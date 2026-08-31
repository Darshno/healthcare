export function parseAllowedOrigins(rawOrigins?: string): string[] {
  if (!rawOrigins) return [];

  return rawOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function isAllowedOrigin(origin: string | undefined, allowedOrigins: string[]): boolean {
  if (!origin) {
    return true;
  }

  if (allowedOrigins.length === 0 || allowedOrigins.includes("*")) {
    return true;
  }

  const normalizedOrigin = origin.replace(/\/$/, "");

  return allowedOrigins.some((allowedOrigin) => {
    const normalizedAllowed = allowedOrigin.replace(/\/$/, "");
    return normalizedAllowed === normalizedOrigin;
  });
}

export function buildCorsConfig(rawOrigins?: string) {
  const allowedOrigins = parseAllowedOrigins(rawOrigins);

  return {
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean | string) => void,
    ) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.length === 0 || allowedOrigins.includes("*")) {
        callback(null, true);
        return;
      }

      if (isAllowedOrigin(origin, allowedOrigins)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    allowedHeaders: [
      "Origin",
      "X-Requested-With",
      "Content-Type",
      "Accept",
      "Authorization",
      "Cache-Control",
      "X-Session-Id",
    ],
    credentials: true,
  };
}
