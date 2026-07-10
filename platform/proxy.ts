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

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/notifications/:path*",
    "/clients/:path*",
    "/engagements/:path*",
    "/documents/:path*",
    "/independence/:path*",
    "/portal/:path*",
    "/api/engagements/:path*",
  ],
};
