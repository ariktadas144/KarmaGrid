const test = require('node:test');
const assert = require('node:assert/strict');
const { requireRole } = require('../../src/middleware/roleGuard');
const { verifyToken } = require('../../src/middleware/auth');
const jwt = require('jsonwebtoken');
const env = require('../../src/config/env');

test('roleGuard and verifyToken Unit Tests', async (t) => {
  const getCookie = (role) => {
    const secret = role === 'ORG' ? env.JWT_ORG_SECRET : env.JWT_VOL_SECRET;
    return jwt.sign({ id: 1, role }, secret, { expiresIn: '1h' });
  };

  const createMockReqResNext = (token) => {
    const req = {
      cookies: {}
    };
    if (token) req.cookies.authToken = token;

    const res = {};
    let errorPassed = null;
    let nextCalled = false;
    const next = (err) => {
      errorPassed = err;
      nextCalled = true;
    };
    
    return { req, res, next, getError: () => errorPassed, wasNextCalled: () => nextCalled };
  };

  const runMiddleware = (middleware, req, res, next) => {
    middleware(req, res, next);
  };

  await t.test('valid ORG token accessing org-only succeeds', async () => {
    const { req, res, next, getError } = createMockReqResNext(getCookie('ORG'));
    
    runMiddleware(verifyToken('ORG'), req, res, next);
    assert.equal(getError(), undefined);
    assert.equal(req.auth.role, 'ORG');

    let nextError;
    runMiddleware(requireRole('ORG'), req, res, (err) => nextError = err);
    assert.equal(nextError, undefined);
  });

  await t.test('valid VOLUNTEER token accessing org-only is rejected', async () => {
    // If a VOLUNTEER token is sent to an endpoint expecting verifyToken('ORG')
    const { req, res, next, getError } = createMockReqResNext(getCookie('VOLUNTEER'));
    
    runMiddleware(verifyToken('ORG'), req, res, next);
    const err = getError();
    assert.ok(err);
    assert.ok(err.status === 401 || err.status === 403);
  });

  await t.test('valid VOLUNTEER token accessing vol-only succeeds', async () => {
    const { req, res, next, getError } = createMockReqResNext(getCookie('VOLUNTEER'));
    
    runMiddleware(verifyToken('VOLUNTEER'), req, res, next);
    assert.equal(getError(), undefined);
    assert.equal(req.auth.role, 'VOLUNTEER');

    let nextError;
    runMiddleware(requireRole('VOLUNTEER'), req, res, (err) => nextError = err);
    assert.equal(nextError, undefined);
  });

  await t.test('valid ORG token accessing vol-only is rejected', async () => {
    const { req, res, next, getError } = createMockReqResNext(getCookie('ORG'));
    
    runMiddleware(verifyToken('VOLUNTEER'), req, res, next);
    const err = getError();
    assert.ok(err);
    assert.ok(err.status === 401 || err.status === 403);
  });

  await t.test('no token at all is rejected', async () => {
    const { req, res, next, getError } = createMockReqResNext(null);
    
    runMiddleware(verifyToken('ORG'), req, res, next);
    const err = getError();
    assert.ok(err);
    assert.equal(err.status, 401);
  });
});
