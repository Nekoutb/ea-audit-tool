/**
 * The client's IP address, or null when it cannot be trusted.
 *
 * Behind Cloudflare and Apache, every candidate header is attacker-supplied
 * unless the origin refuses connections that do not come from the proxy. Until
 * that is true, reading one is worse than reading none: an attacker sets
 * whatever value evades the throttle, or forges somebody else's to lock them
 * out.
 *
 * So there is exactly one source, named explicitly by CLIENT_IP_HEADER, and no
 * fallback. A fallback defeats the entire point — configuring the "safe" header
 * would still leave a forgeable one being consulted whenever the safe one is
 * absent, which is precisely the request an attacker sends.
 */

export function clientIp(headers: Headers): string | null {
  const name = process.env.CLIENT_IP_HEADER?.trim().toLowerCase();
  if (!name) return null;

  const raw = headers.get(name);
  if (!raw) return null;

  // X-Forwarded-For style: the left-most entry is the client, the rest are
  // proxies. Only meaningful at all because the header is trusted by config.
  const first = raw.split(",")[0]?.trim() ?? "";
  return isIpAddress(first) ? first : null;
}

/** Postgres inet will reject anything malformed, but do not hand it garbage. */
export function isIpAddress(value: string): boolean {
  if (!value || value.length > 45) return false;
  // IPv4
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(value)) {
    return value.split(".").every((part) => Number(part) <= 255);
  }
  // IPv6, including the ::ffff:1.2.3.4 form
  return /^[0-9a-fA-F:]+(\.\d{1,3}){0,3}$/.test(value) && value.includes(":");
}
