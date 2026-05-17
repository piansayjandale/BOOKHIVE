"use client";

import React, { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import './Login.css';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

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
    <div className="login-page">
      <div className="login-container">
        {/* LEFT PANEL */}
        <div 
          className="left-panel" 
          role="img" 
          aria-label="STI library building illustration"
        />

        {/* RIGHT PANEL */}
        <div className="right-panel">
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
                placeholder="yourname@example.com"
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
                  placeholder="••••••••"
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
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
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
              <a href="#" className="forgot-password" onClick={e => e.preventDefault()}>
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

          <div className="bottom-link">
            <a href="/signup" className="create-account">Create Account</a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
