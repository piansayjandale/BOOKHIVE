"use client";

import React, { useState, useEffect, FormEvent } from "react";
import { Mail, Lock, Eye, EyeOff, Sun, Moon, User, CheckCircle2 } from "lucide-react";

export default function LoginPage() {
  const [mounted, setMounted] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isSignUp, setIsSignUp] = useState(false);

  // Login Fields
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Sign Up Fields
  const [signupName, setSignupName] = useState("");
  const [signupIdNumber, setSignupIdNumber] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupSuccess, setSignupSuccess] = useState("");

  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
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

  const handleLoginSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSignupSuccess("");
    setIsLoading(true);

    const trimmedIdentifier = identifier.trim();
    const trimmedPassword = password.trim();

    if (!trimmedIdentifier || !trimmedPassword) {
      setError("Please enter both your school email or ID and password.");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

      // Check role
      const userRole = (data.user?.role || "").toLowerCase().trim();
      const isStudent = userRole === "student";

      // Save user session in localStorage for student web companion
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

  const handleSignUpSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSignupSuccess("");
    setIsLoading(true);

    const name = signupName.trim();
    const idNumber = signupIdNumber.trim();
    const email = signupEmail.trim().toLowerCase();
    const pwd = signupPassword.trim();

    if (!name || !idNumber || !email || !pwd) {
      setError("Please fill in all registration fields.");
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/student/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          idNumber,
          email,
          password: pwd,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Registration failed. Please check your information.");
        setIsLoading(false);
        return;
      }

      setSignupSuccess("Account created successfully! You can now log in.");
      setIsSignUp(false);
      setIdentifier(idNumber || email);
      setPassword(pwd);
      setIsLoading(false);
    } catch {
      setError("Unable to complete registration. Please try again.");
      setIsLoading(false);
    }
  };

  const bgStyle = isDarkMode
    ? "bg-[#080E1A] text-slate-100"
    : "bg-[#F1F5F9] text-slate-900";
  const cardStyle = isDarkMode
    ? "bg-[#0E1728] border-slate-800/80 shadow-2xl shadow-black/80"
    : "bg-white border-slate-200/90 shadow-xl shadow-slate-300/40";
  const inputStyle = isDarkMode
    ? "bg-[#091120] border-slate-800 text-white placeholder-slate-500 focus-within:border-amber-400"
    : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus-within:border-amber-500";

  return (
    <div
      className={`min-h-screen w-full flex flex-col justify-between selection:bg-amber-300 selection:text-slate-950 transition-colors duration-200 relative ${bgStyle}`}
      data-theme={isDarkMode ? "dark" : "light"}
      suppressHydrationWarning
    >
      {/* Top Bar with Theme Toggle only (matching mobile app in Picture 2) */}
      <header className="w-full px-6 py-6 flex items-center justify-end max-w-lg mx-auto">
        <button
          type="button"
          onClick={toggleTheme}
          className={`w-11 h-11 rounded-full flex items-center justify-center transition-all cursor-pointer ${
            isDarkMode
              ? "text-amber-400 hover:bg-slate-800/60"
              : "text-amber-600 hover:bg-slate-200/60"
          }`}
          title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          aria-label="Toggle theme"
        >
          {isDarkMode ? <Sun className="w-6 h-6 text-amber-400" /> : <Moon className="w-6 h-6 text-amber-600" />}
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center px-5 py-4 w-full max-w-[440px] mx-auto -mt-6">
        {/* Brand Identity Header: Exactly matching Picture 2 */}
        <div className="flex flex-col items-center text-center mb-7">
          <h1 className="text-4xl font-extrabold tracking-tight text-white">
            BookHive
          </h1>
          <p className="text-sm font-medium mt-1.5 text-slate-400">
            Welcome to BookHive
          </p>
        </div>

        {/* Central Card: Exactly matching Picture 2 */}
        <div className={`w-full border rounded-3xl p-6 sm:p-7 backdrop-blur-md transition-all ${cardStyle}`}>
          <h2 className="text-2xl font-extrabold tracking-tight text-white mb-5">
            {isSignUp ? "Create your account" : "Log in to your account"}
          </h2>

          {signupSuccess && (
            <div className="mb-4 rounded-xl p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold text-center flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{signupSuccess}</span>
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-xl p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold text-center leading-relaxed">
              {error}
            </div>
          )}

          {!isSignUp ? (
            /* Login Form */
            <form onSubmit={handleLoginSubmit} noValidate className="space-y-4">
              {/* School Email or ID */}
              <div className={`h-14 rounded-2xl border px-4 flex items-center gap-3 transition-all ${inputStyle}`}>
                <Mail className="w-5 h-5 text-slate-400 shrink-0" />
                <input
                  id="identifier"
                  type="text"
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    if (error) setError("");
                  }}
                  placeholder=""
                  style={{ backgroundColor: "transparent", color: "inherit" }}
                  className="login-input w-full bg-transparent border-0 outline-hidden text-sm font-medium"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  required
                />
              </div>

              {/* Password */}
              <div className={`h-14 rounded-2xl border px-4 flex items-center gap-3 transition-all ${inputStyle}`}>
                <Lock className="w-5 h-5 text-slate-400 shrink-0" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError("");
                  }}
                  placeholder=""
                  style={{ backgroundColor: "transparent", color: "inherit" }}
                  className="login-input w-full bg-transparent border-0 outline-hidden text-sm font-medium tracking-widest"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-slate-400 hover:text-white transition-colors p-1"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                </button>
              </div>

              {/* Login Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-13 mt-2 rounded-2xl bg-[#FFCC00] hover:bg-[#F59E0B] active:scale-[0.99] text-[#080E1A] font-extrabold text-base tracking-wide shadow-lg shadow-amber-500/20 transition-all cursor-pointer flex items-center justify-center disabled:opacity-60"
              >
                {isLoading ? "Logging in..." : "Log In"}
              </button>

              {/* Don't have an account? Sign Up Link */}
              <div className="pt-3 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(true);
                    setError("");
                  }}
                  className="text-sm font-bold text-[#FFCC00] hover:underline cursor-pointer"
                >
                  Don&apos;t have an account? Sign Up
                </button>
              </div>
            </form>
          ) : (
            /* Sign Up Form */
            <form onSubmit={handleSignUpSubmit} noValidate className="space-y-3.5">
              <div className={`h-13 rounded-2xl border px-4 flex items-center gap-3 transition-all ${inputStyle}`}>
                <User className="w-5 h-5 text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                  placeholder="Full Name (e.g., Juan Dela Cruz)"
                  style={{ backgroundColor: "transparent", color: "inherit" }}
                  className="login-input w-full bg-transparent border-0 outline-hidden text-sm font-medium"
                  required
                />
              </div>

              <div className={`h-13 rounded-2xl border px-4 flex items-center gap-3 transition-all ${inputStyle}`}>
                <Mail className="w-5 h-5 text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={signupIdNumber}
                  onChange={(e) => setSignupIdNumber(e.target.value)}
                  placeholder="Student ID (e.g., 23-1653-705)"
                  style={{ backgroundColor: "transparent", color: "inherit" }}
                  className="login-input w-full bg-transparent border-0 outline-hidden text-sm font-medium"
                  required
                />
              </div>

              <div className={`h-13 rounded-2xl border px-4 flex items-center gap-3 transition-all ${inputStyle}`}>
                <Mail className="w-5 h-5 text-slate-400 shrink-0" />
                <input
                  type="email"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  placeholder="School Email (e.g., juan@wnu.sti.edu.ph)"
                  style={{ backgroundColor: "transparent", color: "inherit" }}
                  className="login-input w-full bg-transparent border-0 outline-hidden text-sm font-medium"
                  required
                />
              </div>

              <div className={`h-13 rounded-2xl border px-4 flex items-center gap-3 transition-all ${inputStyle}`}>
                <Lock className="w-5 h-5 text-slate-400 shrink-0" />
                <input
                  type="password"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  placeholder="Create Password"
                  style={{ backgroundColor: "transparent", color: "inherit" }}
                  className="login-input w-full bg-transparent border-0 outline-hidden text-sm font-medium"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-13 mt-2 rounded-2xl bg-[#FFCC00] hover:bg-[#F59E0B] active:scale-[0.99] text-[#080E1A] font-extrabold text-base tracking-wide shadow-lg shadow-amber-500/20 transition-all cursor-pointer flex items-center justify-center disabled:opacity-60"
              >
                {isLoading ? "Creating Account..." : "Sign Up"}
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(false);
                    setError("");
                  }}
                  className="text-sm font-bold text-[#FFCC00] hover:underline cursor-pointer"
                >
                  Already have an account? Log In
                </button>
              </div>
            </form>
          )}
        </div>
      </main>

      <footer className="w-full py-4 text-center">
        <p className="text-[11px] text-slate-600">
          BookHive &bull; STI West Negros University Library System
        </p>
      </footer>
    </div>
  );
}
