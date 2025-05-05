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
let isSending = false;

// Show user or bot message
function showMessage(sender, text) {
  const message = document.createElement("div");
  message.classList.add("message", sender);
  message.innerHTML = `
    <img src="${sender === 'user' ? 'assets/user.png' : 'assets/bot.png'}" alt="${sender}">
    <div class="message-content">${text}</div>`;
  chatBox.appendChild(message);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// Toggle thinking animation
function toggleThinking(show) {
  thinkingIndicator.style.display = show ? "block" : "none";
}

// Load session via cookie check
function loadSession() {
  fetch("/api/session", { credentials: "include" })
    .then(res => res.json())
    .then(data => {
      if (data.loggedIn) {
        session = { email: data.email };
        refreshChatList();
      } else {
        loadLocalChats();
      }
    })
    .catch(() => loadLocalChats());
}

// Save to localStorage
function saveChatLocally(chatId, chat) {
  const history = JSON.parse(localStorage.getItem("chatHistory")) || {};
  history[chatId] = chat;
  localStorage.setItem("chatHistory", JSON.stringify(history));
}

// Load from localStorage
function loadLocalChats() {
  const history = JSON.parse(localStorage.getItem("chatHistory")) || {};
  chatList.innerHTML = "";
  Object.entries(history).forEach(([id, chat]) => {
    const btn = document.createElement("button");
    btn.textContent = `Local Chat ${id}`;
    btn.onclick = () => {
      currentChatId = id;
      renderChat(chat);
      drawer.classList.remove("open");
    };
    chatList.appendChild(btn);
  });
}

// Show full chat
function renderChat(chat) {
  chatBox.innerHTML = "";
  chat.forEach(msg => showMessage(msg.role === "user" ? "user" : "bot", msg.content));
}

// Load one chat
function loadChat(chatId) {
  if (session) {
    fetch(`/chat/${chatId}`, {
      headers: { "Authorization": session.email }
    })
      .then(res => res.json())
      .then(data => {
        currentChatId = chatId;
        renderChat(data.chat);
      })
      .catch(err => console.error("Error loading chat:", err));
  } else {
    const history = JSON.parse(localStorage.getItem("chatHistory")) || {};
    if (history[chatId]) {
      currentChatId = chatId;
      renderChat(history[chatId]);
    }
  }
}

// Get all chats
function refreshChatList() {
  if (!session) return;
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

// Send message to backend
// Send message to backend
function sendMessage(message) {
  if (!message.trim() || isSending) return;

  lastUserMessage = message;
  isSending = true; // Lock the isSending flag
  showMessage("user", message);
  userInput.value = "";
  toggleThinking(true);

  fetch("/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(session && { "Authorization": session.email })
    },
    body: JSON.stringify({ chatId: currentChatId, message })
  })
    .then(res => {
      if (!res.ok) {
        // Handle specific response errors
        return res.text().then(text => { 
          throw new Error(text || "Gemini backend error."); 
        });
      }
      return res.json();
    })
    .then(data => {
      currentChatId = data.chatId;
      showMessage("bot", data.reply);
      saveChatLocally(data.chatId, data.chat);
      if (session) refreshChatList();
    })
    .catch(err => {
      // More detailed error logging
      console.error("Error sending message:", err);
      if (err.message.includes("Gemini backend error")) {
        showMessage("bot", "Sorry, we couldn't process your request right now. Please try again later.");
      } else {
        showMessage("bot", "Oops! Something went wrong. Try again.");
      }
    })
    .finally(() => {
      toggleThinking(false);
      isSending = false; // Unlock after message is sent
    });
}

// Events
// Remove the duplicate sendBtn.onclick
// This code will be enough:
sendBtn.onclick = () => sendMessage(userInput.value);
userInput.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault(); // Prevent newline
    sendMessage(userInput.value);
  }
});



regenerateBtn.onclick = () => {
  if (lastUserMessage && !isSending) sendMessage(lastUserMessage);
};

logoutBtn.onclick = () => {
  fetch("/api/logout", { method: "POST", credentials: "include" })
    .then(() => {
      session = null;
      localStorage.clear();
      alert("Logged out. Using local mode now.");
      location.reload();
    })
    .catch(err => console.error("Logout failed:", err));
};

newChatBtn.onclick = () => {
  currentChatId = null;
  lastUserMessage = "";
  chatBox.innerHTML = "";
};

openDrawerBtn.onclick = () => drawer.classList.add("open");
closeDrawerBtn.onclick = () => drawer.classList.remove("open");

// Init
window.onload = () => loadSession();
