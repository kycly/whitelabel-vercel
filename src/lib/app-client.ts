import { redirectToLogout } from "@/auth/cognito-client";
import {
  AppError,
  buildFailureHref,
  resolveInlineAppError,
  resolveProtectedAppError,
  type AppErrorPayload,
} from "@/lib/app-error";

async function readResponsePayload(response: Response): Promise<unknown> {
  const raw = await response.text();

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}

function extractErrorPayload(payload: unknown): AppErrorPayload {
  if (!payload || typeof payload !== "object") {
    return {};
  }

  return {
    message: "message" in payload && typeof payload.message === "string" ? payload.message : undefined,
    code: "code" in payload && typeof payload.code === "string" ? payload.code : undefined,
  };
}

type RequestJsonOptions = {
  errorResolver: (params: { status: number; code?: string; message?: string }) => AppError;
};

async function requestJson<T>(input: RequestInfo | URL, init: RequestInit, options: RequestJsonOptions): Promise<T> {
  const response = await fetch(input, init);
  const payload = await readResponsePayload(response);

  if (!response.ok) {
    const errorPayload = extractErrorPayload(payload);
    throw options.errorResolver({
      status: response.status,
      code: errorPayload.code,
      message: errorPayload.message,
    });
  }

  return payload as T;
}

export async function requestProtectedJson<T>(
  input: RequestInfo | URL,
  init: RequestInit,
  options: {
    defaultMessage: string;
    defaultFailureCode: string;
    failureCodeMap?: Record<string, string>;
    sessionId?: string;
  },
): Promise<T> {
  return requestJson<T>(input, init, {
    errorResolver: ({ status, code, message }) =>
      resolveProtectedAppError({
        status,
        code,
        message,
        defaultMessage: options.defaultMessage,
        defaultFailureCode: options.defaultFailureCode,
        failureCodeMap: options.failureCodeMap,
        sessionId: options.sessionId,
      }),
  });
}

export async function requestInlineJson<T>(
  input: RequestInfo | URL,
  init: RequestInit,
  options: {
    defaultMessage: string;
  },
): Promise<T> {
  return requestJson<T>(input, init, {
    errorResolver: ({ status, code, message }) =>
      resolveInlineAppError({
        status,
        code,
        message,
        defaultMessage: options.defaultMessage,
      }),
  });
}

export function handleAppError(error: unknown): boolean {
  if (!(error instanceof AppError) || typeof window === "undefined") {
    return false;
  }

  if (error.action === "logout") {
    redirectToLogout();
    return true;
  }

  if (error.action === "redirect-access-denied") {
    window.location.replace("/access-denied");
    return true;
  }

  if (error.action === "redirect-failure") {
    window.location.replace(
      buildFailureHref({
        sessionId: error.sessionId,
        code: error.failureCode ?? error.code,
        message: error.message,
      }),
    );
    return true;
  }

  return false;
}