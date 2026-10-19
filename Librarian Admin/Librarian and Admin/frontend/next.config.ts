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
    const latestEasApk =
      "https://expo.dev/artifacts/eas/xc8SUbZZdm5ObSv2fEFJIqtMbYHYyDuaEBsqcpwf2c8.apk";
    const envApk = process.env.NEXT_PUBLIC_APP_DOWNLOAD_URL;
    const isStaleApk =
      !envApk ||
      envApk.includes("XFgckz2TnI1Z76BNl4QKdN6GqdBxBMw0p7wHXKXVla8") ||
      envApk.includes("mH97U3T7g48Yn3KFtIHH0Uyal0bzBl5MWx5iu39M_uI") ||
      envApk.includes("m90mnPT1hrznA0zP1xdm95K-P6ZMwCNdlYIbZ6kO-uQ") ||
      envApk.includes("wq4OYzJNpymhY6ysiXCuUri2xPkuZwsavxKd1eAqaoQ") ||
      envApk.includes("u0IuSm_N5wixAJ9iBDJMwuQbe4aKO4HzZfYAjYao-dU") ||
      envApk.includes("9vqmAP6x6yMOIC_o6J9CLqo8sKcXd0rOtUXxAa7M5UU");
    const apkUrl = isStaleApk ? latestEasApk : envApk;
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
      {
        source: "/downloads/app-release.apk",
        destination: apkUrl,
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
