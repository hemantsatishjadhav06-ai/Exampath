import "server-only";
import { SignJWT, jwtVerify } from "jose";

const secret = () => new TextEncoder().encode(process.env.SESSION_JWT_SECRET ?? "");

export async function issueSession(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt().setExpirationTime("90d")
    .sign(secret());
}

export async function readSession(token: string | undefined): Promise<string | null> {
  if (!token || !process.env.SESSION_JWT_SECRET) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return (payload.sub as string) ?? null;
  } catch { return null; }
}
