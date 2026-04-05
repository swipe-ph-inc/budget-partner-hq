import { describe, expect, it } from "vitest";
import { isPublicPath, shouldRedirectAuthenticatedUserToDashboard } from "./public-paths";

describe("isPublicPath", () => {
  it("allows legal exact paths (root / redirects in-app, not public marketing)", () => {
    expect(isPublicPath("/")).toBe(false);
    expect(isPublicPath("/terms")).toBe(true);
    expect(isPublicPath("/refund-policy")).toBe(true);
  });

  it("allows auth flows and webhooks", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/signup")).toBe(true);
    expect(isPublicPath("/auth/callback")).toBe(true);
    expect(isPublicPath("/auth/google")).toBe(true);
    expect(isPublicPath("/api/paymongo/webhook")).toBe(true);
    expect(isPublicPath("/api/cron/process-subscriptions")).toBe(true);
    expect(isPublicPath("/api/health")).toBe(true);
    expect(isPublicPath("/api/ready")).toBe(true);
  });

  it("allows public pricing", () => {
    expect(isPublicPath("/pricing")).toBe(true);
  });

  it("allows SEO and icon routes without auth", () => {
    expect(isPublicPath("/robots.txt")).toBe(true);
    expect(isPublicPath("/sitemap.xml")).toBe(true);
    expect(isPublicPath("/favicon_io/site.webmanifest")).toBe(true);
  });

  it("blocks protected app routes", () => {
    expect(isPublicPath("/dashboard")).toBe(false);
    expect(isPublicPath("/accounts")).toBe(false);
  });
});

describe("shouldRedirectAuthenticatedUserToDashboard", () => {
  it("redirects auth screens only", () => {
    expect(shouldRedirectAuthenticatedUserToDashboard("/login")).toBe(true);
    expect(shouldRedirectAuthenticatedUserToDashboard("/")).toBe(false);
    expect(shouldRedirectAuthenticatedUserToDashboard("/pricing")).toBe(false);
  });
});
