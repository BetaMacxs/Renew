"use client";

import { ArrowLeft, Copy, ExternalLink, GripVertical, Plus, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { buttonClass } from "@/components/ui/button";
import { slugify, slugInput } from "@/lib/domain/slug";
import { uid } from "@/lib/uid";
import type { Category, Collection, Product, ProductImage, ProductOption, ProductStatus } from "@/lib/domain/types";
import { combinations, countCombinations, MAX_OPTIONS, MAX_VARIANTS, optionProblems } from "@/lib/domain/variants";
import {
  deleteProductAction,
  duplicateProductAction,
  saveProductAction,
} from "@/server/actions/admin";
import styles from "./admin.module.css";
import { MediaManager } from "./MediaManager";
import { usePreview } from "./preview";
import { ConfirmButton, Notice, Panel, SelectField, TextAreaField, TextField, Toggle, useToast } from "./ui";

/* ------------------------------------------------------------- the draft */

type VariantDraft = {
  id: string;
  optionValues: string[];
  price: string;
  compareAtPrice: string;
  sku: string;
  stock: string;
  available: boolean;
  imageId: string | null;
};

type Draft = {
  id?: string;
  expectedUpdatedAt: string | null;
  name: string;
  slug: string;
  slugTouched: boolean;
  summary: string;
  description: string;
  status: ProductStatus;
  categoryId: string | null;
  collectionIds: string[];
  tags: string;
  images: ProductImage[];
  options: ProductOption[];
  variants: VariantDraft[];
  trackInventory: boolean;
  specs: { id: string; label: string; value: string }[];
  featured: boolean;
  seoTitle: string;
  seoDescription: string;
};

const money = (value: number | null) => (value === null ? "" : String(value));

/** Keeps a URL handle typeable: lowercase, hyphens for spaces, nothing else. */
function toDraft(product: Product | null): Draft {
  if (!product) {
    return {
      expectedUpdatedAt: null,
      name: "",
      slug: "",
      slugTouched: false,
      summary: "",
      description: "",
      status: "active",
      categoryId: null,
      collectionIds: [],
      tags: "",
      images: [],
      options: [],
      variants: [
        { id: uid(), optionValues: [], price: "", compareAtPrice: "", sku: "", stock: "0", available: true, imageId: null },
      ],
      trackInventory: false,
      specs: [],
      featured: false,
      seoTitle: "",
      seoDescription: "",
    };
  }
  return {
    id: product.id,
    expectedUpdatedAt: product.updatedAt,
    name: product.name,
    slug: product.slug,
    slugTouched: true,
    summary: product.summary,
    description: product.description,
    status: product.status,
    categoryId: product.categoryId,
    collectionIds: product.collectionIds,
    tags: product.tags.join(", "),
    images: product.images,
    options: product.options,
    variants: product.variants.map((variant) => ({
      id: variant.id,
      optionValues: variant.optionValues,
      price: money(variant.price),
      compareAtPrice: money(variant.compareAtPrice),
      sku: variant.sku,
      stock: String(variant.stock),
      available: variant.available,
      imageId: variant.imageId,
    })),
    trackInventory: product.trackInventory,
    specs: product.specs.map((spec) => ({ ...spec, id: uid() })),
    featured: product.featured,
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
  };
}

/** Rebuilds variants for new options, keeping everything already typed. */
function syncDrafts(options: ProductOption[], drafts: VariantDraft[]): VariantDraft[] {
  const template = drafts[0];
  const byKey = new Map(drafts.map((draft) => [JSON.stringify(draft.optionValues), draft]));
  return combinations(options).map((values) => {
    const exact = byKey.get(JSON.stringify(values));
    if (exact) return { ...exact, optionValues: values };
    let nearest: VariantDraft | undefined;
    let best = 0;
    for (const draft of drafts) {
      const score = draft.optionValues.filter((value) => values.includes(value)).length;
      if (score > best) {
        best = score;
        nearest = draft;
      }
    }
    const source = nearest ?? template;
    return {
      id: uid(),
      optionValues: values,
      price: source?.price ?? "",
      compareAtPrice: source?.compareAtPrice ?? "",
      sku: "",
      stock: "0",
      available: true,
      imageId: null,
    };
  });
}

const OPTION_SUGGESTIONS = ["Size", "Colour", "Material", "Capacity", "Storage", "Scent", "Style", "Length", "Pack size"];

/* ---------------------------------------------------------------- editor */

export function ProductEditor({
  product,
  categories,
  collections,
  currency,
}: {
  product: Product | null;
  categories: Category[];
  collections: Collection[];
  currency: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [initial] = useState<Draft>(() => toDraft(product));
  const [draft, setDraft] = useState<Draft>(initial);
  const [saved, setSaved] = useState(() => JSON.stringify(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(draft) !== saved;
  const isNew = !draft.id;

  const preview = usePreview();
  useEffect(() => {
    if (!dirty || preview) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, preview]);

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key as string]) return current;
      const next = { ...current };
      delete next[key as string];
      return next;
    });
  };

  const setName = (name: string) =>
    setDraft((current) => ({
      ...current,
      name,
      slug: current.slugTouched ? current.slug : slugify(name),
    }));

  const setOptions = (options: ProductOption[]) =>
    setDraft((current) => ({ ...current, options, variants: syncDrafts(options, current.variants) }));

  const setVariant = (index: number, patch: Partial<VariantDraft>) =>
    setDraft((current) => ({
      ...current,
      variants: current.variants.map((variant, position) => (position === index ? { ...variant, ...patch } : variant)),
    }));

  const problems = useMemo(() => optionProblems(draft.options), [draft.options]);
  const hasOptions = draft.options.length > 0;

  async function save() {
    setFormError(null);
    const local: Record<string, string> = {};
    if (!draft.name.trim()) local.name = "Give the product a name";
    draft.variants.forEach((variant, index) => {
      if (variant.price.trim() === "" || Number.isNaN(Number(variant.price))) local[`variants.${index}.price`] = "Enter a price";
    });
    if (Object.keys(local).length > 0 || problems.length > 0) {
      setErrors(local);
      setFormError(problems[0] ?? "Some fields need attention.");
      return;
    }

    setSaving(true);
    const result = await saveProductAction({
      id: draft.id,
      expectedUpdatedAt: draft.expectedUpdatedAt,
      name: draft.name,
      slug: draft.slug.replace(/^-+|-+$/g, "") || slugify(draft.name) || `product-${Date.now().toString(36)}`,
      summary: draft.summary,
      description: draft.description,
      status: draft.status,
      categoryId: draft.categoryId,
      collectionIds: draft.collectionIds,
      tags: draft.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      images: draft.images,
      options: draft.options,
      variants: draft.variants.map((variant) => ({
        id: variant.id,
        optionValues: variant.optionValues,
        price: Number(variant.price),
        compareAtPrice: variant.compareAtPrice.trim() === "" ? null : Number(variant.compareAtPrice),
        sku: variant.sku,
        stock: Number(variant.stock || 0),
        available: variant.available,
        imageId: variant.imageId,
      })),
      trackInventory: draft.trackInventory,
      specs: draft.specs.filter((spec) => spec.label.trim() || spec.value.trim()).map(({ label, value }) => ({ label, value })),
      featured: draft.featured,
      seoTitle: draft.seoTitle,
      seoDescription: draft.seoDescription,
    });
    setSaving(false);

    if (!result.ok) {
      setErrors(result.fieldErrors ?? {});
      setFormError(result.error);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const next = toDraft(result.data);
    setDraft(next);
    setSaved(JSON.stringify(next));
    setErrors({});
    toast("success", isNew ? "Product created" : "Product saved");
    if (isNew) router.replace(`/admin/products/${result.data.id}`);
    else router.refresh();
  }

  const priceField = (index: number, key: "price" | "compareAtPrice", label: string, hint?: string) => (
    <TextField
      label={label}
      hint={hint}
      inputMode="decimal"
      suffix={currency}
      value={draft.variants[index]?.[key] ?? ""}
      error={errors[`variants.${index}.${key}`]}
      onChange={(event) => setVariant(index, { [key]: event.target.value.replace(",", ".").replace(/[^\d.]/g, "") })}
      optional={key === "compareAtPrice"}
    />
  );

  return (
    <div className={styles.editorWrap}>
      {/* Header with the save button, always within reach. */}
      <div className={styles.stickyBar}>
        <div className={styles.stickyBarInner}>
          <div className={styles.stickyBarLead}>
            <Link href="/admin/products" className={styles.stickyBackBtn} aria-label="Back to products">
              <ArrowLeft size={18} />
            </Link>
            <h1 className={styles.stickyTitle}>{draft.name || (isNew ? "New product" : "Untitled product")}</h1>
            {dirty && <span className={styles.stickyUnsaved}>Unsaved changes</span>}
          </div>
          <div className={styles.stickyActions}>
            {dirty && !isNew && (
              <button type="button" onClick={() => setDraft(JSON.parse(saved))} className={buttonClass({ variant: "ghost", size: "sm" })}>
                Discard
              </button>
            )}
            <button type="button" onClick={save} disabled={saving || (!dirty && !isNew)} className={buttonClass({ size: "sm" })} data-testid="save-product">
              {saving ? "Saving…" : isNew ? "Create product" : "Save"}
            </button>
          </div>
        </div>
      </div>

      {formError && (
        <div className={styles.mb6}>
          <Notice tone="danger" title={formError}>
            {Object.keys(errors).length > 0 && "Check the fields marked in red."}
          </Notice>
        </div>
      )}

      <div className={styles.editorGrid}>
        <div className={styles.stack6}>
          <Panel title="Product">
            <div className={styles.gridGap4}>
              <TextField
                label="Name"
                value={draft.name}
                onChange={(event) => setName(event.target.value)}
                error={errors.name}
                maxLength={120}
                placeholder="e.g. Organic cotton tee"
                data-testid="product-name"
              />
              <TextField
                label="Short line"
                optional
                value={draft.summary}
                onChange={(event) => update("summary", event.target.value)}
                error={errors.summary}
                maxLength={160}
                hint="Shown under the name, e.g. “Wireless · 40-hour battery”."
              />
              <TextAreaField
                label="Description"
                optional
                rows={6}
                value={draft.description}
                onChange={(event) => update("description", event.target.value)}
                error={errors.description}
                maxLength={5000}
                hint="Leave an empty line between paragraphs. Start lines with “- ” for a list."
              />
            </div>
          </Panel>

          <Panel title="Photos" description="Up to 12. Drag in several at once.">
            <MediaManager
              images={draft.images}
              onChange={(images) => {
                const ids = new Set(images.map((image) => image.id));
                setDraft((current) => ({
                  ...current,
                  images,
                  variants: current.variants.map((variant) =>
                    variant.imageId && !ids.has(variant.imageId) ? { ...variant, imageId: null } : variant,
                  ),
                }));
              }}
              error={errors.images}
            />
          </Panel>

          {!hasOptions && (
            <Panel title="Price and stock">
              <div className={styles.grid2Sm}>
                {priceField(0, "price", "Price")}
                {priceField(0, "compareAtPrice", "Compare-at price", "The old price, if this is on sale. Shown crossed out.")}
                <TextField
                  label="SKU"
                  optional
                  value={draft.variants[0]?.sku ?? ""}
                  onChange={(event) => setVariant(0, { sku: event.target.value })}
                  hint="Your own reference code."
                />
              </div>
              <div className={styles.dividerSection}>
                <Toggle
                  checked={draft.trackInventory}
                  onChange={(value) => update("trackInventory", value)}
                  label="Track stock"
                  description="Count units: confirming an order takes them out, cancelling puts them back. The shop says “Sold out” at zero."
                />
                {draft.trackInventory && (
                  <TextField
                    label="Units in stock"
                    inputMode="numeric"
                    value={draft.variants[0]?.stock ?? "0"}
                    onChange={(event) => setVariant(0, { stock: event.target.value.replace(/\D/g, "") })}
                    className={styles.maxW48}
                    error={errors["variants.0.stock"]}
                  />
                )}
                <Toggle
                  checked={draft.variants[0]?.available ?? true}
                  onChange={(value) => setVariant(0, { available: value })}
                  label="Available to order"
                  description="Turn off to show the product as sold out without changing anything else."
                />
              </div>
            </Panel>
          )}

          <Panel
            title="Options"
            description="Sizes, colours, capacities, scents… Each combination becomes a variant with its own price and stock."
          >
            <OptionsEditor options={draft.options} onChange={setOptions} />
            {problems.length > 0 && (
              <ul className={styles.optionProblems}>
                {problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            )}
            {errors.options && <p className={styles.fieldError}>{errors.options}</p>}
          </Panel>

          {hasOptions && problems.length === 0 && (
            <Panel
              title={`Variants (${draft.variants.length})`}
              description="Set the price, stock and photo for each combination."
              padded={false}
            >
              <div className={styles.variantTopBox}>
                <Toggle
                  checked={draft.trackInventory}
                  onChange={(value) => update("trackInventory", value)}
                  label="Track stock"
                  description="Count units per variant. Confirmed orders take them out, cancelled orders put them back."
                />
                <BulkPrice
                  currency={currency}
                  onApply={(price) =>
                    setDraft((current) => ({ ...current, variants: current.variants.map((variant) => ({ ...variant, price })) }))
                  }
                />
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.variantsTable}>
                  <thead className={styles.tableHead}>
                    <tr>
                      <th scope="col" className={styles.variantThFirst}>Variant</th>
                      <th scope="col" className={styles.variantThMid}>Price</th>
                      <th scope="col" className={styles.variantThMid}>Was</th>
                      {draft.trackInventory && <th scope="col" className={styles.variantThMid}>Stock</th>}
                      <th scope="col" className={styles.variantThMid}>SKU</th>
                      {draft.images.length > 0 && <th scope="col" className={styles.variantThMid}>Photo</th>}
                      <th scope="col" className={styles.variantThLast}>On sale</th>
                    </tr>
                  </thead>
                  <tbody className={styles.dividerTable}>
                    {draft.variants.map((variant, index) => (
                      <tr key={variant.id}>
                        <td className={styles.variantTdFirst}>{variant.optionValues.join(" / ")}</td>
                        <td className={styles.variantTdMid}>
                          <CellInput
                            value={variant.price}
                            invalid={Boolean(errors[`variants.${index}.price`])}
                            onChange={(value) => setVariant(index, { price: value.replace(",", ".").replace(/[^\d.]/g, "") })}
                            label={`Price for ${variant.optionValues.join(" / ")}`}
                            widthClass={styles.cellW24}
                          />
                        </td>
                        <td className={styles.variantTdMid}>
                          <CellInput
                            value={variant.compareAtPrice}
                            onChange={(value) => setVariant(index, { compareAtPrice: value.replace(",", ".").replace(/[^\d.]/g, "") })}
                            label={`Compare-at price for ${variant.optionValues.join(" / ")}`}
                            widthClass={styles.cellW24}
                          />
                        </td>
                        {draft.trackInventory && (
                          <td className={styles.variantTdMid}>
                            <CellInput
                              value={variant.stock}
                              onChange={(value) => setVariant(index, { stock: value.replace(/\D/g, "") })}
                              label={`Stock for ${variant.optionValues.join(" / ")}`}
                              widthClass={styles.cellW20}
                            />
                          </td>
                        )}
                        <td className={styles.variantTdMid}>
                          <CellInput
                            value={variant.sku}
                            onChange={(value) => setVariant(index, { sku: value })}
                            label={`SKU for ${variant.optionValues.join(" / ")}`}
                            widthClass={styles.cellW32}
                          />
                        </td>
                        {draft.images.length > 0 && (
                          <td className={styles.variantTdMid}>
                            <select
                              value={variant.imageId ?? ""}
                              onChange={(event) => setVariant(index, { imageId: event.target.value || null })}
                              aria-label={`Photo for ${variant.optionValues.join(" / ")}`}
                              className={styles.variantSelect}
                            >
                              <option value="">Default</option>
                              {draft.images.map((image, position) => (
                                <option key={image.id} value={image.id}>
                                  Photo {position + 1}
                                </option>
                              ))}
                            </select>
                          </td>
                        )}
                        <td className={styles.variantTdLast}>
                          <input
                            type="checkbox"
                            checked={variant.available}
                            onChange={(event) => setVariant(index, { available: event.target.checked })}
                            aria-label={`${variant.optionValues.join(" / ")} available to order`}
                            className={styles.checkbox}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}

          <Panel title="Details" description="Facts shoppers compare: material, dimensions, battery life, care…">
            <SpecsEditor specs={draft.specs} onChange={(specs) => update("specs", specs)} />
          </Panel>

          <Panel title="Search engines" description="How this product appears on Google and when shared.">
            <div className={styles.gridGap4}>
              <TextField
                label="URL handle"
                prefix="/products/"
                prefixVariant="products"
                value={draft.slug}
                error={errors.slug}
                onChange={(event) => {
                  update("slug", slugInput(event.target.value));
                  update("slugTouched", true);
                }}
                hint={!isNew ? "Changing it breaks links people already shared." : undefined}
              />
              <TextField
                label="Page title"
                optional
                value={draft.seoTitle}
                onChange={(event) => update("seoTitle", event.target.value)}
                maxLength={70}
                placeholder={draft.name}
              />
              <TextAreaField
                label="Description"
                optional
                rows={2}
                value={draft.seoDescription}
                onChange={(event) => update("seoDescription", event.target.value)}
                maxLength={160}
                placeholder={draft.summary || draft.description.slice(0, 160)}
              />
            </div>
          </Panel>
        </div>

        <div className={styles.stack6}>
          <Panel title="Status">
            <div className={styles.stack2} role="radiogroup" aria-label="Status">
              {(
                [
                  ["active", "Active", "Visible and buyable in the store."],
                  ["draft", "Draft", "Hidden while you work on it."],
                  ["archived", "Archived", "Off the shop; old links say it's no longer available."],
                ] as const
              ).map(([value, label, text]) => (
                <label
                  key={value}
                  className={`${styles.statusOption} ${draft.status === value ? styles.statusOptionSelected : ""}`}
                >
                  <input
                    type="radio"
                    name="status"
                    checked={draft.status === value}
                    onChange={() => update("status", value)}
                    className={styles.statusRadio}
                  />
                  <span>
                    <span className={styles.statusTitle}>{label}</span>
                    <span className={styles.statusDesc}>{text}</span>
                  </span>
                </label>
              ))}
            </div>
          </Panel>

          <Panel title="Organization">
            <div className={styles.stack5}>
              <SelectField
                label="Category"
                value={draft.categoryId ?? ""}
                onChange={(event) => update("categoryId", event.target.value || null)}
                error={errors.categoryId}
              >
                <option value="">No category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                    {category.visible ? "" : " (hidden)"}
                  </option>
                ))}
              </SelectField>
              {collections.length > 0 && (
                <fieldset>
                  <legend className={styles.fieldsetLegend}>Collections</legend>
                  <div className={styles.stack2}>
                    {collections.map((collection) => (
                      <label key={collection.id} className={styles.collectionCheckRow}>
                        <input
                          type="checkbox"
                          checked={draft.collectionIds.includes(collection.id)}
                          onChange={(event) =>
                            update(
                              "collectionIds",
                              event.target.checked
                                ? [...draft.collectionIds, collection.id]
                                : draft.collectionIds.filter((id) => id !== collection.id),
                            )
                          }
                          className={styles.checkbox}
                        />
                        {collection.name}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
              <TextField
                label="Search keywords"
                optional
                value={draft.tags}
                onChange={(event) => update("tags", event.target.value)}
                hint="Comma-separated words people might search for."
              />
              <Toggle
                checked={draft.featured}
                onChange={(value) => update("featured", value)}
                label="Featured"
                description="Shown first, and in the homepage “featured” row."
              />
            </div>
          </Panel>

          {product && <ProductDangerZone product={product} />}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- pieces */

function CellInput({
  value,
  onChange,
  label,
  widthClass,
  invalid = false,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  widthClass: string;
  invalid?: boolean;
}) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label={label}
      aria-invalid={invalid || undefined}
      inputMode="decimal"
      className={`${styles.cellInput} ${widthClass} ${invalid ? styles.cellInputInvalid : ""}`}
    />
  );
}

function BulkPrice({ currency, onApply }: { currency: string; onApply: (price: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <div className={styles.bulkPriceRow}>
      <TextField
        label="Same price for every variant"
        inputMode="decimal"
        suffix={currency}
        value={value}
        onChange={(event) => setValue(event.target.value.replace(",", ".").replace(/[^\d.]/g, ""))}
        className={styles.maxW56}
      />
      <button type="button" disabled={!value} onClick={() => onApply(value)} className={buttonClass({ variant: "outline", size: "sm", className: styles.bulkApplyBtn })}>
        Apply to all
      </button>
    </div>
  );
}

function OptionsEditor({ options, onChange }: { options: ProductOption[]; onChange: (options: ProductOption[]) => void }) {
  const combos = countCombinations(options);
  return (
    <div className={styles.stack4}>
      {options.map((option, index) => (
        <OptionRow
          key={index}
          option={option}
          onChange={(next) => onChange(options.map((candidate, position) => (position === index ? next : candidate)))}
          onRemove={() => onChange(options.filter((_, position) => position !== index))}
        />
      ))}
      <div className={styles.optionsFooter}>
        {options.length < MAX_OPTIONS && (
          <button
            type="button"
            onClick={() =>
              onChange([
                ...options,
                {
                  name: OPTION_SUGGESTIONS.find((name) => !options.some((option) => option.name === name)) ?? "",
                  values: [],
                },
              ])
            }
            className={buttonClass({ variant: "outline", size: "sm" })}
          >
            <Plus size={16} /> Add an option
          </button>
        )}
        {options.length > 0 && (
          <p className={combos > MAX_VARIANTS ? styles.fieldError : styles.fieldHint}>
            {combos} {combos === 1 ? "variant" : "variants"} · up to {MAX_VARIANTS}
          </p>
        )}
      </div>
    </div>
  );
}

function OptionRow({
  option,
  onChange,
  onRemove,
}: {
  option: ProductOption;
  onChange: (option: ProductOption) => void;
  onRemove: () => void;
}) {
  const [value, setValue] = useState("");
  const swatches = option.values.some((candidate) => candidate.swatch !== null) || /colou?r/i.test(option.name);
  const input = useRef<HTMLInputElement>(null);

  const add = () => {
    const labels = value
      .split(",")
      .map((label) => label.trim())
      .filter(Boolean)
      .filter((label) => !option.values.some((existing) => existing.label.toLowerCase() === label.toLowerCase()));
    if (labels.length === 0) return;
    onChange({
      ...option,
      values: [...option.values, ...labels.map((label) => ({ label, swatch: swatches ? "#cccccc" : null }))],
    });
    setValue("");
    input.current?.focus();
  };

  return (
    <div className={styles.optionRowCard}>
      <div className={styles.optionRowHeader}>
        <GripVertical size={18} className={styles.optionGrip} aria-hidden="true" />
        <TextField
          label="Option name"
          value={option.name}
          list="option-names"
          onChange={(event) => onChange({ ...option, name: event.target.value })}
          className={styles.optionNameField}
          maxLength={30}
        />
        <button type="button" onClick={onRemove} className={buttonClass({ variant: "ghost", size: "sm", className: styles.optionRemoveBtn })}>
          <Trash2 size={15} /> Remove
        </button>
        <datalist id="option-names">
          {OPTION_SUGGESTIONS.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </div>
      <div className={styles.optionValuesRow}>
        {option.values.map((entry, index) => (
          <span key={entry.label} className={styles.optionChip}>
            {swatches && (
              <input
                type="color"
                value={entry.swatch ?? "#cccccc"}
                onChange={(event) =>
                  onChange({
                    ...option,
                    values: option.values.map((candidate, position) =>
                      position === index ? { ...candidate, swatch: event.target.value } : candidate,
                    ),
                  })
                }
                aria-label={`Colour for ${entry.label}`}
                className={styles.swatchPicker}
              />
            )}
            {entry.label}
            <button
              type="button"
              onClick={() => onChange({ ...option, values: option.values.filter((_, position) => position !== index) })}
              className={styles.optionChipRemove}
              aria-label={`Remove ${entry.label}`}
            >
              <X size={14} />
            </button>
          </span>
        ))}
        <span className={styles.optionAddGroup}>
          <input
            ref={input}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                add();
              }
            }}
            placeholder={option.values.length ? "Add another" : "e.g. S, M, L"}
            aria-label={`Add a value to ${option.name || "this option"}`}
            className={styles.optionAddInput}
          />
          <button type="button" onClick={add} className={styles.optionAddBtn} aria-label="Add value">
            <Plus size={16} />
          </button>
        </span>
      </div>
      <label className={styles.optionSwatchToggle}>
        <input
          type="checkbox"
          checked={swatches}
          onChange={(event) =>
            onChange({
              ...option,
              values: option.values.map((candidate) => ({
                ...candidate,
                swatch: event.target.checked ? (candidate.swatch ?? "#cccccc") : null,
              })),
            })
          }
          className={styles.checkboxSmall}
        />
        Show as colour swatches
      </label>
    </div>
  );
}

function SpecsEditor({
  specs,
  onChange,
}: {
  specs: Draft["specs"];
  onChange: (specs: Draft["specs"]) => void;
}) {
  return (
    <div className={styles.stack2}>
      {specs.map((spec, index) => (
        <div key={spec.id} className={styles.specRow}>
          <input
            value={spec.label}
            onChange={(event) => onChange(specs.map((candidate, position) => (position === index ? { ...candidate, label: event.target.value } : candidate)))}
            placeholder="Label, e.g. Material"
            aria-label={`Detail ${index + 1} label`}
            maxLength={40}
            className={styles.specLabelInput}
          />
          <input
            value={spec.value}
            onChange={(event) => onChange(specs.map((candidate, position) => (position === index ? { ...candidate, value: event.target.value } : candidate)))}
            placeholder="Value, e.g. Organic cotton"
            aria-label={`Detail ${index + 1} value`}
            maxLength={200}
            className={styles.specValueInput}
          />
          <button
            type="button"
            onClick={() => onChange(specs.filter((_, position) => position !== index))}
            className={styles.specRemoveBtn}
            aria-label={`Remove detail ${index + 1}`}
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      <div>
        <button
          type="button"
          onClick={() => onChange([...specs, { id: uid(), label: "", value: "" }])}
          className={buttonClass({ variant: "outline", size: "sm" })}
          disabled={specs.length >= 20}
        >
          <Plus size={16} /> Add a detail
        </button>
      </div>
    </div>
  );
}

function ProductDangerZone({ product }: { product: Product }): ReactNode {
  const router = useRouter();
  const toast = useToast();
  return (
    <Panel title="More">
      <div className={styles.dangerZoneList}>
        {product.status === "active" && (
          <Link href={`/products/${product.slug}`} target="_blank" className={buttonClass({ variant: "ghost", size: "sm" })}>
            <ExternalLink size={15} /> View in store
          </Link>
        )}
        <button
          type="button"
          className={buttonClass({ variant: "ghost", size: "sm" })}
          onClick={async () => {
            const result = await duplicateProductAction(product.id);
            if (result.ok) {
              toast("success", "Copy created as a draft");
              router.push(`/admin/products/${result.data.id}`);
            } else toast("danger", result.error);
          }}
        >
          <Copy size={15} /> Duplicate
        </button>
        <ConfirmButton
          variant="ghost"
          size="sm"
          className={styles.dangerTextBtn}
          title={`Delete “${product.name}”?`}
          description={
            <>
              The product and its variants are removed for good. Past orders keep their own copy of what was bought, so your
              records stay intact. To take it off the shop but keep it, set its status to <strong>Archived</strong> instead.
            </>
          }
          confirmLabel="Delete product"
          onConfirm={async () => {
            const result = await deleteProductAction(product.id);
            if (result.ok) {
              toast("success", "Product deleted");
              router.push("/admin/products");
              router.refresh();
            } else toast("danger", result.error);
          }}
        >
          <Trash2 size={15} /> Delete product
        </ConfirmButton>
      </div>
    </Panel>
  );
}
