import { describe, expect, it } from "vitest";
import { parseCartLines, quoteCart } from "./cart";
import { buildOrder, checkoutErrors, checkoutSchema, isPlausiblePhone } from "./checkout";
import { product, tee, variant } from "./fixtures.test-utils";
import {
  canTransition,
  isStaleHandoff,
  orderMetrics,
  stockEffect,
} from "./orders";
import { settingsSchema } from "./settings";
import { InsufficientStockError, applyStockDelta } from "./stock";
import type { Order, OrderItem } from "./types";
import { buildInquiryMessage, buildOrderMessage, whatsappUrl, type WhatsAppLabels } from "./whatsapp";

const settings = settingsSchema.parse({
  store: { name: "Detail Corner", currency: "USD" },
  contact: { whatsapp: "+44 7700 900123" },
  checkout: { whatsapp: true, cashOnDelivery: true, bankTransfer: false },
  shipping: {
    methods: [
      { id: "standard", name: "Standard", price: 6, requiresAddress: true },
      { id: "pickup", name: "Pickup", price: 0, requiresAddress: false },
    ],
    freeShippingThreshold: 75,
  },
});

const mug = product({ id: "mug", name: "Stoneware Mug", variants: [variant({ id: "mug-v", price: 18 })] });
const shirt = tee({ id: "tee" });

describe("cart lines", () => {
  it("drops garbage and merges duplicates from untrusted storage", () => {
    const lines = parseCartLines([
      { productId: "mug", variantId: "mug-v", quantity: 1 },
      { productId: "mug", variantId: "mug-v", quantity: 2 },
      { productId: "", variantId: "x", quantity: 1 },
      { productId: "tee", variantId: "v", quantity: -4 },
      "nonsense",
      null,
    ]);
    expect(lines).toEqual([{ productId: "mug", variantId: "mug-v", quantity: 3 }]);
    expect(parseCartLines("not an array")).toEqual([]);
  });
});

