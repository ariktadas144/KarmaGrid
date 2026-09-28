const { ZodError } = require('zod');

// Centralized error handling middleware
const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  // 1. Validation Errors (Zod)
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation Error',
      details: err.errors
    });
  }

  // 2. Auth Errors (can be customized based on custom Error classes if needed)
  if (err.name === 'UnauthorizedError' || err.status === 401) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  if (err.name === 'ForbiddenError' || err.status === 403) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // 3. Not Found Errors
  if (err.name === 'NotFoundError' || err.status === 404) {
    return res.status(404).json({ error: 'Not Found' });
  }

  // 4. Catch-all for other Client Errors (4xx)
  if (err.status && err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ error: err.message });
  }

  // 5. Unexpected Errors (500)
  req.log.error(err); // Log the full error with stack trace
  
  res.status(500).json({
    error: 'Internal Server Error'
  });
};

module.exports = errorHandler;
