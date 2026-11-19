import { expect, test, type Page } from "@playwright/test";
import { addToBag, expectToast, FICTIONAL_WHATSAPP, placeOrder as checkout, setWhatsAppNumber } from "./fixtures";

/**
 * The order lifecycle end to end: a shopper orders, the owner works the order
 * in the dashboard, stock follows, and only confirmed orders count as sales.
 */

async function transition(page: Page, orderId: string, to: string, toast: RegExp) {
  await page.goto(`/admin/orders/${orderId}`);
  await page.getByTestId(`transition-${to}`).click();
  await page.getByTestId("confirm-transition").click();
  await expectToast(page, toast);
}

async function stockOf(page: Page, productName: string, label = "Units in stock") {
  await page.goto(`/admin/products?q=${encodeURIComponent(productName)}`);
  await page.getByRole("link", { name: productName }).first().click();
  await expect(page.getByTestId("product-name")).toHaveValue(productName);
  return Number(await page.getByLabel(label).inputValue());
}

test.describe.configure({ mode: "serial" });

test("a pay-on-delivery order: placed, confirmed (stock reserved), fulfilled, completed", async ({ page }) => {
  const before = await stockOf(page, "Premium pH-Neutral Car Shampoo 1L");

  await addToBag(page, "premium-ph-neutral-car-shampoo-1l");
  const order = await checkout(page, "Pay on delivery");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("your order request is in");
  await expect(page.getByText("Received — the store will confirm it soon")).toBeVisible();
  const shopperUrl = page.url();

  expect(await stockOf(page, "Premium pH-Neutral Car Shampoo 1L")).toBe(before);

  await page.goto("/admin/orders?view=new");
  await expect(page.getByRole("link", { name: `#${order.number}` })).toBeVisible();

  await transition(page, order.id, "confirmed", new RegExp(`#${order.number}: Confirmed`));
  expect(await stockOf(page, "Premium pH-Neutral Car Shampoo 1L")).toBe(before - 1);

  await page.goto(shopperUrl);
  await expect(page.getByText("Confirmed by the store")).toBeVisible();

  await transition(page, order.id, "fulfilled", /Fulfilled/);
  await transition(page, order.id, "completed", /Completed/);

  await page.goto("/admin");
  await expect(page.getByText("R149.00").first()).toBeVisible();
});

test("a bank-transfer order shows the payment details, and cancelling returns the stock", async ({ page }) => {
  const before = await stockOf(page, "High-Foaming Snow Foam 1L");

  await addToBag(page, "high-foaming-snow-foam-1l");
  const order = await checkout(page, "Bank transfer");
  await expect(page.getByText("Bank transfer details")).toBeVisible();
  await expect(page.getByText(`Use “${order.number}” as the payment reference.`)).toBeVisible();

  await transition(page, order.id, "confirmed", /Confirmed/);
  expect(await stockOf(page, "High-Foaming Snow Foam 1L")).toBe(before - 1);

  await page.goto(`/admin/orders/${order.id}`);
  await page.getByRole("button", { name: "Mark as paid" }).click();
  await expectToast(page, "Marked as paid");

  await transition(page, order.id, "cancelled", /Cancelled/);
  expect(await stockOf(page, "High-Foaming Snow Foam 1L")).toBe(before);
});

test("without a WhatsApp number, WhatsApp checkout is a demo that sends nothing", async ({ page }) => {
  await setWhatsAppNumber(page, "");

  await addToBag(page, "premium-microfibre-wash-mitt");
  await page.goto("/checkout");
  await page.getByRole("radio", { name: /Order on WhatsApp/ }).check();
  await expect(page.getByText(/hasn't connected a WhatsApp number/)).toBeVisible();
  const order = await checkout(page, "Order on WhatsApp", { address: true });

  const message = page.getByTestId("whatsapp-message");
  await expect(message).toContainText(`#${order.number}`);
  await expect(message).toContainText("Premium Microfibre Wash Mitt");
  await expect(page.getByTestId("open-whatsapp")).toHaveCount(0);

  await page.goto("/admin/orders?view=whatsapp");
  await expect(page.getByRole("link", { name: `#${order.number}` })).toBeVisible();
  await page.goto(`/admin/orders/${order.id}`);
  await expect(page.getByText("WhatsApp: message prepared").first()).toBeVisible();
});

test("with a WhatsApp number, the handoff opens a chat with that number", async ({ page }) => {
  await setWhatsAppNumber(page, FICTIONAL_WHATSAPP);

  await addToBag(page, "streak-free-glass-cleaner-500ml");
  const order = await checkout(page, "Order on WhatsApp");
  const open = page.getByTestId("open-whatsapp");
  await expect(open).toHaveAttribute("href", /^https:\/\/wa\.me\/447700900123\?text=/);
  const href = (await open.getAttribute("href"))!;
  const text = decodeURIComponent(href.split("?text=")[1]);
  expect(text).toContain(`#${order.number}`);
  expect(text).toContain("Streak-Free Glass Cleaner 500ml");

  await setWhatsAppNumber(page, "");
});
