import { describe, expect, it } from "vitest";
import { product } from "./fixtures.test-utils";
import { checkoutErrors, checkoutSchema, productionCheckoutProblem } from "./checkout";
import { quoteCart } from "./cart";
import { parseSettings } from "./settings";

describe("live store readiness", () => {
  it("rejects untouched starter settings", () => {
    expect(productionCheckoutProblem(parseSettings({}))).toBe("store_name");
  });

  it("requires a real customer contact and configured delivery option", () => {
    const noContact = parseSettings({ store: { name: "Detail Corner" } });
    expect(productionCheckoutProblem(noContact)).toBe("contact");

    const invalidContact = parseSettings({
      store: { name: "Detail Corner" },
      contact: { email: "hello@example.com", phone: "not a phone" },
    });
    expect(productionCheckoutProblem(invalidContact)).toBe("contact");

    const noPrivacyPolicy = parseSettings({
      store: { name: "Detail Corner" },
      contact: { email: "hello@detailcorner.co.za" },
    });
    expect(productionCheckoutProblem(noPrivacyPolicy)).toBe("privacy_policy");

    // The untouched schema default is a placeholder even though its description
    // includes "with you" — it must not be mistaken for a configured delivery method.
    const defaultShipping = parseSettings({
      store: { name: "Detail Corner" },
      contact: { email: "hello@detailcorner.co.za" },
      policies: { privacy: "We explain how customer information is used." },
    });
    expect(productionCheckoutProblem(defaultShipping)).toBe("shipping");

    const noShipping = parseSettings({
      store: { name: "Detail Corner" },
      contact: { email: "hello@detailcorner.co.za" },
      policies: { privacy: "We explain how customer information is used." },
      shipping: {
        methods: [{
          id: "delivery",
          name: "Delivery",
          description: "We'll confirm the delivery cost and timing.",
          price: 0,
          requiresAddress: true,
        }],
      },
    });
    expect(productionCheckoutProblem(noShipping)).toBe("shipping");

    const placeholderStillSelectable = parseSettings({
      store: { name: "Detail Corner" },
      contact: { email: "hello@detailcorner.co.za" },
      policies: { privacy: "We explain how customer information is used." },
      shipping: {
        methods: [
          {
            id: "delivery",
            name: "Delivery",
            description: "We'll confirm the delivery cost and timing.",
            price: 0,
            requiresAddress: true,
          },
          {
            id: "pickup",
            name: "Collection",
            description: "Collect from the shop",
            price: 0,
            requiresAddress: false,
          },
        ],
      },
    });
    expect(productionCheckoutProblem(placeholderStillSelectable)).toBe("shipping");
  });

  it("accepts a named store with real contact details and an explicit delivery method", () => {
    const configured = parseSettings({
      store: { name: "Detail Corner" },
      contact: { email: "hello@detailcorner.co.za" },
      policies: { privacy: "We explain how customer information is used." },
      shipping: {
        methods: [{
          id: "free-delivery",
          name: "Free delivery",
          description: "Complimentary delivery across the service area",
          price: 0,
          requiresAddress: true,
        }],
      },
    });
    expect(productionCheckoutProblem(configured)).toBeNull();
  });
});

describe("checkout configuration safeguards", () => {
  const settings = (instructions: string) =>
    parseSettings({
      checkout: { bankTransfer: true, bankTransferInstructions: instructions },
    });

  const inputFor = (store: ReturnType<typeof settings>) => {
    const item = product();
    const variant = item.variants[0];
    return {
      input: checkoutSchema.parse({
        method: "bank_transfer",
        shippingMethodId: store.shipping.methods[0].id,
        name: "Test Customer",
        phone: "+27123456789",
        email: "",
        line1: "1 Main Road",
        city: "Cape Town",
        region: "",
        postalCode: "",
        country: "South Africa",
        note: "",
        lines: [{ productId: item.id, variantId: variant.id, quantity: 1 }],
      }),
      quote: quoteCart(
        [{ productId: item.id, variantId: variant.id, quantity: 1 }],
        [item],
        store,
        store.shipping.methods[0].id,
      ),
    };
  };

  it("does not offer bank-transfer checkout without payment instructions", () => {
    const store = settings("");
    const { input, quote } = inputFor(store);
    expect(checkoutErrors(input, store, quote).method).toBe("method_disabled");
  });

  it("allows bank-transfer checkout when payment instructions are configured", () => {
    const store = settings("Bank: Example Bank\nAccount: 123456");
    const { input, quote } = inputFor(store);
    expect(checkoutErrors(input, store, quote).method).toBeUndefined();
  });
});
