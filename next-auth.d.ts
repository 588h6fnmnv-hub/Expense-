import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      email?: string | null;
      name?: string | null;
      image?: string | null;
      mustChangePassword?: boolean;
      role?: string;
      companyId?: string;
    };
    accessTokenError?: string;
    googleScope?: string;
  }

  interface User {
    mustChangePassword?: boolean;
    role?: string;
    companyId?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    accessTokenExpires?: number;
    refreshToken?: string;
    scope?: string;
    error?: string;
    emailVerified?: boolean;
    mustChangePassword?: boolean;
    role?: string;
    companyId?: string;
  }
}
