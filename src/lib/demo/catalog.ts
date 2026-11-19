import type { Category, Collection, Product, ProductOption, ProductVariant } from "@/lib/domain/types";
import { DEMO_PRODUCTS } from "./products";

/**
 * Detail Corner demo catalog: South African automotive detailing and car-care
 * store across seven categories, exercising variants, sizes, tracked stock,
 * and plain products.
 */

export const demoId = (kind: "c" | "a" | "b", n: number) =>
  `de000000-0000-4000-8000-${kind}${String(n).padStart(11, "0")}`;

const CATEGORY_DEFS = [
  {
    n: 1,
    slug: "car-wash",
    name: "Car Wash",
    description: "pH-neutral shampoos, pre-wash snow foams and wash buckets.",
  },
  {
    n: 2,
    slug: "interior-care",
    name: "Interior Care",
    description: "All-purpose cleaners and satin-finish interior detailers for cabins.",
  },
  {
    n: 3,
    slug: "wheel-tyre-care",
    name: "Wheel & Tyre Care",
    description: "Non-acid wheel cleaners and polymer-based tyre dressings.",
  },
  {
    n: 4,
    slug: "exterior-care",
    name: "Exterior Care",
    description: "Color-changing iron fallout removers and paint decontamination.",
  },
  {
    n: 5,
    slug: "glass-care",
    name: "Glass Care",
    description: "Ammonia-free glass cleaners for crystal clear visibility.",
  },
  {
    n: 6,
    slug: "accessories",
    name: "Accessories",
    description: "Plush microfibre wash mitts, twisted drying towels and edgeless cloths.",
  },
  {
    n: 7,
    slug: "protection",
    name: "Protection",
    description: "Ceramic spray sealants and hydrophobic paint protectants.",
  },
] as const;

const COLLECTION_DEFS = [
  {
    n: 1,
    slug: "wash-decon",
    name: "Wash & Decon",
    description: "Essential pre-wash, shampoo and decontamination products for a safe contact wash.",
    image: "/demo/banners/gift-guide.jpg",
  },
  {
    n: 2,
    slug: "interior-glass",
    name: "Interior & Glass",
    description: "Keep your cockpit spotless, protected and glare-free.",
    image: "/demo/banners/desk-setup.jpg",
  },
  {
    n: 3,
    slug: "maintenance-essentials",
    name: "Maintenance Essentials",
    description: "High-performance car care staples for weekly upkeep.",
    image: null,
  },
] as const;

export type DemoCategorySlug = (typeof CATEGORY_DEFS)[number]["slug"];
export type DemoCollectionSlug = (typeof COLLECTION_DEFS)[number]["slug"];

const daysAgo = (now: Date | string | undefined | null, days: number) => {
  const base = now instanceof Date ? now : (typeof now === 'string' ? new Date(now) : new Date());
  const validBase = !isNaN(base.getTime()) ? base : new Date();
  return new Date(validBase.getTime() - days * 86_400_000).toISOString();
};

export function demoCategories(now: Date): Category[] {
  return CATEGORY_DEFS.map((def, index) => ({
    id: demoId("c", def.n),
    slug: def.slug,
    name: def.name,
    description: def.description,
    imageUrl: `/demo/categories/${def.slug}.jpg`,
    sortOrder: index,
    visible: true,
    isDemo: true,
    createdAt: daysAgo(now, 60),
    updatedAt: daysAgo(now, 60),
  }));
}

export function demoCollections(now: Date): Collection[] {
  return COLLECTION_DEFS.map((def, index) => ({
    id: demoId("a", def.n),
    slug: def.slug,
    name: def.name,
    description: def.description,
    imageUrl: def.image,
    sortOrder: index,
    visible: true,
    isDemo: true,
    createdAt: daysAgo(now, 60),
    updatedAt: daysAgo(now, 60),
  }));
}

/* --------------------------------------------------------------- products */

export type DemoProductDef = {
  n: number;
  slug: string;
  name: string;
  summary: string;
  description: string;
  category: DemoCategorySlug;
  collections?: DemoCollectionSlug[];
  tags?: string[];
  featured?: boolean;
  addedDaysAgo: number;
  photos: string[];
  price?: number;
  compareAt?: number;
  stock?: number;
  sku?: string;
  options?: ProductOption[];
  variants?: {
    values: string[];
    price: number;
    compareAt?: number;
    stock?: number;
    sku: string;
    available?: boolean;
    photo?: number;
  }[];
  trackInventory?: boolean;
  specs?: [string, string][];
};

function buildProduct(def: DemoProductDef, now: Date): Product {
  const images = def.photos.map((alt, index) => ({
    id: `${def.slug}-${index + 1}`,
    url: `/demo/products/${def.slug}/${index + 1}.jpg`,
    alt,
    width: 1200,
    height: 1500,
  }));

  const variants: ProductVariant[] = def.variants
    ? def.variants.map((variant) => ({
        id: `${def.slug}--${variant.values.join("-").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        optionValues: variant.values,
        price: variant.price,
        compareAtPrice: variant.compareAt ?? null,
        sku: variant.sku,
        stock: variant.stock ?? 0,
        available: variant.available ?? true,
        imageId: variant.photo ? `${def.slug}-${variant.photo}` : null,
      }))
    : [
        {
          id: `${def.slug}--default`,
          optionValues: [],
          price: def.price ?? 0,
          compareAtPrice: def.compareAt ?? null,
          sku: def.sku ?? "",
          stock: def.stock ?? 0,
          available: true,
          imageId: null,
        },
      ];

  const stamp = daysAgo(now, def.addedDaysAgo);
  return {
    id: demoId("b", def.n),
    slug: def.slug,
    name: def.name,
    summary: def.summary,
    description: def.description,
    status: "active",
    categoryId: demoId("c", CATEGORY_DEFS.find((category) => category.slug === def.category)!.n),
    collectionIds: (def.collections ?? []).map((slug) =>
      demoId("a", COLLECTION_DEFS.find((collection) => collection.slug === slug)!.n),
    ),
    tags: def.tags ?? [],
    images,
    options: def.options ?? [],
    variants,
    trackInventory: def.trackInventory ?? false,
    specs: (def.specs ?? []).map(([label, value]) => ({ label, value })),
    featured: def.featured ?? false,
    seoTitle: "",
    seoDescription: "",
    isDemo: true,
    createdAt: stamp,
    updatedAt: stamp,
  };
}

export function demoProducts(now: Date): Product[] {
  return DEMO_PRODUCTS.map((def) => buildProduct(def, now));
}
