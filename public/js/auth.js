// public/js/auth.js

document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("form");
  const authType = form.dataset.authType; // "login" or "signup"
  const statusMsg = document.getElementById("statusMsg");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = form.email.value.trim();
    const password = form.password.value.trim();

    if (!email || !password) {
      return showStatus("Please enter email and password", "error");
    }

    try {
      const res = await fetch(`/api/${authType}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (res.ok) {
        showStatus(data.message, "success");
        setTimeout(() => {
          window.location.href = "/chat.html";
        }, 800);
      } else {
        showStatus(data.error || "Something went wrong", "error");
      }
    } catch (err) {
      showStatus("Network error", "error");
    }
  });

  function showStatus(msg, type) {
    statusMsg.textContent = msg;
    statusMsg.className = type;
    statusMsg.style.opacity = 1;
    setTimeout(() => {
      statusMsg.style.opacity = 0;
    }, 3000);
  }
});
