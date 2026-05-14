import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { randomUUID } from "crypto";

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const integrations = await prisma.integration.findMany({
      include: { store: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(integrations);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch integrations" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { storeId, apiKey } = await req.json();

    if (!storeId || !apiKey) {
      return NextResponse.json({ error: "Store and API key are required" }, { status: 400 });
    }

    const store = await prisma.store.findUnique({ where: { id: storeId } });
    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    const integration = await prisma.integration.create({
      data: {
        storeId,
        websiteType: "woocommerce",
        apiKey,
        endpointUuid: randomUUID(),
      },
      include: { store: { select: { id: true, name: true } } },
    });

    return NextResponse.json(integration);
  } catch (error) {
    return NextResponse.json({ error: "Failed to create integration" }, { status: 500 });
  }
}
