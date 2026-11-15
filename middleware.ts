import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextFetchEvent, NextMiddleware, NextRequest } from "next/server";
import { isUiPreviewMode } from "@/lib/auth/preview";

const isProtectedRoute = createRouteMatcher(["/app(.*)"]);

// Build the Clerk handler lazily so the module never crashes at load time,
// even if Clerk keys are absent. Only invoked when keys are valid
// (i.e. when isUiPreviewMode() is false).
let clerkHandler: NextMiddleware | null = null;
function getClerkHandler(): NextMiddleware {
  if (!clerkHandler) {
    clerkHandler = clerkMiddleware(async (auth, req) => {
      if (isProtectedRoute(req)) {
        await auth().protect();
      }
    });
  }
  return clerkHandler;
}

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  if (isUiPreviewMode()) {
    // No valid Clerk keys (or UI_PREVIEW_MODE=true): skip auth so the app
    // remains browsable instead of crashing the Edge middleware.
    return NextResponse.next();
  }
  return getClerkHandler()(req, event);
}

export const config = {
  matcher: ["/((?!.*\\..*|_next/static|_next/image|favicon.ico|logo).*)"],
};
