import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/eaaf-automation",
  env: {
    NEXT_PUBLIC_BASE_PATH: "/eaaf-automation",
  },
};

export default nextConfig;
