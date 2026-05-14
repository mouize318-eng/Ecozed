import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export async function GET() {
  const user = await getAuthUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const configs = await prisma.ecotrackConfig.findMany({
      include: { store: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(configs);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { storeId, company, prefix, apiKey, baseUrl } = await req.json();
    if (!storeId || !prefix || !apiKey) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const config = await prisma.ecotrackConfig.create({
      data: {
        storeId,
        company: company || "ecotrack",
        prefix,
        apiKey,
        baseUrl: baseUrl || `https://${prefix}.ecotrack.dz`,
      },
      include: { store: { select: { id: true, name: true } } },
    });

    return NextResponse.json(config);
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json({ error: "A config for this store already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  }
}
