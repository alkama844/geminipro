const chatBox = document.getElementById("chat-box");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const regenerateBtn = document.getElementById("regenerate-btn");
const logoutBtn = document.getElementById("logout-btn");
const thinkingIndicator = document.getElementById("thinking-indicator");
const drawer = document.getElementById("drawer");
const openDrawerBtn = document.getElementById("open-drawer");
const closeDrawerBtn = drawer.querySelector(".close-btn");
const chatList = document.getElementById("chat-list");
const newChatBtn = document.getElementById("new-chat-btn");

let session = null;
let currentChatId = null;
let lastUserMessage = "";

// Show message in chat
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

// Toggle "thinking..." indicator
function toggleThinking(show) {
  thinkingIndicator.style.display = show ? "block" : "none";
}

// Load user session
function loadSession() {
  fetch("/api/session", { credentials: "include" })
    .then(res => res.json())
    .then(data => {
      if (data.loggedIn) {
        session = { email: data.email };
        refreshChatList(); // Load chat list on session check
      } else {
        window.location.href = "login.html"; // Redirect to login if not logged in
      }
    })
    .catch(err => {
      console.error("Session check failed:", err);
      window.location.href = "login.html"; // Redirect to login on error
    });
}

// Save chat to localStorage
function saveChatLocally(chatId, chat) {
  let history = JSON.parse(localStorage.getItem("chatHistory")) || {};
  history[chatId] = chat;
  localStorage.setItem("chatHistory", JSON.stringify(history));
}

// Render chat messages
function renderChat(chat) {
  chatBox.innerHTML = "";
  chat.forEach(msg => showMessage(msg.role === "user" ? "user" : "bot", msg.content));
}

// Load chat by ID
function loadChat(chatId) {
  fetch(`/chat/${chatId}`, {
    headers: { "Authorization": session.email }
  })
    .then(res => res.json())
    .then(data => {
      currentChatId = chatId;
      renderChat(data.chat);
    })
    .catch(err => console.error("Error loading chat:", err));
}

// Refresh chat list in drawer
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
        btn.onclick = () => {
          drawer.classList.remove("open");
          loadChat(chat.id);
        };
        chatList.appendChild(btn);
      });
    })
    .catch(err => console.error("Error refreshing chat list:", err));
}

// Send a message to the bot
function sendMessage(message) {
  if (!message.trim()) return;

  lastUserMessage = message;
  showMessage("user", message);
  userInput.value = "";
  toggleThinking(true);

  fetch("/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": session.email
    },
    body: JSON.stringify({ chatId: currentChatId, message })
  })
    .then(res => res.json())
    .then(data => {
      currentChatId = data.chatId;
      showMessage("bot", data.reply);
      toggleThinking(false);
      saveChatLocally(data.chatId, data.chat);
      refreshChatList(); // Refresh the chat list after sending a message
    })
    .catch(err => {
      console.error(err);
      toggleThinking(false); // Stop thinking indicator on error
    });
}

// Event listeners
sendBtn.onclick = () => sendMessage(userInput.value);
userInput.addEventListener("keydown", e => {
  if (e.key === "Enter") sendMessage(userInput.value);
});

regenerateBtn.onclick = () => {
  if (lastUserMessage) sendMessage(lastUserMessage);
};

logoutBtn.onclick = () => {
  localStorage.removeItem("session");
  window.location.href = "login.html"; // Redirect to login page on logout
};

newChatBtn.onclick = () => {
  currentChatId = null;
  lastUserMessage = "";
  chatBox.innerHTML = ""; // Clear the chat window for a new chat
};

// Open/close drawer
openDrawerBtn.onclick = () => drawer.classList.add("open");
closeDrawerBtn.onclick = () => drawer.classList.remove("open");

// Init on load
window.onload = () => {
  loadSession(); // Load session when page loads
};