describe("quotes", () => {
  it("prices from the catalog, not from the browser", () => {
    const quote = quoteCart([{ productId: "mug", variantId: "mug-v", quantity: 2 }], [mug], settings, "standard");
    expect(quote.subtotal).toBe(36);
    expect(quote.shipping?.fee).toBe(6);
    expect(quote.total).toBe(42);
    expect(quote.freeShippingRemaining).toBe(39);
    expect(quote.hasIssues).toBe(false);
  });

  it("waives delivery above the free-shipping threshold", () => {
    const quote = quoteCart([{ productId: "mug", variantId: "mug-v", quantity: 5 }], [mug], settings, "standard");
    expect(quote.shipping).toMatchObject({ fee: 0, waived: true });
    expect(quote.total).toBe(90);
    expect(quote.freeShippingRemaining).toBeNull();
  });

  it("caps quantities at tracked stock and flags the change", () => {
    const quote = quoteCart([{ productId: "tee", variantId: "tee-black-s", quantity: 9 }], [shirt], settings);
    expect(quote.lines[0]).toMatchObject({ quantity: 5, status: "adjusted", reason: "limited" });
    expect(quote.hasIssues).toBe(true);
  });

  it("marks sold-out, removed and unpublished items without charging for them", () => {
    const draft = product({ id: "draft", status: "draft" });
    const quote = quoteCart(
      [
        { productId: "tee", variantId: "tee-white-l", quantity: 1 },
        { productId: "ghost", variantId: "x", quantity: 1 },
        { productId: "draft", variantId: draft.variants[0].id, quantity: 1 },
        { productId: "tee", variantId: "no-such-variant", quantity: 1 },
        { productId: "mug", variantId: "mug-v", quantity: 1 },
      ],
      [shirt, draft, mug],
      settings,
    );
    expect(quote.lines.map((line) => line.reason)).toEqual(["sold-out", "gone", "gone", "variant-gone", null]);
    expect(quote.subtotal).toBe(18);
    expect(quote.orderable).toBe(true);
  });

  it("handles configurable ZAR free-shipping threshold edge cases accurately", () => {
    const zaSettings = (threshold: number | null) =>
      settingsSchema.parse({
        store: { name: "Detail Corner", currency: "ZAR" },
        shipping: {
          methods: [
            { id: "flat", name: "Standard courier", price: 100, requiresAddress: true },
            { id: "pickup", name: "Pickup", price: 0, requiresAddress: false },
          ],
          freeShippingThreshold: threshold,
        },
      });
    const polish = product({
      id: "polish",
      name: "Ceramic Sealant",
      variants: [variant({ id: "polish-v", price: 249.99 })],
    });
    const exact500 = product({
      id: "kit",
      name: "Wash Kit",
      variants: [variant({ id: "kit-v", price: 500 })],
    });

    // Strictly below R500 (R499.98): flat R100 fee applies, R0.02 remaining
    const below = quoteCart([{ productId: "polish", variantId: "polish-v", quantity: 2 }], [polish], zaSettings(500), "flat");
    expect(below.subtotal).toBe(499.98);
    expect(below.shipping).toMatchObject({ fee: 100, waived: false });
    expect(below.freeShippingRemaining).toBe(0.02);
    expect(below.total).toBe(599.98);

    // Exact boundary (R500.00 >= R500): fee waived cleanly
    const exact = quoteCart([{ productId: "kit", variantId: "kit-v", quantity: 1 }], [exact500], zaSettings(500), "flat");
    expect(exact.shipping).toMatchObject({ fee: 0, waived: true });
    expect(exact.freeShippingRemaining).toBeNull();
    expect(exact.total).toBe(500);

    // Changing threshold centrally to R1000 re-applies R100 shipping for R500 order
    const raised = quoteCart([{ productId: "kit", variantId: "kit-v", quantity: 1 }], [exact500], zaSettings(1000), "flat");
    expect(raised.shipping).toMatchObject({ fee: 100, waived: false });
    expect(raised.freeShippingRemaining).toBe(500);
    expect(raised.total).toBe(600);

    // Disabled (null) or 0 threshold never waives paid shipping; 0-cost pickup is never marked waived
    const disabled = quoteCart([{ productId: "kit", variantId: "kit-v", quantity: 1 }], [exact500], zaSettings(null), "flat");
    expect(disabled.shipping).toMatchObject({ fee: 100, waived: false });
    const zeroThresh = quoteCart([{ productId: "kit", variantId: "kit-v", quantity: 1 }], [exact500], zaSettings(0), "flat");
    expect(zeroThresh.shipping).toMatchObject({ fee: 100, waived: false });
    const pickup = quoteCart([{ productId: "kit", variantId: "kit-v", quantity: 1 }], [exact500], zaSettings(500), "pickup");
    expect(pickup.shipping).toMatchObject({ fee: 0, waived: false });

    // Unknown shipping method ID yields null shipping quote
    const unknown = quoteCart([{ productId: "kit", variantId: "kit-v", quantity: 1 }], [exact500], zaSettings(500), "tampered-id");
    expect(unknown.shipping).toBeNull();
  });
});

