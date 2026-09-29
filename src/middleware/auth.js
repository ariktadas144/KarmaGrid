const jwt = require('jsonwebtoken');
const env = require('../config/env');

const verifyToken = (role) => {
  return (req, res, next) => {
    const token = req.cookies.authToken;
    if (!token) {
      const err = new Error('No authentication token found');
      err.status = 401;
      return next(err);
    }

    const secret = role === 'ORG' ? env.JWT_ORG_SECRET : env.JWT_VOL_SECRET;

    try {
      const decoded = jwt.verify(token, secret);
      req.auth = {
        id: decoded.id,
        role: role
      };
      next();
    } catch (error) {
      const err = new Error('Invalid or expired authentication token');
      err.status = 401;
      next(err);
    }
  };
};

module.exports = { verifyToken };
