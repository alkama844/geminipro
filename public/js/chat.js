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

function toggleThinking(show) {
  thinkingIndicator.style.display = show ? "block" : "none";
}

function loadSession() {
  session = JSON.parse(localStorage.getItem("session"));
  if (!session || !session.email) {
    window.location.href = "login.html";
  }
}

function saveChatLocally(chatId, chat) {
  let history = JSON.parse(localStorage.getItem("chatHistory")) || {};
  history[chatId] = chat;
  localStorage.setItem("chatHistory", JSON.stringify(history));
}

function renderChat(chat) {
  chatBox.innerHTML = "";
  chat.forEach(msg => showMessage(msg.role === "user" ? "user" : "bot", msg.content));
}

function loadChat(chatId) {
  fetch(`/chat/${chatId}`, {
    headers: { "Authorization": session.email }
  })
    .then(res => res.json())
    .then(data => {
      currentChatId = chatId;
      renderChat(data.chat);
    });
}

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
    });
}

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
      refreshChatList();
    })
    .catch(err => {
      console.error(err);
      toggleThinking(false);
    });
}

sendBtn.onclick = () => sendMessage(userInput.value);
userInput.addEventListener("keydown", e => {
  if (e.key === "Enter") sendMessage(userInput.value);
});

regenerateBtn.onclick = () => {
  if (lastUserMessage) sendMessage(lastUserMessage);
};

logoutBtn.onclick = () => {
  localStorage.removeItem("session");
  window.location.href = "login.html";
};

themeToggle.onclick = () => {
  const currentTheme = document.documentElement.getAttribute("data-theme");
  const nextTheme = currentTheme === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", nextTheme);
  localStorage.setItem("theme", nextTheme);
};

window.onload = () => {
  loadSession();
  const savedTheme = localStorage.getItem("theme") || "light";
  document.documentElement.setAttribute("data-theme", savedTheme);
  refreshChatList();
};

openDrawerBtn.onclick = () => drawer.classList.add("open");
closeDrawerBtn.onclick = () => drawer.classList.remove("open");
