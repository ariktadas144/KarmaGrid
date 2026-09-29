const pino = require('pino');

const logger = pino({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
});

module.exports = logger;
