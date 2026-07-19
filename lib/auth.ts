import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { logSecurityEvent, normalizeEmail } from "@/lib/security";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import bcrypt from "bcryptjs";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8; // 8 hours
const SESSION_UPDATE_AGE_SECONDS = 60 * 15; // rotate/refresh every 15 minutes

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Firebase",
      credentials: {
        username: { label: "Username or Email", type: "text" },
        password: { label: "Password", type: "password" },
        idToken: { label: "ID Token", type: "text" },
      },
      async authorize(credentials) {
        const usernameInput = credentials?.username;
        const passwordInput = credentials?.password;
        const idTokenInput = credentials?.idToken;

        let email = "";
        let userId = "";
        let name = "";
        let picture = "";
        let mustChangePassword = false;
        let role = "";
        let companyId = "";

        const db = getAdminDb();

        if (idTokenInput && !usernameInput) {
          const adminAuth = getAdminAuth();
          if (!adminAuth) return null;
          try {
            const decodedToken = await adminAuth.verifyIdToken(idTokenInput);
            email = normalizeEmail(decodedToken.email);
            userId = decodedToken.uid;
            name = (decodedToken.name as string) || decodedToken.email || "";
            picture = (decodedToken.picture as string) || "";
            role = "owner"; // Fallback role for Firebase Client Token if user doc not found yet
          } catch {
            return null;
          }
        } else if (usernameInput && passwordInput) {
          if (!db) return null;

          const inputLower = usernameInput.trim().toLowerCase();
          let userDocData: Record<string, unknown> | null = null;
          let userDocId = "";

          try {
            if (inputLower.includes("@")) {
              email = inputLower;
              const snap = await db.collection("users").doc(email).get();
              if (snap.exists) {
                userDocId = snap.id;
                userDocData = snap.data() || null;
              } else {
                const querySnap = await db.collection("users").where("email", "==", email).limit(1).get();
                if (!querySnap.empty) {
                  userDocId = querySnap.docs[0].id;
                  userDocData = querySnap.docs[0].data() || null;
                }
              }
            } else {
              const usernameSnap = await db.collection("usernames").doc(inputLower).get();
              if (usernameSnap.exists) {
                const resolvedEmail = usernameSnap.data()?.email || usernameSnap.data()?.userId;
                if (typeof resolvedEmail === "string" && resolvedEmail) {
                  email = normalizeEmail(resolvedEmail);
                  const snap = await db.collection("users").doc(email).get();
                  if (snap.exists) {
                    userDocId = snap.id;
                    userDocData = snap.data() || null;
                  } else {
                    const querySnap = await db.collection("users").where("email", "==", email).limit(1).get();
                    if (!querySnap.empty) {
                      userDocId = querySnap.docs[0].id;
                      userDocData = querySnap.docs[0].data() || null;
                    }
                  }
                }
              }

              if (!userDocData) {
                const querySnap = await db.collection("users").where("username", "==", inputLower).limit(1).get();
                if (!querySnap.empty) {
                  userDocId = querySnap.docs[0].id;
                  userDocData = querySnap.docs[0].data() || null;
                  email = normalizeEmail(userDocData.email);
                }
              }
            }
          } catch {
            return null;
          }

          if (!userDocData) return null;

          const storedHash = (userDocData.passwordHash as string) || (userDocData.password as string) || "";
          let passwordComparisonResult = false;

          if (storedHash) {
            if (storedHash.startsWith("$2a$") || storedHash.startsWith("$2b$") || storedHash.startsWith("$2y$")) {
              try {
                passwordComparisonResult = bcrypt.compareSync(passwordInput, storedHash);
              } catch {
                // Ignore and fall back
              }
            }
            if (!passwordComparisonResult) {
              const { sha256 } = await import("@/lib/security");
              if (sha256(passwordInput) === storedHash) {
                passwordComparisonResult = true;
              } else if (passwordInput === storedHash) {
                passwordComparisonResult = true;
              }
            }
          }

          if (!passwordComparisonResult) return null;

          userId = userDocId;
          name = (userDocData.name as string) || (userDocData.username as string) || email;
          picture = (userDocData.image as string) || "";
          mustChangePassword = Boolean(userDocData.mustChangePassword);
          role = (userDocData.role as string) || "worker";
          companyId = (userDocData.companyId as string) || "";
        } else {
          return null;
        }

        try {
          if (email && db) {
            const userSnap = await db.collection("users").doc(email).get();
            if (userSnap.exists) {
              const uData = userSnap.data();
              if (uData?.active === false || uData?.status === "disabled" || uData?.status === "suspended" || uData?.suspended === true) {
                throw new Error("Your account has been suspended.");
              }
              // Refresh mustChangePassword, role, companyId if found in users collection
              mustChangePassword = Boolean(uData?.mustChangePassword);
              role = (uData?.role as string) || role;
              companyId = (uData?.companyId as string) || companyId;
            }
          }
        } catch (error) {
          if ((error as Error).message === "Your account has been suspended.") {
            throw error;
          }
        }

        return {
          id: userId,
          email: normalizeEmail(email),
          name: name || email,
          image: picture || undefined,
          mustChangePassword,
          role,
          companyId,
        };
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
    async signIn({ user, account }) {
      if (account?.provider === "credentials") {
        return Boolean(user?.email);
      }
      return false;
    },
    async jwt({ token, user }) {
      if (user) {
        token.email = normalizeEmail(user.email) || token.email;
        token.name = user.name || token.name;
        token.picture = user.image || token.picture;
        token.mustChangePassword = user.mustChangePassword;
        token.role = user.role;
        token.companyId = user.companyId;
      }
      return token;
    },
    async session({ session, token }) {
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
      session.user.mustChangePassword = token.mustChangePassword;
      session.user.role = token.role;
      session.user.companyId = token.companyId;

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
