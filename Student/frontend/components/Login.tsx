import React, { useState, FormEvent } from "react";
import styles from "./Login.module.css";

const Login: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      alert("Please fill in both email and password.");
      return;
    }
    console.log("Login submitted", { email, password, rememberMe });
  };

  return (
    <div className={styles.background}>
      <div className={styles.overlay}>
        <div className={styles.container}>
          {/* LEFT PANEL */}
          <div className={styles.leftPanel} />
          {/* RIGHT PANEL */}
          <div className={styles.rightPanel}>
            <h1 className={styles.title}>BOOKHIVE</h1>
            <p className={styles.subtitle}>Login Your Account</p>
            <form className={styles.form} onSubmit={handleSubmit}>
              {/* Email */}
              <div className={styles.inputGroup}>
                <label className={styles.label}>EMAIL ADDRESS</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className={styles.input}
                  required
                />
              </div>
              {/* Password */}
              <div className={styles.inputGroup}>
                <label className={styles.label}>PASSWORD</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className={styles.input}
                  required
                />
              </div>
              {/* Options Row */}
              <div className={styles.optionsRow}>
                <label className={styles.remember}>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className={styles.checkbox}
                  />
                  Remember
                </label>
                <a href="#" className={styles.forgot}>Forgot Password?</a>
              </div>
              {/* Submit Button */}
              <button type="submit" className={styles.submitButton}>LOGIN</button>
            </form>
            <div className={styles.bottomLink}>
              <a href="#" className={styles.createAccount}>Create Account</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
