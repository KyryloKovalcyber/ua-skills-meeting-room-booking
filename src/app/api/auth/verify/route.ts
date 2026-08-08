import { NextResponse } from "next/server";
import { verifyEmailToken } from "@/lib/verification";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";

  try {
    await verifyEmailToken(token);
    return NextResponse.redirect(new URL("/schedule?verified=1", req.url));
  } catch {
    return NextResponse.redirect(new URL("/schedule?verification=invalid", req.url));
  }
}
