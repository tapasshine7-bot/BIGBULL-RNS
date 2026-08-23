import { describe, expect, it } from "vitest";
import { PREVIEW_BASELINE_TOOL, PREVIEW_PUBLIC_SCHEMA } from "./index";

describe("isolated preview schema baseline", () => {
  it("contains the public tables needed before any owner signs in", () => {
    const sql = PREVIEW_PUBLIC_SCHEMA.join("\n");
    for (const table of [
      "managed_tools",
      "visit_counters",
      "tool_ordering",
      "vip_blocks",
      "vip_members",
      "vip_payments",
      "site_config",
      "announcements",
      "tool_requests",
      "status_history",
    ]) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
  });

  it("uses a harmless approved HTTPS baseline for the Bio Tool", () => {
    expect(PREVIEW_BASELINE_TOOL.id).toBe("bio");
    expect(PREVIEW_BASELINE_TOOL.placement).toBe("dashboard");
    expect(PREVIEW_BASELINE_TOOL.url).toMatch(/^https:\/\//);
    expect(PREVIEW_BASELINE_TOOL.url).not.toContain("ffpanels.in");
  });
});
