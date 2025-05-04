// authMiddleware.js

module.exports = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/login'); // Redirect to login if user is not authenticated
  }
  next(); // Proceed to the next middleware/route if authenticated
};
