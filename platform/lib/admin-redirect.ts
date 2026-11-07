/**
 * Where /admin sends an operator, from PLATFORM_ADMIN_URL. Unset, wrong or pointing anywhere else, it is
 * null and /admin opens this tool's own console, as it does today: an environment variable must not be a
 * way to send a signed-in operator to another site.
 */
const ALLOWED_HOST = "platform.auditisa.com";

export function platformAdminUrl(raw: string | undefined = process.env.PLATFORM_ADMIN_URL): string | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.hostname !== ALLOWED_HOST || url.username || url.password || url.port) return null;
  return url.toString();
}
