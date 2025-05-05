// Function to check if the user is logged in
function checkSession() {
  fetch("/api/session", { credentials: "include" })
    .then(res => res.json())
    .then(data => {
      if (data.loggedIn) {
        // If logged in, store session data locally
        localStorage.setItem("session", JSON.stringify({ email: data.email }));
      } else {
        // Redirect to login if not logged in
        window.location.href = "login.html";
      }
    })
    .catch(err => {
      console.error("Error checking session:", err);
      window.location.href = "login.html"; // Redirect to login if there’s an error
    });
}

// Function to log out the user
function logout() {
  fetch("/api/logout", { method: "POST", credentials: "include" })
    .then(() => {
      localStorage.removeItem("session"); // Clear session data
      window.location.href = "login.html"; // Redirect to login page
    })
    .catch(err => {
      console.error("Error logging out:", err);
      localStorage.removeItem("session");
      window.location.href = "login.html"; // Redirect even in case of an error
    });
}

// Initialize session check immediately on page load
(function() {
  const sessionData = localStorage.getItem("session");
  if (!sessionData) {
    window.location.href = "login.html"; // Redirect to login if no session found
  } else {
    const session = JSON.parse(sessionData);
    // Check session validity via the server
    checkSession();
  }
})();
