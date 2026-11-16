import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Vercel API proxy", () => {
  it("routes API requests to Render before the SPA fallback", () => {
    const config = JSON.parse(readFileSync(resolve(process.cwd(), "vercel.json"), "utf8")) as {
      rewrites: Array<{ source: string; destination: string }>;
      headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }>;
    };

    expect(config.rewrites[0]).toEqual({
      source: "/api/:path*",
      destination: "https://tribullwearweb.onrender.com/api/:path*",
    });
    expect(config.rewrites.findIndex(({ source }) => source === "/(.*)")).toBeGreaterThan(0);
    expect(config.headers).toContainEqual({
      source: "/assets/(.*)",
      headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
    });
  });
});
