import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.maersk.com" },
      { protocol: "https", hostname: "**.shipsgo.com" },
    ],
  },
  experimental: {
    serverActions: {
      allowedOrigins: ["trackmycontainer.info", "www.trackmycontainer.info", "localhost:3000"],
    },
  },
};

export default nextConfig;
