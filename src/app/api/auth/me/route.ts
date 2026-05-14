import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const payload = await getAuthUser();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: payload.id },
      select: {
        id: true,
        username: true,
        role: true,
        permissions: true,
        stores: { select: { id: true, name: true } },
      },
    });

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    let stores = dbUser.stores;
    if (dbUser.permissions?.includes("access_all_stores")) {
      const allStores = await prisma.store.findMany({ select: { id: true, name: true } });
      stores = allStores;
    }

    return NextResponse.json({
      user: {
        id: dbUser.id,
        username: dbUser.username,
        role: dbUser.role,
        permissions: dbUser.permissions,
        stores,
      },
    });
  } catch (error) {
    console.error("[GET /api/auth/me] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
