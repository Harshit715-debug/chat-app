const express = require('express');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/users?search=abc  -> list/search users to start a chat with
router.get('/', requireAuth, async (req, res) => {
  const { search = '' } = req.query;
  const filter = {
    _id: { $ne: req.userId },
    ...(search ? { username: { $regex: search, $options: 'i' } } : {}),
  };
  const users = await User.find(filter).limit(20);
  res.json({ users: users.map((u) => u.toSafeObject()) });
});

module.exports = router;
