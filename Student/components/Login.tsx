import React, { useState, FormEvent } from 'react';
import styles from './Login.module.css';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      alert('Please fill in both email and password.');
      return;
    }
    console.log('Login credentials:', { email, password, rememberMe });
    // TODO: integrate real authentication API
  };

  return (
    <div className={styles.loginPage}>
      <div className={styles.loginContainer}>
        <div className={styles.leftPanel} />
        <div className={styles.rightPanel}>
          <h1 className={styles.title}>BOOKHIVE</h1>
          <p className={styles.subtitle}>Login Your Account</p>
          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.formGroup}>
              <label htmlFor="email" className={styles.label}>Email Address</label>
              <input
                type="email"
                id="email"
                className={styles.input}
                placeholder="Enter email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="password" className={styles.label}>Password</label>
              <input
                type="password"
                id="password"
                className={styles.input}
                placeholder="Enter password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            <div className={styles.optionsRow}>
              <label className={styles.remember}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                />
                Remember
              </label>
              <a href="#" className={styles.forgot}>Forgot Password?</a>
            </div>
            <button type="submit" className={styles.submitBtn}>Login</button>
          </form>
          <div className={styles.bottomLink}>
            <a href="#" className={styles.createAccount}>Create Account</a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
