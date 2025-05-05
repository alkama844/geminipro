// Check for saved theme in localStorage
const savedTheme = localStorage.getItem("theme") || "light";

// Set the theme on page load
document.documentElement.setAttribute("data-theme", savedTheme);

// Theme toggle button functionality
const themeToggle = document.getElementById("theme-toggle");

themeToggle.onclick = () => {
  const currentTheme = document.documentElement.getAttribute("data-theme");
  const nextTheme = currentTheme === "dark" ? "light" : "dark";
  
  // Toggle the theme on the document element
  document.documentElement.setAttribute("data-theme", nextTheme);
  
  // Save the selected theme in localStorage
  localStorage.setItem("theme", nextTheme);
};
