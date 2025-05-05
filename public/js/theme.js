// Function to set the theme based on localStorage or default to "light"
function setTheme() {
  const savedTheme = localStorage.getItem("theme") || "light";
  document.documentElement.setAttribute("data-theme", savedTheme);
}

// Function to toggle the theme between light and dark
function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute("data-theme");
  const nextTheme = currentTheme === "dark" ? "light" : "dark";
  
  // Toggle the theme on the document element
  document.documentElement.setAttribute("data-theme", nextTheme);
  
  // Save the selected theme in localStorage
  localStorage.setItem("theme", nextTheme);
}

// Set the theme on page load
setTheme();

// Theme toggle button functionality
const themeToggle = document.getElementById("theme-toggle");
if (themeToggle) {
  themeToggle.onclick = toggleTheme;
}
