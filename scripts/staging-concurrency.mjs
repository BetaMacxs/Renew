#!/usr/bin/env node
/**
 * Real-Postgres concurrency checks for a disposable Supabase staging project.
 *
 * Required environment:
 *   STAGING_SUPABASE_URL
 *   STAGING_SUPABASE_PUBLISHABLE_KEY
 *   STAGING_SUPABASE_SECRET_KEY
 *   STAGING_ADMIN_EMAIL
 *   STAGING_ADMIN_PASSWORD
 *   STAGING_TESTS_CONFIRMATION=I_CONFIRM_THIS_IS_A_DISPOSABLE_STAGING_PROJECT
 *
 * Creates and removes one temporary product, two temporary orders and one
 * rate-limit row. Never point this script at production.
 */

import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const CONFIRMATION = "I_CONFIRM_THIS_IS_A_DISPOSABLE_STAGING_PROJECT";
const url = process.env.STAGING_SUPABASE_URL;
const publishable = process.env.STAGING_SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.STAGING_SUPABASE_SECRET_KEY;
const email = process.env.STAGING_ADMIN_EMAIL;
const password = process.env.STAGING_ADMIN_PASSWORD;

if (process.env.STAGING_TESTS_CONFIRMATION !== CONFIRMATION) {
  throw new Error("Refusing to run: explicitly confirm that this is a disposable staging project.");
}
if (!url || !publishable || !secret || !email || !password) {
  throw new Error("Set all STAGING_SUPABASE_* and STAGING_ADMIN_* environment variables.");
}
if (!/^https:\/\//i.test(url)) {
  throw new Error("STAGING_SUPABASE_URL must be an HTTPS Supabase project URL.");
}

const options = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(url, secret, options);
const admin = createClient(url, publishable, options);
const suffix = randomBytes(10).toString("hex");
const rateKey = "staging-concurrency-" + suffix;
const orderIds = [];
let productId = null;
let failure = null;
const cleanupFailures = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function cleanup() {
  if (orderIds.length > 0) {
    const { data: orders, error: readError } = await service
      .from("orders")
      .select("id,status,stock_reserved")
      .in("id", orderIds);
    if (readError) cleanupFailures.push("Could not read temporary orders: " + readError.message);

    for (const order of orders ?? []) {
      if (order.status === "confirmed") {
        const { error } = await admin.rpc("admin_transition_order", {
          p_order_id: order.id,
          p_from: "confirmed",
          p_to: "cancelled",
          p_stock_delta: order.stock_reserved ? -1 : 0,
          p_note: "Staging test cleanup.",
        });
        if (error) cleanupFailures.push("Could not cancel temporary order " + order.id + ": " + error.message);
      } else if (order.status === "received") {
        const { error } = await admin.rpc("admin_transition_order", {
          p_order_id: order.id,
          p_from: "received",
          p_to: "cancelled",
          p_stock_delta: 0,
          p_note: "Staging test cleanup.",
        });
        if (error) cleanupFailures.push("Could not cancel temporary order " + order.id + ": " + error.message);
      }
    }

    const { error } = await service.from("orders").delete().in("id", orderIds);
    if (error) cleanupFailures.push("Could not remove temporary orders: " + error.message);
  }

  if (productId) {
    const { error } = await service.from("products").delete().eq("id", productId);
    if (error) cleanupFailures.push("Could not remove temporary product: " + error.message);
  }

  const { error: rateError } = await service.from("rate_limits").delete().eq("key", rateKey);
  if (rateError) cleanupFailures.push("Could not remove temporary rate-limit row: " + rateError.message);
}

