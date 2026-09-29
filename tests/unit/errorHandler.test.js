const test = require('node:test');
const assert = require('node:assert/strict');
const errorHandler = require('../../src/middleware/errorHandler');

test('errorHandler Middleware', (t) => {
  t.test('handles 4xx client errors that are not Zod/401/403/404', () => {
    const err = new Error('Test missing role');
    err.status = 400;
    
    const req = {};
    let statusSet;
    let jsonCalledWith;
    
    const res = {
      headersSent: false,
      status(code) {
        statusSet = code;
        return this;
      },
      json(payload) {
        jsonCalledWith = payload;
      }
    };
    
    const next = () => {};
    
    errorHandler(err, req, res, next);
    
    assert.equal(statusSet, 400);
    assert.deepEqual(jsonCalledWith, { error: 'Test missing role' });
  });
});
