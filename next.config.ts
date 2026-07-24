import type { NextConfig } from "next";

const config: NextConfig = {
  // Photos come straight from Supabase Storage's public URL.
  images: { remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }] },
  // No bodySizeLimit override: /api/capture is a route handler, not a Server
  // Action, so `serverActions.bodySizeLimit` never applied to it. The real
  // ceiling is Vercel's 4.5 MB request-body cap, and resize.ts shrinks every
  // upload to 1600px (hundreds of KB) well under it before it leaves the phone.
};

export default config;
