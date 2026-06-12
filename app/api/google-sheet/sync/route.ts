import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { sheetUrl, storeId } = await req.json();

    if (!sheetUrl || !storeId) {
      return NextResponse.json(
        { error: "sheetUrl and storeId are required" },
        { status: 400 }
      );
    }

    const response = await fetch(sheetUrl);

    if (!response.ok) {
      return NextResponse.json(
        { error: "Unable to fetch Google Sheet" },
        { status: 400 }
      );
    }

    const csvText = await response.text();

    const rows = csvText
      .split("\n")
      .slice(1)
      .map((row) => row.split(","));

    let imported = 0;
    let skipped = 0;

    for (const row of rows) {
      try {
        const orderNumber = row[0]?.trim();
        const clientName = row[1]?.trim();
        const phone = row[2]?.trim();
        const productName = row[3]?.trim();
        const state = row[4]?.trim();
        const totalPrice = Number(
          row[5]?.replace(/[^\d.]/g, "") || 0
        );
        const address = row[6]?.trim();

        if (!clientName || !phone) {
          skipped++;
          continue;
        }

        // منع تكرار الطلب
        const exists = await prisma.order.findFirst({
          where: {
            notes: `GS:${orderNumber}`,
          },
        });

        if (exists) {
          skipped++;
          continue;
        }

        // البحث عن المنتج
        const product = await prisma.product.findFirst({
          where: {
            storeId,
            name: {
              contains: productName,
              mode: "insensitive",
            },
          },
        });

        if (!product) {
          skipped++;
          continue;
        }

        await prisma.order.create({
          data: {
            clientName,
            clientPhone1: phone,
            state: state || "Unknown",
            city: state || "Unknown",
            address,
            quantity: 1,
            totalPrice,
            productId: product.id,
            storeId,
            shippingType: "HOME",
            status: "PENDING",
            notes: `GS:${orderNumber}`,
          },
        });

        imported++;
      } catch (error) {
        console.error(error);
        skipped++;
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      skipped,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Import failed" },
      { status: 500 }
    );
  }
}
