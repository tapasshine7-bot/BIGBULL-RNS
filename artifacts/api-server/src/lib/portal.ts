type PartnerTool = {
  id: string;
  name: string;
  url: string;
  description: string;
  status: string;
  category: string;
  isFree: boolean;
};

export const BIO_TOOL_URL = "https://cheatignite.xyz/";

const defaultTools: Array<PartnerTool> = [
  {
    id: "ff-bind",
    name: "FF Bind Tool",
    url: "https://freefirebind.vercel.app/",
    description: "A focused binding utility for Free Fire players.",
    status: "online",
    category: "PLAYER TOOLS",
    isFree: true,
  },
  {
    id: "ff-emote",
    name: "FF Emote Tool",
    url: "https://ffemote.pro",
    description: "Unlock the right emote workflow in seconds.",
    status: "online",
    category: "PLAYER TOOLS",
    isFree: true,
  },
  {
    id: "ff-likes",
    name: "FF Likes Tool",
    url: "https://fflikes.us.cc",
    description: "A quick launch point for the likes utility.",
    status: "online",
    category: "PLAYER TOOLS",
    isFree: true,
  },
  {
    id: "all-in-one",
    name: "All-in-One Tool",
    url: "https://fflevel.in",
    description: "A broad utility hub for everyday player tasks.",
    status: "online",
    category: "NETWORK",
    isFree: true,
  },
  {
    id: "reseller",
    name: "Reseller Panel",
    url: "https://reseller.fflevel.in",
    description: "A direct route to the reseller control surface.",
    status: "online",
    category: "NETWORK",
    isFree: true,
  },
  {
    id: "glory",
    name: "Glory Tool",
    url: "https://www.ffglory.in",
    description: "A fast access point for the Glory utility.",
    status: "online",
    category: "PLAYER TOOLS",
    isFree: true,
  },
  {
    id: "gift",
    name: "Gift Tool",
    url: "https://ffgift.pro",
    description: "Open the gifting utility from one clean card.",
    status: "online",
    category: "PLAYER TOOLS",
    isFree: true,
  },
  {
    id: "bio",
    name: "Bio Tool",
    url: BIO_TOOL_URL,
    description: "A free profile bio utility, ready when you are.",
    status: "online",
    category: "FREE TOOL",
    isFree: true,
  },
];

const publicActivity = [
  {
    id: 'activity-gateway',
    action: 'Gateway initialized',
    detail: 'The public player gateway is ready.',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  },
  {
    id: 'activity-network',
    action: 'Partner network checked',
    detail: 'All registered partner tools are available for launch.',
    createdAt: new Date('2026-01-01T00:01:00.000Z'),
  },
  {
    id: 'activity-vip',
    action: 'VIP Hub connected',
    detail: 'Free partner access is active.',
    createdAt: new Date('2026-01-01T00:02:00.000Z'),
  },
];

const publicPlayer = {
  id: 'public-player',
  displayName: 'VIP PLAYER',
  joinedAt: '2026-01-01T00:00:00.000Z',
  vipAccess: true,
};

export async function listPartnerTools(): Promise<PartnerTool[]> {
  return defaultTools;
}

export async function listActivity(limit = 8) {
  return publicActivity.slice(0, limit);
}

export function activityCount(): number {
  return publicActivity.length;
}

export function activeSessionCount(): number {
  return 1;
}

export function publicUser(activityTotal: number) {
  return { ...publicPlayer, activityCount: activityTotal };
}

export function toolResponse(tool: PartnerTool) {
  return {
    id: tool.id,
    name: tool.name,
    url: tool.url,
    description: tool.description,
    status: tool.status as "online" | "checking" | "warning" | "offline",
    category: tool.category,
    isFree: tool.isFree,
  };
}

type LiveToolStatus = {
  id: string;
  name: string;
  url: string;
  status: "online" | "checking" | "warning" | "offline";
  latencyMs: number;
  detail: string;
};

const LIVE_CHECK_TIMEOUT_MS = 5_000;

async function checkPartnerTool(tool: PartnerTool): Promise<LiveToolStatus> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LIVE_CHECK_TIMEOUT_MS);

  try {
    const response = await fetch(tool.url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        accept: "text/html,application/xhtml+xml,*/*;q=0.8",
        "user-agent": "RVRSED-BIGBULL-Live-Status/1.0",
      },
    });
    const latencyMs = Date.now() - startedAt;
    const status = response.ok
      ? "online"
      : response.status >= 500
        ? "offline"
        : "warning";

    return {
      id: tool.id,
      name: tool.name,
      url: tool.url,
      status,
      latencyMs,
      detail: `HTTP ${response.status}`,
    };
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    const timedOut = error instanceof DOMException && error.name === "AbortError";
    return {
      id: tool.id,
      name: tool.name,
      url: tool.url,
      status: "offline",
      latencyMs,
      detail: timedOut ? "Request timed out" : "Connection failed",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function liveStatusPayload() {
  const tools = await listPartnerTools();
  const statuses = await Promise.all(tools.map(checkPartnerTool));
  return {
    checkedAt: new Date().toISOString(),
    statuses,
  };
}