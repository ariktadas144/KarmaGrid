const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const findByEmail = async (email) => {
  return prisma.volunteer.findUnique({ where: { email } });
};

const create = async (data) => {
  return prisma.volunteer.create({ data });
};

module.exports = {
  findByEmail,
  create
};
