import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { productInputSchema } from "@/lib/domain/admin-schemas";
import { storefrontProducts } from "@/lib/domain/catalog-query";
import { settingsSchema } from "@/lib/domain/settings";
import {
  demoCatalog,
  demoLocalData,
  demoSettings,
  detailCornerStarterSettings,
  detectDemoSettings,
  stripDemoSettings,
} from "./seed";
import { DEMO_SETTINGS } from "./settings";

/**
 * The demo store is what people see first, so it is held to the same rules
 * as anything an owner creates in the dashboard — plus a few of its own.
 */

const catalog = demoCatalog(new Date("2026-06-01T00:00:00Z"));
const publicDir = path.join(process.cwd(), "public");

describe("demo catalog", () => {
  it("has a believable store's worth of automotive detailing products across 7 categories", () => {
    expect(catalog.products).toHaveLength(44);
    expect(catalog.categories).toHaveLength(7);
    for (const category of catalog.categories) {
      expect(catalog.products.filter((product) => product.categoryId === category.id).length).toBeGreaterThanOrEqual(1);
    }
    expect(storefrontProducts(catalog)).toHaveLength(catalog.products.length);
  });

  it("passes the same validation as a product saved from the dashboard", () => {
    for (const product of catalog.products) {
      const result = productInputSchema.safeParse({ ...product, expectedUpdatedAt: null });
      expect(result.success, `${product.slug}: ${result.success ? "" : result.error.issues[0]?.message}`).toBe(true);
    }
  });

  it("uses unique ids, slugs and SKUs, and valid Postgres UUIDs", () => {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    const all = [...catalog.products, ...catalog.categories, ...catalog.collections];
    expect(new Set(all.map((item) => item.id)).size).toBe(all.length);
    for (const item of all) expect(item.id).toMatch(uuid);
    expect(new Set(catalog.products.map((product) => product.slug)).size).toBe(catalog.products.length);
    const skus = catalog.products.flatMap((product) => product.variants.map((variant) => variant.sku)).filter(Boolean);
    expect(new Set(skus).size).toBe(skus.length);
    const variantIds = catalog.products.flatMap((product) => product.variants.map((variant) => variant.id));
    expect(new Set(variantIds).size).toBe(variantIds.length);
  });

  it("points every product, category and collection at a photo that exists", () => {
    const urls = [
      ...catalog.products.flatMap((product) => product.images.map((image) => image.url)),
      ...catalog.categories.map((category) => category.imageUrl),
      ...catalog.collections.map((collection) => collection.imageUrl),
    ].filter((url): url is string => Boolean(url));
    for (const url of urls) {
      expect(existsSync(path.join(publicDir, url)), url).toBe(true);
    }
  });

  it("credits every bundled photograph", () => {
    const credits = readFileSync(path.join(publicDir, "demo/CREDITS.md"), "utf8");
    const urls = catalog.products.flatMap((product) => product.images.map((image) => image.url));
    for (const url of urls) expect(credits, url).toContain(url.replace("/demo/", ""));
  });

  it("flags everything as demo content so it can be removed in one click", () => {
    for (const item of [...catalog.products, ...catalog.categories, ...catalog.collections]) {
      expect(item.isDemo).toBe(true);
    }
  });

  it("includes the cases the storefront must handle", () => {
    const tracked = catalog.products.filter((product) => product.trackInventory);
    expect(tracked.length).toBeGreaterThan(0);
    expect(catalog.products.some((product) => product.options.length === 0)).toBe(true);
    expect(catalog.products.some((product) => product.variants.some((variant) => variant.compareAtPrice))).toBe(true);
  });
});

describe("demo settings", () => {
  it("are valid and contain no real contact details", () => {
    const settings = settingsSchema.parse(DEMO_SETTINGS);
    expect(settings.contact.whatsapp).toBe("");
    expect(settings.contact.phone).toBe("");
    expect(settings.contact.email.endsWith(".example")).toBe(true);
    expect(Object.values(settings.social).every((url) => url === "")).toBe(true);
  });

  it("only link to pages and collections that exist", () => {
    const settings = settingsSchema.parse(DEMO_SETTINGS);
    const slugs = new Set(catalog.collections.map((collection) => collection.slug));
    const links = [
      settings.homepage.hero.primaryHref,
      settings.homepage.hero.secondaryHref,
      settings.homepage.announcement.href,
      ...settings.homepage.sections.flatMap((section) => (section.type === "banner" ? [section.linkHref] : [])),
    ].filter(Boolean);
    for (const link of links) {
      const collection = link.match(/^\/collections\/(.+)$/)?.[1];
      if (collection) expect(slugs.has(collection), link).toBe(true);
      else expect(link).toMatch(/^\/(shop)?$/);
    }
    for (const section of settings.homepage.sections) {
      if (section.type === "products" && section.source === "collection") {
        expect(catalog.collections.some((collection) => collection.id === section.collectionId)).toBe(true);
      }
      if (section.type === "banner") expect(existsSync(path.join(publicDir, section.imageUrl))).toBe(true);
    }
    expect(existsSync(path.join(publicDir, settings.homepage.hero.imageUrl))).toBe(true);
  });

  it("seeds a fresh local store with no owner and no orders", () => {
    const data = demoLocalData();
    expect(data.owner).toBeNull();
    expect(data.orders).toEqual([]);
    expect(data.nextOrderNumber).toBe(1001);
  });
});

