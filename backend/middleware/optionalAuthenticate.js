const jwt = require('jsonwebtoken');

const optionalAuthenticateHeader = async (request, response, next) => {
  const authHeader = request.headers['authorization'];
  if (authHeader) {
    const jwtToken = authHeader.split(' ')[1];
    if (jwtToken) {
      jwt.verify(jwtToken, process.env.JWT_SECRET || 'HELLO_WORLD', (error, payload) => {
        if (!error && payload) {
          request.userId = payload.userId;
          request.username = payload.username;
          request.role = payload.role;
        }
        next();
      });
      return;
    }
  }
  next();
};

module.exports = { optionalAuthenticateHeader };
