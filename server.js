require('dotenv').config();
const express = require('express');
const fs = require('fs');
const bcrypt = require('bcrypt');
const session = require('express-session');
const path = require('path');
const bodyParser = require('body-parser');
const axios = require('axios');
const { body, validationResult } = require('express-validator');

const app = express();
const PORT = process.env.PORT || 3000;

const USERS_FILE = './data/users.json';
const CHATS_FILE = './data/chats.json';

// Middleware setup
app.use(express.static('public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'gemini_secret_key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// Helper functions
function readJSON(file) {
  try {
    if (!fs.existsSync(file)) return file.includes('users') ? [] : {};
    const data = fs.readFileSync(file, 'utf8');
    return data ? JSON.parse(data) : file.includes('users') ? [] : {};
  } catch (err) {
    console.error(`[ERROR] Reading ${file}:`, err.message);
    return file.includes('users') ? [] : {};
  }
}

function writeJSON(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`[ERROR] Writing ${file}:`, err.message);
  }
}

// Auth middleware
const authMiddleware = (req, res, next) => {
  if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
  next();
};

// Sign up route
app.post('/signup', 
  body('email').isEmail(), 
  body('password').isLength({ min: 6 }), 
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid email or password' });

    const { email, password } = req.body;
    const users = readJSON(USERS_FILE);

    if (users.find(u => u.email === email))
      return res.status(400).json({ error: 'User already exists' });

    try {
      const hashed = await bcrypt.hash(password, 10);
      users.push({ email, password: hashed });
      writeJSON(USERS_FILE, users);
      req.session.user = email;
      res.status(201).json({ message: 'Signup successful', user: email });
    } catch (err) {
      res.status(500).json({ error: 'Signup failed' });
    }
  }
);

// Login route
app.post('/login', 
  body('email').isEmail(), 
  body('password').notEmpty(), 
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid login credentials' });

    const { email, password } = req.body;
    const users = readJSON(USERS_FILE);
    const user = users.find(u => u.email === email);
    if (!user) return res.status(400).json({ error: 'User not found' });

    try {
      const match = await bcrypt.compare(password, user.password);
      if (!match) return res.status(400).json({ error: 'Incorrect password' });

      req.session.user = email;
      res.status(200).json({ message: 'Login successful', user: email });
    } catch (err) {
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.redirect('/');
  });
});

// Gemini API call
async function getGeminiReply(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  try {
    const { data } = await axios.post(url, {
      contents: [{ parts: [{ text: prompt }] }]
    }, {
      headers: { 'Content-Type': 'application/json' }
    });

    return { success: true, reply: data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response' };
  } catch (err) {
    if (err.response?.status === 429)
      return { success: false, error: 'Gemini API quota exceeded. Try again later.' };

    return { success: false, error: 'Gemini API Error' };
  }
}

// Chat route
app.post('/chat', authMiddleware, async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

  const result = await getGeminiReply(prompt);
  if (!result.success) return res.status(500).json({ error: result.error });

  const chats = readJSON(CHATS_FILE);
  if (!chats[req.session.user]) chats[req.session.user] = [];
  chats[req.session.user].push({ prompt, reply: result.reply, timestamp: Date.now() });
  writeJSON(CHATS_FILE, chats);

  res.json({ reply: result.reply });
});

// Regenerate response
app.post('/regenerate', authMiddleware, async (req, res) => {
  const { lastPrompt } = req.body;
  if (!lastPrompt) return res.status(400).json({ error: 'Missing prompt' });

  const result = await getGeminiReply(lastPrompt);
  if (!result.success) return res.status(500).json({ error: result.error });

  const chats = readJSON(CHATS_FILE);
  if (!chats[req.session.user]) chats[req.session.user] = [];
  chats[req.session.user].push({ prompt: lastPrompt, reply: result.reply, timestamp: Date.now() });
  writeJSON(CHATS_FILE, chats);

  res.json({ reply: result.reply });
});

// Chat history
app.get('/history', authMiddleware, (req, res) => {
  const chats = readJSON(CHATS_FILE);
  res.json(chats[req.session.user] || []);
});

// Get all users
app.get('/users', authMiddleware, (req, res) => {
  const users = readJSON(USERS_FILE);
  res.json(users);
});

// Get all chats
app.get('/chats', authMiddleware, (req, res) => {
  const chats = readJSON(CHATS_FILE);
  res.json(chats);
});

// Public HTML pages
app.get('/', (_, res) => res.sendFile(path.join(__dirname, 'public/welcome.html')));
app.get('/login', (_, res) => res.sendFile(path.join(__dirname, 'public/login.html')));
app.get('/signup', (_, res) => res.sendFile(path.join(__dirname, 'public/signup.html')));
app.get('/chat', authMiddleware, (_, res) => res.sendFile(path.join(__dirname, 'public/chat.html')));

// Start the server
app.listen(PORT, () => {
  console.log(`Gemini Chat Pro running at http://localhost:${PORT}`);
});
