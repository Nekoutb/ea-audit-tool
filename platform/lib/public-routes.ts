/**
 * Which paths are reachable without a session.
 *
 * Kept out of proxy.ts, which imports next-auth and so cannot be loaded by a
 * unit test — the policy is a list, and a list that decides what an anonymous
 * visitor can open deserves to be stated somewhere a test can read it.
 *
 * /api/version answers "which commit is this?", the deploy pipeline's proof
 * that the public site serves what it just deployed.
 *
 * /invite is public by necessity: it is where a new colleague chooses their
 * first password, so by definition they have no session yet. It is not
 * unguarded — the page refuses anything but a live, unspent, unexpired token,
 * and holding one sets a password rather than opening an audit file.
 */
export const PUBLIC_ROUTES = [
  "/login",
  "/invite",
  "/terms",
  "/privacy",
  "/api/auth",
  "/api/email/inbound",
  "/api/version",
  "/version",
] as const;

/**
 * Segment-aware: "/login" matches "/login" and "/login/anything", but never
 * "/logins". Prefix matching without the boundary would open paths nobody
 * listed.
 */
export const isPublic = (path: string): boolean =>
  path === "/" || PUBLIC_ROUTES.some((p) => path === p || path.startsWith(`${p}/`));
