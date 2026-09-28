import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_NAME, sessionSignature } from "@/lib/session";

/** Gatekeeper of the app: with APP_PASSWORD set, everything requires the session (an HMAC
 *  cookie) except the sign-in screen itself. Without the env, the app is open. */
export default async function proxy(request: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (pathname === "/sign-in" || pathname === "/api/sign-in" || pathname === "/api/health") return NextResponse.next();

  const cookie = request.cookies.get(COOKIE_NAME)?.value;
  if (cookie === (await sessionSignature(password))) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Session expired. Sign in again." }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/sign-in", request.url));
}

export const config = {
  // static assets (icons, fonts, images, the sample PDFs) stay outside the gate
  matcher: ["/((?!_next/static|_next/image|samples/|.*\\.(?:png|jpe?g|svg|ico|webp|woff2?|mjs|pdf)$).*)"],
};
