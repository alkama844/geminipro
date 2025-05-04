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

app.use(session({
  secret: 'gemini_secret_key',
  resave: false,
  saveUninitialized: true
}));

function readJSON(file) {
  try {
    if (!fs.existsSync(file)) return {};
    const data = fs.readFileSync(file, 'utf8');
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Auth Middleware
const authMiddleware = require('./authMiddleware');

// Signup
app.post('/signup', async (req, res) => {
  const { email, password } = req.body;
  const users = readJSON(USERS_FILE);
  if (users[email]) return res.status(409).send('User already exists');
  const hashed = await bcrypt.hash(password, 10);
  users[email] = { password: hashed };
  writeJSON(USERS_FILE, users);
  req.session.user = email;
  res.sendStatus(200);
});

// Login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const users = readJSON(USERS_FILE);
  if (!users[email]) return res.status(401).send('Invalid email');
  const match = await bcrypt.compare(password, users[email].password);
  if (!match) return res.status(403).send('Incorrect password');
  req.session.user = email;
  res.sendStatus(200);
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// Protected: Chat Page
app.get('/chat', authMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, 'public/chat.html'));
});

// Protected: Chat Endpoint
app.post('/chat', authMiddleware, async (req, res) => {
  const prompt = req.body.prompt;
  const apiKey = process.env.GEMINI_API_KEY;

  try {
    const result = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      { contents: [{ parts: [{ text: prompt }] }] },
      { headers: { 'Content-Type': 'application/json' } }
    );

    const reply = result.data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';

    const chats = readJSON(CHATS_FILE);
    if (!chats[req.session.user]) chats[req.session.user] = [];
    chats[req.session.user].push({ prompt, reply, timestamp: Date.now() });
    writeJSON(CHATS_FILE, chats);

    res.json({ reply });
  } catch {
    res.status(500).send('Gemini API Error');
  }
});

// Protected: Regenerate
app.post('/regenerate', authMiddleware, async (req, res) => {
  const lastPrompt = req.body.lastPrompt;
  if (!lastPrompt) return res.status(400).send('Missing prompt');

  const apiKey = process.env.GEMINI_API_KEY;

  try {
    const result = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      { contents: [{ parts: [{ text: lastPrompt }] }] },
      { headers: { 'Content-Type': 'application/json' } }
    );

    const reply = result.data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';

    const chats = readJSON(CHATS_FILE);
    if (!chats[req.session.user]) chats[req.session.user] = [];
    chats[req.session.user].push({ prompt: lastPrompt, reply, timestamp: Date.now() });
    writeJSON(CHATS_FILE, chats);

    res.json({ reply });
  } catch {
    res.status(500).send('Gemini API Error');
  }
});

// Protected: History
app.get('/history', authMiddleware, (req, res) => {
  const chats = readJSON(CHATS_FILE);
  res.json(chats[req.session.user] || []);
});

// Public Routes
app.get('/', (_, res) => res.sendFile(path.join(__dirname, 'public/welcome.html')));
app.get('/login', (_, res) => res.sendFile(path.join(__dirname, 'public/login.html')));
app.get('/signup', (_, res) => res.sendFile(path.join(__dirname, 'public/signup.html')));

app.listen(PORT, () => {
  console.log(`Gemini Chat Pro running at http://localhost:${PORT}`);
});
