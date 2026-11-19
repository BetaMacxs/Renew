import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { demoCatalog } from "@/lib/demo/seed";
import type { Order } from "@/lib/domain/types";
import { createLocalBackend } from "./index";

const dataDir = mkdtempSync(path.join(os.tmpdir(), "detail-corner-local-backend-"));

beforeAll(() => {
  vi.stubEnv("STORE_DATA_DIR", dataDir);
});

afterAll(() => {
  vi.unstubAllEnvs();
  rmSync(dataDir, { recursive: true, force: true });
});

describe("local backend production-safety parity", () => {
  it("derives stock effects and redacts all free-text personal data", async () => {
    const backend = createLocalBackend();
    const admin = await backend.admin({ id: "test-admin", email: "owner@shop.example" });
    const base = demoCatalog().products[0];
    const product = {
      ...base,
      id: "local-test-product",
      slug: "local-test-product",
      trackInventory: true,
      variants: base.variants.map((variant) => ({ ...variant, stock: 5 })),
    };
    await admin.writeProduct(product, null);

    const variant = product.variants[0];
    const order: Omit<Order, "id" | "number" | "createdAt" | "updatedAt"> = {
      channel: "web",
      status: "received",
      paymentMethod: "cod",
      paymentStatus: "unpaid",
      currency: "ZAR",
      items: [{
        productId: product.id,
        variantId: variant.id,
        name: product.name,
        variantLabel: variant.optionValues.join(" / "),
        sku: variant.sku,
        imageUrl: product.images[0]?.url ?? null,
        unitPrice: variant.price,
        quantity: 2,
        lineTotal: variant.price * 2,
      }],
      subtotal: variant.price * 2,
      shippingFee: 0,
      total: variant.price * 2,
      shippingMethod: null,
      customer: { name: "Test Customer", phone: "+27123456789", email: "customer@example.com" },
      address: { line1: "1 Private Road", city: "Cape Town", region: "", postalCode: "", country: "South Africa" },
      customerNote: "Leave the parcel behind the gate",
      internalNote: "Call the customer on their private number",
      stockReserved: false,
      events: [{ at: new Date().toISOString(), kind: "created", by: "customer", note: "Private delivery instructions" }],
    };
    const created = await backend.public.createOrder(order, "access-hash");
    const retried = await backend.public.createOrder(order, "access-hash");
    expect(retried).toEqual(created);

    const confirmed = await admin.transitionOrder({
      id: created.id,
      from: "received",
      to: "confirmed",
      stockDelta: 0,
      note: "Spoke to the customer at their home number",
    });
    expect(confirmed.stockReserved).toBe(true);
    await expect(
      admin.writeProduct({ ...product, variants: product.variants.filter((item) => item.id !== variant.id) }, null),
    ).rejects.toThrow(/cannot be removed while it is referenced by an open order/i);
    await expect(
      admin.writeProduct({ ...product, trackInventory: false }, null),
    ).rejects.toThrow(/inventory tracking cannot be changed while this product is referenced by an open order/i);
    const afterReserve = await admin.loadCatalog();
    expect(afterReserve.products.find((item) => item.id === product.id)?.variants[0].stock).toBe(3);

    const cancelled = await admin.transitionOrder({
      id: created.id,
      from: "confirmed",
      to: "cancelled",
      stockDelta: 0,
      note: "",
    });
    expect(cancelled.stockReserved).toBe(false);
    const afterRelease = await admin.loadCatalog();
    expect(afterRelease.products.find((item) => item.id === product.id)?.variants[0].stock).toBe(5);

    await admin.updateOrder(created.id, { internalNote: "Customer's personal details were confirmed by phone" });
    const redacted = await admin.anonymizeOrder(created.id);
    expect(redacted.customer).toEqual({ name: "Redacted customer", phone: "", email: "" });
    expect(redacted.address).toBeNull();
    expect(redacted.customerNote).toBe("");
    expect(redacted.internalNote).toBe("");
    expect(JSON.stringify(redacted.events)).not.toContain("owner@shop.example");
    expect(JSON.stringify(redacted.events)).not.toContain("Private delivery instructions");
    expect(JSON.stringify(redacted.events)).not.toContain("personal details were confirmed");
    expect(redacted.events.at(-1)?.note).toMatch(/POPIA/);
  });

  it("prevents deleting a product while an order still needs fulfilment", async () => {
    const backend = createLocalBackend();
    const admin = await backend.admin({ id: "test-admin", email: "owner@shop.example" });
    const product = demoCatalog().products[1];
    const stored = { ...product, id: "open-order-product", slug: "open-order-product" };
    await admin.writeProduct(stored, null);
    const variant = stored.variants[0];
    await backend.public.createOrder({
      channel: "web",
      status: "received",
      paymentMethod: "cod",
      paymentStatus: "unpaid",
      currency: "ZAR",
      items: [{
        productId: stored.id,
        variantId: variant.id,
        name: stored.name,
        variantLabel: variant.optionValues.join(" / "),
        sku: variant.sku,
        imageUrl: stored.images[0]?.url ?? null,
        unitPrice: variant.price,
        quantity: 1,
        lineTotal: variant.price,
      }],
      subtotal: variant.price,
      shippingFee: 0,
      total: variant.price,
      shippingMethod: null,
      customer: { name: "Test Customer", phone: "", email: "" },
      address: null,
      customerNote: "",
      internalNote: "",
      stockReserved: false,
      events: [],
    }, "second-access-hash");

    await expect(admin.deleteProduct(stored.id)).rejects.toThrow(/part of an open order/i);
  });
});
