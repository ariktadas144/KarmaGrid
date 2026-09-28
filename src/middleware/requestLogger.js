const pino = require('pino');
const pinoHttp = require('pino-http');

const logger = pino({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
});

const requestLogger = pinoHttp({
  logger,
  customLogLevel: function (req, res, err) {
    if (res.statusCode >= 500 || err) {
      return 'error'
    } else if (res.statusCode >= 400) {
      return 'warn'
    }
    return 'info'
  },
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  }
});

module.exports = requestLogger;
