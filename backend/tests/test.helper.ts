import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { prisma } from '../src/db/prisma';
import { generateAccessToken } from '../src/utils/token';

export async function createTestUser(prefix = 'test') {
  const uniqueId = crypto.randomBytes(4).toString('hex');
  const email = `${prefix}_${uniqueId}@example.com`;
  const username = `${prefix}_${uniqueId}`;
  const password = 'Password123!';
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      username,
      name: `Test User ${uniqueId}`,
      passwordHash,
    },
  });

  // Create self conversation
  const selfConv = await prisma.conversation.create({
    data: {
      userAId: user.id,
      userBId: user.id,
      requesterId: user.id,
      status: 'accepted',
    },
  });

  await prisma.conversationMember.create({
    data: {
      conversationId: selfConv.id,
      userId: user.id,
    },
  });

  const accessToken = generateAccessToken({
    userId: user.id,
    email: user.email,
    username: user.username,
  });

  return {
    user,
    rawPassword: password,
    accessToken,
    authHeader: `Bearer ${accessToken}`,
  };
}

export async function cleanupTestUsers() {
  try {
    await prisma.user.deleteMany({
      where: {
        OR: [
          { email: { contains: 'test_' } },
          { username: { contains: 'test_' } },
        ],
      },
    });
  } catch (err) {
    // Ignore cleanup error if already gone
  }
}
