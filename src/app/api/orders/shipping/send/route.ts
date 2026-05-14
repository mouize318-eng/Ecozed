import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { ids } = await req.json();
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "No order IDs provided" }, { status: 400 });
    }

    const userStoreIds = user.storeIds || [];

    const orders = await prisma.order.findMany({
      where: { id: { in: ids }, storeId: { in: userStoreIds } },
      include: {
        product: { select: { name: true, weight: true } },
      },
    });

    if (orders.length === 0) {
      return NextResponse.json({ error: "Orders not found" }, { status: 404 });
    }

    // Group orders by store
    const storeOrders = new Map<string, typeof orders>();
    for (const order of orders) {
      const group = storeOrders.get(order.storeId) || [];
      group.push(order);
      storeOrders.set(order.storeId, group);
    }

    // Map DZ state names to wilaya codes
    const stateToCode: Record<string, string> = {};
    const shippingConfigs = await prisma.shippingConfig.findMany();
    for (const sc of shippingConfigs) {
      stateToCode[sc.stateName] = sc.stateCode;
    }

    const overallRefs: string[] = [];

    for (const [storeId, storeOrds] of storeOrders) {
      const config = await prisma.ecotrackConfig.findFirst({
        where: { storeId, isActive: true },
      });

      if (!config) {
        console.error(`[POST /api/orders/shipping/send] No active config for store ${storeId}, skipping ${storeOrds.length} orders`);
        continue;
      }

      // Chunk by 100
      for (let i = 0; i < storeOrds.length; i += 100) {
        const chunk = storeOrds.slice(i, i + 100);
        const ecotrackOrders: Record<string, any> = {};

        for (let j = 0; j < chunk.length; j++) {
          const order = chunk[j];
          const ref = `${config.prefix}-${order.id.slice(-8)}`;
          const codeWilaya = stateToCode[order.state] || order.state;

          ecotrackOrders[String(j)] = {
            reference: ref,
            nom_client: order.clientName,
            telephone: order.clientPhone1,
            telephone_2: order.clientPhone2 || "",
            adresse: order.address || "",
            code_postal: "",
            commune: order.city,
            code_wilaya: codeWilaya,
            montant: String(order.totalPrice || 0),
            remarque: order.notes || "",
            produit: order.product.name,
            stock: 1,
            quantite: String(order.quantity),
            produit_a_recuperer: "",
            boutique: "",
            type: order.shippingType === "STOP_DESK" ? "2" : "1",
            stop_desk: order.shippingType === "STOP_DESK" ? 1 : 0,
            weight: String(order.product.weight || 1),
          };
        }

        const apiUrl = `${config.baseUrl}/api/v1/create/orders`;
        console.log(`[POST /api/orders/shipping/send] Sending ${chunk.length} orders to: ${apiUrl}`);

        const apiRes = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": config.apiKey,
          },
          body: JSON.stringify({ orders: ecotrackOrders }),
        });

        const apiData = await apiRes.json();
        console.log("[POST /api/orders/shipping/send] Ecotrack response:", apiData);

        if (!apiRes.ok) {
          console.error("[POST /api/orders/shipping/send] API rejected chunk:", apiData);
          continue;
        }

        for (const order of chunk) {
          const ref = `${config.prefix}-${order.id.slice(-8)}`;
          overallRefs.push(ref);
          await prisma.order.update({
            where: { id: order.id },
            data: {
              ecotrackRef: ref,
              sentToEcotrack: true,
              sentToEcotrackAt: new Date(),
            },
          });
        }
      }
    }

    return NextResponse.json({ success: true, count: overallRefs.length, refs: overallRefs });
  } catch (error) {
    console.error("[POST /api/orders/shipping/send] Error:", error);
    return NextResponse.json({ error: "Failed to send orders" }, { status: 500 });
  }
}
