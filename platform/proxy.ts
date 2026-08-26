// Route protection. Next.js 16 renamed the middleware convention to `proxy`
// (Node.js runtime, not Edge). The full auth config uses Node-only modules
// (pg, bcryptjs), which is fine here since proxy runs on Node.
//
// This is defense-in-depth: every protected page also calls auth()/requireTenant()
// server-side. The matcher keeps the proxy off public routes and static assets.
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canWrite, isRole } from "@/lib/rbac";
import { visibleToUser } from "@/lib/engagement-access";

/**
 * Routes that must stay reachable without a session. They still receive the
 * security headers — a Content-Security-Policy is worth least on the pages an
 * attacker can reach without signing in first.
 */
const PUBLIC = ["/login", "/terms", "/privacy", "/api/auth", "/api/email/inbound"];
const isPublic = (path: string) =>
  path === "/" || PUBLIC.some((p) => path === p || path.startsWith(`${p}/`));

/**
 * Security headers, with a per-request nonce for the Content-Security-Policy.
 *
 * script-src carries the nonce plus 'strict-dynamic', so the chunks Next loads
 * from its own bootstrap are allowed while an injected <script> is not — the
 * attacker would have to guess a fresh random value. style-src keeps
 * 'unsafe-inline' deliberately: 52 components set React `style` attributes,
 * which CSP governs as inline styles, and style injection is a far smaller
 * prize than script execution. 'unsafe-eval' is development-only, where React
 * uses eval to rebuild server stacks.
 */
function securityHeaders(nonce: string): Record<string, string> {
  const dev = process.env.NODE_ENV === "development";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");

  return {
    "Content-Security-Policy": csp,
    // frame-ancestors covers modern browsers; this covers the rest.
    "X-Frame-Options": "DENY",
    // An uploaded file must never be re-interpreted as script by sniffing.
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Permitted-Cross-Domain-Policies": "none",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    // The site is HTTPS-only behind Cloudflare; two years, subdomains included.
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  };
}

/** Continue to the route, carrying the nonce forward and the headers back. */
function proceed(req: Parameters<Parameters<typeof auth>[0]>[0], nonce: string): NextResponse {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  for (const [k, v] of Object.entries(securityHeaders(nonce))) res.headers.set(k, v);
  return res;
}

/**
 * Build a redirect carrying the security headers.
 *
 * Constructed rather than decorated: Response.redirect() returns a response
 * whose headers are IMMUTABLE, so setting one throws "TypeError: immutable" and
 * the route 500s. That is what happened to every unauthenticated request to a
 * protected page after the first version of this file shipped.
 */
function redirectTo(url: URL, nonce: string): Response {
  return new NextResponse(null, {
    status: 307,
    headers: { Location: url.toString(), ...securityHeaders(nonce) },
  });
}

/** Build a refusal carrying the security headers, for the same reason. */
function refuse(body: string, status: number, nonce: string): Response {
  return new NextResponse(body, { status, headers: securityHeaders(nonce) });
}

