import { describe, expect, it } from "vitest";
import { isAllowedOrigin, parseAllowedOrigins } from "../server/_core/cors";

describe("cors", () => {
  it("allows the deployed Vercel origin and local app origin while rejecting unknown domains", () => {
    const origins = parseAllowedOrigins(
      "https://healthcare-qu79.vercel.app, http://localhost:8081, http://127.0.0.1:8081",
    );

    expect(isAllowedOrigin("https://healthcare-qu79.vercel.app", origins)).toBe(true);
    expect(isAllowedOrigin("http://localhost:8081", origins)).toBe(true);
    expect(isAllowedOrigin("http://127.0.0.1:8081", origins)).toBe(true);
    expect(isAllowedOrigin("https://evil.example", origins)).toBe(false);
  });
});
