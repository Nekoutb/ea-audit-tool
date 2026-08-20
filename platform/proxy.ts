// Route protection. Next.js 16 renamed the middleware convention to `proxy`
// (Node.js runtime, not Edge). The full auth config uses Node-only modules
// (pg, bcryptjs), which is fine here since proxy runs on Node.
//
// This is defense-in-depth: every protected page also calls auth()/requireTenant()
// server-side. The matcher keeps the proxy off public routes and static assets.
import { auth } from "@/auth";
import { canWrite } from "@/lib/rbac";

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
    if (isApi) return new Response("Forbidden", { status: 403 });
    // A page-level Server Action: send the refusal back through the same
    // ?error= channel the actions already use, so the user sees a message.
    const url = new URL(req.nextUrl.pathname, req.nextUrl.origin);
    url.searchParams.set("error", "read-only-role");
    return Response.redirect(url);
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