describe("checkout", () => {
  const valid = {
    method: "cod",
    shippingMethodId: "standard",
    name: "Avery Example",
    phone: "+44 7700 900199",
    line1: "12 Sample Street",
    city: "Springfield",
    lines: [{ productId: "mug", variantId: "mug-v", quantity: 2 }],
  };

  it("validates a pay-on-delivery order", () => {
    const input = checkoutSchema.parse(valid);
    const quote = quoteCart(input.lines, [mug], settings, input.shippingMethodId);
    expect(checkoutErrors(input, settings, quote)).toEqual({});
  });

  it("requires a phone for website orders but not for WhatsApp", () => {
    const web = checkoutSchema.parse({ ...valid, phone: "" });
    const quote = quoteCart(web.lines, [mug], settings, "standard");
    expect(checkoutErrors(web, settings, quote).phone).toBe("phone_required");

    const chat = checkoutSchema.parse({ ...valid, method: "whatsapp", phone: "" });
    expect(checkoutErrors(chat, settings, quote).phone).toBeUndefined();
  });

  it("asks for an address only when the delivery method needs one", () => {
    const pickup = checkoutSchema.parse({ ...valid, shippingMethodId: "pickup", line1: "", city: "" });
    const quote = quoteCart(pickup.lines, [mug], settings, "pickup");
    expect(checkoutErrors(pickup, settings, quote)).toEqual({});

    const courier = checkoutSchema.parse({ ...valid, line1: "", city: "" });
    const courierQuote = quoteCart(courier.lines, [mug], settings, "standard");
    expect(checkoutErrors(courier, settings, courierQuote)).toMatchObject({
      line1: "address_required",
      city: "city_required",
    });
  });

  it("refuses disabled methods and carts that changed under the shopper", () => {
    const bank = checkoutSchema.parse({ ...valid, method: "bank_transfer" });
    const changed = quoteCart([{ productId: "tee", variantId: "tee-black-s", quantity: 9 }], [shirt], settings, "standard");
    const errors = checkoutErrors(bank, settings, changed);
    expect(errors.method).toBe("method_disabled");
    expect(errors.form).toBe("cart_changed");
  });

  it("recognises plausible phone numbers", () => {
    expect(isPlausiblePhone("+44 7700 900123")).toBe(true);
    expect(isPlausiblePhone("(555) 010-0199")).toBe(true);
    expect(isPlausiblePhone("call me")).toBe(false);
    expect(isPlausiblePhone("12")).toBe(false);
  });

  it("builds a website order as received and a WhatsApp order as only prepared", () => {
    const input = checkoutSchema.parse(valid);
    const quote = quoteCart(input.lines, [mug], settings, "standard");
    const web = buildOrder(input, quote, settings, new Date("2026-05-01T10:00:00Z"), { whatsappConfigured: true });
    expect(web).toMatchObject({ channel: "web", status: "received", paymentMethod: "cod", total: 42 });
    expect(web.items[0]).toMatchObject({ name: "Stoneware Mug", quantity: 2, lineTotal: 36 });

    const chat = buildOrder({ ...input, method: "whatsapp" }, quote, settings, new Date(), { whatsappConfigured: false });
    expect(chat).toMatchObject({ channel: "whatsapp", status: "prepared", paymentMethod: "whatsapp" });
    expect(chat.events[0].note).toMatch(/preview only/);
  });
});

describe("order lifecycle", () => {
  it("never lets a handoff jump straight to a sale", () => {
    expect(canTransition("opened", "confirmed")).toBe(false);
    expect(canTransition("opened", "received")).toBe(true);
    expect(canTransition("received", "confirmed")).toBe(true);
    expect(canTransition("completed", "cancelled")).toBe(false);
  });

  it("reserves stock on confirmation and returns it on cancellation", () => {
    expect(stockEffect({ stockReserved: false }, "confirmed")).toBe(1);
    expect(stockEffect({ stockReserved: true }, "confirmed")).toBe(0);
    expect(stockEffect({ stockReserved: true }, "cancelled")).toBe(-1);
    expect(stockEffect({ stockReserved: false }, "cancelled")).toBe(0);
  });

  it("counts only confirmed, fulfilled and completed orders as sales", () => {
    const now = new Date("2026-05-30T12:00:00Z");
    const order = (status: Order["status"], total: number, day = "2026-05-29", paid = false) =>
      ({
        status,
        total,
        createdAt: `${day}T10:00:00.000Z`,
        paymentStatus: paid ? "paid" : "unpaid",
      }) as Order;
    const metrics = orderMetrics(
      [
        order("confirmed", 100, "2026-05-29", true),
        order("completed", 50),
        order("received", 999),
        order("opened", 999),
        order("prepared", 999, "2026-04-01"), // stale handoff
        order("cancelled", 999),
        order("fulfilled", 70, "2026-03-01"), // outside the window
      ],
      now,
    );
    expect(metrics).toMatchObject({
      salesTotal: 150,
      salesCount: 2,
      paidTotal: 100,
      toConfirm: 1,
      handoffsToVerify: 1,
    });
    expect(metrics.daily).toHaveLength(30);
    expect(metrics.daily.at(-2)).toMatchObject({ date: "2026-05-29", total: 150, count: 2 });
    expect(isStaleHandoff(order("opened", 1, "2026-05-01"), now)).toBe(true);
  });

  it("prevents overselling, sums duplicate variant lines, and restores stock on cancellation", () => {
    const tracked = product({
      id: "ceramic-kit",
      name: "Ceramic Kit",
      trackInventory: true,
      variants: [variant({ id: "kit-v1", stock: 5 })],
    });
    const item = (quantity: number, variantId = "kit-v1"): OrderItem => ({
      productId: "ceramic-kit",
      variantId,
      name: "Ceramic Kit",
      variantLabel: "",
      sku: "CK-1",
      unitPrice: 250,
      quantity,
      lineTotal: 250 * quantity,
      imageUrl: null,
    });

    // Duplicate lines summing to 6 exceed stock of 5
    expect(() => applyStockDelta(tracked, [item(3), item(3)], 1)).toThrow(InsufficientStockError);

    // Missing variant on a tracked product throws cleanly
    expect(() => applyStockDelta(tracked, [item(1, "deleted-variant")], 1)).toThrow(/no longer exists/);

    // Duplicate lines within stock (2 + 2 = 4) decrement atomically and restore identically
    const reserved = applyStockDelta(tracked, [item(2), item(2)], 1);
    expect(reserved?.variants[0].stock).toBe(1);
    const restored = applyStockDelta(reserved!, [item(2), item(2)], -1);
    expect(restored?.variants[0].stock).toBe(5);

    // Untracked product never modifies stock
    const untracked = product({ id: "untracked", trackInventory: false, variants: [variant({ id: "u-v1", stock: 0 })] });
    expect(applyStockDelta(untracked, [{ ...item(10), productId: "untracked", variantId: "u-v1" }], 1)).toBeNull();
  });
});

