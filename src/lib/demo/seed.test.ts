import { describe, expect, it } from "vitest";
import { productionCheckoutProblem } from "../domain/checkout";
import { detailCornerStarterSettings } from "./seed";

describe("Detail Corner starter settings", () => {
  it("uses the store identity, ZAR and the configured brand accent", () => {
    const settings = detailCornerStarterSettings();

    expect(settings.store.name).toBe("Detail Corner");
    expect(settings.store.tagline).toBe("The Art of Perfection");
    expect(settings.store.currency).toBe("ZAR");
    expect(settings.homepage.hero.heading).toBe("Detail Corner");
    expect(settings.theme.accent).toBe("#C41E3A");
  });

  it("does not invent business contact details or VAT registration", () => {
    const settings = detailCornerStarterSettings();

    expect(settings.contact.email).toBe("");
    expect(settings.contact.phone).toBe("");
    expect(settings.contact.whatsapp).toBe("");
    expect(settings.checkout.vatEnabled).toBe(false);
    expect(settings.checkout.vatNumber).toBe("");
  });

  it("keeps live checkout blocked until real store details are configured", () => {
    expect(productionCheckoutProblem(detailCornerStarterSettings())).toBeTruthy();
  });
});
