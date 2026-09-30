const test = require('node:test');
const assert = require('node:assert/strict');
const taskRepo = require('../../src/repositories/task.repo');
const taskService = require('../../src/services/task.service');

test('task.service.js', async (t) => {
  t.beforeEach(() => {
    t.mock.restoreAll();
  });

  await t.test('createTask()', async (t) => {
    await t.test('throws on missing required fields', async (t) => {
      await assert.rejects(
        taskService.createTask('org-123', {}),
        (err) => err.name === 'ZodError'
      );
    });

    await t.test('calls repo with validated data', async (t) => {
      t.mock.method(taskRepo, 'createTask', async (data) => ({ id: 't1', ...data }));
      const task = await taskService.createTask('org-1', {
        title: 'Clean park',
        description: 'Clean the park',
        size: 5,
        location: 'Park',
        date: new Date().toISOString(),
        category: 'Environment'
      });
      assert.equal(task.id, 't1');
      assert.equal(task.organizationId, 'org-1');
      assert.equal(taskRepo.createTask.mock.calls.length, 1);
    });
  });

  await t.test('updateTask()', async (t) => {
    await t.test('throws 403 on non-owner update', async (t) => {
      t.mock.method(taskRepo, 'findTaskById', async () => ({ id: 't1', organizationId: 'org-1' }));
      await assert.rejects(
        taskService.updateTask('org-2', 't1', { title: 'New title' }),
        (err) => err.status === 403
      );
    });
  });

  await t.test('cancelTask()', async (t) => {
    await t.test('throws 403 on non-owner cancel', async (t) => {
      t.mock.method(taskRepo, 'findTaskById', async () => ({ id: 't1', organizationId: 'org-1' }));
      await assert.rejects(
        taskService.cancelTask('org-2', 't1'),
        (err) => err.status === 403
      );
    });
  });

  await t.test('registerForTask()', async (t) => {
    await t.test('throws 400 if task not OPEN', async (t) => {
      t.mock.method(taskRepo.prisma, '$transaction', async (cb) => {
        const mockTx = {
          task: { findUnique: async () => ({ id: 't1', status: 'CANCELLED' }) }
        };
        return cb(mockTx);
      });
      await assert.rejects(
        taskService.registerForTask('t1', 'vol-1'),
        (err) => err.status === 400 && err.message === 'Task is not open for registration'
      );
    });

    await t.test('throws 409 if task is full', async (t) => {
      t.mock.method(taskRepo.prisma, '$transaction', async (cb) => {
        const mockTx = {
          task: { findUnique: async () => ({ id: 't1', status: 'OPEN', size: 1, registrations: [{ volunteerId: 'vol-2' }] }) }
        };
        return cb(mockTx);
      });
      await assert.rejects(
        taskService.registerForTask('t1', 'vol-1'),
        (err) => err.status === 409 && err.message === 'Task is full'
      );
    });

    await t.test('throws 409 if already registered', async (t) => {
      t.mock.method(taskRepo.prisma, '$transaction', async (cb) => {
        const mockTx = {
          task: { findUnique: async () => ({ id: 't1', status: 'OPEN', size: 2, registrations: [{ volunteerId: 'vol-1' }] }) }
        };
        return cb(mockTx);
      });
      await assert.rejects(
        taskService.registerForTask('t1', 'vol-1'),
        (err) => err.status === 409 && err.message === 'Already registered'
      );
    });

    await t.test('creates registration on happy path', async (t) => {
      t.mock.method(taskRepo.prisma, '$transaction', async (cb) => {
        const mockTx = {
          task: { findUnique: async () => ({ id: 't1', status: 'OPEN', size: 5, registrations: [] }) },
          registration: { create: async (data) => ({ id: 'r1', ...data.data }) }
        };
        return cb(mockTx);
      });
      const reg = await taskService.registerForTask('t1', 'vol-1');
      assert.equal(reg.id, 'r1');
      assert.equal(reg.volunteerId, 'vol-1');
    });
  });
});
