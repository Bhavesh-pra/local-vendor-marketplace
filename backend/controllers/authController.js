const bcrypt = require('bcrypt');
const { createSessionService } = require('../services/sessionService');
const { logger } = require('../middleware/logger');

const createAuthController = (database) => {
  const sessionService = createSessionService(database);

  return {
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

        logger.info('USER_REGISTERED', { username: normalizedUsername, email: normalizedEmail });
        return response.status(201).json({ message: 'Account created successfully' });
      } catch (err) {
        logger.error('REGISTER_ERROR', { error: err.message });
        return response.status(500).json({ error: 'Internal server error. Please try again.' });
      }
    },

    login: async (request, response) => {
      try {
        const { email, emailId, password } = request.body;
        const normalizedEmail = (email || emailId || '').trim().toLowerCase();
        const ipAddress = request.ip || request.headers['x-forwarded-for'] || request.socket.remoteAddress;
        const userAgent = request.headers['user-agent'];

        if (!normalizedEmail || !password) {
          logger.logAuthFailure(normalizedEmail || 'unknown', 'Missing credentials');
          return response.status(400).json({ error: 'Email and password are required' });
        }

        const dbUser = await database.get(
          `SELECT user_id, username, email, password_hash, role, status
           FROM users
           WHERE lower(email) = ?`,
          [normalizedEmail],
        );

        if (dbUser === undefined) {
          logger.logAuthFailure(normalizedEmail, 'Account not found', { ipAddress });
          return response.status(400).json({ error: 'No account found with this email' });
        }

        if (dbUser.status !== 'active') {
          logger.logAuthFailure(normalizedEmail, 'Account deactivated', { ipAddress });
          return response.status(403).json({ error: 'This account has been deactivated' });
        }

        const passwordIsMatched = await bcrypt.compare(password, dbUser.password_hash);
        if (!passwordIsMatched) {
          logger.logAuthFailure(normalizedEmail, 'Incorrect password', { ipAddress });
          return response.status(400).json({ error: 'Incorrect password' });
        }

        const payload = {
          userId: dbUser.user_id,
          username: dbUser.username,
          role: dbUser.role,
        };

        const jwtToken = sessionService.generateAccessToken(payload);
        const refreshToken = await sessionService.generateRefreshToken(dbUser.user_id, ipAddress, userAgent);

        logger.info('USER_LOGIN_SUCCESS', { userId: dbUser.user_id, username: dbUser.username, role: dbUser.role });
        
        return response.status(200).json({
          jwtToken,
          refreshToken,
          userId: dbUser.user_id,
          username: dbUser.username,
          role: dbUser.role,
        });
      } catch (err) {
        logger.error('LOGIN_ERROR', { error: err.message });
        return response.status(500).json({ error: 'Internal server error. Please try again.' });
      }
    },

    refresh: async (request, response) => {
      try {
        const { refreshToken } = request.body;
        const ipAddress = request.ip || request.headers['x-forwarded-for'] || request.socket.remoteAddress;
        const userAgent = request.headers['user-agent'];

        if (!refreshToken) {
          return response.status(400).json({ error: 'Refresh token is required' });
        }

        const rotated = await sessionService.verifyAndRotateSession(refreshToken, ipAddress, userAgent);
        
        logger.info('SESSION_ROTATED', { userId: rotated.userId });
        return response.status(200).json({
          jwtToken: rotated.accessToken,
          refreshToken: rotated.refreshToken,
          userId: rotated.userId,
          username: rotated.username,
          role: rotated.role
        });
      } catch (err) {
        logger.logSecurityEvent('REFRESH_TOKEN_FAILURE', { error: err.message });
        return response.status(401).json({ error: err.message || 'Invalid refresh token' });
      }
    },

    logout: async (request, response) => {
      try {
        const { refreshToken } = request.body;
        
        if (refreshToken) {
          await sessionService.revokeSession(refreshToken);
        }

        // If authenticated, we also support forced logout of all sessions
        if (request.userId) {
          await sessionService.revokeAllUserSessions(request.userId);
        }

        logger.info('USER_LOGGED_OUT', { userId: request.userId || 'unknown' });
        return response.status(200).json({ message: 'Logged out successfully' });
      } catch (err) {
        logger.error('LOGOUT_ERROR', { error: err.message });
        return response.status(500).json({ error: 'Internal server error. Please try again.' });
      }
    }
  };
};

module.exports = { createAuthController };
