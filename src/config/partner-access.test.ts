import { describe, expect, it } from "vitest";
import { buildPartnerAccessHeaders } from "@/config/partner-access";

describe("config/partner-access", () => {
  it("returns Cloudflare Access service-token headers when both credentials are set", () => {
    expect(buildPartnerAccessHeaders("client-id.access", "client-secret")).toEqual({
      "CF-Access-Client-Id": "client-id.access",
      "CF-Access-Client-Secret": "client-secret",
    });
  });

  it("returns no headers when the client id is missing", () => {
    expect(buildPartnerAccessHeaders(undefined, "client-secret")).toEqual({});
    expect(buildPartnerAccessHeaders("", "client-secret")).toEqual({});
  });

  it("returns no headers when the client secret is missing", () => {
    expect(buildPartnerAccessHeaders("client-id.access", undefined)).toEqual({});
    expect(buildPartnerAccessHeaders("client-id.access", "")).toEqual({});
  });

  it("trims surrounding whitespace and ignores whitespace-only values", () => {
    expect(buildPartnerAccessHeaders("  id.access  ", "  secret  ")).toEqual({
      "CF-Access-Client-Id": "id.access",
      "CF-Access-Client-Secret": "secret",
    });
    expect(buildPartnerAccessHeaders("   ", "secret")).toEqual({});
  });
});
