import { SignJWT, jwtVerify } from 'jose';
import { env } from '@/lib/env';

export interface TokenPayload {
  userId: string;
  sessionId: string;
  activeMembershipId: string;
  organizationId: string;
  organizationType?: string | null;
  role: string;
  croStatus: string;
  email: string;
  fullName: string;
  clinicId?: string | null;
  professionalIdCro?: string | null;
}

export interface RefreshTokenPayload {
  userId: string;
  sessionId?: string;
}

const getSecretKey = (secret: string) => new TextEncoder().encode(secret);

export async function signAccessToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h') // 24 horas para continuidade do contexto
    .sign(getSecretKey(env.JWT_SECRET));
}

export async function signRefreshToken(payload: RefreshTokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d') // 7 dias
    .sign(getSecretKey(env.JWT_REFRESH_SECRET));
}

export async function verifyAccessToken(token: string): Promise<TokenPayload | null> {
  try {
    const verified = await jwtVerify(token, getSecretKey(env.JWT_SECRET));
    return verified.payload as unknown as TokenPayload;
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(token: string): Promise<RefreshTokenPayload | null> {
  try {
    const verified = await jwtVerify(token, getSecretKey(env.JWT_REFRESH_SECRET));
    return verified.payload as unknown as RefreshTokenPayload;
  } catch {
    return null;
  }
}
