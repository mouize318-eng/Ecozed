import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  
  // Server-side diagnostics
  console.log("[GET /api/orders] Auth check:", {
    hasUser: !!user,
    userId: user?.id,
    username: user?.username,
    role: user?.role,
    storeIds: user?.storeIds,
  });

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const storeIdsParam = searchParams.get("storeIds");
  
  const userStoreIds = user.storeIds || [];

  console.log("[GET /api/orders] URL params:", {
    storeIdsParam,
    status,
    userStoreIds,
  });

  // Filter store IDs by user permissions
  let targetStoreIds = userStoreIds;
  if (storeIdsParam && storeIdsParam !== "undefined") {
    const requestedIds = storeIdsParam.split(",");
    targetStoreIds = requestedIds.filter(id => userStoreIds.includes(id));
  }

  console.log("[GET /api/orders] targetStoreIds:", targetStoreIds);

  try {
    const orders = await prisma.order.findMany({
      where: {
        AND: [
          status ? { status: status as any } : {},
          { storeId: { in: targetStoreIds } }
        ]
      },
      include: {
        product: {
          select: { 
            name: true,
            sellingPrice: true,
            cost: true,
            adsCost: true,
            extraCharges: true
          }
        },
        confirmedBy: {
          select: { id: true, username: true }
        }
      },
      orderBy: { createdAt: "desc" },
    });

    // Check for blacklisted clients
    const phones = orders.flatMap(o => [o.clientPhone1, o.clientPhone2].filter(Boolean));
    const blacklisted = await prisma.blacklist.findMany({
      where: { phone: { in: phones as string[] } }
    });
    const blacklistMap = new Set(blacklisted.map(b => b.phone));

    const ordersWithBlacklist = orders.map(order => ({
      ...order,
      isBlacklisted: blacklistMap.has(order.clientPhone1) || (order.clientPhone2 && blacklistMap.has(order.clientPhone2))
    }));

    console.log("[GET /api/orders] Returning", ordersWithBlacklist.length, "orders for", targetStoreIds.length, "store(s):");
    for (const o of ordersWithBlacklist) {
      console.log("[GET /api/orders]  - Order:", JSON.stringify({
        id: o.id,
        status: o.status,
        clientName: o.clientName,
        clientPhone1: o.clientPhone1,
        productName: o.product.name,
        totalPrice: o.totalPrice,
        quantity: o.quantity,
        shippingCost: o.shippingCost,
        storeId: o.storeId,
        shippingType: o.shippingType,
        confirmedBy: o.confirmedBy,
        isBlacklisted: o.isBlacklisted,
        createdAt: o.createdAt,
        notes: o.notes,
      }));
    }

    return NextResponse.json(ordersWithBlacklist);
  } catch (error) {
    console.error("[GET /api/orders] Error:", error);
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { 
      clientName, clientPhone1, clientPhone2,
      state, city, address,
      productId, quantity, notes,
      adsCost, totalPrice, storeId,
      shippingType, shippingCost
    } = body;

    console.log("[POST /api/orders] Create order by:", { userId: user.id, username: user.username });
    console.log("[POST /api/orders] Payload:", { clientName, clientPhone1, productId, quantity, totalPrice, storeId, shippingCost });

    if (!clientName || !clientPhone1 || !productId || !storeId) {
      console.warn("[POST /api/orders] Missing required fields:", { clientName: !!clientName, clientPhone1: !!clientPhone1, productId: !!productId, storeId: !!storeId });
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const userStoreIds = user.storeIds || [];

    // Verify user has access to this store
    if (!userStoreIds.includes(storeId)) {
      console.warn("[POST /api/orders] Forbidden: user", user.id, "doesn't have access to store", storeId, "- user stores:", userStoreIds);
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // If totalPrice is not provided, calculate it from product price
    let finalTotalPrice = totalPrice ? parseFloat(totalPrice) : null;
    if (!finalTotalPrice) {
      const product = await prisma.product.findUnique({ where: { id: productId } });
      if (product) {
        finalTotalPrice = product.sellingPrice * (parseInt(quantity) || 1);
        console.log("[POST /api/orders] Auto-calculated totalPrice:", { productSellingPrice: product.sellingPrice, quantity, finalTotalPrice });
      }
    }

    const order = await prisma.order.create({
      data: {
        clientName,
        clientPhone1,
        clientPhone2,
        state,
        city,
        address,
        productId,
        storeId,
        quantity: parseInt(quantity) || 1,
        hasUpsell: body.hasUpsell || false,
        upsellQuantity: body.upsellQuantity ? parseInt(body.upsellQuantity) : null,
        totalPrice: finalTotalPrice,
        shippingType: shippingType || "HOME",
        shippingCost: shippingCost ? parseFloat(shippingCost) : 0,
        adsCost: adsCost ? parseFloat(adsCost) : 0,
        notes,
        status: "PENDING",
      },
    });

    console.log("[POST /api/orders] Created order:", { orderId: order.id, status: order.status, clientName: order.clientName, totalPrice: order.totalPrice });
    return NextResponse.json(order);
  } catch (error) {
    console.error("[POST /api/orders] Error:", error);
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }
}
