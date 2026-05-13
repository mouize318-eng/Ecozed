import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const workerId = searchParams.get("userId");

  if (!workerId) {
    return NextResponse.json({ error: "User ID is required" }, { status: 400 });
  }

  try {
    const payouts = await prisma.payout.findMany({
      where: { workerId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(payouts);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch payout history" }, { status: 500 });
  }
}
