import type { NextConfig } from "next";

// Il browser deve parlare solo con questo dominio (Next.js) e mai direttamente
// col backend Express, altrimenti il cookie di sessione impostato dal login
// (dominio backend) non sarebbe visibile ai Server Component in produzione
// (Vercel vs Render). Vedi lib/api.ts e lib/api.server.ts.
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4200";

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND_URL}/:path*` }];
  },
};

export default nextConfig;
