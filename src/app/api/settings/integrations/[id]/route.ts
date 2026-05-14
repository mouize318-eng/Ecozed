import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getAuthUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { storeId, apiKey, isActive, regenerateKey } = await req.json();
    const data: any = {};

    if (storeId) data.storeId = storeId;
    if (apiKey) data.apiKey = apiKey;
    if (typeof isActive === "boolean") data.isActive = isActive;

    const integration = await prisma.integration.update({
      where: { id },
      data,
      include: { store: { select: { id: true, name: true } } },
    });

    return NextResponse.json(integration);
  } catch (error) {
    return NextResponse.json({ error: "Failed to update integration" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getAuthUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await prisma.integration.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete integration" }, { status: 500 });
  }
}
