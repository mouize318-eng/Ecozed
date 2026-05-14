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
    const { company, prefix, apiKey, baseUrl, isActive } = await req.json();
    const data: any = {};
    if (company) data.company = company;
    if (prefix) data.prefix = prefix;
    if (apiKey) data.apiKey = apiKey;
    if (baseUrl) data.baseUrl = baseUrl;
    if (typeof isActive === "boolean") data.isActive = isActive;

    const config = await prisma.ecotrackConfig.update({
      where: { id },
      data,
      include: { store: { select: { id: true, name: true } } },
    });

    return NextResponse.json(config);
  } catch (error) {
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
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
    await prisma.ecotrackConfig.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
