import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@angelifeline/core",
    "@angelifeline/react",
    "@angelifeline/next",
  ],
};

export default nextConfig;
