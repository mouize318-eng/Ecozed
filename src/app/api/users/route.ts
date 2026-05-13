import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, hashPassword } from "@/lib/auth";

export async function GET() {
  const user = await getAuthUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const workers = await prisma.user.findMany({
      where: { role: "WORKER" },
      select: {
        id: true,
        username: true,
        role: true,
        permissions: true,
        baseSalary: true,
        confirmationPrice: true,
        upsellBonus: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(workers);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { 
      username, 
      password, 
      permissions,
      baseSalary,
      confirmationPrice,
      upsellBonus
    } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" }, { status: 400 });
    }

    // Check if username already exists
    const existingUser = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUser) {
      return NextResponse.json({ error: "اسم المستخدم موجود بالفعل" }, { status: 400 });
    }

    const hashedPassword = await hashPassword(password);

    const newUser = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        role: "WORKER",
        permissions: permissions || [],
        baseSalary: parseFloat(baseSalary) || 0,
        confirmationPrice: parseFloat(confirmationPrice) || 0,
        upsellBonus: parseFloat(upsellBonus) || 0,
      },
    });

    return NextResponse.json({
      id: newUser.id,
      username: newUser.username,
      role: newUser.role,
      permissions: newUser.permissions,
    });
  } catch (error) {
    console.error("User creation error:", error);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}
