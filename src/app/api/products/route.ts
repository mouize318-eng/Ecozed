import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getAuthUser();

  // Server-side diagnostics
  console.log("[GET /api/products] Auth check:", {
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
  const storeIdsParam = searchParams.get("storeIds");
  
  // Guard against undefined storeIds in legacy sessions
  const userStoreIds = user.storeIds || [];
  
  console.log("[GET /api/products] URL params:", {
    storeIdsParam,
    userStoreIds,
  });

  let targetStoreIds = userStoreIds;
  if (storeIdsParam && storeIdsParam !== "undefined") {
    const requestedIds = storeIdsParam.split(",");
    targetStoreIds = requestedIds.filter(id => userStoreIds.includes(id));
  }

  console.log("[GET /api/products] targetStoreIds:", targetStoreIds);

  try {
    const products = await prisma.product.findMany({
      where: {
        storeId: { in: targetStoreIds }
      },
      orderBy: { createdAt: "desc" },
    });
    console.log("[GET /api/products] Returning", products.length, "products");
    return NextResponse.json(products);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
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
      name, weight, cost, sellingPrice, 
      status, adsCost, extraCharges, 
      imageUrl, storeId, description, landingPageUrl, offers
    } = body;

    if (!name || cost === undefined || sellingPrice === undefined || !storeId) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const userStoreIds = user.storeIds || [];

    // Verify user has access to this store
    if (!userStoreIds.includes(storeId)) {
      console.error(`[POST /api/products] ❌ ERROR: 403 Forbidden. User ${user.username} does not have access to store ${storeId}.`);
      console.error(`[POST /api/products] User's authorized stores:`, userStoreIds);
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const product = await prisma.product.create({
      data: {
        name,
        weight: weight ? parseFloat(weight) : null,
        cost: parseFloat(cost),
        sellingPrice: parseFloat(sellingPrice),
        adsCost: adsCost ? parseFloat(adsCost) : 0,
        extraCharges: extraCharges ? parseFloat(extraCharges) : 0,
        imageUrl: imageUrl || null,
        status: status || "DRAFT",
        description: description || null,
        landingPageUrl: landingPageUrl || null,
        offers: offers || undefined,
        storeId,
      },
    });

    return NextResponse.json(product);
  } catch (error) {
    console.error("Product creation error:", error);
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
  }
}
