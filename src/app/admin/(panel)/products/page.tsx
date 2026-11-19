import { Package, Search } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import styles from "@/components/admin/admin.module.css";
import { EmptyState, PageHeader, Panel, Pill } from "@/components/admin/ui";
import { buttonClass } from "@/components/ui/button";
import { searchProducts } from "@/lib/domain/catalog-query";
import { formatMoney } from "@/lib/domain/money";
import { priceSummary, primaryImage, stockIssue, totalStock } from "@/lib/domain/product";
import type { Product } from "@/lib/domain/types";
import { requireAdmin } from "@/server/admin";

export const metadata: Metadata = { title: "Products" };

const VIEWS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "draft", label: "Drafts" },
  { key: "archived", label: "Archived" },
  { key: "stock", label: "Low or out of stock" },
] as const;

type Props = { searchParams: Promise<{ view?: string; q?: string }> };

export default async function ProductsPage({ searchParams }: Props) {
  const params = await searchParams;
  const admin = await requireAdmin();
  const [catalog, settings] = await Promise.all([admin.loadCatalog(), admin.loadSettings()]);
  const money = { currency: settings.store.currency, locale: "en" };
  const view = VIEWS.find((candidate) => candidate.key === params.view) ?? VIEWS[0];
  const query = params.q?.trim() ?? "";
  const categoryName = new Map(catalog.categories.map((category) => [category.id, category.name]));

  const inView = (product: Product) =>
    view.key === "all" ? true : view.key === "stock" ? product.status === "active" && stockIssue(product) !== null : product.status === view.key;
  const base = catalog.products.filter(inView);
  const products = query
    ? searchProducts(base, query, catalog.categories)
    : [...base].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const counts = Object.fromEntries(
    VIEWS.map((candidate) => [
      candidate.key,
      catalog.products.filter((product) =>
        candidate.key === "all"
          ? true
          : candidate.key === "stock"
            ? product.status === "active" && stockIssue(product) !== null
            : product.status === candidate.key,
      ).length,
    ]),
  );

  return (
    <>
      <PageHeader
        title="Products"
        description="Everything you sell. Changes appear in the store as soon as you save."
        actions={
          <Link href="/admin/products/new" className={buttonClass()} data-testid="new-product">
            Add product
          </Link>
        }
      />

      <div className={styles.toolbar}>
        <nav className={`scrollbar-none ${styles.tabsScroll}`} aria-label="Product views">
          {VIEWS.map((candidate) => {
            const active = candidate.key === view.key;
            return (
              <Link
                key={candidate.key}
                href={`/admin/products?view=${candidate.key}${query ? `&q=${encodeURIComponent(query)}` : ""}`}
                aria-current={active ? "page" : undefined}
                className={`${styles.tabLink} ${active ? styles.tabLinkActive : ""}`}
              >
                {candidate.label}
                <span className={`price ${styles.tabCount} ${active ? styles.tabCountActive : ""}`}>{counts[candidate.key]}</span>
              </Link>
            );
          })}
        </nav>
        <form className={styles.searchForm} role="search">
          <input type="hidden" name="view" value={view.key} />
          <Search size={16} className={styles.searchIcon} />
          <input
            name="q"
            defaultValue={query}
            placeholder="Name, SKU or keyword"
            aria-label="Search products"
            className={styles.searchInput}
          />
        </form>
      </div>

      <Panel padded={false}>
        {products.length === 0 ? (
          <EmptyState
            icon={<Package size={20} />}
            title={catalog.products.length === 0 ? "Add your first product" : "No products here"}
            action={
              catalog.products.length === 0 ? (
                <Link href="/admin/products/new" className={buttonClass()}>
                  Add product
                </Link>
              ) : undefined
            }
          >
            {catalog.products.length === 0
              ? "Give it a name, a price and a photo — it's live in your store the moment you save."
              : query
                ? "Nothing matches that search."
                : "Products in this state will appear here."}
          </EmptyState>
        ) : (
          <ul className={styles.dividerList}>
            {products.map((product) => {
              const image = primaryImage(product);
              const price = priceSummary(product);
              const stock = totalStock(product);
              return (
                <li key={product.id}>
                  <Link href={`/admin/products/${product.id}`} className={styles.productRowLink}>
                    <span className={styles.thumb56}>
                      {image && <Image src={image.url} alt="" fill sizes="56px" className={styles.imageCover} />}
                    </span>
                    <span className={styles.productRowBody}>
                      <span className={styles.productRowTitleRow}>
                        <span className={styles.productRowName}>{product.name}</span>
                        {product.isDemo && <Pill tone="muted">Demo</Pill>}
                      </span>
                      <span className={styles.productRowSub}>
                        {[
                          categoryName.get(product.categoryId ?? "") ?? "No category",
                          product.variants.length > 1 ? `${product.variants.length} variants` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    <span className={styles.productStockCol}>
                      {stock === null ? (
                        <span className={styles.fieldHint}>Stock not tracked</span>
                      ) : stock === 0 ? (
                        <span className={styles.stockDanger}>Sold out</span>
                      ) : (
                        <span className={stockIssue(product) !== null ? styles.stockWarning : ""}>{stock} in stock</span>
                      )}
                    </span>
                    <span className={styles.productStatusCol}>
                      <Pill tone={product.status === "active" ? "success" : product.status === "draft" ? "neutral" : "muted"}>
                        {product.status === "active" ? "Active" : product.status === "draft" ? "Draft" : "Archived"}
                      </Pill>
                    </span>
                    <span className={`mono ${styles.productPriceCol}`}>
                      {price.varies ? `from ${formatMoney(price.min, money)}` : formatMoney(price.min, money)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </>
  );
}
