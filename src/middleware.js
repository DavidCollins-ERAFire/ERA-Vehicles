export { default } from "next-auth/middleware";

// Require a valid session for everything except the login page, NextAuth's own
// API routes, the cron endpoint (which uses its own secret), and static assets.
export const config = {
  matcher: [
    "/((?!login|api/auth|api/cron|_next/static|_next/image|favicon.ico).*)",
  ],
};
