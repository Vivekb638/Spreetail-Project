const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/refresh', authController.refresh);

// Logout is protected, since we need to identify the session/user if needed, 
// though we can also process by just deleting the refresh token.
router.post('/logout', authController.logout);

// Update name/profile
router.put('/profile', authMiddleware, authController.updateProfile);

module.exports = router;

