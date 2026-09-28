const { ZodError } = require('zod');

const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation Error',
      details: err.errors
    });
  }

  if (err.name === 'UnauthorizedError' || err.status === 401) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  if (err.name === 'ForbiddenError' || err.status === 403) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (err.name === 'NotFoundError' || err.status === 404) {
    return res.status(404).json({ error: 'Not Found' });
  }

  if (err.status && err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ error: err.message });
  }

  req.log.error(err);
  
  res.status(500).json({
    error: 'Internal Server Error'
  });
};

module.exports = errorHandler;
