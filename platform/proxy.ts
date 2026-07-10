// Route protection. Next.js 16 renamed the middleware convention to `proxy`
// (Node.js runtime, not Edge). The full auth config uses Node-only modules
// (pg, bcryptjs), which is fine here since proxy runs on Node.
//
// This is defense-in-depth: every protected page also calls auth()/requireTenant()
// server-side. The matcher keeps the proxy off public routes and static assets.
import { auth } from "@/auth";

export const proxy = auth((req) => {
  if (!req.auth) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    return Response.redirect(loginUrl);
  }
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/notifications/:path*",
    "/clients/:path*",
    "/engagements/:path*",
    "/documents/:path*",
  ],
};
