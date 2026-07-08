import type { NextConfig } from "next";

// Single source of truth — basePath and NEXT_PUBLIC_BASE_PATH are always in sync
const APP_BASE_PATH = "/eaaf-automation";

// *.trycloudflare.com is always allowed — ephemeral tunnel URLs change every session
// so wildcarding the whole domain avoids needing to update TUNNEL_ORIGIN each time.
// Add TUNNEL_ORIGIN in .env.local only if you use a non-trycloudflare tunnel.
const extraOrigins: string[] = (process.env.TUNNEL_ORIGIN ?? "")
  .split(",")
  .map((h) => h.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  basePath: APP_BASE_PATH,

  // Bake NEXT_PUBLIC_BASE_PATH into the bundle so all client fetch() calls
  // use the correct prefix regardless of whether it is set in .env.local
  env: {
    NEXT_PUBLIC_BASE_PATH: APP_BASE_PATH,
  },

  // Allow Next.js dev server to accept requests from tunnel hostnames.
  // Without this, Next 15+ (Turbopack) blocks cross-origin HMR and API requests.
  allowedDevOrigins: ["*.trycloudflare.com", ...extraOrigins],
};

export default nextConfig;
