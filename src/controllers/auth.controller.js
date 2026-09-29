const authService = require('../services/auth.service');
const constants = require('../config/constants');
const env = require('../config/env');

const setCookies = (res, accessToken, refreshToken) => {
  const cookieOptions = {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
  };

  if (accessToken) {
    res.cookie('authToken', accessToken, cookieOptions);
  }
  
  if (refreshToken) {
    res.cookie('refreshToken', refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
  }
};

const clearCookies = (res) => {
  const cookieOptions = {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
  };
  res.clearCookie('authToken', cookieOptions);
  res.clearCookie('refreshToken', cookieOptions);
};

const orgSignup = async (req, res, next) => {
  try {
    const user = await authService.signup({
      ...req.body,
      role: constants.ROLES.ORGANIZATION
    });
    res.status(201).json({ user });
  } catch (error) {
    next(error);
  }
};

const volSignup = async (req, res, next) => {
  try {
    const user = await authService.signup({
      ...req.body,
      role: constants.ROLES.VOLUNTEER
    });
    res.status(201).json({ user });
  } catch (error) {
    next(error);
  }
};

const orgSignin = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const { user, accessToken, refreshToken } = await authService.signin({
      email,
      password,
      role: constants.ROLES.ORGANIZATION
    });
    
    setCookies(res, accessToken, refreshToken);
    res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
};

const volSignin = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const { user, accessToken, refreshToken } = await authService.signin({
      email,
      password,
      role: constants.ROLES.VOLUNTEER
    });
    
    setCookies(res, accessToken, refreshToken);
    res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
};

const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.cookies;

    const tokens = await authService.refresh({
      refreshToken
    });

    setCookies(res, tokens.accessToken, tokens.refreshToken);
    res.status(200).json({ message: 'Tokens refreshed successfully' });
  } catch (error) {
    clearCookies(res);
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.cookies;
    
    if (refreshToken) {
      await authService.logout({ refreshToken });
    }
    
    clearCookies(res);
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  orgSignup,
  volSignup,
  orgSignin,
  volSignin,
  refresh,
  logout
};
