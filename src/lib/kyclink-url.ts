export function withKyclinkOriginDebug(kyclinkUrl: string): string {
  const url = new URL(kyclinkUrl);
  url.searchParams.set("debug_origin", "1");
  return url.toString();
}