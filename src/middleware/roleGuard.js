const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.auth || !req.auth.role) {
      const err = new Error('Authentication required');
      err.status = 401;
      return next(err);
    }

    if (!allowedRoles.includes(req.auth.role)) {
      const err = new Error('Insufficient permissions');
      err.status = 403;
      return next(err);
    }

    next();
  };
};

module.exports = { requireRole };
