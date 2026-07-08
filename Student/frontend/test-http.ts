async function login() {
  try {
    const res = await fetch("http://localhost:3000/api/auth/login", {
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
