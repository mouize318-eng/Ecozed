import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret";

export interface JWTPayload {
  id: string;
  username: string;
  role: string;
  permissions: string[];
  storeIds: string[];
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePasswords(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    return null;
  }
}

import { cookies } from "next/headers";
import { prisma } from "./prisma";

export async function getAuthUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  
  const payload = verifyToken(token);
  if (!payload) return null;

  // Global Stale Session Check & Live Store Sync:
  // Ensure the user still actually exists in the database.
  // Also fetch their live store access list, since store permissions
  // can change after the JWT token was issued (e.g. creating a new store).
  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { 
        id: true,
        permissions: true,
        stores: { select: { id: true } }
      }
    });
    
    if (!dbUser) return null;

    // If user has "access_all_stores" permission, give them ALL stores in the system
    if (dbUser.permissions?.includes("access_all_stores")) {
      const allStores = await prisma.store.findMany({ select: { id: true } });
      payload.storeIds = allStores.map(s => s.id);
    } else {
      // Override the stale JWT storeIds with the live database data
      payload.storeIds = dbUser.stores.map(s => s.id);
    }
  } catch (error) {
    console.error("[getAuthUser] DB verification failed:", error);
    return null;
  }

  return payload;
}
