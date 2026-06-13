import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    accessTokenError?: string;
    googleScope?: string;
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
  }
}