try {
  const { error: loginError } = await admin.auth.signInWithPassword({ email, password });
  assert(!loginError, "Could not sign in as the staging admin: " + (loginError?.message ?? ""));
  const { data: isAdmin, error: adminError } = await admin.rpc("is_admin");
  assert(!adminError && isAdmin === true, "The staging account is not registered as an admin.");

  const { data: product, error: productError } = await service
    .from("products")
    .insert({
      slug: "staging-stock-race-" + suffix,
      name: "Staging stock concurrency probe",
      summary: "Temporary automated test product",
      status: "active",
      track_inventory: true,
      variants: [{
        id: "single-unit",
        optionValues: [],
        price: 1,
        compareAtPrice: null,
        sku: "STAGING-RACE-" + suffix,
        stock: 1,
        available: true,
        imageId: null,
      }],
    })
    .select("id")
    .single();
  assert(!productError, "Could not create the temporary stock-test product: " + (productError?.message ?? ""));
  productId = product.id;

  for (let index = 0; index < 2; index += 1) {
    const { data: order, error: orderError } = await service
      .from("orders")
      .insert({
        channel: "web",
        status: "received",
        payment_method: "cod",
        payment_status: "unpaid",
        currency: "ZAR",
        items: [{
          productId,
          variantId: "single-unit",
          name: "Staging stock concurrency probe",
          variantLabel: "",
          sku: "STAGING-RACE-" + suffix,
          imageUrl: null,
          unitPrice: 1,
          quantity: 1,
          lineTotal: 1,
        }],
        subtotal: 1,
        shipping_fee: 0,
        total: 1,
        customer: {
          name: "Staging concurrency test",
          phone: "",
          email: "staging-test@example.invalid",
        },
        customer_note: "",
        internal_note: "",
        stock_reserved: false,
        events: [],
        access_token_hash: randomBytes(32).toString("hex"),
      })
      .select("id")
      .single();
    assert(!orderError, "Could not create temporary order: " + (orderError?.message ?? ""));
    orderIds.push(order.id);
  }

  const reservations = await Promise.all(
    orderIds.map((id) =>
      admin.rpc("admin_transition_order", {
        p_order_id: id,
        p_from: "received",
        p_to: "confirmed",
        p_stock_delta: 1,
        p_note: "Staging concurrency test.",
      }),
    ),
  );

  const successful = reservations.filter((result) => !result.error);
  const rejected = reservations.filter((result) => Boolean(result.error));
  assert(successful.length === 1, "Expected exactly one of two competing reservations to succeed; got " + successful.length + ".");
  assert(rejected.length === 1, "Expected exactly one competing reservation to be rejected.");
  assert(/not enough stock/i.test(rejected[0].error.message), "The losing reservation failed for an unexpected reason: " + rejected[0].error.message);

  const { data: savedProduct, error: savedProductError } = await service
    .from("products")
    .select("variants,track_inventory")
    .eq("id", productId)
    .single();
  assert(!savedProductError, "Could not read reserved stock: " + (savedProductError?.message ?? ""));
  const variant = savedProduct.variants.find((item) => item.id === "single-unit");
  assert(savedProduct.track_inventory === true && variant?.stock === 0, "Expected the single available unit to be reserved exactly once.");

  const { data: savedOrders, error: savedOrdersError } = await service
    .from("orders")
    .select("status,stock_reserved")
    .in("id", orderIds);
  assert(!savedOrdersError, "Could not read reservation results: " + (savedOrdersError?.message ?? ""));
  assert(savedOrders.filter((order) => order.status === "confirmed" && order.stock_reserved).length === 1, "Expected exactly one confirmed, stock-reserved order.");
  assert(savedOrders.filter((order) => order.status === "received" && !order.stock_reserved).length === 1, "Expected the losing order to remain received and unreserved.");
  console.log("✓ Concurrent stock reservation: one order confirmed, one rejected, no oversell.");

  const calls = await Promise.all(
    Array.from({ length: 10 }, () =>
      service.rpc("check_rate_limit", {
        p_key: rateKey,
        p_limit: 3,
        p_window_ms: 60_000,
      }),
    ),
  );
  const rateError = calls.find((result) => result.error)?.error;
  assert(!rateError, "Shared rate-limit RPC failed: " + (rateError?.message ?? ""));
  const allowed = calls.reduce((count, result) => count + (result.data?.[0]?.allowed ? 1 : 0), 0);
  assert(allowed === 3, "Expected exactly 3 of 10 concurrent rate-limit requests to be allowed; got " + allowed + ".");
  console.log("✓ Shared rate limit: exactly 3 of 10 concurrent requests were allowed.");
} catch (error) {
  failure = error instanceof Error ? error : new Error(String(error));
} finally {
  await cleanup();
}

if (cleanupFailures.length > 0) {
  const detail = cleanupFailures.join("; ");
  failure = failure ? new Error(failure.message + " Cleanup: " + detail) : new Error("Cleanup failed: " + detail);
}
if (failure) {
  console.error("✗ Staging integration checks failed: " + failure.message);
  process.exitCode = 1;
} else {
  console.log("✓ Staging Supabase concurrency checks passed and temporary records were removed.");
}
