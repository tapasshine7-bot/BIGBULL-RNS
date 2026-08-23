import { describe, expect, it } from "vitest";
import { corsResponse } from "./index";

const previewOrigin = "https://bigbull-rns-toolmanager-preview-site.tapasshine7.workers.dev";

describe("preview API CORS", () => {
  it("authorizes the Admin login preflight from the isolated preview site", () => {
    const request = new Request("https://bigbull-rns-api-toolmanager-preview.tapasshine7.workers.dev/api/admin/login", {
      method: "OPTIONS",
      headers: {
        Origin: previewOrigin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
      },
    });

    const response = corsResponse(new Response(null, { status: 204 }), request);

    expect(response.headers.get("access-control-allow-origin")).toBe(previewOrigin);
    expect(response.headers.get("access-control-allow-methods")).toContain("POST");
    expect(response.headers.get("access-control-allow-headers")).toContain("content-type");
  });

  it("does not authorize untrusted origins", () => {
    const request = new Request("https://bigbull-rns-api-toolmanager-preview.tapasshine7.workers.dev/api/admin/login", {
      method: "OPTIONS",
      headers: { Origin: "https://untrusted.example" },
    });

    const response = corsResponse(new Response(null, { status: 204 }), request);

    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });
});
