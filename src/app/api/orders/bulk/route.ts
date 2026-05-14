import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export async function PUT(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    console.warn("[PUT /api/orders/bulk] Unauthorized - no user");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { ids, status } = body;

    console.log("[PUT /api/orders/bulk] Request by:", { userId: user.id, username: user.username, role: user.role });
    console.log("[PUT /api/orders/bulk] Payload:", { ids, status, count: ids?.length });

    if (!ids || !Array.isArray(ids) || !status) {
      console.warn("[PUT /api/orders/bulk] Invalid data:", { ids: !!ids, isArray: Array.isArray(ids), status });
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }

    const userStoreIds = user.storeIds || [];
    console.log("[PUT /api/orders/bulk] User stores:", userStoreIds);

    // For CONFIRMED, set confirmedById only on orders that haven't been confirmed yet
    if (status === "CONFIRMED") {
      const unconfirmed = await prisma.order.findMany({
        where: { id: { in: ids }, storeId: { in: userStoreIds }, confirmedById: null },
        select: { id: true },
      });
      const unconfirmedIds = unconfirmed.map(o => o.id);
      console.log("[PUT /api/orders/bulk] CONFIRMED: unconfirmedIds=", unconfirmedIds, "out of total", ids.length);
      if (unconfirmedIds.length > 0) {
        await prisma.order.updateMany({
          where: { id: { in: unconfirmedIds } },
          data: { status, confirmedById: user.id },
        });
        console.log("[PUT /api/orders/bulk] Set confirmedById=", user.id, "on", unconfirmedIds.length, "order(s)");
      }
      // Update remaining (already-confirmed) orders without overwriting confirmedById
      const alreadyConfirmedIds = ids.filter(id => !unconfirmedIds.includes(id));
      if (alreadyConfirmedIds.length > 0) {
        await prisma.order.updateMany({
          where: { id: { in: alreadyConfirmedIds }, storeId: { in: userStoreIds } },
          data: { status },
        });
        console.log("[PUT /api/orders/bulk] Updated status only (already confirmed) for", alreadyConfirmedIds.length, "order(s)");
      }
    } else {
      console.log("[PUT /api/orders/bulk] Updating", ids.length, "orders to status:", status);
      await prisma.order.updateMany({
        where: { id: { in: ids }, storeId: { in: userStoreIds } },
        data: { status },
      });
    }

    // If status is RETURNED, handle blacklisting for all affected orders
    if (status === "RETURNED") {
      console.log("[PUT /api/orders/bulk] RETURNED - blacklisting phones for", ids.length, "order(s)");
      const orders = await prisma.order.findMany({
        where: { 
          id: { in: ids },
          storeId: { in: userStoreIds }
        }
      });
      
      for (const order of orders) {
        console.log("[PUT /api/orders/bulk] Blacklisting phone:", order.clientPhone1, "(order:", order.id, ")");
        await prisma.blacklist.upsert({
          where: { phone: order.clientPhone1 },
          create: { phone: order.clientPhone1, reason: "Bulk Order returned" },
          update: { reason: "Bulk Order returned" },
        });
        if (order.clientPhone2) {
          console.log("[PUT /api/orders/bulk] Also blacklisting phone2:", order.clientPhone2);
          await prisma.blacklist.upsert({
            where: { phone: order.clientPhone2 },
            create: { phone: order.clientPhone2, reason: "Bulk Order returned" },
            update: { reason: "Bulk Order returned" },
          });
        }
      }
    }

    console.log("[PUT /api/orders/bulk] Done -", ids.length, "order(s) updated to status:", status);
    return NextResponse.json({ success: true, count: ids.length });
  } catch (error) {
    console.error("[PUT /api/orders/bulk] Error:", error);
    return NextResponse.json({ error: "Failed to perform bulk update" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== "ADMIN") {
    console.warn("[DELETE /api/orders/bulk] Unauthorized: user=", user?.id, "role=", user?.role);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const idsString = searchParams.get("ids");
    if (!idsString) {
      console.warn("[DELETE /api/orders/bulk] Missing IDs");
      return NextResponse.json({ error: "Missing IDs" }, { status: 400 });
    }
    
    const ids = idsString.split(",");
    const userStoreIds = user.storeIds || [];
    console.log("[DELETE /api/orders/bulk] Request by:", { userId: user.id, username: user.username });
    console.log("[DELETE /api/orders/bulk] Deleting", ids.length, "order(s):", ids);

    const result = await prisma.order.deleteMany({
      where: { 
        id: { in: ids },
        storeId: { in: userStoreIds }
      },
    });

    console.log("[DELETE /api/orders/bulk] Deleted", result.count, "order(s)");
    return NextResponse.json({ success: true, count: result.count });
  } catch (error) {
    console.error("[DELETE /api/orders/bulk] Error:", error);
    return NextResponse.json({ error: "Failed to perform bulk delete" }, { status: 500 });
  }
}