describe("Detail Corner starter settings & demo cleanup", () => {
  it("provides clean ZAR starter settings with zero placeholder business data", () => {
    const starter = detailCornerStarterSettings();
    expect(settingsSchema.safeParse(starter).success).toBe(true);
    expect(starter.store.name).toBe("Detail Corner");
    expect(starter.store.tagline).toBe("The Art of Perfection");
    expect(starter.store.currency).toBe("ZAR");
    expect(starter.theme.accent).toBe("#C41E3A");
    expect(starter.contact).toEqual({ email: "", phone: "", whatsapp: "", address: "", hours: "" });
    expect(starter.checkout.vatEnabled).toBe(false);
    expect(starter.checkout.vatRate).toBe(15);
    expect(starter.checkout.vatNumber).toBe("");
    expect(starter.checkout.bankTransfer).toBe(false);
    expect(starter.checkout.bankTransferInstructions).toBe("");
    expect(detectDemoSettings(starter)).toEqual([]);
  });

  it("detects demo settings and resets only untouched demo fields", () => {
    const sample = demoSettings();
    expect(detectDemoSettings(sample).length).toBeGreaterThanOrEqual(4);

    const mixed = settingsSchema.parse({
      ...sample,
      store: { ...sample.store, name: "Detail Corner", currency: "ZAR" },
      contact: { ...sample.contact, email: "orders@detailcorner.example" },
      policies: { ...sample.policies, about: "Custom Detail Corner story." },
    });

    const { settings: cleaned, cleanedFields } = stripDemoSettings(mixed);
    expect(cleaned.store.name).toBe("Detail Corner");
    expect(cleaned.store.currency).toBe("ZAR");
    expect(cleaned.contact.email).toBe("orders@detailcorner.example");
    expect(cleaned.policies.about).toBe("Custom Detail Corner story.");

    expect(cleaned.checkout.bankTransferInstructions).toBe("");
    expect(cleaned.checkout.bankTransfer).toBe(false);
    expect(cleaned.policies.shipping).toBe("");
    expect(cleaned.homepage.hero.imageUrl).toBe("");
    expect(cleanedFields).toContain("checkout.bankTransferInstructions");
    expect(detectDemoSettings(cleaned)).toEqual([]);
  });

  it("converts USD currency to ZAR and preserves custom shipping settings", () => {
    const sample = demoSettings();
    const customShipping = {
      methods: [{ id: "custom", name: "Custom Courier", description: "", price: 150, requiresAddress: true }],
      freeShippingThreshold: 2000,
      areas: "South Africa only",
    };
    const settings = settingsSchema.parse({
      ...sample,
      store: { ...sample.store, currency: "USD" },
      shipping: customShipping,
    });

    const { settings: cleaned, cleanedFields } = stripDemoSettings(settings);
    expect(cleaned.store.currency).toBe("ZAR");
    expect(cleanedFields).toContain("store.currency");
    expect(cleaned.shipping.freeShippingThreshold).toBe(2000);
    expect(cleaned.shipping.areas).toBe("South Africa only");
    expect(cleaned.shipping.methods[0].name).toBe("Custom Courier");
  });

  it("selectively cleans hero fields while preserving custom hero text and custom images independently", () => {
    const sample = demoSettings();
    const customSettings = settingsSchema.parse({
      ...sample,
      homepage: {
        ...sample.homepage,
        hero: {
          ...sample.homepage.hero,
          heading: "My Custom Detail Store Heading",
          imageUrl: "/demo/hero/hero-1.jpg",
          text: sample.homepage.hero.text,
          primaryLabel: "Custom Shop Now",
        },
      },
    });

    const { settings: cleaned } = stripDemoSettings(customSettings);
    expect(cleaned.homepage.hero.heading).toBe("My Custom Detail Store Heading");
    expect(cleaned.homepage.hero.primaryLabel).toBe("Custom Shop Now");
    expect(cleaned.homepage.hero.imageUrl).toBe("");
    expect(cleaned.homepage.hero.text).toBe("");
  });

  it("ensures repeated cleanup is safe and produces no further changes", () => {
    const sample = demoSettings();
    const { settings: firstClean } = stripDemoSettings(sample);
    const { cleanedFields: secondCleanFields } = stripDemoSettings(firstClean);
    expect(secondCleanFields).toEqual([]);
  });
});
