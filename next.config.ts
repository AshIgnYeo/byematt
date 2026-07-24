import type { NextConfig } from "next";

const config: NextConfig = {
  // Photos come straight from Supabase Storage's public URL.
  images: { remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }] },
  experimental: {
    // Phone photos are big; the capture route accepts the resized blob.
    serverActions: { bodySizeLimit: "8mb" },
  },
};

export default config;
