const jwt = require('jsonwebtoken');

const authenticateHeader = async (request, response, next) => {
  const authHeader = request.headers['authorization'];
  let jwtToken;

  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1];
  }

  if (authHeader === undefined) {
    return response.status(401).json({ message: 'Invalid JWT Token' });
  } else {
    jwt.verify(jwtToken, process.env.JWT_SECRET || 'HELLO_WORLD', async (error, payload) => {
      if (error) {
        return response.status(401).json({ message: 'Invalid JWT Token' });
      } else {
        request.userId = payload.userId;
        request.username = payload.username;
        request.role = payload.role;
        request.name = payload.username;
        next();
      }
    });
  }
};

const optionalAuthenticateHeader = async (request, response, next) => {
  const authHeader = request.headers['authorization'];
  if (authHeader === undefined) {
    return next();
  }
  const jwtToken = authHeader.split(' ')[1];
  if (!jwtToken) {
    return next();
  }
  jwt.verify(jwtToken, process.env.JWT_SECRET || 'HELLO_WORLD', async (error, payload) => {
    if (!error && payload) {
      request.userId = payload.userId;
      request.username = payload.username;
      request.role = payload.role;
      request.name = payload.username;
    }
    next();
  });
};

module.exports = { authenticateHeader, optionalAuthenticateHeader };
