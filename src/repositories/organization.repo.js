const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const findByEmail = async (email) => {
  return prisma.organization.findUnique({ where: { email } });
};

const create = async (data) => {
  return prisma.organization.create({ data });
};

module.exports = {
  findByEmail,
  create
};