export const proxy = auth(async (req) => {
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const path = req.nextUrl.pathname;
  // Public routes get the headers and none of the session rules.
  if (isPublic(path)) return proceed(req, nonce);

  const isApi = path.startsWith("/api/");
  if (!req.auth) {
    // API routes return their own 401; pages redirect to login.
    if (isApi) return proceed(req, nonce);
    const loginUrl = new URL("/login", req.nextUrl.origin);
    // A session cookie that no longer resolves means the jwt callback refused
    // it — the membership went, the account was suspended, or the password
    // changed. Say so, rather than presenting a blank login form to someone who
    // believes they are signed in.
    const hadSession = req.cookies.getAll().some((c) => c.name.includes("authjs.session-token"));
    if (hadSession) loginUrl.searchParams.set("error", "session-ended");
    return redirectTo(loginUrl, nonce);
  }
  // An account still holding its system-generated temporary password gets
  // nowhere until it sets its own (Phase 0 item 1). Checked before the portal
  // rules so a client_user with a temporary password is confined too.
  if (req.auth.user?.mustChangePassword) {
    const onChange = req.nextUrl.pathname.startsWith("/change-password");
    if (isApi) return refuse("Password change required", 403, nonce);
    if (!onChange) return redirectTo(new URL("/change-password", req.nextUrl.origin), nonce);
    return proceed(req, nonce);
  }

  // A role that may not write must not reach a mutation, whichever surface it
  // arrives on. There are two: a non-GET request to an API tree, and a Server
  // Action — which posts to the URL of the page that rendered it and is
  // identified by the Next-Action header, not by its path. Checking here covers
  // both without depending on 29 route handlers and 19 action files each
  // remembering to check. The lib layer checks again (requireWrite); this is the
  // outer boundary, not the only one.
  const role = req.auth.user?.role;
  const isServerAction = req.method === "POST" && req.headers.has("next-action");
  const isMutation = isServerAction || (isApi && !["GET", "HEAD", "OPTIONS"].includes(req.method));
  // The portal is a client_user's own surface and has actions of its own (PBC
  // upload). Which of them they may call is decided by requirePortalUser() in
  // the lib layer — path alone cannot tell one action id from another.
  const ownPortalAction = role === "client_user" && req.nextUrl.pathname.startsWith("/portal");
  if (isMutation && role && !canWrite(role) && !ownPortalAction) {
    if (isApi) return refuse("Forbidden", 403, nonce);
    // A page-level Server Action: send the refusal back through the same
    // ?error= channel the actions already use, so the user sees a message.
    const url = new URL(req.nextUrl.pathname, req.nextUrl.origin);
    url.searchParams.set("error", "read-only-role");
    return redirectTo(url, nonce);
  }

  // Engagement-level access for the API. app/engagements/[id]/layout.tsx gates
  // the ~30 PAGES, but 20 route handlers under /api/engagements/[id] sit
  // outside it and none checked for itself — so the id in the URL was enough to
  // read or write another team's file through the API. Enforced here rather
  // than in each handler: one place, and a route added later inherits it
  // instead of having to remember.
  const engagementMatch = /^\/api\/engagements\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/|$)/.exec(path);
  if (engagementMatch) {
    const user = req.auth.user;
    const userRole = user?.role;
    // Partners and firm admins short-circuit without a query.
    if (user?.tenantId && user.id && userRole && isRole(userRole)) {
      const allowed = await visibleToUser(engagementMatch[1], user.tenantId, user.id, userRole)
        // A database problem must not silently open the door.
        .catch(() => false);
      if (!allowed) return refuse("Forbidden", 403, nonce);
    }
  }

  // Portal users never see the audit file (spec §2.3): firm routes redirect
  // to the portal, firm APIs are refused outright, and firm users have no
  // business on the portal.
  const isClientUser = req.auth.user?.role === "client_user";
  const onPortal = req.nextUrl.pathname.startsWith("/portal");
  if (isClientUser && isApi) {
    return refuse("Forbidden", 403, nonce);
  }
  if (isClientUser && !onPortal) {
    return redirectTo(new URL("/portal", req.nextUrl.origin), nonce);
  }
  if (!isClientUser && onPortal) {
    return redirectTo(new URL("/dashboard", req.nextUrl.origin), nonce);
  }
  return proceed(req, nonce);
});

/*
 * Every authenticated page tree and every API tree is listed here — closes
 * assurance finding C2, where only /api/engagements was matched and
 * /api/attachments, /api/documents, /api/steps, /api/probe and
 * /api/notifications reached their handlers with no portal-user check at all.
 *
 * Deliberately NOT matched (they must stay reachable without a session):
 *   /                    marketing/landing page
 *   /login               the sign-in page itself
 *   /api/auth/*          NextAuth's own endpoints — matching them would make
 *                        signing in depend on already being signed in
 *   /api/email/inbound   the inbound-mail webhook, authenticated by its own
 *                        shared secret rather than by a session
 *
 * A `:path*` suffix matches zero or more segments, so each entry covers the
 * bare route as well as everything beneath it. ADD A LINE HERE FOR EVERY NEW
 * app/<tree> AND app/api/<tree>: the routes below carry their own role checks,
 * but a tree missing from this list is a tree with no proxy-level check at all.
 */
export const config = {
  // Everything except Next's own static output and file-like requests. The
  // security headers must reach every document, including the landing page and
  // /login — a Content-Security-Policy is worth least on the pages an attacker
  // can reach without signing in. The route rules inside the proxy still apply
  // only to non-public paths; see PUBLIC above.
  matcher: ["/((?!_next/static|_next/image|favicon[.]ico|.*[.][^/]+$).*)"],
};
