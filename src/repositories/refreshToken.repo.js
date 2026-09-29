const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const create = async (data) => {
  return prisma.refreshToken.create({ data });
};

const findByTokenHash = async (tokenHash) => {
  return prisma.refreshToken.findUnique({ where: { tokenHash } });
};

const revoke = async (tokenHash) => {
  return prisma.refreshToken.update({
    where: { tokenHash },
    data: { revoked: true }
  });
};

module.exports = {
  create,
  findByTokenHash,
  revoke
};