describe("WhatsApp messages", () => {
  const labels: WhatsAppLabels = {
    orderIntro: (store) => `Hello ${store}! I'd like to place this order.`,
    order: "Order",
    subtotal: "Subtotal",
    delivery: "Delivery",
    free: "Free",
    total: "Total",
    payment: "Payment",
    paymentMethods: { cod: "Cash on delivery", bank_transfer: "Bank transfer", whatsapp: "To arrange in this chat" },
    name: "Name",
    phone: "Phone",
    address: "Address",
    note: "Note",
    inquiryIntro: (store) => `Hello ${store}! I have a question about:`,
    link: "Link",
  };

  it("lists the order number, every item with its options, and the totals", () => {
    const input = checkoutSchema.parse({
      method: "whatsapp",
      shippingMethodId: "standard",
      name: "Avery Example",
      line1: "12 Sample Street",
      city: "Springfield",
      note: "Ring twice",
      lines: [
        { productId: "tee", variantId: "tee-black-m", quantity: 2 },
        { productId: "mug", variantId: "mug-v", quantity: 1 },
      ],
    });
    const quote = quoteCart(input.lines, [shirt, mug], settings, "standard");
    const order = { ...buildOrder(input, quote, settings, new Date(), { whatsappConfigured: true }), number: 1042 };
    const message = buildOrderMessage(order, {
      storeName: "Detail Corner",
      money: { currency: "USD", locale: "en" },
      labels,
    });

    expect(message).toContain("*Order #1042*");
    expect(message).toContain("• 2 × Organic Tee (Black / M) — $64.00");
    expect(message).toContain("• 1 × Stoneware Mug — $18.00");
    expect(message).toContain("Delivery (Standard): Free"); // $82 is over the $75 threshold
    expect(message).toContain("*Total: $82.00*");
    expect(message).toContain("Payment: To arrange in this chat");
    expect(message).toContain("Address: 12 Sample Street, Springfield");
    expect(message).toContain("Note: Ring twice");
    expect(message).not.toContain("Phone:"); // not given, so not invented
  });

  it("encodes the message into an official wa.me link", () => {
    const url = whatsappUrl("+44 7700 900123", "Hi & welcome #1\nLine two");
    expect(url).toBe("https://wa.me/447700900123?text=Hi%20%26%20welcome%20%231%0ALine%20two");
  });

  it("writes a product question with the link", () => {
    const text = buildInquiryMessage(
      { name: "Organic Tee", variantLabel: "Black / M", url: "https://shop.example/products/organic-tee" },
      { storeName: "Detail Corner", labels },
    );
    expect(text).toContain("*Organic Tee* (Black / M)");
    expect(text).toContain("Link: https://shop.example/products/organic-tee");
  });
});
