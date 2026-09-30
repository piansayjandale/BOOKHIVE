import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
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
} from "lucide-react";

export const metadata: Metadata = {
  title: "Get BookHive for Android | BookHive Library",
  description:
    "Download the official BookHive Android mobile companion application (.APK) for students and library members.",
};

const DOWNLOAD_URL =
  process.env.NEXT_PUBLIC_APP_DOWNLOAD_URL || "/downloads/bookhive-release.apk";

export default function DownloadPage() {
  return (
    <div className="min-h-screen bg-[#0b1825] text-slate-100 flex flex-col justify-between selection:bg-amber-400 selection:text-slate-900">
      {/* Top Navigation */}
      <header className="border-b border-slate-800/80 bg-[#0f1f2d]/90 backdrop-blur-md sticky top-0 z-50 px-4 sm:px-8 py-3.5">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <BookOpen className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <span className="font-bold text-base tracking-tight text-white block">
                BookHive
              </span>
              <span className="text-[11px] text-slate-400 block -mt-1 font-medium">
                STI WNU Library Ecosystem
              </span>
            </div>
          </div>

          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/70 hover:bg-slate-700/70 border border-slate-700/60 transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Portal
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8 sm:py-12 flex flex-col items-center">
        {/* Release Status Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold mb-5 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Official Mobile Companion • Android Release
        </div>

        {/* Hero Title */}
        <h1 className="text-3xl sm:text-5xl font-extrabold text-center tracking-tight text-white max-w-2xl leading-tight">
          Get BookHive for Android
        </h1>

        <p className="mt-3.5 text-sm sm:text-base text-slate-300 text-center max-w-xl leading-relaxed">
          Access the library catalog, reserve titles, track loan deadlines, and
          present your digital student QR library card directly from your smartphone.
        </p>

        {/* Primary Download Card */}
        <div className="mt-8 w-full max-w-lg bg-gradient-to-b from-[#162738] to-[#122130] border border-slate-700/70 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/40 text-center relative overflow-hidden">
          {/* Subtle Ambient Glow */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4 shadow-inner">
              <Smartphone className="w-8 h-8" />
            </div>

            <h2 className="text-xl font-bold text-white">BookHive Student App</h2>
            <p className="text-xs text-slate-400 mt-1">
              Universal Standalone Package • Android 8.0+
            </p>

            {/* Direct Call-to-Action Button */}
            <a
              href={DOWNLOAD_URL}
              download="bookhive-release.apk"
              className="mt-6 w-full group relative inline-flex items-center justify-center gap-3 px-6 py-4 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-slate-950 font-bold text-base shadow-xl shadow-amber-500/25 hover:shadow-amber-500/40 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer"
            >
              <Download className="w-5 h-5 transition-transform group-hover:-translate-y-0.5" />
              <span>Download BookHive APK</span>
            </a>

            <div className="mt-3.5 flex items-center justify-center gap-4 text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <FileCheck className="w-3.5 h-3.5 text-emerald-400" /> Direct APK
              </span>
              <span>•</span>
              <span>Target: bookhive-release.apk</span>
              <span>•</span>
              <span className="text-slate-300 font-medium">Free</span>
            </div>
          </div>
        </div>

        {/* Installation Instructions */}
        <section className="mt-8 w-full max-w-lg bg-[#112131] border border-slate-800 rounded-2xl p-6 sm:p-7 shadow-lg">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white">
                How to Install on Android
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Quick 3-step setup instructions for direct side-loading:
              </p>
            </div>
          </div>

          <div className="space-y-3 text-xs text-slate-300">
            <div className="flex gap-3 items-start bg-slate-900/50 p-3.5 rounded-xl border border-slate-800/80">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-bold text-[11px] shrink-0 mt-0.5">
                1
              </span>
              <p className="leading-relaxed">
                <strong className="text-white">Download the APK file</strong> by tapping the{" "}
                <span className="text-amber-400 font-semibold">&ldquo;Download BookHive APK&rdquo;</span> button above.
              </p>
            </div>

            <div className="flex gap-3 items-start bg-slate-900/50 p-3.5 rounded-xl border border-slate-800/80">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-bold text-[11px] shrink-0 mt-0.5">
                2
              </span>
              <p className="leading-relaxed">
                If prompted by Android, tap{" "}
                <strong className="text-amber-300">&ldquo;Download anyway&rdquo;</strong>. Android shows this standard prompt for any app installed outside of Google Play.
              </p>
            </div>

            <div className="flex gap-3 items-start bg-slate-900/50 p-3.5 rounded-xl border border-slate-800/80">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-bold text-[11px] shrink-0 mt-0.5">
                3
              </span>
              <p className="leading-relaxed">
                Open the file and allow{" "}
                <strong className="text-white">&ldquo;Install unknown apps&rdquo;</strong> to complete setup.
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" /> Verified Safe Build
            </span>
            <span>STI West Negros University • Official Student App</span>
          </div>
        </section>

        {/* Feature Highlights Grid */}
        <section className="mt-8 w-full max-w-lg grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-[#122232] border border-slate-800/80 p-3.5 rounded-xl text-center flex flex-col items-center">
            <QrCode className="w-5 h-5 text-amber-400 mb-1.5" />
            <span className="text-xs font-bold text-white">Digital Library Card</span>
            <span className="text-[10px] text-slate-400 mt-0.5">
              Live QR code verification
            </span>
          </div>

          <div className="bg-[#122232] border border-slate-800/80 p-3.5 rounded-xl text-center flex flex-col items-center">
            <BookOpen className="w-5 h-5 text-sky-400 mb-1.5" />
            <span className="text-xs font-bold text-white">Catalog & Holds</span>
            <span className="text-[10px] text-slate-400 mt-0.5">
              Search & reserve books
            </span>
          </div>

          <div className="bg-[#122232] border border-slate-800/80 p-3.5 rounded-xl text-center flex flex-col items-center">
            <Clock className="w-5 h-5 text-emerald-400 mb-1.5" />
            <span className="text-xs font-bold text-white">Due Alerts</span>
            <span className="text-[10px] text-slate-400 mt-0.5">
              Real-time loan countdowns
            </span>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-[#0d1a27] py-6 px-4 text-center text-xs text-slate-500">
        <p>© {new Date().getFullYear()} BookHive Library Management System. All rights reserved.</p>
        <p className="mt-1 text-[11px] text-slate-600">
          STI West Negros University • Direct Distribution Release
        </p>
      </footer>
    </div>
  );
}
