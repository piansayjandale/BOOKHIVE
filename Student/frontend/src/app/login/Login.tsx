
import React, { useState } from "react";
import "./Login.css";

// If your image is in public/login-bg.jpg, you can use "/login-bg.jpg"

const Login: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password.trim()) {
      setError("Please enter both email and password.");
      return;
    }
    // Simulate login
    // eslint-disable-next-line no-console
    console.log({ email, password, rememberMe });
  };

  return (
    <div className="login-root">
      <img src="/login-bg.jpg" alt="Background" className="login-bg" />
      <div className="login-bg-overlay" />
      <div className="login-card-container">
        <div className="login-card">
          <div className="login-card-left">
            <div className="login-card-img-wrapper">
              <img src="/login-bg.jpg" alt="STI Building" className="login-card-img" />
              <div className="login-card-img-overlay" />
            </div>
          </div>
          <div className="login-card-right">
            <form className="login-form" onSubmit={handleSubmit} autoComplete="off">
              <div className="login-title">BOOKHIVE</div>
              <div className="login-subtitle">Login Your Account</div>
              <div className="login-field">
                <label htmlFor="email" className="login-label">EMAIL ADDRESS</label>
                <input
                  id="email"
                  type="email"
                  className="login-input"
                  placeholder="yourname@example.com"
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
                  placeholder="••••••••"
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
                <a className="login-forgot" href="#">Forgot Password?</a>
              </div>
              <button className="login-btn" type="submit">
                SUBMIT
              </button>
              <div className="login-bottom-link" tabIndex={0} role="button">
                Create Account
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
