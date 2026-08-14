import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["ts-morph", "typescript", "postgres", "octokit"],
};

export default nextConfig;
