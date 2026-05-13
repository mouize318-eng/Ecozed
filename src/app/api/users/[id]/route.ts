import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, hashPassword } from "@/lib/auth";

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
    const { username, password, permissions, storeIds, baseSalary, confirmationPrice, upsellBonus } = await req.json();
    const data: any = {};
    if (username) data.username = username;
    if (password) data.password = await hashPassword(password);
    if (permissions) data.permissions = permissions;
    if (storeIds) {
      data.stores = { set: storeIds.map((id: string) => ({ id })) };
    }
    if (baseSalary !== undefined) data.baseSalary = parseFloat(baseSalary) || 0;
    if (confirmationPrice !== undefined) data.confirmationPrice = parseFloat(confirmationPrice) || 0;
    if (upsellBonus !== undefined) data.upsellBonus = parseFloat(upsellBonus) || 0;

    const updatedUser = await prisma.user.update({
      where: { id },
      data,
      include: {
        stores: { select: { id: true, name: true } }
      }
    });

    return NextResponse.json({
      id: updatedUser.id,
      username: updatedUser.username,
      role: updatedUser.role,
      permissions: updatedUser.permissions,
      stores: updatedUser.stores,
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
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
    await prisma.user.delete({
      where: { id },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
