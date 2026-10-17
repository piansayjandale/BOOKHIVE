"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Download,
  Smartphone,
  ShieldCheck,
  AlertTriangle,
  QrCode,
  BookOpen,
  Clock,
  ArrowLeft,
  FileCheck,
  Share2,
  ExternalLink,
  PlusSquare,
  Sparkles,
  Info,
  CheckCircle2,
  Layers,
} from "lucide-react";

interface DownloadViewProps {
  downloadUrl: string;
}

export function DownloadView({ downloadUrl }: DownloadViewProps) {
  const [platform, setPlatform] = useState<"android" | "ios">("android");
  const [isInAppBrowser, setIsInAppBrowser] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && typeof navigator !== "undefined") {
      const ua = navigator.userAgent || "";
      if (/iPhone|iPad|iPod/i.test(ua)) {
        setPlatform("ios");
      } else if (/Android/i.test(ua)) {
        setPlatform("android");
      }

      // Detect in-app browsers like Facebook, Messenger, Instagram, Line
      if (/FBAN|FBAV|Messenger|Instagram|Line|TikTok|MicroMessenger/i.test(ua)) {
        setIsInAppBrowser(true);
      }
    }
  }, []);

  return (
    <div className="download-page-root fixed inset-0 overflow-y-auto overflow-x-hidden bg-slate-50 text-slate-800 flex flex-col justify-between selection:bg-amber-300 selection:text-slate-900">
      {/* Decorative top ambient glow */}
      <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-amber-500/10 via-sky-500/5 to-transparent pointer-events-none" />

      {/* Top Navigation */}
      <header className="border-b border-slate-200/80 bg-white/95 backdrop-blur-md sticky top-0 z-50 px-4 sm:px-8 py-3.5 shadow-xs">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center justify-center p-1.5 shadow-xs">
              <img
                src="/logo.png"
                alt="BookHive Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <span className="font-extrabold text-base tracking-tight text-slate-900 block">
                BookHive
              </span>
              <span className="text-[11px] text-slate-500 block -mt-0.5 font-medium">
                STI WNU Library Ecosystem
              </span>
            </div>
          </div>

          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:text-slate-950 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 transition-all shadow-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Portal
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 max-w-4xl mx-auto w-full px-4 py-8 sm:py-12 flex flex-col items-center">
        {/* Release Status Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold mb-5 shadow-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Official Mobile Companion • Cross-Platform Access
        </div>

        {/* Hero Title */}
        <h1 className="text-3xl sm:text-5xl font-black text-center tracking-tight text-slate-900 max-w-2xl leading-tight">
          Get BookHive for {platform === "ios" ? "Apple iOS" : "Android"}
        </h1>

        <p className="mt-3.5 text-sm sm:text-base text-slate-600 text-center max-w-xl leading-relaxed">
          Access the library catalog, reserve titles, track loan deadlines, and
          present your digital student QR library card directly from your smartphone.
        </p>

        {/* In-app Browser Warning Alert (Messenger, Instagram, FB) */}
        {isInAppBrowser && (
          <div className="mt-5 w-full max-w-lg bg-amber-50 border border-amber-300 rounded-xl p-4 text-left shadow-sm flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 leading-relaxed">
              <strong className="block font-bold mb-0.5">
                Viewing inside an in-app social browser
              </strong>
              In-app browsers (like Messenger or Instagram) restrict installing apps. For the best experience, tap the{" "}
              <strong>three dots (•••)</strong> in the top-right corner and select{" "}
              <strong>&ldquo;Open in Safari&rdquo;</strong> (iOS) or <strong>&ldquo;Open in Chrome&rdquo;</strong> (Android).
            </div>
          </div>
        )}

        {/* Segmented Platform Switcher */}
        <div className="mt-6 w-full max-w-md bg-slate-200/80 p-1.5 rounded-2xl flex items-center gap-1.5 shadow-inner">
          <button
            type="button"
            onClick={() => setPlatform("android")}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              platform === "android"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Smartphone className="w-4 h-4 text-emerald-600" />
            <span>🤖 Android (APK)</span>
          </button>
          <button
            type="button"
            onClick={() => setPlatform("ios")}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              platform === "ios"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Layers className="w-4 h-4 text-sky-600" />
            <span>🍎 Apple iOS (iPhone/iPad)</span>
          </button>
        </div>

        {/* ================================================================= */}
        {/* ANDROID PLATFORM PANEL                                            */}
        {/* ================================================================= */}
        {platform === "android" && (
          <div className="w-full flex flex-col items-center">
            {/* Primary Download Card */}
            <div className="mt-6 w-full max-w-lg bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-xl shadow-slate-200/60 text-center relative overflow-hidden">
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-24 h-24 rounded-2xl bg-gradient-to-b from-amber-50 to-amber-100/60 border border-amber-200/80 p-2.5 flex items-center justify-center mb-4 shadow-sm">
                  <img
                    src="/logo.png"
                    alt="BookHive Logo"
                    className="w-full h-full object-contain drop-shadow-xs"
                  />
                </div>

                <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                  BookHive Student App
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
                  Universal Standalone Package • Android 8.0+
                </p>

                {/* Direct Call-to-Action Button */}
                <a
                  href={downloadUrl}
                  download="bookhive-release.apk"
                  className="mt-6 w-full group relative inline-flex items-center justify-center gap-3 px-6 py-4 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-base sm:text-lg shadow-lg shadow-amber-500/25 hover:shadow-xl hover:shadow-amber-500/35 hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
                >
                  <Download className="w-5 h-5 transition-transform group-hover:-translate-y-0.5" />
                  <span>Download BookHive APK</span>
                </a>

                {/* Meta Tags under Button */}
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[11px]">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200/70">
                    <FileCheck className="w-3.5 h-3.5" /> Direct APK
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium border border-slate-200">
                    bookhive-release.apk
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 font-bold border border-amber-200/70">
                    Free Download
                  </span>
                </div>
              </div>
            </div>

            {/* Installation Instructions */}
            <section className="mt-6 w-full max-w-lg bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-7 shadow-md shadow-slate-200/50">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-700 shrink-0 mt-0.5 shadow-2xs">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    How to Install on Android
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5 font-medium">
                    Quick 3-step setup guide for direct installation:
                  </p>
                </div>
              </div>

              <div className="space-y-3 text-xs text-slate-700">
                <div className="flex gap-3.5 items-start bg-slate-50 hover:bg-slate-100/70 p-3.5 rounded-xl border border-slate-200/70 transition-colors">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500 text-slate-950 font-black text-xs shrink-0 mt-0.5 shadow-xs">
                    1
                  </span>
                  <p className="leading-relaxed">
                    <strong className="text-slate-900">Download the APK file</strong> by tapping the{" "}
                    <span className="text-amber-800 font-bold">&ldquo;Download BookHive APK&rdquo;</span> button above.
                  </p>
                </div>

                <div className="flex gap-3.5 items-start bg-slate-50 hover:bg-slate-100/70 p-3.5 rounded-xl border border-slate-200/70 transition-colors">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500 text-slate-950 font-black text-xs shrink-0 mt-0.5 shadow-xs">
                    2
                  </span>
                  <p className="leading-relaxed">
                    If prompted by Android or your browser, tap{" "}
                    <strong className="text-slate-950 bg-amber-100/80 px-1.5 py-0.5 rounded font-bold">&ldquo;Download anyway&rdquo;</strong>. Android shows this standard prompt for official apps installed outside the Google Play Store.
                  </p>
                </div>

                <div className="flex gap-3.5 items-start bg-slate-50 hover:bg-slate-100/70 p-3.5 rounded-xl border border-slate-200/70 transition-colors">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500 text-slate-950 font-black text-xs shrink-0 mt-0.5 shadow-xs">
                    3
                  </span>
                  <p className="leading-relaxed">
                    Open the downloaded file from your notifications or <strong className="text-slate-900">Downloads</strong> folder, then tap{" "}
                    <strong className="text-slate-900">&ldquo;Install&rdquo;</strong> (or <strong className="text-slate-900">&ldquo;Update&rdquo;</strong> if updating). If requested, toggle <strong className="text-slate-900">&ldquo;Allow from this source&rdquo;</strong> to proceed.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-amber-50/90 border border-amber-200/90 text-[11px] text-amber-950 leading-relaxed">
                  <span className="font-bold text-amber-900 block mb-0.5">
                    Note for users updating from an earlier build:
                  </span>
                  Android requires tapping the downloaded APK to install the update. If your phone home screen still displays an older version, remove the shortcut and relaunch BookHive from your App Drawer, or restart your phone to refresh your launcher cache.
                </div>
              </div>

              <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                <span className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" /> Verified Safe Build
                </span>
                <span className="font-medium">STI West Negros University • Official Student App</span>
              </div>
            </section>
          </div>
        )}

        {/* ================================================================= */}
        {/* APPLE IOS PLATFORM PANEL                                          */}
        {/* ================================================================= */}
        {platform === "ios" && (
          <div className="w-full flex flex-col items-center">
            {/* Why iOS cannot download APK explanation */}
            <div className="mt-6 w-full max-w-lg bg-sky-50/80 border border-sky-200/90 rounded-2xl p-4 sm:p-5 text-left shadow-xs">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-sky-100 flex items-center justify-center text-sky-700 shrink-0 mt-0.5">
                  <Info className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-sky-950">
                    Why can&apos;t iPhones download .APK files?
                  </h3>
                  <p className="text-xs text-sky-800/90 mt-1 leading-relaxed">
                    <strong>.APK</strong> files are exclusive to Android devices. Apple iOS strictly blocks downloading executable app packages from web browsers. Instead, you can run BookHive natively or add it directly to your home screen using the official methods below:
                  </p>
                </div>
              </div>
            </div>

            {/* Option 1: Progressive Web App via Safari (Instant & 100% Free) */}
            <div className="mt-4 w-full max-w-lg bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-7 shadow-xl shadow-slate-200/60 text-left">
              <div className="flex items-center justify-between mb-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200/80">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" /> Recommended • Instant Access
                </span>
                <span className="text-[11px] font-bold text-slate-400">No App Store Required</span>
              </div>

              <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                Option 1: Add to Home Screen (Safari)
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
                Install BookHive directly to your iPhone or iPad home screen in seconds. Launches in fullscreen standalone mode with instant catalog search, digital library card, and student pass!
              </p>

              {/* 4-Step Visual Instructions */}
              <div className="mt-5 space-y-2.5 text-xs text-slate-700">
                <div className="flex gap-3 items-start bg-slate-50 p-3 rounded-xl border border-slate-200/70">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-sky-500 text-white font-black text-xs shrink-0 mt-0.5">
                    1
                  </span>
                  <p className="leading-relaxed">
                    Open BookHive in <strong className="text-slate-900">Safari</strong> on your iPhone or iPad.
                  </p>
                </div>

                <div className="flex gap-3 items-start bg-slate-50 p-3 rounded-xl border border-slate-200/70">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-sky-500 text-white font-black text-xs shrink-0 mt-0.5">
                    2
                  </span>
                  <p className="leading-relaxed flex items-center gap-1.5 flex-wrap">
                    Tap the <strong className="text-slate-900">Share</strong> button in Safari&apos;s bottom toolbar (the square icon with an upward arrow: <Share2 className="w-3.5 h-3.5 inline text-sky-600" />).
                  </p>
                </div>

                <div className="flex gap-3 items-start bg-slate-50 p-3 rounded-xl border border-slate-200/70">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-sky-500 text-white font-black text-xs shrink-0 mt-0.5">
                    3
                  </span>
                  <p className="leading-relaxed flex items-center gap-1.5 flex-wrap">
                    Scroll down and tap <strong className="text-slate-900">&ldquo;Add to Home Screen&rdquo;</strong> (<PlusSquare className="w-3.5 h-3.5 inline text-slate-700" />).
                  </p>
                </div>

                <div className="flex gap-3 items-start bg-slate-50 p-3 rounded-xl border border-slate-200/70">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-sky-500 text-white font-black text-xs shrink-0 mt-0.5">
                    4
                  </span>
                  <p className="leading-relaxed">
                    Tap <strong className="text-slate-900">&ldquo;Add&rdquo;</strong> in the top-right corner. The BookHive icon will now appear on your iPhone home screen!
                  </p>
                </div>
              </div>

              <Link
                href="/login"
                className="mt-5 w-full inline-flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-500 hover:to-sky-600 text-white font-bold text-sm shadow-md shadow-sky-600/25 transition-all cursor-pointer"
              >
                <span>Launch BookHive in Safari</span>
                <ExternalLink className="w-4 h-4" />
              </Link>
            </div>

            {/* Option 2: Run Native App via Expo Go */}
            <div className="mt-4 w-full max-w-lg bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-7 shadow-md shadow-slate-200/50 text-left">
              <div className="flex items-center justify-between mb-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-800 text-xs font-bold border border-indigo-200/80">
                  ⚡ Native Mobile App
                </span>
                <span className="text-[11px] font-bold text-slate-400">App Store Verified</span>
              </div>

              <h2 className="text-lg sm:text-xl font-black text-slate-900">
                Option 2: Run via Expo Go
              </h2>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Because BookHive is built with cross-platform React Native and Expo, students can run the native application directly on iOS using the official free <strong>Expo Go</strong> app from the Apple App Store.
              </p>

              <div className="mt-4 space-y-2 text-xs text-slate-700">
                <div className="flex gap-2.5 items-start">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <span>Install <strong>Expo Go</strong> from the Apple App Store on your iPhone.</span>
                </div>
                <div className="flex gap-2.5 items-start">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <span>Scan your campus development QR code or launch the student project link to run natively.</span>
                </div>
              </div>

              <a
                href="https://apps.apple.com/app/expo-go/id982107779"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm transition-all"
              >
                <span>Get Expo Go on the App Store</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Option 3: Official App Store / TestFlight Information */}
            <div className="mt-4 w-full max-w-lg p-4 rounded-xl bg-slate-100/80 border border-slate-200 text-xs text-slate-600 leading-relaxed text-left">
              <strong className="text-slate-900 block font-bold mb-1">
                Looking for an official App Store / TestFlight build?
              </strong>
              Apple requires an active Apple Developer Program membership ($99/year) to publish standalone .IPA files to TestFlight or the App Store. When STI WNU configures its institutional Apple Developer account, the BookHive EAS build pipeline is already fully configured in <code className="bg-slate-200 px-1 py-0.5 rounded text-[11px]">eas.json</code> to compile and submit the iOS app instantly.
            </div>
          </div>
        )}

        {/* Feature Highlights Grid */}
        <section className="mt-8 w-full max-w-lg grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white border border-slate-200/80 p-4 rounded-xl text-center flex flex-col items-center shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center mb-2">
              <QrCode className="w-4 h-4 text-amber-600" />
            </div>
            <span className="text-xs font-bold text-slate-900">Digital Student ID</span>
            <span className="text-[11px] text-slate-500 mt-0.5 font-medium">
              Live QR code scanner
            </span>
          </div>

          <div className="bg-white border border-slate-200/80 p-4 rounded-xl text-center flex flex-col items-center shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center mb-2">
              <BookOpen className="w-4 h-4 text-sky-600" />
            </div>
            <span className="text-xs font-bold text-slate-900">Catalog & Holds</span>
            <span className="text-[11px] text-slate-500 mt-0.5 font-medium">
              Search & reserve books
            </span>
          </div>

          <div className="bg-white border border-slate-200/80 p-4 rounded-xl text-center flex flex-col items-center shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center mb-2">
              <Clock className="w-4 h-4 text-emerald-600" />
            </div>
            <span className="text-xs font-bold text-slate-900">Due Alerts</span>
            <span className="text-[11px] text-slate-500 mt-0.5 font-medium">
              Loan countdown timers
            </span>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-200/80 bg-white py-6 px-4 text-center text-xs text-slate-500 shadow-xs">
        <p className="font-medium">© {new Date().getFullYear()} BookHive Library Management System. All rights reserved.</p>
        <p className="mt-1 text-[11px] text-slate-400">
          STI West Negros University • Official Cross-Platform Companion
        </p>
      </footer>
    </div>
  );
}
