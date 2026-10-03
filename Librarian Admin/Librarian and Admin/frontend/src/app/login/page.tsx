"use client";

import React, { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/components/providers/theme-provider';
import './Login.css';

const LoginPage: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowForgotModal(false);
      }
    };
    if (showForgotModal) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showForgotModal]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Validation
    if (!email.trim() || !password.trim()) {
      setError('Please fill in both email and password.');
      setIsLoading(false);
      return;
    }

    if (!email.includes('@')) {
      setError('Please enter a valid email address.');
      setIsLoading(false);
      return;
    }

    try {
      // Call authentication API
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identifier: email.trim(),
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Login failed. Please check your credentials.');
        setIsLoading(false);
        return;
      }

      // Redirect based on the path provided by the API
      if (data.redirectPath) {
        window.location.assign(data.redirectPath);
      } else {
        window.location.assign('/dashboard');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('An error occurred during login. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page" data-theme={mounted ? theme : "light"} suppressHydrationWarning>
      <img 
        src="/login-building.jpg" 
        alt="Background" 
        className="login-bg" 
        suppressHydrationWarning 
      />
      <div className="login-bg-overlay" />
      <div className="login-container" style={{ position: 'relative', zIndex: 10 }}>
        {/* LEFT PANEL */}
        <div 
          className="left-panel" 
          role="img" 
          aria-label="STI Logo and Library" 
          style={{ backgroundColor: '#FFF200' }}
        >
          <div className="sti-brand-container">
            <img 
              src="/sti-logo.png" 
              className="sti-brand-logo" 
              alt="STI Logo" 
              suppressHydrationWarning
            />
            <div className="sti-brand-library">LIBRARY</div>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="right-panel">
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

          <h1 className="title">BOOKHIVE</h1>
          <p className="subtitle">Login Your Account</p>

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            {error && <div className="login-error">{error}</div>}

            <div className="form-group">
              <label htmlFor="email" className="label">EMAIL ADDRESS</label>
              <input
                id="email"
                type="email"
                className="input"
                value={email}
                onChange={e => setEmail(e.target.value)}
                aria-required="true"
                autoComplete="username"
                required
                disabled={isLoading}
                suppressHydrationWarning
              />
            </div>

            <div className="form-group">
              <label htmlFor="password" className="label">PASSWORD</label>
              <div className="password-input-wrapper">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className="input"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  aria-required="true"
                  autoComplete="current-password"
                  required
                  disabled={isLoading}
                  suppressHydrationWarning
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                  aria-label="Toggle password visibility"
                  suppressHydrationWarning
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', right: '8px' }}
                >
                  {showPassword ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ color: mounted && theme === 'dark' ? '#94a3b8' : '#000000', opacity: 0.85 }}
                    >
                      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                      <path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                      <line x1="2" y1="2" x2="22" y2="22" />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ color: mounted && theme === 'dark' ? '#94a3b8' : '#000000', opacity: 0.85 }}
                    >
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="options-row">
              <label className="remember">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  disabled={isLoading}
                  suppressHydrationWarning
                />
                Remember
              </label>
              <a 
                href="#forgot-password" 
                className="forgot-password" 
                onClick={e => {
                  e.preventDefault();
                  setShowForgotModal(true);
                }}
              >
                Forgot Password?
              </a>
            </div>

            <button 
              type="submit" 
              className="submit-btn"
              disabled={isLoading}
              suppressHydrationWarning
            >
              {isLoading ? 'SIGNING IN...' : 'SUBMIT'}
            </button>
          </form>
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

export default LoginPage;
