import { describe, expect, it } from "vitest";
import { getAppErrorMessage, resolveProtectedAppError } from "@/lib/app-error";

describe("app-error", () => {
  it("prefers the common UX message for known failure codes", () => {
    expect(getAppErrorMessage("SESSION_NOT_FOUND", "KycLink session not found")).toBe(
      "Cette session est introuvable ou n'est pas accessible pour ce compte.",
    );
  });

  it("maps 401 protected API failures to a logout action", () => {
    const error = resolveProtectedAppError({
      status: 401,
      code: "UNAUTHORIZED",
      message: "Unauthorized.",
      defaultMessage: "Lecture impossible.",
      defaultFailureCode: "SESSION_FETCH_FAILED",
    });

    expect(error.action).toBe("logout");
    expect(error.category).toBe("auth");
    expect(error.code).toBe("UNAUTHORIZED");
  });

  it("maps access denied responses to a dedicated authorization action", () => {
    const error = resolveProtectedAppError({
      status: 403,
      code: "ACCESS_DENIED",
      message: "Access denied for this demo account.",
      defaultMessage: "Lecture impossible.",
      defaultFailureCode: "SESSION_FETCH_FAILED",
    });

    expect(error.action).toBe("redirect-access-denied");
    expect(error.category).toBe("authorization");
  });

  it("maps not found session reads to the canonical failure code", () => {
    const error = resolveProtectedAppError({
      status: 404,
      code: "KYCLINK_SESSION_NOT_FOUND",
      message: "KycLink session not found",
      defaultMessage: "Lecture impossible.",
      defaultFailureCode: "SESSION_FETCH_FAILED",
      failureCodeMap: {
        KYCLINK_SESSION_NOT_FOUND: "SESSION_NOT_FOUND",
      },
      sessionId: "sess_1",
    });

    expect(error.action).toBe("redirect-failure");
    expect(error.failureCode).toBe("SESSION_NOT_FOUND");
    expect(error.sessionId).toBe("sess_1");
  });
});