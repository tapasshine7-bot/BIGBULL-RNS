import { describe, expect, it } from "vitest";
import { ownerControlPage } from "./owner-control-page";

describe("ownerControlPage", () => {
  const page = ownerControlPage();

  it("uses the existing authenticated Tool Manager API endpoints", () => {
    expect(page).toContain("/api/admin");
    expect(page).toContain("/tools/reorder");
    expect(page).toContain("method: 'DELETE'");
  });

  it("does not embed passwords, credentials, or tool data in the owner page", () => {
    expect(page).not.toContain("ADMIN_PASSWORD");
    expect(page).not.toContain("password_hash");
    expect(page).toContain('type="password"');
  });

  it("provides an explicit owner-only permanent removal action", () => {
    expect(page).toContain("Permanently remove");
    expect(page).toContain("Remove");
  });
});
