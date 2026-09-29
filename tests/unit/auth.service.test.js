const test = require('node:test');
const assert = require('node:assert/strict');

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const volunteerRepo = require('../../src/repositories/volunteer.repo');
const organizationRepo = require('../../src/repositories/organization.repo');
const refreshTokenRepo = require('../../src/repositories/refreshToken.repo');

const authService = require('../../src/services/auth.service');
const constants = require('../../src/config/constants');

test('auth.service.js', async (t) => {
  t.beforeEach(() => {
    t.mock.restoreAll();
  });

  await t.test('signup()', async (t) => {
    await t.test('throws on duplicate email', async (t) => {
      t.mock.method(volunteerRepo, 'findByEmail', async () => ({ id: 1, email: 'test@test.com' }));
      
      await assert.rejects(
        authService.signup({ name: 'Test', email: 'test@test.com', password: 'password123', role: constants.ROLES.VOLUNTEER }),
        (err) => err.status === 400 && err.message === 'Email already in use'
      );
    });

    await t.test('calls bcrypt.hash and returns created user without password', async (t) => {
      t.mock.method(volunteerRepo, 'findByEmail', async () => null);
      t.mock.method(bcrypt, 'hash', async () => 'hashed_password');
      t.mock.method(volunteerRepo, 'create', async (data) => ({ id: 2, ...data, password: 'hashed_password' }));
      
      const user = await authService.signup({ name: 'Test', email: 'test@test.com', password: 'password123', role: constants.ROLES.VOLUNTEER });
      
      assert.equal(bcrypt.hash.mock.calls.length, 1);
      assert.deepEqual(bcrypt.hash.mock.calls[0].arguments, ['password123', 12]);
      
      assert.equal(user.id, 2);
      assert.equal(user.email, 'test@test.com');
      assert.equal(user.password, undefined);
    });
  });

  await t.test('signin()', async (t) => {
    await t.test('throws 401 on user not found', async (t) => {
      t.mock.method(organizationRepo, 'findByEmail', async () => null);
      
      await assert.rejects(
        authService.signin({ email: 'org@test.com', password: 'password123', role: constants.ROLES.ORGANIZATION }),
        (err) => err.status === 401 && err.message === 'Invalid email or password'
      );
    });

    await t.test('throws 401 on wrong password', async (t) => {
      t.mock.method(organizationRepo, 'findByEmail', async () => ({ id: 1, password: 'hashed_password' }));
      t.mock.method(bcrypt, 'compare', async () => false);
      
      await assert.rejects(
        authService.signin({ email: 'org@test.com', password: 'wrongpassword', role: constants.ROLES.ORGANIZATION }),
        (err) => err.status === 401 && err.message === 'Invalid email or password'
      );
    });

    await t.test('returns user, accessToken, refreshToken on success', async (t) => {
      t.mock.method(organizationRepo, 'findByEmail', async () => ({ id: 1, email: 'org@test.com', password: 'hashed_password' }));
      t.mock.method(bcrypt, 'compare', async () => true);
      t.mock.method(jwt, 'sign', () => 'access_token_123');
      t.mock.method(crypto, 'randomBytes', () => ({ toString: () => 'refresh_token_123' }));
      t.mock.method(crypto, 'createHash', () => {
        return {
          update: () => ({ digest: () => 'hashed_refresh_token_123' })
        };
      });
      t.mock.method(refreshTokenRepo, 'create', async () => ({}));
      
      const result = await authService.signin({ email: 'org@test.com', password: 'password123', role: constants.ROLES.ORGANIZATION });
      
      assert.equal(result.accessToken, 'access_token_123');
      assert.equal(result.refreshToken, 'refresh_token_123');
      assert.equal(result.user.password, undefined);
      assert.equal(result.user.email, 'org@test.com');
      
      const createCalls = refreshTokenRepo.create.mock.calls;
      assert.equal(createCalls.length, 1);
      assert.equal(createCalls[0].arguments[0].tokenHash, 'hashed_refresh_token_123');
    });
  });

  await t.test('refresh()', async (t) => {
    await t.test('throws 401 if findByTokenHash returns null', async (t) => {
      t.mock.method(crypto, 'createHash', () => ({ update: () => ({ digest: () => 'hash1' }) }));
      t.mock.method(refreshTokenRepo, 'findByTokenHash', async () => null);
      
      await assert.rejects(
        authService.refresh({ refreshToken: 'token1' }),
        (err) => err.status === 401 && err.message === 'Invalid or revoked refresh token'
      );
    });

    await t.test('throws 401 if revoked is true', async (t) => {
      t.mock.method(crypto, 'createHash', () => ({ update: () => ({ digest: () => 'hash1' }) }));
      t.mock.method(refreshTokenRepo, 'findByTokenHash', async () => ({ revoked: true }));
      
      await assert.rejects(
        authService.refresh({ refreshToken: 'token1' }),
        (err) => err.status === 401 && err.message === 'Invalid or revoked refresh token'
      );
    });

    await t.test('throws 401 if expiresAt is in the past', async (t) => {
      t.mock.method(crypto, 'createHash', () => ({ update: () => ({ digest: () => 'hash1' }) }));
      t.mock.method(refreshTokenRepo, 'findByTokenHash', async () => ({ 
        revoked: false, 
        role: constants.ROLES.VOLUNTEER, 
        expiresAt: new Date(Date.now() - 10000) 
      }));
      
      await assert.rejects(
        authService.refresh({ refreshToken: 'token1' }),
        (err) => err.status === 401 && err.message === 'Refresh token expired'
      );
    });

    await t.test('revokes old, creates new, returns new tokens on success', async (t) => {
      let hashIndex = 0;
      t.mock.method(crypto, 'createHash', () => ({ 
        update: () => ({ 
          digest: () => {
            hashIndex++;
            return hashIndex === 1 ? 'old_hash' : 'new_hash';
          } 
        }) 
      }));
      t.mock.method(refreshTokenRepo, 'findByTokenHash', async () => ({ 
        userId: 99,
        revoked: false, 
        role: constants.ROLES.VOLUNTEER, 
        expiresAt: new Date(Date.now() + 10000) 
      }));
      t.mock.method(refreshTokenRepo, 'revoke', async () => {});
      t.mock.method(refreshTokenRepo, 'create', async () => {});
      t.mock.method(jwt, 'sign', () => 'new_access_token');
      t.mock.method(crypto, 'randomBytes', () => ({ toString: () => 'new_refresh_token' }));
      
      const result = await authService.refresh({ refreshToken: 'old_refresh_token' });
      
      assert.equal(result.accessToken, 'new_access_token');
      assert.equal(result.refreshToken, 'new_refresh_token');
      
      assert.equal(refreshTokenRepo.revoke.mock.calls.length, 1);
      assert.equal(refreshTokenRepo.revoke.mock.calls[0].arguments[0], 'old_hash');
      
      assert.equal(refreshTokenRepo.create.mock.calls.length, 1);
      assert.equal(refreshTokenRepo.create.mock.calls[0].arguments[0].tokenHash, 'new_hash');
    });
  });

  await t.test('logout()', async (t) => {
    await t.test('calls revoke when valid record is found', async (t) => {
      t.mock.method(crypto, 'createHash', () => ({ update: () => ({ digest: () => 'some_hash' }) }));
      t.mock.method(refreshTokenRepo, 'findByTokenHash', async () => ({ role: constants.ROLES.VOLUNTEER }));
      t.mock.method(refreshTokenRepo, 'revoke', async () => {});

      await authService.logout({ refreshToken: 'token' });
      
      assert.equal(refreshTokenRepo.revoke.mock.calls.length, 1);
      assert.equal(refreshTokenRepo.revoke.mock.calls[0].arguments[0], 'some_hash');
    });

    await t.test('does nothing when token missing', async (t) => {
      t.mock.method(refreshTokenRepo, 'findByTokenHash', async () => null);
      t.mock.method(refreshTokenRepo, 'revoke', async () => {});
      
      await authService.logout({}); // no refresh token
      
      assert.equal(refreshTokenRepo.revoke.mock.calls.length, 0);
    });

    await t.test('does nothing when record not found', async (t) => {
      t.mock.method(crypto, 'createHash', () => ({ update: () => ({ digest: () => 'some_hash' }) }));
      t.mock.method(refreshTokenRepo, 'findByTokenHash', async () => null);
      t.mock.method(refreshTokenRepo, 'revoke', async () => {});
      
      await authService.logout({ refreshToken: 'token' });
      
      assert.equal(refreshTokenRepo.revoke.mock.calls.length, 0);
    });
  });
});
