#!/usr/bin/env node
/**
 * Uploads all Detail Corner product, category, and banner photos to your
 * Supabase Storage bucket ('products') on project 'gllpmefitusfsuzrjgtf'.
 *
 * Usage:
 *   SUPABASE_SECRET_KEY=your_service_role_key node scripts/upload-images-to-supabase.mjs
 *   node scripts/upload-images-to-supabase.mjs --key your_service_role_key
 *
 * Safe & Idempotent:
 *   • Preserves existing custom <slug>.png files in the bucket.
 *   • Uploads missing product images to <slug>.jpg (unless --force is passed).
 *   • Also uploads category and collection banner images.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { env, fail, loadEnv } from "./lib.mjs";

loadEnv();

const PROJECT_REF = "gllpmefitusfsuzrjgtf";
const DEFAULT_URL = `https://${PROJECT_REF}.supabase.co`;
const BUCKET = "products";

const args = process.argv.slice(2);
const keyIndex = args.indexOf("--key");
const secretKey =
  (keyIndex >= 0 ? args[keyIndex + 1] : undefined) ??
  env("SUPABASE_SECRET_KEY") ??
  env("SUPABASE_SERVICE_ROLE_KEY");

if (!secretKey) {
  console.log(`
✗ Missing Supabase secret/service_role key.
  
Run with:
  SUPABASE_SECRET_KEY=your_service_role_key node scripts/upload-images-to-supabase.mjs
or:
  node scripts/upload-images-to-supabase.mjs --key your_service_role_key
`);
  process.exit(1);
}

const supabaseUrl = env("SUPABASE_URL") ?? DEFAULT_URL;
const supabase = createClient(supabaseUrl, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function ensureBucket() {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) {
    fail(`Could not list buckets: ${error.message}`);
  }
  const exists = buckets.some((b) => b.name === BUCKET);
  if (!exists) {
    console.log(`Creating public bucket '${BUCKET}'...`);
    const { error: createErr } = await supabase.storage.createBucket(BUCKET, {
      public: true,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    });
    if (createErr) fail(`Failed to create bucket '${BUCKET}': ${createErr.message}`);
    console.log(`✓ Created public bucket '${BUCKET}'.`);
  } else {
    console.log(`✓ Bucket '${BUCKET}' found.`);
  }
}

async function uploadFile(localPath, storagePath) {
  const buffer = readFileSync(localPath);
  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
    contentType: "image/jpeg",
    upsert: true,
  });
  if (error) {
    console.error(`  ✗ Failed to upload ${storagePath}: ${error.message}`);
    return false;
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  console.log(`  ✓ ${storagePath} -> ${data.publicUrl}`);
  return true;
}

async function main() {
  console.log(`\nConnecting to Supabase Storage: ${supabaseUrl}`);
  console.log(`Target Bucket: ${BUCKET}\n`);

  await ensureBucket();

  const publicDir = path.resolve(process.cwd(), "public", "demo");
  const productsDir = path.join(publicDir, "products");

  let uploadedCount = 0;
  let failedCount = 0;

  const force = args.includes("--force");
  const existingRoot = new Set();
  const { data: listed } = await supabase.storage.from(BUCKET).list("", { limit: 1000 });
  for (const item of listed ?? []) {
    if (item.name) existingRoot.add(item.name);
  }

  // 1. Upload Missing Product Images (skips existing custom .png files)
  console.log("\n1. Checking & Uploading Missing Product Images...");
  if (existsSync(productsDir)) {
    const slugs = readdirSync(productsDir).sort();
    for (const slug of slugs) {
      const alias = slug === "absorber-chemois" ? "chemois" : slug;
      if (!force && (existingRoot.has(`${slug}.png`) || existingRoot.has(`${alias}.png`))) {
        console.log(`  • Skipping ${slug} (existing custom ${alias}.png found in bucket)`);
        continue;
      }
      const imgPath = path.join(productsDir, slug, "1.jpg");
      if (existsSync(imgPath)) {
        const ok = await uploadFile(imgPath, `${slug}.jpg`);
        if (ok) uploadedCount++;
        else failedCount++;
      }
    }
  }

  // 2. Upload Categories
  const categoriesDir = path.join(publicDir, "categories");
  if (existsSync(categoriesDir)) {
    console.log("\n2. Uploading Category Images...");
    const files = readdirSync(categoriesDir).filter((f) => f.endsWith(".jpg"));
    for (const file of files) {
      const ok = await uploadFile(path.join(categoriesDir, file), `categories/${file}`);
      if (ok) uploadedCount++;
      else failedCount++;
    }
  }

  // 3. Upload Banners
  const bannersDir = path.join(publicDir, "banners");
  if (existsSync(bannersDir)) {
    console.log("\n3. Uploading Banner Images...");
    const files = readdirSync(bannersDir).filter((f) => f.endsWith(".jpg"));
    for (const file of files) {
      const ok = await uploadFile(path.join(bannersDir, file), `banners/${file}`);
      if (ok) uploadedCount++;
      else failedCount++;
    }
  }

  console.log(`\n========================================`);
  console.log(`Upload Complete: ${uploadedCount} uploaded, ${failedCount} failed.`);
  console.log(`All files are publicly accessible under:`);
  console.log(`https://${PROJECT_REF}.supabase.co/storage/v1/object/public/${BUCKET}/`);
  console.log(`========================================\n`);
}

main().catch((err) => {
  console.error("Fatal upload error:", err);
  process.exit(1);
});
