"use client";

import React, { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { useSession } from "@/components/providers/session-provider";
import { useNavigationTransition } from "@/components/providers/navigation-provider";
import "./Login.css";

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useSession();
  const { startNavigation } = useNavigationTransition();
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Load remembered email if previously saved
    if (typeof window !== "undefined") {
      const savedEmail = localStorage.getItem("bookhive_remember_email");
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
      }
    }
  }, []);

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

    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      setError("Please fill in both email and password.");
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
          identifier: trimmedEmail,
          password: trimmedPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Invalid credentials. Please verify your school email and password.");
        setIsLoading(false);
        return;
      }

      // Handle Remember Me
      if (typeof window !== "undefined") {
        if (rememberMe) {
          localStorage.setItem("bookhive_remember_email", trimmedEmail);
        } else {
          localStorage.removeItem("bookhive_remember_email");
        }
      }

      // Check user role
      const userRole = (data.user?.role || "").toLowerCase().trim();
      const isStudent = userRole === "student";

      // Save student session in localStorage for web companion
      if (typeof window !== "undefined" && data.user) {
        try {
          sessionStorage.setItem("bookhive_tab_user", JSON.stringify(data.user));
        } catch {}
        localStorage.setItem("bookhive_student_user", JSON.stringify(data.user));
        if (data.token) localStorage.setItem("bookhive_token", data.token);
      }

      if (data.user) {
        setUser(data.user);
      }
      const destPath = isStudent
        ? "/student"
        : data.redirectPath && data.redirectPath !== "/login"
        ? data.redirectPath
        : "/librarian";
      startNavigation(destPath, { fullScreen: true });
      router.replace(destPath);
    } catch (err) {
      console.error("Login error:", err);
      setError("Unable to connect to BookHive services. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page" suppressHydrationWarning>
      {/* Background Building Image & Translucent Dark Overlay */}
      <img
        src="/login-bg.jpg"
        alt="STI Campus Building"
        className="login-bg"
        suppressHydrationWarning
      />
      <div className="login-bg-overlay" />

      {/* Main 2-Column Card Container */}
      <div className="login-container">
        {/* Left Panel: Yellow Brand Section with STI Logo and LIBRARY */}
        <div className="left-panel">
          <div className="sti-brand-container">
            <img
              src="/sti-logo.png"
              alt="STI Logo"
              className="sti-brand-logo"
              suppressHydrationWarning
            />
            <div className="sti-brand-library">LIBRARY</div>
          </div>
        </div>

        {/* Right Panel: Clean White Form */}
        <div className="right-panel">
          <h1 className="login-title">BOOKHIVE</h1>
          <p className="login-subtitle">Login Your Account</p>

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            {error && <div className="login-error">{error}</div>}

            {/* Email Address Field */}
            <div className="login-field">
              <label htmlFor="email" className="login-label">
                EMAIL ADDRESS
              </label>
              <input
                id="email"
                type="email"
                className="login-input"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError("");
                }}
                placeholder="Gmail"
                autoComplete="username"
                spellCheck={false}
                disabled={isLoading}
                required
                suppressHydrationWarning
              />
            </div>

            {/* Password Field */}
            <div className="login-field">
              <label htmlFor="password" className="login-label">
                PASSWORD
              </label>
              <div className="password-input-wrapper">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  className="login-input"
                  value={password}
                  placeholder="password"
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError("");
                  }}
                  autoComplete="current-password"
                  disabled={isLoading}
                  required
                  suppressHydrationWarning
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="password-toggle"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Options Row: Remember Me & Forgot Password */}
            <div className="login-options-row">
              <label className="login-checkbox-label">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={isLoading}
                />
                <span>Remember</span>
              </label>

              <a
                href="#forgot-password"
                className="login-forgot"
                onClick={(e) => {
                  e.preventDefault();
                  setShowForgotModal(true);
                }}
              >
                Forgot Password?
              </a>
            </div>

            {/* Submit Button */}
            <button className="login-btn" type="submit" disabled={isLoading}>
              {isLoading ? "LOGGING IN..." : "SUBMIT"}
            </button>
          </form>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div
          className="forgot-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowForgotModal(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="forgot-modal-title"
        >
          <div className="forgot-modal-card">
            <div className="forgot-modal-top-accent" />

            <div className="forgot-modal-header">
              <div className="forgot-modal-header-content">
                <div className="forgot-modal-icon-badge">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <div>
                  <h2 id="forgot-modal-title" className="forgot-modal-title">
                    Password Assistance
                  </h2>
                  <p className="forgot-modal-subtitle">BookHive Account Security</p>
                </div>
              </div>
              <button
                type="button"
                className="forgot-modal-close-btn"
                onClick={() => setShowForgotModal(false)}
                aria-label="Close dialog"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            <div className="forgot-modal-body">
              <div className="forgot-alert-box">
                <svg
                  className="forgot-alert-icon"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" x2="12" y1="8" y2="12" />
                  <line x1="12" x2="12.01" y1="16" y2="16" />
                </svg>
                <div className="forgot-alert-text">
                  <strong>Please contact the Super Administrator:</strong> To reset your password, reach out directly to the Super Administrator. Self-service password reset is disabled for institutional security.
                </div>
              </div>

              <div className="forgot-contact-card">
                <div className="forgot-contact-title">Super Administrator Contact</div>

                <div className="forgot-contact-item">
                  <svg
                    className="forgot-contact-item-icon"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  <div>
                    <div className="forgot-contact-label">Administrator</div>
                    <div className="forgot-contact-value">Super Administrator</div>
                  </div>
                </div>

                <div className="forgot-contact-item">
                  <svg
                    className="forgot-contact-item-icon"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect width="20" height="16" x="2" y="4" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                  <div>
                    <div className="forgot-contact-label">Official Support Email</div>
                    <a
                      href="mailto:superadmin@stiwnu.edu.ph"
                      className="forgot-contact-email-link"
                    >
                      superadmin@stiwnu.edu.ph
                    </a>
                  </div>
                </div>

                <div className="forgot-contact-item">
                  <svg
                    className="forgot-contact-item-icon"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  <div>
                    <div className="forgot-contact-label">Office Location</div>
                    <div className="forgot-contact-value">
                      STI WNU Library Services / ICT Admin Desk
                    </div>
                  </div>
                </div>
              </div>

              <p className="forgot-instructions">
                When contacting the Super Administrator, please specify your{" "}
                <strong>Full Name</strong>, <strong>Employee/Student ID Number</strong>, and registered{" "}
                <strong>Email Address</strong>.
              </p>
            </div>

            <div className="forgot-modal-footer">
              <button
                type="button"
                className="forgot-modal-btn-close"
                onClick={() => setShowForgotModal(false)}
              >
                Close
              </button>
              <a
                href="mailto:superadmin@stiwnu.edu.ph?subject=BookHive%20Password%20Reset%20Request&body=Hello%20Super%20Administrator,%0D%0A%0D%0AI%20am%20requesting%20a%20password%20reset%20for%20my%20BookHive%20account.%0D%0A%0D%0AFull%20Name:%20%0D%0AEmployee/Student%20ID:%20%0D%0ARegistered%20Email:%20%0D%0A%0D%0AThank%20you."
                className="forgot-modal-btn-email"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect width="20" height="16" x="2" y="4" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
                Email Super Administrator
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
