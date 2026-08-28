import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  exchangeCodeForShortLivedToken,
  exchangeForLongLivedToken,
  getThreadsProfile,
} from "@/lib/threads";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const dashboardUrl = new URL("/dashboard/accounts", request.nextUrl.origin);

  if (error) {
    dashboardUrl.searchParams.set("error", error);
    return NextResponse.redirect(dashboardUrl);
  }

  const cookieState = request.cookies.get("threads_oauth_state")?.value;
  if (!code || !state || !cookieState || state !== cookieState) {
    dashboardUrl.searchParams.set("error", "invalid_state");
    return NextResponse.redirect(dashboardUrl);
  }

  try {
    const { accessToken: shortLivedToken } = await exchangeCodeForShortLivedToken(code);
    const { accessToken, expiresIn } = await exchangeForLongLivedToken(shortLivedToken);
    const profile = await getThreadsProfile(accessToken);

    await prisma.account.upsert({
      where: { threadsUserId: profile.id },
      create: {
        threadsUserId: profile.id,
        username: profile.username,
        accessToken,
        tokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
      },
      update: {
        username: profile.username,
        accessToken,
        tokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
      },
    });

    dashboardUrl.searchParams.set("linked", profile.username);
  } catch (err) {
    dashboardUrl.searchParams.set(
      "error",
      err instanceof Error ? err.message : "link_failed"
    );
  }

  const response = NextResponse.redirect(dashboardUrl);
  response.cookies.delete("threads_oauth_state");
  return response;
}
