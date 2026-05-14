import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { 
      status, clientName, clientPhone1, clientPhone2, 
      state, city, address, notes,
      productId, quantity, adsCost, totalPrice,
      shippingType, shippingCost
    } = body;

    console.log("[PUT /api/orders/" + id + "] Update by:", { userId: user.id, username: user.username });
    console.log("[PUT /api/orders/" + id + "] Payload:", { status, clientName, productId, quantity, shippingCost });

    // Fetch current order to check existing confirmedById
    const existingOrder = await prisma.order.findUnique({
      where: { id },
      select: { id: true, status: true, confirmedById: true, clientPhone1: true, clientPhone2: true }
    });

    if (!existingOrder) {
      console.warn("[PUT /api/orders/" + id + "] Order not found");
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    console.log("[PUT /api/orders/" + id + "] Existing order:", { currentStatus: existingOrder.status, confirmedById: existingOrder.confirmedById });

    const data: any = {};
    if (status) {
      data.status = status;
      // Only set confirmedById on first confirmation, never overwrite
      if (status === "CONFIRMED" && !existingOrder?.confirmedById) {
        data.confirmedById = user.id;
        console.log("[PUT /api/orders/" + id + "] Setting confirmedById to:", user.id, "(", user.username, ")");
      } else if (status === "CONFIRMED" && existingOrder?.confirmedById) {
        console.log("[PUT /api/orders/" + id + "] Order already confirmed by:", existingOrder.confirmedById, "- not overwriting");
      }
    }
    if (clientName) data.clientName = clientName;
    if (clientPhone1) data.clientPhone1 = clientPhone1;
    if (clientPhone2 !== undefined) data.clientPhone2 = clientPhone2;
    if (state) data.state = state;
    if (city) data.city = city;
    if (address) data.address = address;
    if (notes !== undefined) data.notes = notes;
    if (productId) data.productId = productId;
    if (quantity !== undefined) data.quantity = parseInt(quantity) || 1;
    if (body.hasUpsell !== undefined) data.hasUpsell = body.hasUpsell;
    if (body.upsellQuantity !== undefined) data.upsellQuantity = body.upsellQuantity ? parseInt(body.upsellQuantity) : null;
    if (adsCost !== undefined) data.adsCost = parseFloat(adsCost) || 0;
    if (totalPrice !== undefined) data.totalPrice = parseFloat(totalPrice) || 0;
    if (shippingType) data.shippingType = shippingType;
    if (shippingCost !== undefined) data.shippingCost = parseFloat(shippingCost) || 0;

    const updatedOrder = await prisma.order.update({
      where: { id },
      data,
    });

    // Automatically blacklist if status is RETURNED
    if (status === "RETURNED") {
      const order = await prisma.order.findUnique({ where: { id } });
      if (order) {
        console.log("[PUT /api/orders/" + id + "] Blacklisting phone:", order.clientPhone1);
        await prisma.blacklist.upsert({
          where: { phone: order.clientPhone1 },
          create: { phone: order.clientPhone1, reason: "Order returned" },
          update: { reason: "Order returned" },
        });
        if (order.clientPhone2) {
          console.log("[PUT /api/orders/" + id + "] Also blacklisting phone2:", order.clientPhone2);
          await prisma.blacklist.upsert({
            where: { phone: order.clientPhone2 },
            create: { phone: order.clientPhone2, reason: "Order returned" },
            update: { reason: "Order returned" },
          });
        }
      }
    }

    console.log("[PUT /api/orders/" + id + "] Updated order:", { status: data.status, confirmedById: data.confirmedById || existingOrder?.confirmedById });
    return NextResponse.json(updatedOrder);
  } catch (error) {
    console.error("[PUT /api/orders/" + id + "] Error:", error);
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getAuthUser();
  if (!user || user.role !== "ADMIN") {
    console.warn("[DELETE /api/orders/" + id + "] Unauthorized: user=", user?.id, "role=", user?.role);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[DELETE /api/orders/" + id + "] Deleting order by:", { userId: user.id, username: user.username });

  try {
    await prisma.order.delete({
      where: { id },
    });
    console.log("[DELETE /api/orders/" + id + "] Deleted successfully");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/orders/" + id + "] Error:", error);
    return NextResponse.json({ error: "Failed to delete order" }, { status: 500 });
  }
}
