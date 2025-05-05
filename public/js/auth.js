// Optional: you can keep this if you still want logout to work
function logout() {
  fetch("/api/logout", { method: "POST", credentials: "include" })
    .then(() => {
      localStorage.removeItem("session");
      window.location.href = "login.html";
    })
    .catch(err => {
      console.error("Error logging out:", err);
      localStorage.removeItem("session");
      window.location.href = "login.html";
    });
}
