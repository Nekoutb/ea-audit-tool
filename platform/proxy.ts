// Route protection. Next.js 16 renamed the middleware convention to `proxy`
// (Node.js runtime, not Edge). The full auth config uses Node-only modules
// (pg, bcryptjs), which is fine here since proxy runs on Node.
//
// This is defense-in-depth: every protected page also calls auth()/requireTenant()
// server-side. The matcher keeps the proxy off public routes and static assets.
import { auth } from "@/auth";

export const proxy = auth((req) => {
  const isApi = req.nextUrl.pathname.startsWith("/api/");
  if (!req.auth) {
    // API routes return their own 401; pages redirect to login.
    if (isApi) return;
    const loginUrl = new URL("/login", req.nextUrl.origin);
    return Response.redirect(loginUrl);
  }
  // An account still holding its system-generated temporary password gets
  // nowhere until it sets its own (Phase 0 item 1). Checked before the portal
  // rules so a client_user with a temporary password is confined too.
  if (req.auth.user?.mustChangePassword) {
    const onChange = req.nextUrl.pathname.startsWith("/change-password");
    if (isApi) return new Response("Password change required", { status: 403 });
    if (!onChange) return Response.redirect(new URL("/change-password", req.nextUrl.origin));
    return;
  }

  // Portal users never see the audit file (spec §2.3): firm routes redirect
  // to the portal, firm APIs are refused outright, and firm users have no
  // business on the portal.
  const isClientUser = req.auth.user?.role === "client_user";
  const onPortal = req.nextUrl.pathname.startsWith("/portal");
  if (isClientUser && isApi) {
    return new Response("Forbidden", { status: 403 });
  }
  if (isClientUser && !onPortal) {
    return Response.redirect(new URL("/portal", req.nextUrl.origin));
  }
  if (!isClientUser && onPortal) {
    return Response.redirect(new URL("/dashboard", req.nextUrl.origin));
  }
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
  matcher: [
    // Authenticated pages.
    "/admin/:path*",
    "/change-password/:path*",
    "/clients/:path*",
    "/dashboard/:path*",
    "/documents/:path*",
    "/engagements/:path*",
    "/independence/:path*",
    "/new-engagement/:path*",
    "/notifications/:path*",
    "/portal/:path*",
    "/resources/:path*",
    "/settings/:path*",
    "/templates/:path*",
    "/users/:path*",
    // API trees.
    "/api/attachments/:path*",
    "/api/documents/:path*",
    "/api/engagements/:path*",
    "/api/notifications/:path*",
    "/api/probe/:path*",
    "/api/steps/:path*",
  ],
};
