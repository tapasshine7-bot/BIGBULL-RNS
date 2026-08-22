import { describe, expect, it } from "vitest";
import { safeToolId, toPublicTool, validateToolInput, type ManagedToolRow } from "./tool-manager";

describe("owner-managed tool validation", () => {
  it("accepts an owner-approved HTTPS tool link, logo, and VIP placement", () => {
    const result = validateToolInput({
      name: "Creator Notes",
      url: "https://example.com/tool",
      logoUrl: "https://cdn.example.com/creator-notes.png",
      description: "Notes for creators",
      placement: "vip",
      enabled: true,
    });

    expect(result.error).toBeUndefined();
    expect(result.input).toEqual({
      name: "Creator Notes",
      url: "https://example.com/tool",
      logoUrl: "https://cdn.example.com/creator-notes.png",
      description: "Notes for creators",
      placement: "vip",
      enabled: true,
    });
  });

  it("rejects unsafe, malformed, and non-HTTPS destinations", () => {
    expect(validateToolInput({ name: "Invalid", url: "javascript:alert(1)" }).error).toContain("HTTPS");
    expect(validateToolInput({ name: "Invalid", url: "http://example.com" }).error).toContain("HTTPS");
    expect(validateToolInput({ name: "Invalid", url: "https://ffpanels.in" }).error).toContain("cannot be listed");
    expect(validateToolInput({ name: "Invalid", url: "https://example.com", logoUrl: "not-a-url" }).error).toContain("Logo image link");
  });

  it("keeps supported placement values bounded to the public dashboard or VIP Hub", () => {
    expect(validateToolInput({ name: "Workspace", url: "https://example.com", placement: "dashboard" }).input?.placement).toBe("dashboard");
    expect(validateToolInput({ name: "Workspace", url: "https://example.com", placement: "unexpected" }).input?.placement).toBe("dashboard");
  });

  it("produces a safe public card record without audit timestamps or write controls", () => {
    const row: ManagedToolRow = {
      id: "creator-notes",
      name: "Creator Notes",
      url: "https://example.com/tool",
      logo_url: "https://cdn.example.com/creator-notes.png",
      description: "Notes for creators",
      placement: "vip",
      enabled: 1,
      position: 20,
      created_at: "2026-08-22T00:00:00.000Z",
      updated_at: "2026-08-22T00:00:00.000Z",
    };

    expect(toPublicTool(row)).toEqual({
      id: "creator-notes",
      name: "Creator Notes",
      url: "https://example.com/tool",
      description: "Notes for creators",
      status: "online",
      category: "VIP Hub",
      isFree: true,
      placement: "vip",
      logoUrl: "https://cdn.example.com/creator-notes.png",
    });
  });

  it("normalizes tool IDs without allowing path-like segments", () => {
    expect(safeToolId(" Bio Tool / 2026 ")).toBe("bio-tool-2026");
    expect(safeToolId("../../admin")).toBe("admin");
  });
});
