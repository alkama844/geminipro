require('dotenv').config();
const express = require('express');
const fs = require('fs');
const bcrypt = require('bcrypt');
const session = require('express-session');
const path = require('path');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

const USERS_FILE = './data/users.json';
const CHATS_FILE = './data/chats.json';

app.use(express.static('public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Setup session
app.use(session({
  secret: process.env.SESSION_SECRET || 'gemini_secret_key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// Read JSON helper
function readJSON(file) {
  try {
    if (!fs.existsSync(file)) return {};
    const data = fs.readFileSync(file, 'utf8');
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error('Error reading file:', error);
    return {};
  }
}

// Write JSON helper
function writeJSON(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error writing file:', error);
  }
}

// Auth Middleware to protect routes
const authMiddleware = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Signup route
app.post('/signup', async (req, res) => {
  const { email, password } = req.body;
  const users = readJSON(USERS_FILE);

  // Check if user already exists
  const existingUser = users.find(user => user.email === email);
  if (existingUser) return res.status(400).json({ error: 'User already exists' });

  try {
    const hashed = await bcrypt.hash(password, 10);
    users.push({ email, password: hashed }); // Save new user
    writeJSON(USERS_FILE, users);
    req.session.user = email; // Set session user after signup
    res.status(201).json({ message: 'Signup successful', user: email });
  } catch (error) {
    res.status(500).json({ error: 'Signup failed' });
  }
});

// Login route
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const users = readJSON(USERS_FILE);

  // Check if user exists
  const user = users.find(u => u.email === email);
  if (!user) return res.status(400).json({ error: 'User not found, please signup' });

  try {
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: 'Incorrect password' });

    req.session.user = email; // Set session user after login
    res.status(200).json({ message: 'Login successful', user: email });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// Logout route
app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.redirect('/');
  });
});

// Gemini API wrapper
async function getGeminiReply(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  try {
    const result = await axios.post(url, {
      contents: [{ parts: [{ text: prompt }] }]
    }, { headers: { 'Content-Type': 'application/json' } });

    return { success: true, reply: result.data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response' };
  } catch (error) {
    if (error.response?.status === 429) {
      return { success: false, error: 'Gemini API quota exceeded. Try again later.' };
    }
    return { success: false, error: 'Gemini API Error' };
  }
}

// Chat route: Save and respond to chat prompt
app.post('/chat', authMiddleware, async (req, res) => {
  const prompt = req.body.prompt;
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

  const result = await getGeminiReply(prompt);
  if (!result.success) return res.status(500).json({ error: result.error });

  const chats = readJSON(CHATS_FILE);
  if (!chats[req.session.user]) chats[req.session.user] = [];
  chats[req.session.user].push({ prompt, reply: result.reply, timestamp: Date.now() });
  writeJSON(CHATS_FILE, chats);

  res.json({ reply: result.reply });
});

// Regenerate last chat response
app.post('/regenerate', authMiddleware, async (req, res) => {
  const lastPrompt = req.body.lastPrompt;
  if (!lastPrompt) return res.status(400).json({ error: 'Missing prompt' });

  const result = await getGeminiReply(lastPrompt);
  if (!result.success) return res.status(500).json({ error: result.error });

  const chats = readJSON(CHATS_FILE);
  if (!chats[req.session.user]) chats[req.session.user] = [];
  chats[req.session.user].push({ prompt: lastPrompt, reply: result.reply, timestamp: Date.now() });
  writeJSON(CHATS_FILE, chats);

  res.json({ reply: result.reply });
});

// View chat history
app.get('/history', authMiddleware, (req, res) => {
  const chats = readJSON(CHATS_FILE);
  res.json(chats[req.session.user] || []);
});

// View all users (for admin)
app.get('/users', authMiddleware, (req, res) => {
  // Check if user is admin (for demonstration, we just check if email is admin@example.com)
  if (req.session.user !== 'admin@example.com') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const users = readJSON(USERS_FILE);
  res.json(users);
});

// View all chat history (for admin)
app.get('/chats', authMiddleware, (req, res) => {
  // Check if user is admin (for demonstration, we just check if email is admin@example.com)
  if (req.session.user !== 'admin@example.com') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const chats = readJSON(CHATS_FILE);
  res.json(chats);
});

// Public Routes
app.get('/', (_, res) => res.sendFile(path.join(__dirname, 'public/welcome.html')));
app.get('/login', (_, res) => res.sendFile(path.join(__dirname, 'public/login.html')));
app.get('/signup', (_, res) => res.sendFile(path.join(__dirname, 'public/signup.html')));
app.get('/chat', authMiddleware, (_, res) => res.sendFile(path.join(__dirname, 'public/chat.html')));

app.listen(PORT, () => {
  console.log(`Gemini Chat Pro running at http://localhost:${PORT}`);
});
