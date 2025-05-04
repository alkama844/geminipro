document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.getElementById('theme-toggle');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const savedTheme = localStorage.getItem('theme');

  // Function to apply theme and save it to localStorage
  const applyTheme = (theme) => {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  };

  // Function to determine the initial theme
  const getInitialTheme = () => {
    if (savedTheme) return savedTheme;
    return prefersDark ? 'dark' : 'light';
  };

  // Set the current theme and apply it
  const currentTheme = getInitialTheme();
  applyTheme(currentTheme);

  // Update button text according to the current theme
  if (toggleBtn) {
    toggleBtn.textContent = currentTheme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode';

    // Toggle between dark and light mode on button click
    toggleBtn.addEventListener('click', () => {
      const newTheme = document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(newTheme);
      toggleBtn.textContent = newTheme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode';
    });
  }
});
