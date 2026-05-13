import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const workerId = searchParams.get("userId");

  if (!workerId) {
    return NextResponse.json({ error: "User ID is required" }, { status: 400 });
  }

  try {
    const worker = await prisma.user.findUnique({
      where: { id: workerId },
      include: {
        confirmedOrders: true,
        payouts: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!worker) {
      return NextResponse.json({ error: "Worker not found" }, { status: 404 });
    }

    const allTimeOrders = worker.confirmedOrders;
    const paidOrders = allTimeOrders.filter(o => o.isPaidOut);
    const pendingOrders = allTimeOrders.filter(o => !o.isPaidOut && o.status === "DELIVERED");

    let totalUpsellQty = 0;
    let totalRevenue = 0;
    allTimeOrders.forEach(order => {
      if (order.hasUpsell && order.upsellQuantity) {
        totalUpsellQty += order.upsellQuantity;
      }
      totalRevenue += order.totalPrice || 0;
    });

    const paidUpsellQty = allTimeOrders
      .filter(o => o.isPaidOut && o.hasUpsell && o.upsellQuantity)
      .reduce((sum, o) => sum + (o.upsellQuantity || 0), 0);

    const totalPayouts = worker.payouts.reduce((sum, p) => sum + p.amount, 0);

    return NextResponse.json({
      allTimeConfirmed: allTimeOrders.length,
      deliveredOrders: allTimeOrders.filter(o => o.status === "DELIVERED").length,
      canceledOrders: allTimeOrders.filter(o => o.status === "CANCELED").length,
      returnedOrders: allTimeOrders.filter(o => o.status === "RETURNED").length,
      paidOrders: paidOrders.length,
      pendingOrders: pendingOrders.length,
      totalUpsellQty,
      totalRevenue,
      totalPayouts,
      payouts: worker.payouts,
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch performance data" }, { status: 500 });
  }
}
