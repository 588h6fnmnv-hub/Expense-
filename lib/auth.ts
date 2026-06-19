import type { NextAuthOptions } from "next-auth";
import type { JWT } from "next-auth/jwt";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { logSecurityEvent, normalizeEmail } from "@/lib/security";
import { getAdminAuth } from "@/lib/firebase-admin";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8; // 8 hours
const SESSION_UPDATE_AGE_SECONDS = 60 * 15; // rotate/refresh every 15 minutes

type GoogleProfile = {
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  sub?: string;
};

const refreshGoogleAccessToken = async (token: JWT): Promise<JWT> => {
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
        grant_type: "refresh_token",
        refresh_token: typeof token.refreshToken === "string" ? token.refreshToken : "",
      }),
      cache: "no-store",
    });

    const refreshed = (await response.json()) as Record<string, unknown>;

    if (!response.ok || typeof refreshed.access_token !== "string") {
      throw refreshed;
    }

    return {
      ...token,
      accessToken: refreshed.access_token,
      accessTokenExpires:
        Date.now() + Number(refreshed.expires_in || SESSION_MAX_AGE_SECONDS) * 1000,
      refreshToken:
        typeof refreshed.refresh_token === "string" ? refreshed.refresh_token : token.refreshToken,
      error: undefined,
    };
  } catch {
    await logSecurityEvent({
      type: "auth_failure",
      userEmail: normalizeEmail(token.email),
      metadata: { reason: "google_refresh_failed" },
    });
    return {
      ...token,
      accessToken: undefined,
      refreshToken: undefined,
      error: "RefreshAccessTokenError",
    };
  }
};

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "openid email profile",
          access_type: "offline",
          prompt: "consent",
          include_granted_scopes: "true",
          response_type: "code",
        },
      },
    }),
    CredentialsProvider({
      name: "Firebase",
      credentials: {
        idToken: { label: "ID Token", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.idToken) return null;

        const adminAuth = getAdminAuth();
        if (!adminAuth) return null;

        try {
          const decodedToken = await adminAuth.verifyIdToken(credentials.idToken);
          return {
            id: decodedToken.uid,
            email: normalizeEmail(decodedToken.email),
            name: (decodedToken.name as string) || decodedToken.email,
            image: (decodedToken.picture as string) || undefined,
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE_SECONDS,
    updateAge: SESSION_UPDATE_AGE_SECONDS,
  },
  jwt: {
    maxAge: SESSION_MAX_AGE_SECONDS,
  },
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-next-auth.session-token"
          : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        const googleProfile = profile as GoogleProfile | undefined;
        const email = normalizeEmail(googleProfile?.email);
        const verified = googleProfile?.email_verified === true;

        await logSecurityEvent({
          type: verified ? "auth_attempt" : "auth_failure",
          userEmail: email,
          metadata: { provider: "google", verified },
        });

        // OAuth users must have a Google-verified email. This is the equivalent
        // of email verification for this app because password auth is not used.
        console.log("PROFILE", profile);
        console.log("EMAIL", email);
        console.log("VERIFIED", verified);

        return Boolean(email && verified);
      }

      if (account?.provider === "credentials") {
        return Boolean(user?.email);
      }

      return false;
    },
    async jwt({ token, user, account, profile }) {
      if (user) {
        token.email = normalizeEmail(user.email) || token.email;
        token.name = user.name || token.name;
        token.picture = user.image || token.picture;
      }

      if (profile && account?.provider === "google") {
        const googleProfile = profile as GoogleProfile;
        token.email = normalizeEmail(googleProfile.email) || token.email;
        token.emailVerified = googleProfile.email_verified === true;
        token.name = googleProfile.name || token.name;
        token.picture = googleProfile.picture || token.picture;
      }

      if (account && account.provider === "google") {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token || token.refreshToken;
        token.accessTokenExpires = account.expires_at
          ? account.expires_at * 1000
          : Date.now() + Number(account.expires_in || SESSION_MAX_AGE_SECONDS) * 1000;
        token.scope = account.scope || token.scope;
        token.error = undefined;
        return token;
      }

      if (
        token.accessToken &&
        token.accessTokenExpires &&
        Date.now() < Number(token.accessTokenExpires) - 60_000
      ) {
        return token;
      }

      if (token.refreshToken) {
        return refreshGoogleAccessToken(token);
      }

      return {
        ...token,
        accessToken: undefined,
        refreshToken: undefined,
        error: "RefreshAccessTokenError",
      };
    },
    async session({ session, token }) {
      // Never expose OAuth access/refresh tokens to React/browser code.
      session.accessTokenError = token.error;
      session.googleScope = token.scope;

      // Always ensure session.user exists and has the email from the JWT
      if (!session.user) {
        session.user = {
          email: normalizeEmail(token.email),
          name: typeof token.name === "string" ? token.name : undefined,
          image: typeof token.picture === "string" ? token.picture : undefined,
        };
      } else {
        session.user.email = normalizeEmail(token.email || session.user.email);
        if (token.name) session.user.name = String(token.name);
        if (token.picture) session.user.image = String(token.picture);
      }

      return session;
    },
  },
  events: {
    async signOut({ token }) {
      await logSecurityEvent({
        type: "auth_attempt",
        userEmail: normalizeEmail(token?.email),
        metadata: { event: "signout" },
      });
    },
  },
};
