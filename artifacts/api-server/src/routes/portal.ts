import { Router, type IRouter } from "express";
import {
  GetActivityResponse,
  GetBioToolResponse,
  GetGatewayResponse,
  GetLiveStatusResponse,
  GetVipHubResponse,
} from "@workspace/api-zod";
import {
  activeSessionCount,
  activityCount,
  publicUser,
  listActivity,
  listPartnerTools,
  toolResponse,
  liveStatusPayload,
} from "../lib/portal";

const router: IRouter = Router();

async function gatewayPayload() {
  const [tools, recentActivity, countValue, activeSessions] = await Promise.all([
    listPartnerTools(),
    listActivity(8),
    activityCount(),
    activeSessionCount(),
  ]);
  const onlineTools = tools.filter((tool) => tool.status === "online").length;
  return {
    user: publicUser(countValue),
    stats: {
      totalTools: tools.length,
      onlineTools,
      activeSessions,
    },
    tools: tools.map(toolResponse),
    recentActivity: recentActivity.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
    })),
  };
}

router.get("/gateway", async (req, res): Promise<void> => {
  res.json(GetGatewayResponse.parse(await gatewayPayload()));
});

router.get("/vip", async (req, res): Promise<void> => {
  res.json(GetVipHubResponse.parse(await gatewayPayload()));
});

router.get("/bio", async (req, res): Promise<void> => {
  const tools = await listPartnerTools();
  const tool = tools.find((candidate) => candidate.id === "bio");
  if (!tool) {
    res.status(404).json({ error: "Bio Tool unavailable." });
    return;
  }
  res.json(GetBioToolResponse.parse(toolResponse(tool)));
});

router.get("/live-status", async (req, res): Promise<void> => {
  res.json(GetLiveStatusResponse.parse(await liveStatusPayload()));
});

router.get("/activity", async (req, res): Promise<void> => {
  const activity = await listActivity(50);
  res.json(
    GetActivityResponse.parse(
      activity.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
      })),
    ),
  );
});

export default router;