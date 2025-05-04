const chatBox = document.getElementById("chat-box");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const regenerateBtn = document.getElementById("regenerate-btn");
const logoutBtn = document.getElementById("logout-btn");
const themeToggle = document.getElementById("theme-toggle");
const thinkingIndicator = document.getElementById("thinking-indicator");
const drawer = document.getElementById("drawer");
const openDrawerBtn = document.getElementById("open-drawer");
const closeDrawerBtn = drawer.querySelector(".close-btn");
const chatList = document.getElementById("chat-list");

let session = null;
let currentChatId = null;
let lastUserMessage = "";

// Function to display messages (user or bot)
function showMessage(sender, text) {
  const message = document.createElement("div");
  message.classList.add("message", sender);
  message.innerHTML = `
    <img src="${sender === 'user' ? 'assets/user.png' : 'assets/bot.png'}" alt="${sender}">
    <div class="message-content">${text}</div>
  `;
  chatBox.appendChild(message);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// Toggle the 'thinking' indicator when the bot is processing
function toggleThinking(show) {
  thinkingIndicator.style.display = show ? "block" : "none";
}

/function loadSession() {
  fetch("/api/session", { credentials: "include" })
    .then(res => res.json())
    .then(data => {
      if (data.loggedIn) {
        session = { email: data.email }; // optional: store it locally if needed
      } else {
        window.location.href = "login.html";
      }
    })
    .catch(err => {
      console.error("Session check failed:", err);
      window.location.href = "login.html";
    });
}

// Save chat history locally
function saveChatLocally(chatId, chat) {
  let history = JSON.parse(localStorage.getItem("chatHistory")) || {};
  history[chatId] = chat;
  localStorage.setItem("chatHistory", JSON.stringify(history));
}

// Render a chat history into the chat box
function renderChat(chat) {
  chatBox.innerHTML = "";
  chat.forEach(msg => showMessage(msg.role === "user" ? "user" : "bot", msg.content));
}

// Load a specific chat by ID
function loadChat(chatId) {
  fetch(`/chat/${chatId}`, {
    headers: { "Authorization": session.email }
  })
    .then(res => res.json())
    .then(data => {
      currentChatId = chatId;
      renderChat(data.chat);
    })
    .catch(err => console.error('Error loading chat:', err));
}

// Refresh the list of chats
function refreshChatList() {
  fetch(`/chats`, {
    headers: { "Authorization": session.email }
  })
    .then(res => res.json())
    .then(data => {
      chatList.innerHTML = "";
      data.chats.forEach(chat => {
        const btn = document.createElement("button");
        btn.textContent = chat.title || "Untitled Chat";
        btn.onclick = () => loadChat(chat.id);
        chatList.appendChild(btn);
      });
    })
    .catch(err => console.error('Error refreshing chat list:', err));
}

// Send message to the backend and get the response
function sendMessage(message) {
  if (!message.trim()) return; // Don't send if the message is empty

  lastUserMessage = message; // Store the last user message
  showMessage("user", message); // Display user's message in chat
  userInput.value = ""; // Clear the input field
  toggleThinking(true); // Show the thinking indicator while processing

  fetch("/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": session.email // Pass session email for user identification
    },
    body: JSON.stringify({ chatId: currentChatId, message })
  })
    .then(res => res.json())
    .then(data => {
      currentChatId = data.chatId; // Update the current chat ID
      showMessage("bot", data.reply); // Display bot's response
      toggleThinking(false); // Hide the thinking indicator
      saveChatLocally(data.chatId, data.chat); // Save the chat history locally
      refreshChatList(); // Refresh the list of chats after a new message
    })
    .catch(err => {
      console.error(err);
      toggleThinking(false); // Hide the thinking indicator on error
    });
}

// Event listeners for sending messages
sendBtn.onclick = () => sendMessage(userInput.value);
userInput.addEventListener("keydown", e => {
  if (e.key === "Enter") sendMessage(userInput.value); // Send message on Enter key press
});

// Regenerate the last message from the user
regenerateBtn.onclick = () => {
  if (lastUserMessage) sendMessage(lastUserMessage); // Send the last message again
};

// Logout functionality
logoutBtn.onclick = () => {
  localStorage.removeItem("session"); // Clear session data from local storage
  window.location.href = "login.html"; // Redirect to the login page
};

// Theme toggle (light/dark)
themeToggle.onclick = () => {
  const currentTheme = document.documentElement.getAttribute("data-theme");
  const nextTheme = currentTheme === "dark" ? "light" : "dark"; // Toggle between dark and light
  document.documentElement.setAttribute("data-theme", nextTheme);
  localStorage.setItem("theme", nextTheme); // Save the selected theme to localStorage
};

// Initialize settings on page load
window.onload = () => {
  loadSession(); // Load session when the page loads
  const savedTheme = localStorage.getItem("theme") || "light"; // Get saved theme or default to light
  document.documentElement.setAttribute("data-theme", savedTheme); // Set the page's theme
  refreshChatList(); // Refresh the chat list
};

// Open and close the settings drawer
openDrawerBtn.onclick = () => drawer.classList.add("open");
closeDrawerBtn.onclick = () => drawer.classList.remove("open");
