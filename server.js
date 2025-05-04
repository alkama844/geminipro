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

// Static files
app.use(express.static('public'));

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'gemini_secret_key', // Secure session secret from env variables
  resave: false,
  saveUninitialized: true,
  cookie: { secure: process.env.NODE_ENV === 'production' } // Use secure cookies in production
}));

// Helper Functions
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

function writeJSON(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error writing file:', error);
  }
}

// Auth Middleware
const authMiddleware = require('./authMiddleware');

// Signup
app.post('/signup', async (req, res) => {
  const { email, password } = req.body;
  const users = readJSON(USERS_FILE);

  if (users[email]) {
    return res.status(400).json({ error: 'User already exists' });  // JSON response for existing user
  }

  try {
    const hashed = await bcrypt.hash(password, 10);
    users[email] = { password: hashed };
    writeJSON(USERS_FILE, users);
    req.session.user = email;
    res.status(201).json({ message: 'Signup successful', user: email });  // JSON response for success
  } catch (error) {
    res.status(500).json({ error: 'Signup failed' });
  }
});

// Login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const users = readJSON(USERS_FILE);

  if (!users[email]) {
    return res.status(400).json({ error: 'Invalid email' });  // JSON response for invalid email
  }

  try {
    const match = await bcrypt.compare(password, users[email].password);
    if (!match) {
      return res.status(400).json({ error: 'Incorrect password' });  // JSON response for incorrect password
    }

    req.session.user = email;
    res.status(200).json({ message: 'Login successful', user: email });  // JSON response for success
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
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

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

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
  } catch (error) {
    console.error('Error with Gemini API:', error);
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
  } catch (error) {
    console.error('Error with Gemini API:', error);
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
