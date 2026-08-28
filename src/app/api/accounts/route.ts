import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const accounts = await prisma.account.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      threadsUserId: true,
      username: true,
      displayName: true,
      notes: true,
      tokenExpiresAt: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ accounts });
}
