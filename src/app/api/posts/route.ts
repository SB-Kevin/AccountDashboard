import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishTextPost } from "@/lib/threads";

export async function GET(request: NextRequest) {
  const accountId = request.nextUrl.searchParams.get("accountId");
  const posts = await prisma.post.findMany({
    where: accountId ? { accountId } : undefined,
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { account: { select: { username: true } } },
  });
  return NextResponse.json({ posts });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const accountId = body.accountId as string | undefined;
  const text = (body.text as string | undefined)?.trim();
  const scheduledForRaw = body.scheduledFor as string | undefined;

  if (!accountId || !text) {
    return NextResponse.json({ error: "accountId and text are required" }, { status: 400 });
  }

  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const scheduledFor = scheduledForRaw ? new Date(scheduledForRaw) : null;
  const isFuture = scheduledFor && scheduledFor.getTime() > Date.now();

  if (isFuture) {
    const post = await prisma.post.create({
      data: { accountId, text, status: "SCHEDULED", scheduledFor },
    });
    return NextResponse.json({ post });
  }

  const post = await prisma.post.create({ data: { accountId, text, status: "DRAFT" } });

  try {
    const threadsPostId = await publishTextPost(account.threadsUserId, account.accessToken, text);
    const updated = await prisma.post.update({
      where: { id: post.id },
      data: { status: "PUBLISHED", threadsPostId, publishedAt: new Date() },
    });
    return NextResponse.json({ post: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Publish failed";
    const updated = await prisma.post.update({
      where: { id: post.id },
      data: { status: "FAILED", errorMessage: message },
    });
    return NextResponse.json({ post: updated, error: message }, { status: 502 });
  }
}
