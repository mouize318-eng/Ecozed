import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function extractPhone(raw: string): string {
  // Remove country code prefix "05" or "06" or "07" — just take numbers
  const digits = raw.replace(/\D/g, "");
  return digits;
}

function extractStateCode(raw: string): string {
  // DZ-16 → "16"
  const match = raw.match(/DZ-(\d+)/);
  return match ? match[1] : raw;
}

function findMatchingState(stateCode: string, configs: { stateCode: string; stateName: string }[]): string | null {
  const config = configs.find(c => c.stateCode === stateCode);
  return config ? config.stateName : null;
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9\u0600-\u06FF\s]/g, "").trim();
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const { uuid } = await params;

  try {
    // Find integration by endpoint UUID
    const integration = await prisma.integration.findUnique({
      where: { endpointUuid: uuid },
      include: { store: true },
    });

    if (!integration || !integration.isActive) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Validate API key (sent as X-API-Key header)
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey || apiKey !== integration.apiKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    // Support both single order array and single object
    const orders = Array.isArray(body) ? body : [body];
    const createdOrders: any[] = [];

    // Fetch shipping configs for state matching
    const shippingConfigs = await prisma.shippingConfig.findMany();

    for (const woocommerceOrder of orders) {
      // Only process orders with "processing" status
      if (woocommerceOrder.status !== "processing") {
        continue;
      }

      const billing = woocommerceOrder.billing || {};
      const shipping = woocommerceOrder.shipping || {};
      const lineItems = woocommerceOrder.line_items || [];

      // Extract phone
      const phone = extractPhone(billing.phone || shipping.phone || "");

      // Extract state code and find matching state name
      const stateRaw = billing.state || shipping.state || "";
      const stateCode = extractStateCode(stateRaw);
      const stateName = findMatchingState(stateCode, shippingConfigs) || stateRaw;

      // Extract client name
      const clientName = [billing.first_name, billing.last_name].filter(Boolean).join(" ").trim() || "Unknown";

      // Extract city
      const city = billing.city || shipping.city || "";

      // Extract address
      const address = billing.address_1 || shipping.address_1 || "";

      // Extract total and shipping cost
      const totalPrice = parseFloat(woocommerceOrder.total || "0");
      const shippingCost = parseFloat(woocommerceOrder.shipping_total || "0");

      // Determine store
      const storeId = integration.storeId;

      // Process line items
      const itemsToProcess = lineItems.length > 0 ? lineItems : [{
        name: woocommerceOrder.meta_data?.find((m: any) => m.key === "_qf_product_id")?.value || "Imported Product",
        quantity: woocommerceOrder.meta_data?.find((m: any) => m.key === "_qf_quantity")?.value || 1,
        total: woocommerceOrder.total || "0",
      }];

      for (const item of itemsToProcess) {
        const productName = item.name || "Imported Product";
        const quantity = parseInt(item.quantity) || 1;
        const itemTotal = parseFloat(item.total || "0");

        // Try to find existing product by name
        const normalized = normalizeName(productName);
        let product = await prisma.product.findFirst({
          where: {
            storeId,
            name: { contains: productName, mode: "insensitive" },
          },
        });

        // Also try normalized fuzzy match
        if (!product) {
          const allStoreProducts = await prisma.product.findMany({
            where: { storeId },
            select: { id: true, name: true },
          });
          product = allStoreProducts.find(p => normalizeName(p.name) === normalized) as any;
        }

        // Create product if not found
        if (!product) {
          product = await prisma.product.create({
            data: {
              name: productName,
              cost: 0,
              sellingPrice: itemTotal / quantity,
              storeId,
              status: "DRAFT",
            },
          });
        }

        // Create the order
        const order = await prisma.order.create({
          data: {
            clientName,
            clientPhone1: phone,
            clientPhone2: "",
            state: stateName,
            city,
            address,
            productId: (product as any).id,
            storeId,
            quantity,
            totalPrice,
            shippingCost,
            shippingType: "HOME",
            adsCost: 0,
            status: "PENDING",
            notes: `Imported from WooCommerce (Order #${woocommerceOrder.id})`,
          },
        });

        createdOrders.push(order);
      }
    }

    return NextResponse.json({ success: true, created: createdOrders.length });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Failed to process webhook" }, { status: 500 });
  }
}
