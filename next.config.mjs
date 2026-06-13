const isProd = process.env.NODE_ENV === "production";

const nextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options",            value: "DENY" },
          { key: "X-Content-Type-Options",      value: "nosniff" },
          { key: "Strict-Transport-Security",   value: "max-age=31536000; includeSubDomains; preload" },
          { key: "Referrer-Policy",             value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy",          value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
          // Content-Security-Policy: locks down script/style/connect origins.
          // 'self' covers Next.js bundles. fonts.googleapis.com + fonts.gstatic.com
          // cover the Inter/Material Symbols fonts loaded in globals.css.
          // apis.google.com and oauth2.googleapis.com cover the Google OAuth flow.
          // gmail.googleapis.com covers the email import feature.
          // Adjust connect-src if you add other third-party API calls from the client.
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              isProd ? "script-src 'self' 'unsafe-inline'" : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: https:",
              "connect-src 'self' https://apis.google.com https://oauth2.googleapis.com https://gmail.googleapis.com https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://*.cloudfunctions.net",
              "frame-src https://accounts.google.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "upgrade-insecure-requests",
            ].join("; "),
          },
        ],
      },
      {
        source: "/api/(.*)",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
          { key: "Pragma",         value: "no-cache" },
        ],
      },
    ];
  },
};

export default nextConfig;
