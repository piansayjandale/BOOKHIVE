import React from "react";
import type { Metadata } from "next";
import { DownloadView } from "./download-view";

export const metadata: Metadata = {
  title: "Get BookHive Mobile Companion | Android & iOS",
  description:
    "Get the official BookHive mobile companion application for STI West Negros University students and library members on Android and Apple iOS.",
};

const EAS_APK_URL =
  "https://expo.dev/artifacts/eas/PRTn5oa71TieuMvrCQEVkPrIn53UMEKb1lsYNGnS0AQ.apk";

const rawEnvDownloadUrl = process.env.NEXT_PUBLIC_APP_DOWNLOAD_URL;
const isStaleDownloadUrl =
  !rawEnvDownloadUrl ||
  rawEnvDownloadUrl.includes("QuHFoP8CF0nyJcYjtxTABgfINbWkLET_Jqi8rjeI4-g") ||
  rawEnvDownloadUrl.includes("a3L1Zy4ZsfcYyQgjemhGKXJZwGQw54-073mSl8Jm4eY") ||
  rawEnvDownloadUrl.includes("PdclHLKCDOCemD5tcCx2e-a8eSKYUW2tj0rg8Sv1kjU") ||
  rawEnvDownloadUrl.includes("X9oVsAt4oAvIWYiAg2Lj3eO7pUsuz_f1XhCDlM_uytg") ||
  rawEnvDownloadUrl.includes("xc8SUbZZdm5ObSv2fEFJIqtMbYHYyDuaEBsqcpwf2c8") ||
  rawEnvDownloadUrl.includes("XFgckz2TnI1Z76BNl4QKdN6GqdBxBMw0p7wHXKXVla8") ||
  rawEnvDownloadUrl.includes("mH97U3T7g48Yn3KFtIHH0Uyal0bzBl5MWx5iu39M_uI") ||
  rawEnvDownloadUrl.includes("m90mnPT1hrznA0zP1xdm95K-P6ZMwCNdlYIbZ6kO-uQ") ||
  rawEnvDownloadUrl.includes("wq4OYzJNpymhY6ysiXCuUri2xPkuZwsavxKd1eAqaoQ") ||
  rawEnvDownloadUrl.includes("u0IuSm_N5wixAJ9iBDJMwuQbe4aKO4HzZfYAjYao-dU") ||
  rawEnvDownloadUrl.includes("9vqmAP6x6yMOIC_o6J9CLqo8sKcXd0rOtUXxAa7M5UU");

const DOWNLOAD_URL = isStaleDownloadUrl ? EAS_APK_URL : rawEnvDownloadUrl;

export default function DownloadPage() {
  return <DownloadView downloadUrl={DOWNLOAD_URL} />;
}
