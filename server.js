require('dotenv').config(); const express = require('express'); const fs = require('fs'); const bcrypt = require('bcrypt'); const session = require('express-session'); const path = require('path'); const bodyParser = require('body-parser'); const axios = require('axios'); const { body, validationResult } = require('express-validator'); const cors = require('cors');

const app = express(); const PORT = process.env.PORT || 3000;

const USERS_FILE = './data/users.json'; const CHATS_FILE = './data/chats.json'; const usersPath = path.join(__dirname, 'data', 'users.json'); const chatPath = path.join(__dirname, 'data', 'chats.json');

// Middleware app.use(express.json()); app.use(express.urlencoded({ extended: true })); app.use(cors({ origin: 'https://geminipronafij.onrender.com', credentials: true })); app.use(express.static('public')); app.use(bodyParser.json()); app.use(bodyParser.urlencoded({ extended: true }));

// Session app.use(session({ secret: process.env.SESSION_SECRET || 'gemini_secret_key', resave: false, saveUninitialized: false, cookie: { maxAge: 24 * 60 * 60 * 1000, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' } }));

if (!process.env.GEMINI_API_KEY) { console.warn('[WARNING] GEMINI_API_KEY is missing. Gemini features will NOT work.'); } else { console.log('[INFO] GEMINI_API_KEY is set. Gemini features are ENABLED.'); }

// Utils const readJSON = (file) => { try { if (!fs.existsSync(file)) return file.includes('users') ? [] : {}; const data = fs.readFileSync(file, 'utf8'); return data ? JSON.parse(data) : file.includes('users') ? [] : {}; } catch (err) { console.error([ERROR] Reading ${file}:, err.message); return file.includes('users') ? [] : {}; } };

const writeJSON = (file, data) => { try { fs.writeFileSync(file, JSON.stringify(data, null, 2)); } catch (err) { console.error([ERROR] Writing ${file}:, err.message); } };

const authMiddleware = (req, res, next) => { if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' }); next(); };

// Auth APIs app.get('/api/session', (req, res) => { if (req.session && req.session.user) return res.json({ loggedIn: true, email: req.session.user }); res.json({ loggedIn: false }); });

app.post('/api/signup', body('email').isEmail(), body('password').isLength({ min: 6 }), async (req, res) => { const errors = validationResult(req); if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid email or password' });

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

} );

app.post('/api/login', body('email').isEmail(), body('password').notEmpty(), async (req, res) => { const errors = validationResult(req); if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid login credentials' });

const { email, password } = req.body;
const users = readJSON(USERS_FILE);
const user = users.find(u => u.email === email);
if (!user) return res.status(400).json({ error: 'User not found' });

const match = await bcrypt.compare(password, user.password);
if (!match) return res.status(400).json({ error: 'Incorrect password' });

req.session.user = email;
res.status(200).json({ message: 'Login successful' });

} );

app.get('/api/logout', (req, res) => { req.session.destroy(err => { if (err) return res.status(500).json({ error: 'Logout failed' }); res.clearCookie('connect.sid'); res.json({ message: 'Logged out' }); }); });

app.get('/api/userinfo', (req, res) => { if (!req.session.user) return res.json({ loggedIn: false }); res.json({ loggedIn: true, email: req.session.user }); });

// Gemini Chat const getGeminiReply = async (prompt) => { try { const { data } = await axios.post( https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-pro:generateContent?key=${process.env.GEMINI_API_KEY}, { contents: [{ parts: [{ text: prompt }] }] }, { headers: { 'Content-Type': 'application/json' } } ); return { success: true, response: data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response.' }; } catch (err) { return { success: false, error: 'Gemini API error or quota exceeded' }; } };

app.post('/api/gemini', authMiddleware, async (req, res) => { const { prompt } = req.body; if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

const result = await getGeminiReply(prompt); if (!result.success) return res.status(500).json({ error: result.error });

const chats = readJSON(CHATS_FILE); if (!chats[req.session.user]) chats[req.session.user] = []; chats[req.session.user].push({ role: 'user', content: prompt }); chats[req.session.user].push({ role: 'ai', content: result.response }); writeJSON(CHATS_FILE, chats);

res.json({ response: result.response }); });

app.get('/api/chats', authMiddleware, (req, res) => { const chats = readJSON(CHATS_FILE); res.json({ chats: chats[req.session.user] || [] }); });

// Static Routes app.get('/', (, res) => res.sendFile(path.join(__dirname, 'public', 'index.html'))); app.get('/login', (, res) => res.redirect('/login.html')); app.get('/signup', (_, res) => res.redirect('/signup.html'));

// Admin/debug routes app.get('/users', (req, res) => { fs.readFile(usersPath, 'utf8', (err, data) => { if (err) return res.status(500).json({ error: 'Unable to load user data' }); res.setHeader('Content-Type', 'application/json'); res.send(data); }); });

app.get('/chats', (req, res) => { if (!fs.existsSync(chatPath)) return res.json({}); const chats = JSON.parse(fs.readFileSync(chatPath, 'utf8')); res.json(chats); });

app.get('/chats/:email', (req, res) => { const email = req.params.email; if (!fs.existsSync(chatPath)) return res.json({}); const chats = JSON.parse(fs.readFileSync(chatPath, 'utf8')); res.json(chats[email] || {}); });

app.listen(PORT, () => { console.log(Gemini Chat Pro is live at http://localhost:${PORT}); });

