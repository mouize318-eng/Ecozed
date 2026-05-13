import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const stores = await prisma.store.findMany({
      include: {
        _count: {
          select: { products: true, orders: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });
    return NextResponse.json(stores);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch stores" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  
  // Diagnostic logging
  console.log("[POST /api/stores] Auth check:", {
    hasUser: !!user,
    userId: user?.id,
    username: user?.username,
    role: user?.role,
    storeIds: user?.storeIds,
  });

  if (!user || user.role !== "ADMIN") {
    console.log("[POST /api/stores] REJECTED — user:", user?.username, "role:", user?.role);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { name, description, websiteUrl } = await req.json();
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

    // Verify user still exists in DB (might be a stale session after reset)
    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    
    if (!dbUser) {
      console.error(`[POST /api/stores] ❌ ERROR: User ID '${user.id}' from JWT token was NOT FOUND in the database.`);
      console.error(`[POST /api/stores] ℹ️ This means your browser has an old session from before the database was reset/migrated.`);
      console.error(`[POST /api/stores] 🛠️ FIX: Please click 'Logout' in the dashboard and log back in.`);
      return NextResponse.json({ error: "User session is invalid. Please log out and back in." }, { status: 401 });
    }

    const store = await prisma.store.create({
      data: { name, description, websiteUrl }
    });

    // Automatically link the admin to the new store
    await prisma.user.update({
      where: { id: user.id },
      data: {
        stores: { connect: { id: store.id } }
      }
    });

    return NextResponse.json(store);
  } catch (error) {
    console.error("Store creation error:", error);
    return NextResponse.json({ 
      error: "Failed to create store", 
      details: error instanceof Error ? error.message : "Unknown error" 
    }, { status: 500 });
  }
}
