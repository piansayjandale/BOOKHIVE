async function login() {
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  try {
    const res = await fetch(`${appUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: "joseph.tan@stiwnu.edu.ph",
        password: "BookHiveLibrarian!2026"
      })
    });
    console.log("Status:", res.status);
    console.log("Response:", await res.json());
  } catch (err) {
    console.error(err);
  }
}
login();
