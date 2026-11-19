import { expect, test } from "@playwright/test";
import { addToBag } from "./fixtures";

test.describe("shopping", () => {
  test("the homepage shows the store's own sections", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: /Car Wash/ }).first()).toBeVisible();
    await expect(page.locator('a[href^="/products/"]').first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("search finds products from the header", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Search" }).first().click();
    await page.getByRole("searchbox", { name: "Search products" }).fill("shampoo");
    await expect(page.getByRole("link", { name: /Premium pH-Neutral Car Shampoo 1L/ })).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/shop\?q=shampoo/);
    await expect(page.getByRole("heading", { name: "Premium pH-Neutral Car Shampoo 1L" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "All-Purpose Cleaner 1L" })).toHaveCount(0);
  });

  test("a category page lists only its products", async ({ page }) => {
    await page.goto("/categories/accessories");
    await expect(page.getByRole("heading", { name: "Premium Microfibre Wash Mitt" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "All-Purpose Cleaner 1L" })).toHaveCount(0);
  });

  test("the bag keeps its lines and totals across pages", async ({ page }) => {
    await addToBag(page, "premium-microfibre-wash-mitt");
    await page.goto("/cart");
    await expect(page.getByRole("heading", { name: "Premium Microfibre Wash Mitt" }).or(page.getByText("Premium Microfibre Wash Mitt").first())).toBeVisible();
    await expect(page.getByText("R99").first()).toBeVisible();
    await expect(page.getByTestId("cart-button")).toContainText("1");
  });
});
