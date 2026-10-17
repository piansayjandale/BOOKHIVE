import React from "react";
import type { Metadata } from "next";
import { DownloadView } from "./download-view";

export const metadata: Metadata = {
  title: "Get BookHive Mobile Companion | Android & iOS",
  description:
    "Get the official BookHive mobile companion application for STI West Negros University students and library members on Android and Apple iOS.",
};

const EAS_APK_URL =
  "https://expo.dev/artifacts/eas/m90mnPT1hrznA0zP1xdm95K-P6ZMwCNdlYIbZ6kO-uQ.apk";

const rawEnvDownloadUrl = process.env.NEXT_PUBLIC_APP_DOWNLOAD_URL;
const isStaleDownloadUrl =
  !rawEnvDownloadUrl ||
  rawEnvDownloadUrl.includes("wq4OYzJNpymhY6ysiXCuUri2xPkuZwsavxKd1eAqaoQ") ||
  rawEnvDownloadUrl.includes("u0IuSm_N5wixAJ9iBDJMwuQbe4aKO4HzZfYAjYao-dU") ||
  rawEnvDownloadUrl.includes("9vqmAP6x6yMOIC_o6J9CLqo8sKcXd0rOtUXxAa7M5UU");

const DOWNLOAD_URL = isStaleDownloadUrl ? EAS_APK_URL : rawEnvDownloadUrl;

export default function DownloadPage() {
  return <DownloadView downloadUrl={DOWNLOAD_URL} />;
}

