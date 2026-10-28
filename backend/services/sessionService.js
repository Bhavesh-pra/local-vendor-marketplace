const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

const createSessionService = (database) => {
  return {
    generateAccessToken: (payload) => {
      return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
    },

    generateRefreshToken: async (userId, ipAddress, userAgent) => {
      const rawToken = crypto.randomBytes(40).toString('hex');
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);
      const expiresAtStr = expiresAt.toISOString();

      await database.run(`
        INSERT INTO refresh_tokens (user_id, token_hash, ip_address, user_agent, expires_at, last_used_at, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `, [userId, tokenHash, ipAddress || null, userAgent || null, expiresAtStr]);

      return rawToken;
    },

    verifyAndRotateSession: async (rawRefreshToken, ipAddress, userAgent) => {
      const tokenHash = hashToken(rawRefreshToken);
      
      const session = await database.get(`
        SELECT id, user_id, expires_at, revoked_at
        FROM refresh_tokens
        WHERE token_hash = ?
      `, [tokenHash]);

      if (!session) {
        throw new Error('Invalid refresh token');
      }

      if (session.revoked_at) {
        // Token reuse detection: if a token has already been revoked, revoke ALL tokens for this user!
        await database.run(`
          UPDATE refresh_tokens
          SET revoked_at = datetime('now')
          WHERE user_id = ?
        `, [session.user_id]);
        throw new Error('Token reuse detected. Session terminated.');
      }

      const now = new Date();
      const expiresAt = new Date(session.expires_at);
      if (now > expiresAt) {
        throw new Error('Refresh token expired');
      }

      // Revoke the old token (rotation)
      await database.run(`
        UPDATE refresh_tokens
        SET revoked_at = datetime('now')
        WHERE id = ?
      `, [session.id]);

      // Fetch user details for the new access token
      const user = await database.get(`
        SELECT user_id, username, role, status FROM users WHERE user_id = ?
      `, [session.user_id]);

      if (!user || user.status !== 'active') {
        throw new Error('User inactive or not found');
      }

      // Create new access token and refresh token
      const newPayload = { userId: user.user_id, username: user.username, role: user.role };
      const newAccessToken = jwt.sign(newPayload, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });

      const newRawRefreshToken = crypto.randomBytes(40).toString('hex');
      const newTokenHash = hashToken(newRawRefreshToken);
      const newExpiresAt = new Date();
      newExpiresAt.setDate(newExpiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);
      const newExpiresAtStr = newExpiresAt.toISOString();

      await database.run(`
        INSERT INTO refresh_tokens (user_id, token_hash, ip_address, user_agent, expires_at, last_used_at, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `, [user.user_id, newTokenHash, ipAddress || null, userAgent || null, newExpiresAtStr]);

      return {
        accessToken: newAccessToken,
        refreshToken: newRawRefreshToken,
        userId: user.user_id,
        username: user.username,
        role: user.role
      };
    },

    revokeSession: async (rawRefreshToken) => {
      const tokenHash = hashToken(rawRefreshToken);
      await database.run(`
        UPDATE refresh_tokens
        SET revoked_at = datetime('now')
        WHERE token_hash = ?
      `, [tokenHash]);
    },

    revokeAllUserSessions: async (userId) => {
      await database.run(`
        UPDATE refresh_tokens
        SET revoked_at = datetime('now')
        WHERE user_id = ? AND revoked_at IS NULL
      `, [userId]);
    }
  };
};

module.exports = { createSessionService };
