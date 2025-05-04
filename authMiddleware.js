// authMiddleware.js
const authMiddleware = (req, res, next) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Unauthorized: Please log in first.' });
  }
  next();
};

module.exports = authMiddleware;
