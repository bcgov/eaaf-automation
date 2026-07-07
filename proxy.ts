import { NextRequest, NextResponse } from "next/server";

/**
 * HTTP Basic Auth middleware.
 *
 * Activated only when AUTH_USERNAME and AUTH_PASSWORD are set in .env.local.
 * Leave them unset for unrestricted local development.
 *
 * Add to .env.local:
 *   AUTH_USERNAME=your-username
 *   AUTH_PASSWORD=your-password
 */
export default function proxy(request: NextRequest) {
  const username = process.env.AUTH_USERNAME;
  const password = process.env.AUTH_PASSWORD;

  // Auth not configured — allow all requests (local dev default)
  if (!username || !password) {
    return NextResponse.next();
  }

  // Skip auth for localhost — only enforce on external/tunnel access
  const host = request.headers.get("host") ?? "";
  const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  if (isLocal) {
    return NextResponse.next();
  }

  const authHeader = request.headers.get("authorization") ?? "";

  if (authHeader.startsWith("Basic ")) {
    try {
      const decoded = atob(authHeader.slice(6));
      const colonIdx = decoded.indexOf(":");
      if (colonIdx !== -1) {
        const user = decoded.slice(0, colonIdx);
        const pass = decoded.slice(colonIdx + 1);
        if (user === username && pass === password) {
          return NextResponse.next();
        }
      }
    } catch {
      // malformed base64 — fall through to 401
    }
  }

  return new NextResponse("Unauthorized", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="EAAF Automation", charset="UTF-8"',
    },
  });
}

export const config = {
  // Exclude all Next.js internals (static assets, images, HMR WebSocket, etc.)
  matcher: ["/((?!_next/|favicon.ico).*)"],
};
