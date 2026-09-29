const express = require('express');
const cookieParser = require('cookie-parser');
const env = require('./config/env');
const requestLogger = require('./middleware/requestLogger');
const errorHandler = require('./middleware/errorHandler');
const routes = require('./routes/index');

const app = express();

app.use(requestLogger);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', env: env.NODE_ENV });
});

app.use('/api', routes);
app.use(errorHandler);

module.exports = app;
