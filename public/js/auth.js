// Check user session
function checkSession(callback) {
  fetch("/api/session", { credentials: "include" })
    .then(res => res.json())
    .then(data => {
      if (data.loggedIn) {
        callback(null, data.email);
      } else {
        callback("Not logged in");
      }
    })
    .catch(err => {
      console.error("Session check failed:", err);
      callback("Session error");
    });
}

// Login function
function loginUser(email, password, callback) {
  fetch("/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    credentials: "include"
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) callback(null, data);
      else callback(data.message || "Login failed");
    })
    .catch(err => {
      console.error("Login error:", err);
      callback("Login request failed");
    });
}

// Signup function
function signupUser(email, password, callback) {
  fetch("/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    credentials: "include"
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) callback(null, data);
      else callback(data.message || "Signup failed");
    })
    .catch(err => {
      console.error("Signup error:", err);
      callback("Signup request failed");
    });
}

// Logout function
function logoutUser() {
  fetch("/logout", {
    method: "POST",
    credentials: "include"
  })
    .then(() => {
      localStorage.removeItem("session");
      window.location.href = "login.html";
    })
    .catch(err => {
      console.error("Logout error:", err);
      window.location.href = "login.html";
    });
}
