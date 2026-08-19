// RNS BIGBULL public portal Worker.
// Public endpoints are open (no payment system). Admin endpoints live under /api/admin.

import { handleAdmin, handleBanner } from "./admin";

export interface Env {
  db: D1Database;
}

interface ToolRow {
  id: string;
  name: string;
  url: string;
  description: string;
  category: string;
  is_free: number;
  enabled: number;
}

interface Tool {
  id: string;
  name: string;
  url: string;
  description: string;
  status: string;
  category: string;
  isFree: boolean;
}

const ALLOWED_ORIGINS = ["https://rnsbigbull.site", "https://www.rnsbigbull.site", "https://rnsbigbull-site.pages.dev"];

function allowedOrigin(request: Request): string | null {
  const origin = request.headers.get("Origin") ?? "";
  return ALLOWED_ORIGINS.includes(origin) ? origin : null;
}

function corsResponse(response: Response, request: Request): Response {
  const origin = allowedOrigin(request);
  if (origin) {
    response.headers.set("access-control-allow-origin", origin);
    response.headers.set("access-control-allow-credentials", "true");
    response.headers.set("vary", "Origin");
  }
  return response;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function toolToPublic(tool: ToolRow): Tool {
  return {
    id: tool.id,
    name: tool.name,
    url: tool.url,
    description: tool.description,
    status: "online",
    category: tool.category,
    isFree: tool.is_free === 1,
  };
}

async function listTools(db: D1Database, freeOnly = false): Promise<ToolRow[]> {
  const base = freeOnly
    ? db.prepare("SELECT * FROM tool_registry WHERE enabled = 1 AND is_free = 1 ORDER BY id")
    : db.prepare("SELECT * FROM tool_registry WHERE enabled = 1 ORDER BY id");
  const { results } = await base.all<ToolRow>();
  return results ?? [];
}

interface ToolStatus {
  id: string;
  status: "online" | "offline";
  latencyMs: number | null;
  checkedAt: string;
}

async function probeTool(tool: ToolRow): Promise<ToolStatus> {
  const checkedAt = new Date().toISOString();
  const start = Date.now();
  try {
    const response = await fetch(tool.url, { method: "HEAD", redirect: "manual" });
    const ok = response.status < 500;
    return { id: tool.id, status: ok ? "online" : "offline", latencyMs: Date.now() - start, checkedAt };
  } catch {
    return { id: tool.id, status: "offline", latencyMs: null, checkedAt };
  }
}

async function probeAll(tools: ToolRow[]): Promise<{ checkedAt: string; statuses: ToolStatus[] }> {
  const checkedAt = new Date().toISOString();
  const statuses = await Promise.all(tools.map(probeTool));
  return { checkedAt, statuses };
}

function publicActivity(limit: number): { id: string; action: string; detail: string; createdAt: string }[] {
  return [
    { id: "activity-gateway", action: "Gateway initialized", detail: "The public player gateway is ready.", createdAt: "2026-01-01T00:00:00.000Z" },
    { id: "activity-network", action: "Partner network checked", detail: "All registered partner tools are available for launch.", createdAt: "2026-01-01T00:01:00.000Z" },
    { id: "activity-vip", action: "VIP Hub connected", detail: "Free partner access is active.", createdAt: "2026-01-01T00:02:00.000Z" },
  ].slice(0, limit);
}

// ---- Route handlers --------------------------------------------------------

async function handleGateway(db: D1Database): Promise<Response> {
  const tools = await listTools(db);
  const health = await probeAll(tools);
  return jsonResponse(200, {
    user: { id: "public-player", displayName: "VIP PLAYER", joinedAt: "2026-01-01T00:00:00.000Z", vipAccess: true, activityCount: 3 },
    stats: {
      totalTools: tools.length,
      onlineTools: health.statuses.filter((s) => s.status === "online").length,
      activeSessions: 1,
    },
    tools: tools.map(toolToPublic),
    recentActivity: publicActivity(3),
  });
}

async function handleVipHub(db: D1Database): Promise<Response> {
  const tools = await listTools(db);
  const health = await probeAll(tools);
  const statusById = new Map(health.statuses.map((s) => [s.id, s.status]));
  return jsonResponse(200, {
    user: { id: "public-player", displayName: "VIP PLAYER", joinedAt: "2026-01-01T00:00:00.000Z", vipAccess: true },
    stats: {
      totalTools: tools.length,
      onlineTools: health.statuses.filter((s) => s.status === "online").length,
      activeSessions: 1,
    },
    tools: tools.map((tool) => ({ ...toolToPublic(tool), status: statusById.get(tool.id) ?? "online" })),
    recentActivity: [],
  });
}

async function handleBio(db: D1Database): Promise<Response> {
  const tools = await listTools(db, true);
  const bio = tools.find((tool) => tool.id === "bio");
  if (!bio) return jsonResponse(500, { error: "Bio tool not configured." });
  return jsonResponse(200, toolToPublic(bio));
}

async function handleLiveStatus(db: D1Database): Promise<Response> {
  const tools = await listTools(db);
  return jsonResponse(200, await probeAll(tools));
}

async function handleActivity(): Promise<Response> {
  return jsonResponse(200, publicActivity(50));
}

// ---- Entry -----------------------------------------------------------------

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return corsResponse(new Response(null, { status: 204 }), request);
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/api/, "");

    try {
      if (path === "/healthz") return corsResponse(jsonResponse(200, { status: "ok" }), request);
      if (path === "/gateway") return corsResponse(await handleGateway(env.db), request);
      if (path === "/vip") return corsResponse(await handleVipHub(env.db), request);
      if (path === "/bio") return corsResponse(await handleBio(env.db), request);
      if (path === "/live-status") return corsResponse(await handleLiveStatus(env.db), request);
      if (path === "/activity") return corsResponse(await handleActivity(), request);
      if (path.startsWith("/admin")) return corsResponse(await handleAdmin(env.db, request, path.slice("/admin".length)), request);
      if (path === "/banner") return await handleBanner(env.db, request);
      return jsonResponse(404, { error: "Route not found" });
    } catch (error) {
      const message = (error as { message?: string }).message ?? "Internal error";
      console.error("Worker error", message);
      return corsResponse(jsonResponse(502, { error: message }), request);
    }
  },
};
