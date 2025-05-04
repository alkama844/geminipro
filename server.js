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

app.use(express.json()); // Needed to parse JSON request body

const USERS_FILE = './data/users.json';
const CHATS_FILE = './data/chats.json';

// Middleware
app.use(express.static('public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'gemini_secret_key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Set true with HTTPS in production
}));

// Utils
const readJSON = (file) => {
  try {
    if (!fs.existsSync(file)) return file.includes('users') ? [] : {};
    const data = fs.readFileSync(file, 'utf8');
    return data ? JSON.parse(data) : file.includes('users') ? [] : {};
  } catch (err) {
    console.error(`[ERROR] Reading ${file}:`, err.message);
    return file.includes('users') ? [] : {};
  }
};

const writeJSON = (file, data) => {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`[ERROR] Writing ${file}:`, err.message);
  }
};

// Middleware: auth check
const authMiddleware = (req, res, next) => {
  if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
  next();
};

// Signup
app.post('/api/signup',
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid email or password' });

    const { email, password } = req.body;
    const users = readJSON(USERS_FILE);
    if (users.find(u => u.email === email)) return res.status(400).json({ error: 'User already exists' });

    try {
      const hashed = await bcrypt.hash(password, 10);
      users.push({ email, password: hashed });
      writeJSON(USERS_FILE, users);
      req.session.user = email;
      res.status(201).json({ message: 'Signup successful' });
    } catch {
      res.status(500).json({ error: 'Signup failed' });
    }
  }
);

// Login
app.post('/api/login',
  body('email').isEmail(),
  body('password').notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid login credentials' });

    const { email, password } = req.body;
    const users = readJSON(USERS_FILE);
    const user = users.find(u => u.email === email);
    if (!user) return res.status(400).json({ error: 'User not found' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: 'Incorrect password' });

    req.session.user = email;
    res.status(200).json({ message: 'Login successful' });
  }
);

app.post('/create-user', (req, res) => {
  const { email, password } = req.body;
  const usersPath = path.join(__dirname, 'data', 'users.json');

  fs.readFile(usersPath, 'utf8', (err, data) => {
    if (err) return res.status(500).json({ error: 'Failed to read users' });

    let users = [];
    try {
      users = JSON.parse(data || '[]');
    } catch (e) {}

    if (users.some(u => u.email === email)) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    users.push({ email, password }); // TIP: Hash password in real apps
    fs.writeFile(usersPath, JSON.stringify(users, null, 2), err => {
      if (err) return res.status(500).json({ success: false, message: 'Write failed' });
      res.json({ success: true });
    });
  });
});

app.post('/check-user', (req, res) => {
  const { email } = req.body;
  const usersPath = path.join(__dirname, 'data', 'users.json');

  fs.readFile(usersPath, 'utf8', (err, data) => {
    if (err) return res.status(500).json({ error: 'Failed to read users data' });

    let users = [];
    try {
      users = JSON.parse(data || '[]');
    } catch (e) {
      return res.status(500).json({ error: 'Failed to parse users data' });
    }

    // Check if the email already exists
    const userExists = users.some(u => u.email === email);
    if (userExists) {
      return res.status(400).json({ exists: true });
    }

    res.json({ exists: false });
  });
});

// Logout
app.get('/api/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.json({ message: 'Logged out' });
  });
});

// User info
app.get('/api/userinfo', (req, res) => {
  if (!req.session.user) return res.json({ loggedIn: false });
  res.json({ loggedIn: true, email: req.session.user });
});

// Gemini chat response
const getGeminiReply = async (prompt) => {
  const apiKey = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-pro:generateContent?key=${apiKey}`;

  try {
    const { data } = await axios.post(url, {
      contents: [{ parts: [{ text: prompt }] }]
    }, {
      headers: { 'Content-Type': 'application/json' }
    });

    return {
      success: true,
      response: data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response.'
    };
  } catch (err) {
    return { success: false, error: 'Gemini API error or quota exceeded' };
  }
};

// Chat route
app.post('/api/gemini', authMiddleware, async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

  const result = await getGeminiReply(prompt);
  if (!result.success) return res.status(500).json({ error: result.error });

  const chats = readJSON(CHATS_FILE);
  if (!chats[req.session.user]) chats[req.session.user] = [];
  chats[req.session.user].push({ role: 'user', content: prompt });
  chats[req.session.user].push({ role: 'ai', content: result.response });
  writeJSON(CHATS_FILE, chats);

  res.json({ response: result.response });
});

// Chat history
app.get('/api/chats', authMiddleware, (req, res) => {
  const chats = readJSON(CHATS_FILE);
  res.json({ chats: chats[req.session.user] || [] });
});

// Serve index.html for root
app.get('/', (_, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Catch-all to redirect unknown routes to index.html (SPA fallback if needed)
// app.get('*', (_, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.get('/login', (_, res) => res.redirect('/login.html'));
app.get('/signup', (_, res) => res.redirect('/signup.html'));

app.get('/users', (req, res) => {
  const usersPath = path.join(__dirname, 'data', 'users.json');
  fs.readFile(usersPath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading users.json:', err);
      return res.status(500).json({ error: 'Unable to load user data' });
    }
    res.setHeader('Content-Type', 'application/json');
    res.send(data);
  });
});

// Hash password in /create-user route
bcrypt.hash(password, 10, (err, hashedPassword) => {
  if (err) return res.status(500).json({ error: 'Password hashing failed' });

  users.push({ email, password: hashedPassword });
  fs.writeFile(usersPath, JSON.stringify(users, null, 2), (err) => {
    if (err) return res.status(500).json({ error: 'Failed to save user data' });
    res.status(201).json({ message: 'User created successfully' });
  });
});

if (!fs.existsSync(file)) return file.includes('users') ? [] : {}; // Handle chats.json similarly

// Start server
app.listen(PORT, () => {
  console.log(`Gemini Chat Pro is live at http://localhost:${PORT}`);
});
