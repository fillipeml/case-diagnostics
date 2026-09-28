import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // native-ish server packages stay outside the bundler
  serverExternalPackages: ["mysql2", "unpdf"],
};

export default nextConfig;
