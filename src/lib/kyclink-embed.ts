export const PARENT_ORIGIN_HANDSHAKE_MESSAGE_TYPE = "kyclink:parent-origin:init";

export function createParentOriginHandshakeMessage(sessionId: string): {
  type: typeof PARENT_ORIGIN_HANDSHAKE_MESSAGE_TYPE;
  sessionId: string;
} {
  return {
    type: PARENT_ORIGIN_HANDSHAKE_MESSAGE_TYPE,
    sessionId,
  };
}

export function resolveKyclinkOrigin(kyclinkUrl: string): string {
  return new URL(kyclinkUrl).origin;
}