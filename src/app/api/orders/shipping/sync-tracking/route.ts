import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

const DELIVERED_ACTIVITIES = new Set(["livred", "encaissed", "payed"]);
const DELIVERED_STATUS_KEYWORDS = ["livre", "encaiss", "paye", "paiement"];
const RETURNED_ACTIVITIES = new Set(["return_asked", "return_in_transit", "Return_received"]);
const RETURNED_STATUS_KEYWORDS = ["retour"];

function classifyEcotrackStatus(status: string, activity: string): string {
  const s = status.toLowerCase();
  const a = activity.toLowerCase();

  if (DELIVERED_ACTIVITIES.has(a)) return "DELIVERED";
  if (RETURNED_ACTIVITIES.has(a)) return "RETURNED";

  for (const kw of DELIVERED_STATUS_KEYWORDS) {
    if (s.includes(kw)) return "DELIVERED";
  }
  for (const kw of RETURNED_STATUS_KEYWORDS) {
    if (s.includes(kw)) return "RETURNED";
  }

  return "CONFIRMED";
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const ids: string[] | undefined = body?.ids;

    const userStoreIds = user.storeIds || [];

    const where: any = {
      storeId: { in: userStoreIds },
      sentToEcotrack: true,
      ecotrackRef: { not: null },
    };
    if (ids && Array.isArray(ids) && ids.length > 0) {
      where.id = { in: ids };
    }

    const orders = await prisma.order.findMany({
      where,
      select: { id: true, storeId: true, ecotrackRef: true, status: true },
    });

    if (orders.length === 0) {
      return NextResponse.json({ success: true, total: 0, updated: 0, message: "No sent orders found" });
    }

    // Group by store
    const storeMap = new Map<string, { config: any; orders: typeof orders }>();
    for (const order of orders) {
      if (!storeMap.has(order.storeId)) {
        const config = await prisma.ecotrackConfig.findFirst({
          where: { storeId: order.storeId, isActive: true },
        });
        if (!config) continue;
        storeMap.set(order.storeId, { config, orders: [] });
      }
      storeMap.get(order.storeId)!.orders.push(order);
    }

    const CHUNK_SIZE = 100;
    const allResults: { id: string; ecotrackRef: string; status: string; newOrderStatus: string }[] = [];

    for (const [, { config, orders: storeOrders }] of storeMap) {
      // Chunk trackings into batches of 100
      for (let i = 0; i < storeOrders.length; i += CHUNK_SIZE) {
        const chunk = storeOrders.slice(i, i + CHUNK_SIZE);
        const trackings = chunk.map(o => o.ecotrackRef!);
        const params = `trackings[]=${encodeURIComponent(`[${trackings.join(",")}]`)}`;
        const url = `${config.baseUrl}/api/v1/get/trackings/info?${params}`;

        console.log(`[POST /api/orders/shipping/sync-tracking] Fetching ${chunk.length} trackings from: ${config.baseUrl}`);

        try {
          const apiRes = await fetch(url, {
            headers: { "x-api-key": config.apiKey },
          });

          if (!apiRes.ok) {
            const errText = await apiRes.text();
            console.error("[POST /api/orders/shipping/sync-tracking] API error:", errText);
            continue;
          }

          const apiData = await apiRes.json();
          console.log("[POST /api/orders/shipping/sync-tracking] Response:", JSON.stringify(apiData).slice(0, 500));

          // The response might be an array or have a trackings field
          const trackingList = Array.isArray(apiData) ? apiData : (apiData.trackings || []);

          for (const entry of trackingList) {
            const ref = entry.reference || entry.tracking;
            if (!ref) continue;

            const order = chunk.find(o => o.ecotrackRef === ref);
            if (!order) continue;

            const status = entry.status || "";
            const activity = entry.activity || "";
            const newOrderStatus = classifyEcotrackStatus(status, activity);

            if (newOrderStatus !== order.status && newOrderStatus !== "CONFIRMED") {
              await prisma.order.update({
                where: { id: order.id },
                data: { status: newOrderStatus as any },
              });
            }

            allResults.push({
              id: order.id,
              ecotrackRef: ref,
              status: entry.status || entry.activity || "unknown",
              newOrderStatus,
            });
          }
        } catch (err) {
          console.error("[POST /api/orders/shipping/sync-tracking] Fetch error:", err);
        }
      }
    }

    const updated = allResults.filter(r => r.newOrderStatus !== "CONFIRMED").length;

    return NextResponse.json({
      success: true,
      total: orders.length,
      processed: allResults.length,
      updated,
      results: allResults,
    });
  } catch (error) {
    console.error("[POST /api/orders/shipping/sync-tracking] Error:", error);
    return NextResponse.json({ error: "Failed to sync tracking" }, { status: 500 });
  }
}
