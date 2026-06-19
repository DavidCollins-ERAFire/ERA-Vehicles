import GoogleProvider from "next-auth/providers/google";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";

// Comma-separated list in .env.local, e.g. "erafire.com,era-corp.com"
function allowedDomains() {
  return (process.env.ALLOWED_EMAIL_DOMAINS || "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

function domainAllowed(email) {
  const domains = allowedDomains();
  if (domains.length === 0) return true; // no restriction configured
  const domain = (email || "").split("@")[1]?.toLowerCase();
  return domain ? domains.includes(domain) : false;
}

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          prompt: "select_account",
          // Request the scopes the workflows need (Drive upload, Gmail send,
          // Sheets sync) so a single corporate consent covers everything.
          scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/gmail.send",
            "https://www.googleapis.com/auth/drive.file",
            "https://www.googleapis.com/auth/spreadsheets",
          ].join(" "),
          access_type: "offline",
        },
      },
    }),
  ],

  session: { strategy: "jwt" },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  callbacks: {
    // Block anyone outside the approved corporate domain(s).
    async signIn({ user }) {
      return domainAllowed(user.email);
    },

    // On first sign-in, ensure a User row exists; attach role + id to the JWT.
    async jwt({ token, user }) {
      const email = token.email || user?.email;
      if (!email) return token;

      // The very first user to log in becomes MANAGER so the system is usable
      // out of the box. Everyone after defaults to DRIVER (promote later).
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        token.userId = existing.id;
        token.role = existing.role;
        token.slackId = existing.slackId || null;
        token.name = existing.name;
      } else {
        const count = await prisma.user.count();
        const created = await prisma.user.create({
          data: {
            email,
            name: user?.name || email.split("@")[0],
            role: count === 0 ? "MANAGER" : "DRIVER",
          },
        });
        token.userId = created.id;
        token.role = created.role;
        token.slackId = null;
        token.name = created.name;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId;
        session.user.role = token.role;
        session.user.slackId = token.slackId;
        session.user.name = token.name || session.user.name;
      }
      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
};

// --- Server-side helpers --------------------------------------------------

export function auth() {
  return getServerSession(authOptions);
}

// Returns the session if the user holds one of the allowed roles, else null.
export async function requireRole(roles) {
  const session = await auth();
  if (!session?.user) return null;
  const allowed = Array.isArray(roles) ? roles : [roles];
  return allowed.includes(session.user.role) ? session : null;
}
