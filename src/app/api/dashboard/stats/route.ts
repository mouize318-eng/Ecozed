import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const storeIdsParam = searchParams.get("storeIds");
  
  const userStoreIds = user.storeIds || [];

  let targetStoreIds = userStoreIds;
  if (storeIdsParam && storeIdsParam !== "undefined") {
    const requestedIds = storeIdsParam.split(",");
    targetStoreIds = requestedIds.filter(id => userStoreIds.includes(id));
  }

  try {
    const [orderCount, pendingCount, productCount, orders] = await Promise.all([
      prisma.order.count({ where: { storeId: { in: targetStoreIds } } }),
      prisma.order.count({ where: { storeId: { in: targetStoreIds }, status: "PENDING" } }),
      prisma.product.count({ where: { storeId: { in: targetStoreIds } } }),
      prisma.order.findMany({
        where: { storeId: { in: targetStoreIds } },
        include: { product: true }
      })
    ]);

    // Calculate total sales and profit only for DELIVERED orders
    // Attribution is based on createdAt as requested
    const deliveredOrders = orders.filter(o => o.status === "DELIVERED");
    
    const totalSales = deliveredOrders.reduce((sum, order) => {
      const revenue = order.totalPrice || ((order.product.sellingPrice * order.quantity) + order.shippingCost);
      return sum + revenue;
    }, 0);

    const totalProfit = deliveredOrders.reduce((sum, order) => {
      const revenue = order.totalPrice || ((order.product.sellingPrice * order.quantity) + order.shippingCost);
      const cost = (order.product.cost * order.quantity) + order.adsCost + order.product.extraCharges;
      return sum + (revenue - cost);
    }, 0);

    // Group by date (createdAt)
    const dailyStats: Record<string, { revenue: number, profit: number }> = {};
    deliveredOrders.forEach(order => {
      const date = new Date(order.createdAt).toISOString().split("T")[0];
      if (!dailyStats[date]) dailyStats[date] = { revenue: 0, profit: 0 };
      
      const revenue = order.totalPrice || ((order.product.sellingPrice * order.quantity) + order.shippingCost);
      const cost = (order.product.cost * order.quantity) + order.adsCost + order.product.extraCharges;
      
      dailyStats[date].revenue += revenue;
      dailyStats[date].profit += (revenue - cost);
    });

    return NextResponse.json({
      orderCount,
      pendingCount,
      productCount,
      totalSales,
      totalProfit,
      dailyStats
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    return NextResponse.json({ error: "Failed to fetch dashboard stats" }, { status: 500 });
  }
}
