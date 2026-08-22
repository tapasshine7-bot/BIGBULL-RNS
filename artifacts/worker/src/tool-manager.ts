export type ToolPlacement = "dashboard" | "vip";

export interface ManagedToolRow {
  id: string;
  name: string;
  url: string;
  logo_url: string | null;
  description: string;
  placement: ToolPlacement;
  enabled: number;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface ToolInput {
  name: string;
  url: string;
  logoUrl: string | null;
  description: string;
  placement: ToolPlacement;
  enabled: boolean;
}

const DISALLOWED_HOSTS = new Set(["ffpanels.in", "www.ffpanels.in"]);

export const TOOL_MANAGER_SCHEMA = `CREATE TABLE IF NOT EXISTS managed_tools (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  logo_url TEXT,
  description TEXT NOT NULL DEFAULT '',
  placement TEXT NOT NULL CHECK (placement IN ('dashboard', 'vip')),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  position INTEGER NOT NULL DEFAULT 100,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`;

function cleanText(value: unknown, limit: number): string {
  return typeof value === "string" ? value.replace(/[<>]/g, "").trim().slice(0, limit) : "";
}

function validateHttpsUrl(value: unknown, field: string, optional = false): { value: string | null; error?: string } {
  const raw = cleanText(value, 900);
  if (!raw && optional) return { value: null };
  if (!raw) return { value: null, error: `${field} is required` };
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:") return { value: null, error: `${field} must use HTTPS` };
    if (DISALLOWED_HOSTS.has(parsed.hostname.toLowerCase())) return { value: null, error: "This destination cannot be listed" };
    return { value: parsed.toString() };
  } catch {
    return { value: null, error: `${field} must be a valid HTTPS URL` };
  }
}

export function validateToolInput(value: unknown, defaults?: Partial<ToolInput>): { input?: ToolInput; error?: string } {
  const body = (value ?? {}) as Record<string, unknown>;
  const name = cleanText(body.name ?? defaults?.name, 80);
  const description = cleanText(body.description ?? defaults?.description, 240);
  const url = validateHttpsUrl(body.url ?? defaults?.url, "Website link");
  const logo = validateHttpsUrl(body.logoUrl ?? body.logo_url ?? defaults?.logoUrl, "Logo image link", true);
  const placementRaw = body.placement ?? defaults?.placement;
  const placement: ToolPlacement = placementRaw === "vip" ? "vip" : "dashboard";
  const enabledRaw = body.enabled;
  const enabled = typeof enabledRaw === "boolean" ? enabledRaw : (defaults?.enabled ?? true);
  if (!name) return { error: "Tool name is required" };
  if (url.error) return { error: url.error };
  if (logo.error) return { error: logo.error };
  return { input: { name, url: url.value!, logoUrl: logo.value, description, placement, enabled } };
}

export function safeToolId(value: unknown): string {
  return cleanText(value, 64).toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

export function toPublicTool(row: ManagedToolRow) {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    description: row.description,
    status: "online" as const,
    category: row.placement === "vip" ? "VIP Hub" : "Dashboard",
    isFree: true,
    placement: row.placement,
    logoUrl: row.logo_url,
  };
}
