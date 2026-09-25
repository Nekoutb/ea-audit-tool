import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Next 16's proxy caps request bodies at 10 MB by default, so an upload
    // between 10 MB and the advertised 25 MB (60 MB for data imports) died in
    // formData() with a 500 after a long wait (UAT B25). The route handlers
    // enforce the real per-route limits; Apache's LimitRequestBody must allow
    // the same on the servers.
    proxyClientMaxBodySize: "61mb",
  },
};

export default nextConfig;
