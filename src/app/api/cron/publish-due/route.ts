import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishTextPost } from "@/lib/threads";

async function publishDuePosts() {
  const due = await prisma.post.findMany({
    where: { status: "SCHEDULED", scheduledFor: { lte: new Date() } },
    include: { account: true },
  });

  const results = [];
  for (const post of due) {
    try {
      const threadsPostId = await publishTextPost(
        post.account.threadsUserId,
        post.account.accessToken,
        post.text
      );
      await prisma.post.update({
        where: { id: post.id },
        data: { status: "PUBLISHED", threadsPostId, publishedAt: new Date() },
      });
      results.push({ id: post.id, ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Publish failed";
      await prisma.post.update({
        where: { id: post.id },
        data: { status: "FAILED", errorMessage: message },
      });
      results.push({ id: post.id, ok: false, error: message });
    }
  }
  return results;
}

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const results = await publishDuePosts();
  return NextResponse.json({ published: results.length, results });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
