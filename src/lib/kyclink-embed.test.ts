import { describe, expect, it } from "vitest";
import {
  createParentOriginHandshakeMessage,
  PARENT_ORIGIN_HANDSHAKE_MESSAGE_TYPE,
  resolveKyclinkOrigin,
} from "@/lib/kyclink-embed";

describe("kyclink embed helpers", () => {
  it("construit le message de handshake parent-origin", () => {
    expect(createParentOriginHandshakeMessage("sess_1")).toEqual({
      type: PARENT_ORIGIN_HANDSHAKE_MESSAGE_TYPE,
      sessionId: "sess_1",
    });
  });

  it("extrait l origin KycLink depuis l URL de session", () => {
    expect(
      resolveKyclinkOrigin(
        "https://link.kycly.io/s/sess_1?cs=12345678-1234-4234-8234-123456789abc",
      ),
    ).toBe("https://link.kycly.io");
  });
});