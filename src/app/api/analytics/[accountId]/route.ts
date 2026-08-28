import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getThreadsInsights } from "@/lib/threads";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  const { accountId } = await params;
  const snapshots = await prisma.analyticsSnapshot.findMany({
    where: { accountId },
    orderBy: { capturedAt: "asc" },
    take: 90,
  });
  return NextResponse.json({ snapshots });
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  const { accountId } = await params;
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  try {
    const insights = await getThreadsInsights(account.threadsUserId, account.accessToken);
    const snapshot = await prisma.analyticsSnapshot.create({
      data: {
        accountId,
        views: insights.views ?? 0,
        likes: insights.likes ?? 0,
        replies: insights.replies ?? 0,
        reposts: insights.reposts ?? 0,
        quotes: insights.quotes ?? 0,
        followersCount: insights.followers_count ?? 0,
      },
    });
    return NextResponse.json({ snapshot });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch insights";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
