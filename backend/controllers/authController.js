const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const createAuthController = (database) => ({
  register: async (request, response) => {
    try {
      const { name, username, password, email, emailId } = request.body;
      const normalizedEmail = (email || emailId || '').trim().toLowerCase();
      const normalizedUsername = (username || name || '').trim();

      if (!normalizedUsername || !normalizedEmail || !password) {
        return response.status(400).json({ error: 'Username, email, and password are required' });
      }

      if (password.length < 6) {
        return response.status(400).json({ error: 'Password must be at least 6 characters' });
      }

      const existingEmail = await database.get(
        'SELECT user_id FROM users WHERE lower(email) = ?',
        [normalizedEmail],
      );

      if (existingEmail !== undefined) {
        return response.status(400).json({ error: 'An account with this email already exists' });
      }

      const existingUsername = await database.get(
        'SELECT user_id FROM users WHERE lower(username) = ?',
        [normalizedUsername.toLowerCase()],
      );

      if (existingUsername !== undefined) {
        return response.status(400).json({ error: `The name "${normalizedUsername}" is already taken. Please use a different name.` });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      await database.run(
        `INSERT INTO users (username, email, password_hash, role, status)
         VALUES (?, ?, ?, 'customer', 'active')`,
        [normalizedUsername, normalizedEmail, hashedPassword],
      );

      return response.status(201).json({ message: 'Account created successfully' });
    } catch (err) {
      console.error('[register] Unexpected error:', err.message);
      return response.status(500).json({ error: 'Internal server error. Please try again.' });
    }
  },

  login: async (request, response) => {
    try {
      const { email, emailId, password } = request.body;
      const normalizedEmail = (email || emailId || '').trim().toLowerCase();

      if (!normalizedEmail || !password) {
        return response.status(400).json({ error: 'Email and password are required' });
      }

      const dbUser = await database.get(
        `SELECT user_id, username, email, password_hash, role, status
         FROM users
         WHERE lower(email) = ?`,
        [normalizedEmail],
      );

      if (dbUser === undefined) {
        return response.status(400).json({ error: 'No account found with this email' });
      }

      if (dbUser.status !== 'active') {
        return response.status(403).json({ error: 'This account has been deactivated' });
      }

      const passwordIsMatched = await bcrypt.compare(password, dbUser.password_hash);
      if (!passwordIsMatched) {
        return response.status(400).json({ error: 'Incorrect password' });
      }

      const payload = {
        userId: dbUser.user_id,
        username: dbUser.username,
        role: dbUser.role,
      };
      const jwtToken = jwt.sign(payload, process.env.JWT_SECRET || 'HELLO_WORLD');

      return response.status(200).json({
        jwtToken,
        userId: dbUser.user_id,
        username: dbUser.username,
        role: dbUser.role,
      });
    } catch (err) {
      console.error('[login] Unexpected error:', err.message);
      return response.status(500).json({ error: 'Internal server error. Please try again.' });
    }
  },
});

module.exports = { createAuthController };
