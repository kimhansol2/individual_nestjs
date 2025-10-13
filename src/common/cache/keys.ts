import { createHash } from 'crypto';

export const profileKey = (userId: number) => `user:profile:${userId}`;
export const profileIdx = (userId: number) => `idx:user:${userId}`;

export const myGamesIdx = (userId: number) => `idx:user:${userId}:games`;
export const myGamesKey = (userId: number, q: unknown) => {
  const norm = JSON.stringify(q);
  const h = createHash('sha1').update(norm).digest('hex').slice(0, 12);
  return `user:${userId}:games:${h}`;
};

export const myGamesCountIdx = (userId: number) => `user:${userId}:games:count`;
