import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const data: { displayName?: string | null; notes?: string | null } = {};
  if (typeof body.displayName === "string" || body.displayName === null) {
    data.displayName = body.displayName;
  }
  if (typeof body.notes === "string" || body.notes === null) {
    data.notes = body.notes;
  }

  const account = await prisma.account.update({
    where: { id },
    data,
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
  return NextResponse.json({ account });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.account.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
