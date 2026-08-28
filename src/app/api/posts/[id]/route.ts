import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const post = await prisma.post.findUnique({ where: { id } });
  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }
  if (post.status === "PUBLISHED") {
    return NextResponse.json(
      { error: "Cannot delete a post that was already published" },
      { status: 400 }
    );
  }
  await prisma.post.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
