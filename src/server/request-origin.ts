const DEFAULT_HTTPS_PROTOCOL = "https";

function firstHeaderValue(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const [first] = value.split(",");
  const normalized = first?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
}

function normalizeOrigin(value: string): string {
  return new URL(value).origin;
}

function originFromForwardedHeaders(headers: Headers): string | null {
  const forwardedHost = firstHeaderValue(headers.get("x-forwarded-host"));

  if (!forwardedHost) {
    return null;
  }

  const forwardedProto = firstHeaderValue(headers.get("x-forwarded-proto")) ?? DEFAULT_HTTPS_PROTOCOL;
  return normalizeOrigin(`${forwardedProto}://${forwardedHost}`);
}

function originFromHostHeader(headers: Headers): string | null {
  const host = firstHeaderValue(headers.get("host"));

  if (!host) {
    return null;
  }

  return normalizeOrigin(`${DEFAULT_HTTPS_PROTOCOL}://${host}`);
}

export function resolveParentOrigin(request: Request, options?: { canonicalOrigin?: string | null }): string {
  const canonicalOrigin = options?.canonicalOrigin?.trim();

  if (canonicalOrigin) {
    return normalizeOrigin(canonicalOrigin);
  }

  return (
    originFromForwardedHeaders(request.headers) ??
    originFromHostHeader(request.headers) ??
    normalizeOrigin(new URL(request.url).origin)
  );
}