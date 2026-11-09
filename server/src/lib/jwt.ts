import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-me';
const EXPIRES_IN = '7d';

export type TokenPayload = { userId: number };

export function signToken(userId: number): string {
  return jwt.sign({ userId } satisfies TokenPayload, SECRET, { expiresIn: EXPIRES_IN });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const payload = jwt.verify(token, SECRET);
    if (typeof payload === 'object' && typeof payload.userId === 'number') {
      return { userId: payload.userId };
    }
    return null;
  } catch {
    return null;
  }
}
