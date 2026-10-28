"use client";

import React, { useState, useEffect, FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, Lock, Eye, EyeOff, Sun, Moon, Sparkles, HelpCircle } from "lucide-react";
import "./Login.css";

export default function LoginPage() {
  const [mounted, setMounted] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check local storage or document theme
    if (typeof window !== "undefined") {
      const savedTheme = localStorage.getItem("bookhive_theme");
      if (savedTheme === "light") {
        setIsDarkMode(false);
      }
    }
  }, []);

  const toggleTheme = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("bookhive_theme", next ? "dark" : "light");
      }
      return next;
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowForgotModal(false);
      }
    };
    if (showForgotModal) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showForgotModal]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    const trimmedIdentifier = identifier.trim();
    const trimmedPassword = password.trim();

    if (!trimmedIdentifier || !trimmedPassword) {
      setError("Please fill in both email / ID and password.");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          identifier: trimmedIdentifier,
          password: trimmedPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Invalid credentials. Please verify your school email or Student ID.");
        setIsLoading(false);
        return;
      }

      // Route based on role
      const userRole = (data.user?.role || "").toLowerCase().trim();
      const isStudent = userRole === "student";

      // Save student session in localStorage for web companion
      if (typeof window !== "undefined" && data.user) {
        localStorage.setItem("bookhive_student_user", JSON.stringify(data.user));
        if (data.token) localStorage.setItem("bookhive_token", data.token);
      }

      if (isStudent) {
        window.location.assign("/student");
      } else if (data.redirectPath && data.redirectPath !== "/login") {
        window.location.assign(data.redirectPath);
      } else {
        window.location.assign("/librarian");
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("Unable to connect to BookHive services. Please try again.");
      setIsLoading(false);
    }
  };

  const bgClass = isDarkMode ? "bg-[#090E1A] text-slate-100" : "bg-[#F8FAFC] text-slate-900";
  const cardBgClass = isDarkMode
    ? "bg-[#111A2E] border-slate-700/60 shadow-2xl shadow-black/60"
    : "bg-white border-slate-200 shadow-xl shadow-slate-300/50";
  const inputBgClass = isDarkMode
    ? "bg-[#0A1120] border-slate-700/80 text-white placeholder-slate-500"
    : "bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400";

  return (
    <div
      className={`min-h-screen w-full flex flex-col justify-between selection:bg-amber-300 selection:text-slate-950 transition-colors duration-200 ${bgClass}`}
      data-theme={isDarkMode ? "dark" : "light"}
      suppressHydrationWarning
    >
      {/* Ambient decorative glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          className={`absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full blur-3xl opacity-20 pointer-events-none transition-all ${
            isDarkMode ? "bg-amber-500/20" : "bg-sky-400/20"
          }`}
        />
      </div>

      {/* Top Bar Navigation */}
      <header className="relative z-20 w-full px-4 sm:px-8 py-4 sm:py-6 flex items-center justify-between max-w-5xl mx-auto">
        <Link
          href="/intro"
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold border transition-all cursor-pointer ${
            isDarkMode
              ? "bg-slate-800/80 border-slate-700/80 text-slate-200 hover:bg-slate-700/80 hover:text-white"
              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-950 shadow-xs"
          }`}
          title="Back to Intro & Features"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Intro</span>
        </Link>

        <button
          type="button"
          onClick={toggleTheme}
          className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all cursor-pointer ${
            isDarkMode
              ? "bg-slate-800/80 border-slate-700/80 text-amber-400 hover:bg-slate-700/80"
              : "bg-white border-slate-200 text-amber-500 hover:bg-slate-100 shadow-xs"
          }`}
          title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          aria-label="Toggle theme"
        >
          {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-6 sm:py-10 w-full max-w-lg mx-auto">
        {/* Brand Identity Header */}
        <div className="flex flex-col items-center text-center mb-6 sm:mb-8">
          <div className="w-14 h-14 rounded-2xl bg-[#FFF200] p-2 flex items-center justify-center shadow-lg shadow-amber-500/15 mb-3.5 transition-transform hover:scale-105">
            <img
              src="/sti-logo.png"
              alt="STI Logo"
              className="w-full h-full object-contain"
              suppressHydrationWarning
            />
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight flex items-center gap-2">
            <span>BookHive</span>
          </h1>
          <p
            className={`text-xs sm:text-sm font-medium mt-1 ${
              isDarkMode ? "text-slate-400" : "text-slate-600"
            }`}
          >
            STI West Negros University Library Companion
          </p>
        </div>

        {/* Central Login Card */}
        <div className={`w-full border rounded-3xl p-6 sm:p-8 backdrop-blur-md transition-all ${cardBgClass}`}>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight mb-5">
            Log in to your account
          </h2>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {error && (
              <div className="rounded-xl p-3.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold text-center leading-relaxed animate-in fade-in">
                {error}
              </div>
            )}

            {/* School Email or ID */}
            <div>
              <label
                htmlFor="identifier"
                className={`block text-[11px] font-bold tracking-wider uppercase mb-1.5 ${
                  isDarkMode ? "text-slate-400" : "text-slate-600"
                }`}
              >
                School Email or Student ID
              </label>
              <div
                className={`h-13 rounded-2xl border px-3.5 flex items-center gap-3 transition-all focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-400/20 ${inputBgClass}`}
              >
                <Mail className="w-5 h-5 text-slate-400 shrink-0" />
                <input
                  id="identifier"
                  type="text"
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    if (error) setError("");
                  }}
                  placeholder="e.g., student@sti.edu.ph or 23-1653-705"
                  className="w-full bg-transparent text-sm font-medium focus:outline-hidden"
                  autoCapitalize="none"
                  autoCorrect="off"
                  disabled={isLoading}
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className={`block text-[11px] font-bold tracking-wider uppercase mb-1.5 ${
                  isDarkMode ? "text-slate-400" : "text-slate-600"
                }`}
              >
                Password
              </label>
              <div
                className={`h-13 rounded-2xl border px-3.5 flex items-center gap-3 transition-all focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-400/20 ${inputBgClass}`}
              >
                <Lock className="w-5 h-5 text-slate-400 shrink-0" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError("");
                  }}
                  placeholder="••••••••"
                  className="w-full bg-transparent text-sm font-medium focus:outline-hidden"
                  autoCapitalize="none"
                  autoCorrect="off"
                  disabled={isLoading}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded-md border-slate-600 text-amber-500 focus:ring-amber-400 focus:ring-offset-0 bg-transparent"
                />
                <span className={isDarkMode ? "text-slate-300 font-medium" : "text-slate-600 font-medium"}>
                  Remember me
                </span>
              </label>

              <button
                type="button"
                onClick={() => setShowForgotModal(true)}
                className="font-bold text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
              >
                Forgot Password?
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="mt-3 w-full h-13 rounded-2xl bg-[#FFD700] hover:bg-[#ffe033] active:scale-[0.99] text-slate-950 font-black text-base shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Logging in...</span>
                </span>
              ) : (
                "Log In"
              )}
            </button>

            {/* Mobile App Download Promo */}
            <div className="pt-2 text-center">
              <Link
                href="/download"
                className={`inline-flex items-center gap-1.5 text-xs font-bold transition-colors ${
                  isDarkMode ? "text-sky-400 hover:text-sky-300" : "text-sky-600 hover:text-sky-700"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Get the Official Android Mobile Companion</span>
              </Link>
            </div>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full py-4 text-center text-[11px] text-slate-500 font-medium">
        STI West Negros University • BookHive Intelligent Library System
      </footer>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowForgotModal(false);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-[#111A2E] border border-slate-700/80 rounded-3xl p-6 sm:p-7 shadow-2xl text-slate-200 relative">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-700/60">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-white">Password Assistance</h3>
                  <p className="text-[11px] text-slate-400">BookHive Security Support</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs text-slate-300 leading-relaxed">
              <p>
                For student and institutional account security, password resets are verified directly by the STI WNU Library Services and ICT Administration.
              </p>
              <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/70 space-y-1.5">
                <div className="font-bold text-white text-[11px] uppercase tracking-wider">
                  Support Contact
                </div>
                <div><strong>Office:</strong> STI WNU Library Desk / ICT Office</div>
                <div><strong>Email:</strong> superadmin@stiwnu.edu.ph</div>
                <div><strong>Hours:</strong> Monday – Friday, 8:00 AM – 5:00 PM</div>
              </div>
              <p className="text-[11px] text-slate-400">
                Please provide your <strong>Student ID Number</strong> and <strong>Full Name</strong> when requesting assistance.
              </p>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors cursor-pointer"
              >
                Close
              </button>
              <a
                href="mailto:superadmin@stiwnu.edu.ph?subject=BookHive%20Student%20Password%20Assistance"
                className="flex-1 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs text-center transition-colors cursor-pointer flex items-center justify-center"
              >
                Email Support
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
