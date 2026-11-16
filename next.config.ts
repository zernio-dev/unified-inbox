import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  devIndicators: false,
  outputFileTracingRoot: path.join(__dirname, "../"),
  async redirects() {
    return [
      {
        source: "/inbox",
        destination: "/",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
