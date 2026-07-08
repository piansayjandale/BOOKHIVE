import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  /* config options here */
  serverExternalPackages: ["pg"], // Example for database drivers if needed in server actions
  allowedDevOrigins: ["192.168.1.28", "localhost:3000"],
  devIndicators: {
    position: "bottom-left",
  },
  turbopack: {
    root: path.join(__dirname, ".."),
  },
};

export default nextConfig;
// Force Next.js hard restart to clear stale cache

