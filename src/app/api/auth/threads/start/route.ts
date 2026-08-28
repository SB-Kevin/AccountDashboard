import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getThreadsAuthorizationUrl } from "@/lib/threads";

export async function GET() {
  const state = randomBytes(16).toString("hex");
  const response = NextResponse.redirect(getThreadsAuthorizationUrl(state));
  response.cookies.set("threads_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}
