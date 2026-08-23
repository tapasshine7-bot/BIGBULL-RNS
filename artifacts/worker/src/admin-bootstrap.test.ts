import { describe, expect, it } from "vitest";
import { canBootstrapCredential } from "./admin";

describe("administrator credential bootstrap", () => {
  it("continues to require all three bootstrap values outside preview mode", () => {
    expect(
      canBootstrapCredential({
        username: "owner",
        password: "strong-preview-password",
      }),
    ).toBe(false);
  });

  it("permits only the isolated preview to initialize from its username and password secrets", () => {
    expect(
      canBootstrapCredential({
        username: "owner",
        password: "strong-preview-password",
        allowGeneratedRecovery: true,
      }),
    ).toBe(true);
  });

  it("permits the fully configured production bootstrap", () => {
    expect(
      canBootstrapCredential({
        username: "owner",
        password: "strong-production-password",
        recovery: "private recovery phrase",
      }),
    ).toBe(true);
  });
});
