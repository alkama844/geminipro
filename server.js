require('dotenv').config();
const express = require('express');
const fs = require('fs');
const bcrypt = require('bcrypt');
const session = require('express-session');
const path = require('path');
const bodyParser = require('body-parser');
const axios = require('axios');
const { body, validationResult } = require('express-validator');
const cors = require('cors');

const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.json()); // For parsing application/json
app.use(express.urlencoded({ extended: true })); 
const USERS_FILE = './data/users.json';
const CHATS_FILE = './data/chats.json';

console.log('Before defining the function');
const getGeminiReply = async (prompt) => {
  // Function implementation
};
console.log('After defining the function');

console.log(`Node version: ${process.version}`);

app.use(cors({
  origin: 'https://geminipronafij.onrender.com/',  // Change to your front-end URL
  credentials: true  // Allow cookies to be sent with requests
}));

app.get('/api/session', (req, res) => {
  if (req.session && req.session.email) {
    return res.json({ loggedIn: true, email: req.session.email });
  } else {
    return res.json({ loggedIn: false });
  }
});

// Middleware
 app.use(express.static('public'));
 app.use(bodyParser.json());
 app.use(bodyParser.urlencoded({ extended: true }));

// Check Gemini API key status
if (!process.env.GEMINI_API_KEY) {
  console.warn('[WARNING] GEMINI_API_KEY is missing. Gemini features will NOT work.');
} else {
  console.log('[INFO] GEMINI_API_KEY is set. Gemini features are ENABLED.');
}



app.set('trust proxy', 1); // trust Render's proxy

app.use(session({
    secret: 'yourSecretKey',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: true,           // important for HTTPS!
        httpOnly: true,         // security best practice
        sameSite: 'none',       // must be 'none' for cross-site cookies
        maxAge: 1000 * 60 * 60 * 24 // 1 day
    }
}));

app.get('/check-auth', (req, res) => {
  const user = req.session?.user;

  if (user) {
    res.json({ loggedIn: true, user });
  } else {
    res.status(401).json({ loggedIn: false, message: 'Not authenticated' });
  }
});

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
if (!process.env.GEMINI_API_KEY) {
  return { success: false, error: 'API Key is missing' };
}


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

const usersPath = path.join(__dirname, 'data', 'users.json');

// CREATE USER
app.post('/create-user', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  // Read users file
  fs.readFile(usersPath, 'utf8', (err, data) => {
    if (err) return res.status(500).json({ error: 'Failed to read users data' });

    let users = [];
    try {
      users = JSON.parse(data || '[]');
    } catch (e) {
      return res.status(500).json({ error: 'Failed to parse users data' });
    }

    if (users.some(u => u.email === email)) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    // Hash the password
    bcrypt.hash(password, 10, (err, hashedPassword) => {
      if (err) return res.status(500).json({ error: 'Password hashing failed' });

      users.push({ email, password: hashedPassword });

      fs.writeFile(usersPath, JSON.stringify(users, null, 2), err => {
        if (err) return res.status(500).json({ error: 'Failed to save user data' });
        res.status(201).json({ success: true, message: 'User created successfully' });
      });
    });
  });
});

// CHECK IF USER EXISTS
app.post('/check-user', (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  fs.readFile(usersPath, 'utf8', (err, data) => {
    if (err) return res.status(500).json({ error: 'Failed to read users data' });

    let users = [];
    try {
      users = JSON.parse(data || '[]');
    } catch (e) {
      return res.status(500).json({ error: 'Failed to parse users data' });
    }

    const exists = users.some(u => u.email === email);
    return res.status(200).json({ exists });
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

app.post("/chat", async (req, res) => {
  const { message, chatId, history } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Message cannot be empty" });
  }

  try {
    // Ensure history is always an array
    const contents = (history || []).map(msg => ({
      role: msg.role,
      parts: [{ text: msg.content }]
    }));

    // Add the current user message
    contents.push({
      role: "user",
      parts: [{ text: message }]
    });

    // Call Gemini API
    const geminiRes = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      { contents },
      { headers: { "Content-Type": "application/json" } }
    );

    // Log the response data to check its structure
    console.log("Gemini Response:", geminiRes.data);

    const text = geminiRes.data?.candidates?.[0]?.content?.parts?.[0]?.text || "No reply from Gemini.";

    // Build updated chat array
    const updatedChat = [
      ...(history || []),
      { role: "user", content: message },
      { role: "bot", content: text }
    ];

    // Save the updated chat to the chat file
    const chats = readJSON(CHATS_FILE);
    chats[chatId] = updatedChat;
    writeJSON(CHATS_FILE, chats);

    // Send back final response
    res.status(200).json({
      reply: text,
      chatId: chatId || `chat_${Date.now()}`,
      chat: updatedChat
    });

  } catch (error) {
    console.error("Gemini API error:", error?.response?.data || error.message);

    // Send a more detailed error response to the frontend for debugging
    res.status(500).json({
      error: "Failed to generate a response. Please try again later.",
      details: error?.response?.data || error.message
    });
  }
});

// ===== Route 2: Get All Chats (for session-based users) =====
app.get('/chats', (req, res) => {
  const chatPath = path.join(__dirname, 'data', 'chats.json');
  try {
    if (!fs.existsSync(chatPath)) return res.json({});
    const data = fs.readFileSync(chatPath, 'utf8');
    const chats = JSON.parse(data || '{}');
    res.json(chats);
  } catch (err) {
    console.error('Failed to read chats:', err);
    res.status(500).json({ error: 'Failed to load chat history' });
  }
});


// GET /chats/:email - Fetch all user chats
app.get('/chats/:email', (req, res) => {
  const email = req.params.email;
  const chatPath = path.join(__dirname, 'data', 'chats.json');

  if (!fs.existsSync(chatPath)) return res.json({});

  const chats = JSON.parse(fs.readFileSync(chatPath, 'utf-8'));
  res.json(chats[email] || {});
});

app.get('/chat/:id', (req, res) => {
  const chatId = req.params.id;
  // Fetch chat with ID from database or file
  const chat = chats[chatId]; 
  res.json(chat);
});

function isAuthenticated(req, res, next) {
    if (req.session && req.session.user) {
        next();
    } else {
        res.redirect('/login.html');
    }
}
                          
// Start server
app.listen(PORT, () => {
  console.log(`Gemini Chat Pro is live at http://localhost:${PORT}`);
});
