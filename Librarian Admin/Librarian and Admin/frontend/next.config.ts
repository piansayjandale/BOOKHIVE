import type { NextConfig } from "next";
import fs from "fs";
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
  ...(process.env.VERCEL
    ? {}
    : {
        turbopack: {
          root: fs.existsSync(path.join(__dirname, "node_modules"))
            ? __dirname
            : path.join(__dirname, ".."),
        },
      }),
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
    const apkUrl =
      process.env.NEXT_PUBLIC_APP_DOWNLOAD_URL ||
      "https://expo.dev/artifacts/eas/u0IuSm_N5wixAJ9iBDJMwuQbe4aKO4HzZfYAjYao-dU.apk";
    return [
      {
        source: "/mobile",
        destination: "/download",
        permanent: true,
      },
      {
        source: "/downloads/bookhive-release.apk",
        destination: apkUrl,
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
