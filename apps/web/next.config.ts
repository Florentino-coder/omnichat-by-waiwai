import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(appDir, "../.."),
  transpilePackages: ["@omnichat/ui"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "stickershop.line-scdn.net"
      }
    ]
  },
  // API calls are proxied by app/api/v1 route handlers (BFF) so HttpOnly
  // session cookies can be translated into Authorization headers upstream.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' http://localhost:* ws://localhost:* https:; font-src 'self' data:; frame-ancestors 'none'"
          }
        ]
      }
    ];
  }
};

export default nextConfig;
