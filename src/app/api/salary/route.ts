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
    const worker = await prisma.user.findUnique({
      where: { id: workerId },
      include: {
        confirmedOrders: {
          where: {
            status: "DELIVERED",
            isPaidOut: false,
          },
        },
      },
    });

    if (!worker) {
      return NextResponse.json({ error: "Worker not found" }, { status: 404 });
    }

    let totalUpsellQty = 0;
    worker.confirmedOrders.forEach(order => {
      if (order.hasUpsell && order.upsellQuantity) {
        totalUpsellQty += order.upsellQuantity;
      }
    });

    const pendingEarnings = {
      baseSalary: worker.baseSalary,
      orderBonuses: worker.confirmedOrders.length * worker.confirmationPrice,
      upsellBonuses: totalUpsellQty * worker.upsellBonus,
      total: worker.baseSalary + 
             (worker.confirmedOrders.length * worker.confirmationPrice) + 
             (totalUpsellQty * worker.upsellBonus),
      ordersCount: worker.confirmedOrders.length,
      upsellCount: totalUpsellQty,
      unpaidOrders: worker.confirmedOrders
    };

    return NextResponse.json(pendingEarnings);
  } catch (error) {
    console.error("Salary fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch salary data" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { workerId } = await req.json();

    const worker = await prisma.user.findUnique({
      where: { id: workerId },
      include: {
        confirmedOrders: {
          where: {
            status: "DELIVERED",
            isPaidOut: false,
          },
        },
      },
    });

    if (!worker || worker.confirmedOrders.length === 0) {
      // Even if no orders, they might still get base salary? 
      // The user said "when we pay this worker the counter should be reset to zero".
      // I'll allow payout if baseSalary > 0 or orders > 0.
    }

    if (!worker) return NextResponse.json({ error: "Worker not found" }, { status: 404 });

    let totalUpsellQty = 0;
    worker.confirmedOrders.forEach(order => {
      if (order.hasUpsell && order.upsellQuantity) {
        totalUpsellQty += order.upsellQuantity;
      }
    });

    const totalAmount = worker.baseSalary + 
                        (worker.confirmedOrders.length * worker.confirmationPrice) + 
                        (totalUpsellQty * worker.upsellBonus);

    // Transaction to ensure atomic payout
    const payout = await prisma.$transaction(async (tx) => {
      // 1. Create payout record
      const record = await tx.payout.create({
        data: {
          workerId,
          amount: totalAmount,
          ordersCount: worker.confirmedOrders.length,
          upsellCount: totalUpsellQty,
        }
      });

      // 2. Mark orders as paid out
      await tx.order.updateMany({
        where: {
          id: { in: worker.confirmedOrders.map(o => o.id) }
        },
        data: {
          isPaidOut: true
        }
      });

      return record;
    });

    return NextResponse.json(payout);
  } catch (error) {
    console.error("Payout error:", error);
    return NextResponse.json({ error: "Failed to process payout" }, { status: 500 });
  }
}
