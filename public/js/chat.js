const form = document.getElementById('chat-form');
const input = document.getElementById('message-input');
const messages = document.getElementById('messages');
const regenerateBtn = document.getElementById('regenerate-btn');
const thinkingIndicator = document.getElementById('thinking-indicator');
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const openDrawerBtn = document.getElementById('open-drawer');
const closeDrawerBtn = document.getElementById('close-drawer');
const drawer = document.getElementById('drawer');
const newChatBtn = document.getElementById('new-chat-btn');
const loadChatsBtn = document.getElementById('load-chats-btn');
const logoutBtn = document.getElementById('logout-btn');

let currentChatId = Date.now().toString();
const email = sessionStorage.getItem("userEmail") || "guest@example.com";

function addMessage(text, type) {
  const msg = document.createElement('div');
  msg.className = `message ${type}`;
  const avatar = document.createElement('img');
  avatar.src = type === 'user' ? '/public/user.png' : '/public/ai.png';
  avatar.className = 'msg-avatar';
  const content = document.createElement('div');
  content.textContent = text;
  msg.appendChild(avatar);
  msg.appendChild(content);
  messages.appendChild(msg);
  messages.scrollTop = messages.scrollHeight;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const userMsg = input.value.trim();
  if (!userMsg) return;

  addMessage(userMsg, 'user');
  input.value = '';
  thinkingIndicator.style.display = 'block';

  try {
    const res = await fetch('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, message: userMsg, chatId: currentChatId })
    });

    const data = await res.json();
    currentChatId = data.chatId;
    addMessage(data.reply || 'Sorry, something went wrong.', 'bot');
  } catch (err) {
    console.error('Error:', err);
    addMessage('Error contacting server.', 'bot');
  } finally {
    thinkingIndicator.style.display = 'none';
  }
});

regenerateBtn.addEventListener('click', () => {
  const lastMsg = messages.querySelector('.message.user:last-child');
  if (lastMsg) {
    addMessage(`Reprocessing: "${lastMsg.textContent}"`, 'bot');
  }
});

newChatBtn.addEventListener('click', () => {
  messages.innerHTML = '';
  currentChatId = Date.now().toString();
});

loadChatsBtn.addEventListener('click', async () => {
  try {
    const res = await fetch(`/chats/${email}`);
    const data = await res.json();
    messages.innerHTML = '';
    Object.values(data).flat().forEach(chat => {
      addMessage(chat.user, 'user');
      addMessage(chat.bot, 'bot');
    });
  } catch (err) {
    console.error('Chat history error:', err);
  }
});

logoutBtn.addEventListener('click', () => {
  fetch('/logout')
    .then(() => {
      sessionStorage.clear();
      window.location.href = '/login.html';
    });
});

openDrawerBtn.addEventListener('click', () => drawer.classList.add('open'));
closeDrawerBtn.addEventListener('click', () => drawer.classList.remove('open'));

themeToggleBtn.addEventListener('click', () => {
  document.body.classList.toggle('dark-theme');
  localStorage.setItem('theme', document.body.classList.contains('dark-theme') ? 'dark' : 'light');
});

window.addEventListener('DOMContentLoaded', () => {
  if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-theme');
  }
});
