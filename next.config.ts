import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Raise the Server Action body cap so PDF uploads above the 1 MB default
      // go through. On Vercel the platform still hard-caps function bodies at
      // ~4.5 MB; locally there is no limit.
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
