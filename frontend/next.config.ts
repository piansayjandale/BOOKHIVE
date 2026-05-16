import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  serverExternalPackages: ["pg"], // Example for database drivers if needed in server actions
  allowedDevOrigins: ["192.168.1.28", "localhost:3000"],
  devIndicators: {
    position: "bottom-left",
  },
};

export default nextConfig;
