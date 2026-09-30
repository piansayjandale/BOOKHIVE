
"use client";

import React, { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/components/providers/theme-provider";
import "./Login.css";

const Login: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setMounted(true);
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

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password.trim()) {
      setError("Please enter both email and password.");
      return;
    }
    console.log({ email, password, rememberMe });
  };

  return (
    <div className="login-root" data-theme={mounted ? theme : "light"} suppressHydrationWarning>
      <img src="/login-bg.jpg" alt="Background" className="login-bg" />
      <div className="login-bg-overlay" />
      <div className="login-card-container">
        <div className="login-card">
          <div className="login-card-left" style={{ backgroundColor: '#FFF200' }}>
            <div className="sti-brand-container">
              <img src="/sti-logo.png" alt="STI Logo" className="sti-brand-logo" />
              <div className="sti-brand-library">LIBRARY</div>
            </div>
          </div>
          <div className="login-card-right" style={{ position: 'relative' }}>
            {/* In-Card Theme Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              className="card-theme-toggle-btn"
              aria-label={`Switch to ${mounted ? (theme === 'dark' ? 'light' : 'dark') : 'dark'} mode`}
              title={`Switch to ${mounted ? (theme === 'dark' ? 'light' : 'dark') : 'dark'} mode`}
              suppressHydrationWarning
            >
              {mounted && theme === 'dark' ? (
                <Sun className="h-4 w-4 text-amber-400" />
              ) : (
                <Moon className="h-4 w-4 text-slate-600" />
              )}
            </button>

            <form className="login-form" onSubmit={handleSubmit} autoComplete="off">
              <div className="login-title">BOOKHIVE</div>
              <div className="login-subtitle">Login Your Account</div>
              <div className="login-field">
                <label htmlFor="email" className="login-label">EMAIL ADDRESS</label>
                <input
                  id="email"
                  type="email"
                  className="login-input"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="username"
                  spellCheck={false}
                  required
                />
              </div>
              <div className="login-field">
                <label htmlFor="password" className="login-label">PASSWORD</label>
                <input
                  id="password"
                  type="password"
                  className="login-input"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
              {error && (
                <div className="login-error">{error}</div>
              )}
              <div className="login-options-row">
                <label className="login-checkbox-label">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                  />
                  <span>Remember</span>
                </label>
                <a 
                  className="login-forgot" 
                  href="#forgot-password"
                  onClick={e => {
                    e.preventDefault();
                    setShowForgotModal(true);
                  }}
                >
                  Forgot Password?
                </a>
              </div>
              <button className="login-btn" type="submit">
                SUBMIT
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* FORGOT PASSWORD MODAL */}
      {showForgotModal && (
        <div 
          className="forgot-modal-backdrop" 
          onClick={e => {
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
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </div>
                <div>
                  <h2 id="forgot-modal-title" className="forgot-modal-title">Password Assistance</h2>
                  <p className="forgot-modal-subtitle">BookHive Account Security</p>
                </div>
              </div>
              <button 
                type="button" 
                className="forgot-modal-close-btn"
                onClick={() => setShowForgotModal(false)}
                aria-label="Close dialog"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18"/>
                  <path d="m6 6 12 12"/>
                </svg>
              </button>
            </div>

            <div className="forgot-modal-body">
              <div className="forgot-alert-box">
                <svg className="forgot-alert-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" x2="12" y1="8" y2="12"/>
                  <line x1="12" x2="12.01" y1="16" y2="16"/>
                </svg>
                <div className="forgot-alert-text">
                  <strong>Please contact the Super Administrator:</strong> To reset your password, reach out directly to the Super Administrator. Self-service password reset is disabled for institutional security.
                </div>
              </div>

              <div className="forgot-contact-card">
                <div className="forgot-contact-title">Super Administrator Contact</div>
                
                <div className="forgot-contact-item">
                  <svg className="forgot-contact-item-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                  <div>
                    <div className="forgot-contact-label">Administrator</div>
                    <div className="forgot-contact-value">Super Administrator</div>
                  </div>
                </div>

                <div className="forgot-contact-item">
                  <svg className="forgot-contact-item-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="16" x="2" y="4" rx="2"/>
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                  </svg>
                  <div>
                    <div className="forgot-contact-label">Official Support Email</div>
                    <a href="mailto:superadmin@stiwnu.edu.ph" className="forgot-contact-email-link">
                      superadmin@stiwnu.edu.ph
                    </a>
                  </div>
                </div>

                <div className="forgot-contact-item">
                  <svg className="forgot-contact-item-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                  <div>
                    <div className="forgot-contact-label">Office Location</div>
                    <div className="forgot-contact-value">STI WNU Library Services / ICT Admin Desk</div>
                  </div>
                </div>
              </div>

              <p className="forgot-instructions">
                When contacting the Super Administrator, please specify your <strong>Full Name</strong>, <strong>Employee/Student ID Number</strong>, and registered <strong>Email Address</strong>.
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
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="16" x="2" y="4" rx="2"/>
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                </svg>
                Email Super Administrator
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
