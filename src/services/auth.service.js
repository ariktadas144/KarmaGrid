const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const env = require('../config/env');
const constants = require('../config/constants');
const volunteerRepo = require('../repositories/volunteer.repo');
const organizationRepo = require('../repositories/organization.repo');
const refreshTokenRepo = require('../repositories/refreshToken.repo');

const getRepoByRole = (role) => {
  if (role === constants.ROLES.ORGANIZATION) return organizationRepo;
  if (role === constants.ROLES.VOLUNTEER) return volunteerRepo;
  throw new Error('Invalid role');
};

const getSecretByRole = (role) => {
  if (role === constants.ROLES.ORGANIZATION) return env.JWT_ORG_SECRET;
  if (role === constants.ROLES.VOLUNTEER) return env.JWT_VOL_SECRET;
  throw new Error('Invalid role');
};

// Hash refresh tokens before storage to mitigate impact of database leaks
const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

const signup = async ({ name, email, password, role }) => {
  const repo = getRepoByRole(role);
  
  const existingUser = await repo.findByEmail(email);
  if (existingUser) {
    const err = new Error('Email already in use');
    err.status = 400;
    throw err;
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const user = await repo.create({
    name,
    email,
    password: hashedPassword,
  });

  const { password: _, ...userWithoutPassword } = user;
  return userWithoutPassword;
};

const signin = async ({ email, password, role }) => {
  const repo = getRepoByRole(role);
  
  const user = await repo.findByEmail(email);
  if (!user) {
    const err = new Error('Invalid email or password');
    err.status = 401;
    throw err;
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    const err = new Error('Invalid email or password');
    err.status = 401;
    throw err;
  }

  const secret = getSecretByRole(role);
  const expiresIn = role === constants.ROLES.ORGANIZATION ? constants.JWT_EXPIRY.ORG : constants.JWT_EXPIRY.VOLUNTEER;
  
  const accessToken = jwt.sign({ id: user.id, role }, secret, { expiresIn: '15m' });
  
  const refreshToken = crypto.randomBytes(40).toString('hex');
  const tokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await refreshTokenRepo.create({
    userId: user.id,
    role,
    tokenHash,
    expiresAt,
  });

  const { password: _, ...userWithoutPassword } = user;
  return { user: userWithoutPassword, accessToken, refreshToken };
};

const refresh = async ({ refreshToken }) => {
  if (!refreshToken) {
    const err = new Error('Refresh token is required');
    err.status = 401;
    throw err;
  }

  const tokenHash = hashToken(refreshToken);
  const tokenRecord = await refreshTokenRepo.findByTokenHash(tokenHash);

  if (!tokenRecord || tokenRecord.revoked) {
    const err = new Error('Invalid or revoked refresh token');
    err.status = 401;
    throw err;
  }

  const role = tokenRecord.role;

  if (new Date() > tokenRecord.expiresAt) {
    const err = new Error('Refresh token expired');
    err.status = 401;
    throw err;
  }

  await refreshTokenRepo.revoke(tokenHash);

  const secret = getSecretByRole(role);
  const expiresIn = role === constants.ROLES.ORGANIZATION ? constants.JWT_EXPIRY.ORG : constants.JWT_EXPIRY.VOLUNTEER;
  
  const newAccessToken = jwt.sign({ id: tokenRecord.userId, role }, secret, { expiresIn: '15m' });
  
  const newRefreshToken = crypto.randomBytes(40).toString('hex');
  const newTokenHash = hashToken(newRefreshToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await refreshTokenRepo.create({
    userId: tokenRecord.userId,
    role,
    tokenHash: newTokenHash,
    expiresAt,
  });

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
};

const logout = async ({ refreshToken }) => {
  if (!refreshToken) return;
  const tokenHash = hashToken(refreshToken);
  const tokenRecord = await refreshTokenRepo.findByTokenHash(tokenHash);
  
  if (tokenRecord) {
    await refreshTokenRepo.revoke(tokenHash);
  }
};

module.exports = {
  signup,
  signin,
  refresh,
  logout
};
