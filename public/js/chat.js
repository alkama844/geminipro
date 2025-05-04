let isGenerating = false;
let controller = null;

document.addEventListener("DOMContentLoaded", () => {
  const chatBox = document.getElementById("chat-box");
  const input = document.getElementById("chat-input");
  const sendBtn = document.getElementById("send-btn");
  const regenBtn = document.getElementById("regen-btn");
  const stopBtn = document.getElementById("stop-btn");
  const logoutBtn = document.getElementById("logout-btn");

  let lastUserPrompt = "";

  fetch("/api/userinfo")
    .then(res => res.json())
    .then(data => {
      const isGuest = !data.loggedIn;
      document.getElementById("welcome-user").textContent = isGuest
        ? "Hi Guest! Login to save your chats."
        : `Hi ${data.email}!`;
      if (!isGuest) loadChatHistory();
    });

  sendBtn.addEventListener("click", sendMessage);
  regenBtn.addEventListener("click", regenerateResponse);
  stopBtn.addEventListener("click", stopGeneration);

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await fetch("/api/logout");
      location.reload();
    });
  }

  function appendMessage(sender, text) {
    const wrapper = document.createElement("div");
    wrapper.className = `message ${sender}`;

    const avatar = document.createElement("img");
    avatar.src = sender === "user" ? "user.png" : "ai.png";
    avatar.alt = sender;
    avatar.className = "avatar";

    const msg = document.createElement("div");
    msg.className = "msg-bubble";
    msg.textContent = text;

    wrapper.appendChild(avatar);
    wrapper.appendChild(msg);
    chatBox.appendChild(wrapper);
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  async function sendMessage() {
    const prompt = input.value.trim();
    if (!prompt || isGenerating) return;

    lastUserPrompt = prompt;
    appendMessage("user", prompt);
    input.value = "";
    input.disabled = true;
    sendBtn.disabled = true;
    regenBtn.disabled = true;
    stopBtn.disabled = false;
    isGenerating = true;

    appendMessage("ai", "Thinking...");

    controller = new AbortController();

    try {
      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
        signal: controller.signal,
      });

      const data = await res.json();
      const aiMessages = document.querySelectorAll(".message.ai .msg-bubble");
      const latestAiMsg = aiMessages[aiMessages.length - 1];
      latestAiMsg.textContent = data.response || "No response.";
    } catch (err) {
      const aiMessages = document.querySelectorAll(".message.ai .msg-bubble");
      const latestAiMsg = aiMessages[aiMessages.length - 1];
      latestAiMsg.textContent = "Request cancelled or error.";
    }

    input.disabled = false;
    sendBtn.disabled = false;
    regenBtn.disabled = false;
    stopBtn.disabled = true;
    isGenerating = false;
  }

  function stopGeneration() {
    if (controller) controller.abort();
    stopBtn.disabled = true;
    input.disabled = false;
    sendBtn.disabled = false;
    isGenerating = false;
  }

  function regenerateResponse() {
    if (lastUserPrompt) {
      input.value = lastUserPrompt;
      sendMessage();
    }
  }

  async function loadChatHistory() {
    try {
      const res = await fetch("/api/chats");
      const data = await res.json();
      data.chats.forEach(({ role, content }) => appendMessage(role, content));
    } catch (err) {
      console.error("Failed to load history:", err);
    }
  }
});
