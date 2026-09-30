import type { NextConfig } from "next";
import path from "path";

const devOrigins = (
  process.env.ALLOWED_DEV_ORIGINS || "192.168.1.28,localhost:3000"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg"],
  allowedDevOrigins: devOrigins,
  devIndicators: {
    position: "bottom-left",
  },
  turbopack: {
    root: path.join(__dirname, ".."),
  },
  async headers() {
    return [
      {
        source: "/downloads/:path*.apk",
        headers: [
          {
            key: "Content-Type",
            value: "application/vnd.android.package-archive",
          },
          {
            key: "Content-Disposition",
            value: "attachment; filename=bookhive-release.apk",
          },
          {
            key: "Cache-Control",
            value: "public, max-age=3600, must-revalidate",
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/mobile",
        destination: "/download",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
