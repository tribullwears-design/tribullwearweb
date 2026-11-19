import { once } from "node:events";
import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findOrderForTracking: vi.fn(),
}));

vi.mock("./orderStore.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./orderStore.js")>();
  return { ...actual, findOrderForTracking: mocks.findOrderForTracking };
});

import { createOrderTrackingRouter } from "./orderTrackingRoutes.js";

let server: ReturnType<express.Application["listen"]>;
let baseUrl = "";

beforeEach(async () => {
  mocks.findOrderForTracking.mockReset().mockResolvedValue(null);
  const app = express();
  app.use(express.json());
  app.use(createOrderTrackingRouter());
  server = app.listen(0);
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind a TCP port");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

describe("public order tracking route", () => {
  it("returns the matched order's tracking summary without exposing customer details", async () => {
    const order = {
      id: "TB-20261017-1234ABCD",
      status: "Shipped",
      createdAt: "2026-10-17T10:00:00.000Z",
      statusUpdatedAt: "2026-10-18T10:00:00.000Z",
    };
    mocks.findOrderForTracking.mockResolvedValue(order);

    const response = await fetch(`${baseUrl}/api/orders/track`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ orderId: order.id.toLowerCase(), customerName: "Test Customer" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ order });
    expect(mocks.findOrderForTracking).toHaveBeenCalledWith(order.id, "Test Customer");
  });

  it("uses the same not-found response for an unknown order or name", async () => {
    const response = await fetch(`${baseUrl}/api/orders/track`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ orderId: "TB-20261017-1234ABCD", customerName: "Incorrect Name" }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "No order matched those details. Check the order ID and name and try again.",
    });
  });

  it("validates both fields before looking up an order", async () => {
    const response = await fetch(`${baseUrl}/api/orders/track`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ orderId: " ", customerName: "A" }),
    });

    expect(response.status).toBe(400);
    expect(mocks.findOrderForTracking).not.toHaveBeenCalled();
  });
});
