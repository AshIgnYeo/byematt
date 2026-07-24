import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/config";

/** Posted to by a plain <form>, so redirect rather than returning JSON. */
export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/", request.url), 303);
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
