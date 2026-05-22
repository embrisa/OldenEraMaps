const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://oldeneramaps.vercel.app",
  "https://oldeneramaps.com",
  "https://www.oldeneramaps.com"
];

export function buildEdgeFunctionCorsHeaders(
  origin: string | null | undefined,
  requestedHeaders: string | null | undefined,
  allowedOrigins = readAllowedOrigins()
): Record<string, string> {
  const normalizedOrigin = origin?.trim();
  const allowOrigin = normalizedOrigin && isAllowedOrigin(normalizedOrigin, allowedOrigins)
    ? normalizedOrigin
    : "null";

  return {
    "access-control-allow-origin": allowOrigin,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": requestedHeaders ?? "authorization, x-client-info, apikey, content-type",
    "access-control-max-age": "86400",
    vary: "Origin, Access-Control-Request-Headers",
  };
}

function isAllowedOrigin(origin: string, allowedOrigins: readonly string[]): boolean {
  if (allowedOrigins.includes(origin)) return true;
  try {
    const parsed = new URL(origin);
    return parsed.protocol === "https:"
      && parsed.hostname.endsWith(".vercel.app")
      && (parsed.hostname.startsWith("oldeneramaps-") || parsed.hostname.startsWith("olden-era-maps-"));
  } catch {
    return false;
  }
}

function readAllowedOrigins(): string[] {
  const configured = readDenoEnv("OLDEN_ERA_ALLOWED_ORIGINS");
  if (!configured) return DEFAULT_ALLOWED_ORIGINS;
  return configured
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function readDenoEnv(name: string): string | undefined {
  const deno = (globalThis as { Deno?: { env?: { get(name: string): string | undefined } } }).Deno;
  return deno?.env?.get(name);
}
