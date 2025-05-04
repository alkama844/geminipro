// Initialize chat variables
let chatId = null;
const userEmail = localStorage.getItem('email'); // Assuming email is stored in localStorage after login
const chatContainer = document.getElementById('chat-container');
const inputField = document.getElementById('user-input');
const sendButton = document.getElementById('send-btn');
const thinkingIndicator = document.getElementById('thinking-indicator'); // Assuming this is a DOM element showing the "thinking..." text

// Fetch previous chats on page load (if any)
window.onload = async () => {
  if (userEmail) {
    // Fetch and display previous chats
    const response = await fetch(`/chats/${userEmail}`);
    const chats = await response.json();
    displayPreviousChats(chats);
  } else {
    alert('Please login to view your chats.');
  }
};

// Display previous chats for a specific user
function displayPreviousChats(chats) {
  Object.keys(chats).forEach(chatKey => {
    const chat = chats[chatKey];
    chat.forEach(message => {
      addMessageToChat(message.user, 'user');
      addMessageToChat(message.bot, 'bot');
    });
  });
}

// Send a new message to the backend
async function sendMessage() {
  const message = inputField.value.trim();
  if (!message) return;

  // Show "thinking..." indicator
  thinkingIndicator.style.display = 'block';

  // Add user message to chat
  addMessageToChat(message, 'user');

  // Send message to backend
  const response = await fetch('/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: userEmail,
      message,
      chatId
    })
  });

  const data = await response.json();
  if (response.ok) {
    const botReply = data.reply;
    chatId = data.chatId; // Update the chatId for this session
    addMessageToChat(botReply, 'bot');
  } else {
    alert('Error: ' + data.error);
  }

  // Hide "thinking..." indicator
  thinkingIndicator.style.display = 'none';

  // Clear input field
  inputField.value = '';
}

// Add message to the chat container
function addMessageToChat(message, sender) {
  const messageElement = document.createElement('div');
  messageElement.classList.add('chat-message');
  messageElement.classList.add(sender);
  messageElement.textContent = message;
  chatContainer.appendChild(messageElement);
}

// Listen for the send button click
sendButton.addEventListener('click', sendMessage);

// Optional: Listen for pressing 'Enter' to send a message
inputField.addEventListener('keypress', (event) => {
  if (event.key === 'Enter') {
    sendMessage();
  }
});
