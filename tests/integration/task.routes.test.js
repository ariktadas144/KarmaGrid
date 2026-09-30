const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const errorHandler = require('../../src/middleware/errorHandler');
const taskRoutes = require('../../src/routes/task.routes');
const env = require('../../src/config/env');

const prisma = new PrismaClient();

test('task.routes.js concurrency', async (t) => {
  let server;
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/tasks', taskRoutes);
  app.use(errorHandler);

  t.before(async () => {
    await new Promise((resolve) => {
      server = app.listen(0, resolve);
    });
  });

  t.after(async () => {
    server.close();
    await prisma.$disconnect();
  });

  await t.test('concurrent registration respects capacity', async () => {
    const port = server.address().port;
    
    const org = await prisma.organization.create({
      data: { name: 'Test Org', email: 'testorg@example.com', password: 'hash' }
    });
    
    const vol1 = await prisma.volunteer.create({
      data: { name: 'Vol 1', email: 'vol1@example.com', password: 'hash' }
    });
    
    const vol2 = await prisma.volunteer.create({
      data: { name: 'Vol 2', email: 'vol2@example.com', password: 'hash' }
    });
    
    const task = await prisma.task.create({
      data: {
        title: 'Tiny Task',
        description: 'Only 1 slot',
        size: 1,
        location: 'Park',
        date: new Date(),
        category: 'Test',
        status: 'OPEN',
        organizationId: org.id
      }
    });

    const token1 = jwt.sign({ id: vol1.id }, env.JWT_VOL_SECRET);
    const token2 = jwt.sign({ id: vol2.id }, env.JWT_VOL_SECRET);

    const makeReq = async (token) => {
      const res = await fetch(`http://localhost:${port}/tasks/${task.id}/register`, {
        method: 'POST',
        headers: {
          'Cookie': `authToken=${token}`
        }
      });
      return { status: res.status, body: await res.json() };
    };

    const results = await Promise.all([
      makeReq(token1),
      makeReq(token2)
    ]);

    const successes = results.filter(r => r.status === 201);
    const failures = results.filter(r => r.status === 409 || r.status === 400);

    assert.equal(successes.length, 1, 'Exactly one registration should succeed');
    assert.equal(failures.length, 1, 'Exactly one registration should fail');

    const dbRegistrations = await prisma.registration.count({ where: { taskId: task.id } });
    assert.equal(dbRegistrations, 1, 'Database should contain exactly one registration');

    await prisma.registration.deleteMany({ where: { taskId: task.id } });
    await prisma.task.delete({ where: { id: task.id } });
    await prisma.volunteer.deleteMany({ where: { id: { in: [vol1.id, vol2.id] } } });
    await prisma.organization.delete({ where: { id: org.id } });
  });
});
