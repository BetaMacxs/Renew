"use client";

import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  GalleryHorizontalEnd,
  LayoutGrid,
  Megaphone,
  Plus,
  ShoppingBag,
  Sparkles,
  Trash2,
  Truck,
} from "lucide-react";
import Image from "next/image";
import { useState, type CSSProperties, type ReactNode } from "react";
import { buttonClass } from "@/components/ui/button";
import {
  CORNER_STYLES,
  FONT_PAIRINGS,
  type HomepageSection,
  type HomepageSectionType,
  type StoreSettings,
} from "@/lib/domain/settings";
import { ACCENT_PRESETS, accentText, readableOn, themeStyle } from "@/lib/theme";
import { uid } from "@/lib/uid";
import styles from "./admin.module.css";
import { ImagePicker } from "./ImagePicker";
import { errorsUnder, SettingsPanel, useSettingsDraft } from "./settings-kit";
import { Notice, Pill, SelectField, TextAreaField, TextField, Toggle } from "./ui";

type Theme = StoreSettings["theme"];
type GroupingRef = { id: string; name: string; slug: string };

/** Links offered while typing a button's destination. */
export type LinkSuggestion = { href: string; label: string };

function LinkSuggestions({ id, links }: { id: string; links: LinkSuggestion[] }) {
  return (
    <datalist id={id}>
      {links.map((link) => (
        <option key={link.href} value={link.href}>
          {link.label}
        </option>
      ))}
    </datalist>
  );
}

/* ------------------------------------------------------------------ theme */

const PAIRINGS: Record<Theme["fontPairing"], { name: string; text: string }> = {
  signage: { name: "Signage", text: "Geometric sans capitals and display clarity." },
  editorial: { name: "Editorial", text: "High-contrast elegance for flagship releases." },
  friendly: { name: "Friendly", text: "Clean humanist warmth for everyday browsing." },
};

const CORNERS: Record<Theme["corners"], string> = { sharp: "Sharp", soft: "Soft", round: "Round" };

const isHex = (value: string) => /^#[0-9a-fA-F]{6}$/.test(value);

/** A real product of the store, shown in the theme preview. */
export type PreviewProduct = { name: string; price: string; imageUrl: string; discount: number | null };

export function ThemePanel({ storeName, sample }: { storeName: string; sample: PreviewProduct | null }) {
  const form = useSettingsDraft({
    read: (settings) => settings.theme,
    write: (draft) => ({ section: "theme", value: draft }),
    validate: (draft) => (isHex(draft.accent) ? {} : { accent: "Use a 6-digit hex colour like #C41E3A" }),
    saved: "Theme saved",
  });
  const { draft, patch, errors } = form;
  const [hexText, setHexText] = useState(draft.accent);
  const [lastAccent, setLastAccent] = useState(draft.accent);
  if (draft.accent !== lastAccent) {
    setLastAccent(draft.accent);
    setHexText(draft.accent);
  }
  const preset = ACCENT_PRESETS.find((candidate) => candidate.value.toLowerCase() === draft.accent.toLowerCase());
  const previewTheme = isHex(draft.accent) ? draft : { ...draft, accent: "#C41E3A" };

  return (
    <SettingsPanel
      id="theme"
      title="Look"
      description="Colour, type and corners for the whole shop. The dashboard keeps its own type, so it stays familiar."
      dirty={form.dirty}
      busy={form.busy}
      onSave={form.save}
      onReset={form.reset}
      testId="storefront-theme"
    >
      <div className={styles.themeGrid}>
        <div className={styles.stack7}>
          <fieldset>
            <legend className={styles.fieldsetTitle}>Accent colour</legend>
            <div className={styles.swatchRow} role="radiogroup" aria-label="Accent colour">
              {ACCENT_PRESETS.map((option) => {
                const selected = option.value === preset?.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={option.name}
                    title={option.name}
                    onClick={() => patch({ accent: option.value })}
                    className={`${styles.swatchBtn} ${selected ? styles.swatchBtnSelected : ""}`}
                  >
                    <span className={styles.swatchDot} style={{ background: option.value }} />
                  </button>
                );
              })}
              <label className={`${styles.customColorLabel} ${!preset ? styles.customColorLabelSelected : ""}`}>
                <input
                  type="color"
                  value={isHex(draft.accent) ? draft.accent : "#C41E3A"}
                  onChange={(event) => patch({ accent: event.target.value.toUpperCase() })}
                  className={styles.customColorInput}
                  aria-label="Pick a custom colour"
                />
                Custom
              </label>
            </div>
            <TextField
              label="Hex code"
              className={`${styles.mt4} ${styles.maxW40}`}
              value={hexText}
              maxLength={7}
              error={errors.accent}
              onChange={(event) => {
                const value = event.target.value.trim();
                setHexText(value);
                const normalised = value.startsWith("#") ? value : `#${value}`;
                if (isHex(normalised)) patch({ accent: normalised.toUpperCase() });
              }}
              spellCheck={false}
            />
            {isHex(draft.accent) && accentText(draft.accent) !== draft.accent && (
              <p className={styles.fieldHint}>
                Adjusted for contrast: buttons fill with your colour, while links and small text automatically shift so they stay readable.
              </p>
            )}
          </fieldset>

          <fieldset>
            <legend className={styles.fieldsetTitle}>Type</legend>
            <div className={styles.pairingGrid} role="radiogroup" aria-label="Type">
              {FONT_PAIRINGS.map((pairing) => {
                const selected = draft.fontPairing === pairing;
                return (
                  <button
                    key={pairing}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => patch({ fontPairing: pairing })}
                    data-pairing={pairing}
                    style={themeStyle({ ...previewTheme, fontPairing: pairing }) as CSSProperties}
                    className={`${styles.choiceCard} ${selected ? styles.choiceCardSelected : ""}`}
                  >
                    <span className={`display ${styles.pairingSample}`}>New in</span>
                    <span className={styles.pairingName}>{PAIRINGS[pairing].name}</span>
                    <span className={styles.pairingDesc}>{PAIRINGS[pairing].text}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className={styles.fieldsetTitle}>Corners</legend>
            <div className={styles.cornersRow} role="radiogroup" aria-label="Corners">
              {CORNER_STYLES.map((corners) => {
                const selected = draft.corners === corners;
                const radius = corners === "sharp" ? "0" : corners === "soft" ? "8px" : "16px";
                return (
                  <button
                    key={corners}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => patch({ corners })}
                    className={`${styles.cornerBtn} ${selected ? styles.cornerBtnSelected : ""}`}
                  >
                    <span
                      className={styles.cornerSample}
                      style={{ borderRadius: radius, borderEndEndRadius: radius }}
                      aria-hidden
                    />
                    {CORNERS[corners]}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>

        <ThemePreview theme={previewTheme} storeName={storeName} sample={sample} />
      </div>
    </SettingsPanel>
  );
}

function ThemePreview({ theme, storeName, sample }: { theme: Theme; storeName: string; sample: PreviewProduct | null }) {
  return (
    <div>
      <p className={styles.previewLabel}>Preview</p>
      <div
        data-pairing={theme.fontPairing}
        style={themeStyle(theme) as CSSProperties}
        className={styles.previewCard}
        aria-hidden
      >
        <div className={styles.previewHeader}>
          <span className={`display ${styles.previewStoreName}`}>{storeName}</span>
          <ShoppingBag size={16} />
        </div>
        <div className={styles.previewBody}>
          <div className={styles.previewImageBox}>
            {sample ? (
              <Image src={sample.imageUrl} alt="" fill sizes="320px" className={styles.imageCover} />
            ) : (
              <span className={styles.previewPlaceholder}>Product photo</span>
            )}
            {sample?.discount != null && (
              <span
                className={`price ${styles.previewSaleBadge}`}
                style={{ background: theme.accent, color: readableOn(theme.accent) }}
              >
                Save {sample.discount}%
              </span>
            )}
          </div>
          <p className={styles.previewProductName}>{sample?.name ?? "Product name"}</p>
          <p className={`price ${styles.previewProductPrice}`}>{sample?.price ?? "Price"}</p>
          <span className={buttonClass({ full: true, className: styles.mt3 })}>Add to bag</span>
          <p className={styles.previewLinkWrap}>
            <span className={styles.previewLink} style={{ color: accentText(theme.accent) }}>
              Delivery and returns
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- announcement */

export function AnnouncementPanel({ links }: { links: LinkSuggestion[] }) {
  const form = useSettingsDraft({
    read: (settings) => settings.homepage.announcement,
    write: (draft, settings) => ({ section: "homepage", value: { ...settings.homepage, announcement: draft } }),
    validate: (draft) => (draft.enabled && !draft.text.trim() ? { text: "Write the message, or switch the bar off." } : {}),
    saved: "Announcement saved",
  });
  const { draft, patch } = form;
  const errors = { ...errorsUnder(form.errors, "announcement"), ...form.errors };

  return (
    <SettingsPanel
      id="announcement"
      title="Announcement bar"
      description="A thin strip above the header on every page — a delivery promise, a sale, opening hours."
      dirty={form.dirty}
      busy={form.busy}
      onSave={form.save}
      onReset={form.reset}
    >
      <div className={styles.stack5}>
        <Toggle checked={draft.enabled} onChange={(value) => patch({ enabled: value })} label="Show the announcement bar" />
        <div className={styles.grid2Md}>
          <TextField
            label="Message"
            value={draft.text}
            maxLength={140}
            error={errors.text}
            placeholder="Free delivery on orders over R1,000"
            onChange={(event) => patch({ text: event.target.value })}
          />
          <TextField
            label="Link"
            optional
            list="announcement-links"
            value={draft.href}
            error={errors.href}
            placeholder="/collections/gift-guide"
            onChange={(event) => patch({ href: event.target.value })}
            hint="Makes the whole bar a link. A page of your shop, or a full https:// address."
          />
          <LinkSuggestions id="announcement-links" links={links} />
        </div>
      </div>
    </SettingsPanel>
  );
}

/* ------------------------------------------------------------------ hero */

export function HeroPanel({ links }: { links: LinkSuggestion[] }) {
  const form = useSettingsDraft({
    read: (settings) => settings.homepage.hero,
    write: (draft, settings) => ({ section: "homepage", value: { ...settings.homepage, hero: draft } }),
    saved: "Homepage banner saved",
  });
  const { draft, patch } = form;
  const errors = errorsUnder(form.errors, "hero");

  return (
    <SettingsPanel
      id="hero"
      title="Top of the homepage"
      description="The first thing shoppers see: a photo, a headline and up to two buttons."
      dirty={form.dirty}
      busy={form.busy}
      onSave={form.save}
      onReset={form.reset}
      testId="storefront-hero"
    >
      <div className={styles.stack5}>
        <Toggle
          checked={draft.enabled}
          onChange={(value) => patch({ enabled: value })}
          label="Show the photo and headline"
          description="When off, the homepage starts with your sections."
        />
        <div className={styles.grid2Lg}>
          <div className={styles.stack5}>
            <TextField
              label="Small line above the headline"
              optional
              value={draft.eyebrow}
              maxLength={60}
              error={errors.eyebrow}
              placeholder="New this season"
              onChange={(event) => patch({ eyebrow: event.target.value })}
            />
            <TextField
              label="Headline"
              value={draft.heading}
              maxLength={100}
              error={errors.heading}
              onChange={(event) => patch({ heading: event.target.value })}
              data-testid="hero-heading"
            />
            <TextAreaField
              label="Text"
              optional
              rows={3}
              maxLength={240}
              value={draft.text}
              error={errors.text}
              onChange={(event) => patch({ text: event.target.value })}
            />
          </div>
          <ImagePicker
            label="Photo"
            value={draft.imageUrl}
            onChange={(url) => patch({ imageUrl: url })}
            aspect="16/9"
            hint="Landscape, at least 2000 px wide. Without one, the headline stands on its own in large type."
          />
        </div>
        <div className={styles.grid2Md}>
          <TextField
            label="Main button"
            optional
            value={draft.primaryLabel}
            maxLength={40}
            placeholder="Shop now"
            error={errors.primaryLabel}
            onChange={(event) => patch({ primaryLabel: event.target.value })}
          />
          <TextField
            label="Main button goes to"
            optional
            list="hero-links"
            value={draft.primaryHref}
            placeholder="/shop"
            error={errors.primaryHref}
            onChange={(event) => patch({ primaryHref: event.target.value })}
          />
          <TextField
            label="Second button"
            optional
            value={draft.secondaryLabel}
            maxLength={40}
            placeholder="Gift guide"
            error={errors.secondaryLabel}
            onChange={(event) => patch({ secondaryLabel: event.target.value })}
          />
          <TextField
            label="Second button goes to"
            optional
            list="hero-links"
            value={draft.secondaryHref}
            placeholder="/collections/gift-guide"
            error={errors.secondaryHref}
            onChange={(event) => patch({ secondaryHref: event.target.value })}
          />
          <LinkSuggestions id="hero-links" links={links} />
        </div>
      </div>
    </SettingsPanel>
  );
}

/* -------------------------------------------------------------- sections */

const SECTION_TYPES: Record<HomepageSectionType, { name: string; icon: ReactNode; text: string; single: boolean }> = {
  categories: {
    name: "Categories",
    icon: <LayoutGrid size={17} />,
    text: "Your visible categories as a store directory.",
    single: true,
  },
  products: {
    name: "Product row",
    icon: <GalleryHorizontalEnd size={17} />,
    text: "A row of featured, new, on-sale or collection products.",
    single: false,
  },
  banner: {
    name: "Banner",
    icon: <Megaphone size={17} />,
    text: "A wide photo with a message and a button.",
    single: false,
  },
  collections: {
    name: "Collections",
    icon: <Sparkles size={17} />,
    text: "Cards for your visible collections.",
    single: true,
  },
  highlights: {
    name: "Delivery and payment",
    icon: <Truck size={17} />,
    text: "Your delivery, free-delivery and payment promises, taken from Settings.",
    single: true,
  },
};

const SOURCE_LABELS = {
  featured: "Featured products",
  new: "Newest products",
  sale: "On sale",
  collection: "From a collection",
} as const;

function newSection(type: HomepageSectionType, collections: GroupingRef[]): HomepageSection {
  const id = `${type}-${uid().slice(0, 6)}`;
  switch (type) {
    case "categories":
      return { id, type, enabled: true, title: "Shop by category" };
    case "collections":
      return { id, type, enabled: true, title: "Collections" };
    case "highlights":
      return { id, type, enabled: true };
    case "banner":
      return {
        id,
        type,
        enabled: true,
        eyebrow: "",
        heading: "",
        text: "",
        imageUrl: "",
        linkLabel: "",
        linkHref: "",
        align: "start",
      };
    case "products":
      return {
        id,
        type,
        enabled: true,
        title: collections[0] ? collections[0].name : "Featured",
        source: collections[0] ? "collection" : "featured",
        collectionId: collections[0]?.id ?? null,
        limit: 4,
      };
  }
}

function summary(section: HomepageSection, collections: GroupingRef[]): string {
  switch (section.type) {
    case "products": {
      const source =
        section.source === "collection"
          ? `From “${collections.find((collection) => collection.id === section.collectionId)?.name ?? "a deleted collection"}”`
          : SOURCE_LABELS[section.source];
      return `${source} · up to ${section.limit}`;
    }
    case "banner":
      return section.heading || "No headline yet";
    default:
      return SECTION_TYPES[section.type].text;
  }
}

export function SectionsPanel({ collections, links }: { collections: GroupingRef[]; links: LinkSuggestion[] }) {
  const form = useSettingsDraft({
    read: (settings) => settings.homepage.sections,
    write: (draft, settings) => ({ section: "homepage", value: { ...settings.homepage, sections: draft } }),
    validate: (draft) => {
      const problems: Record<string, string> = {};
      draft.forEach((section, index) => {
        if (section.type === "products" && section.source === "collection" && !section.collectionId) {
          problems[`sections.${index}.collectionId`] = "Choose a collection";
        }
        if (section.type === "banner" && !section.heading.trim() && !section.imageUrl) {
          problems[`sections.${index}.heading`] = "Add a headline or a photo";
        }
      });
      return problems;
    },
    saved: "Homepage sections saved",
  });
  const { draft: sections, setDraft } = form;
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const update = (index: number, changes: Partial<HomepageSection>) =>
    setDraft((current) =>
      current.map((section, position) => (position === index ? ({ ...section, ...changes } as HomepageSection) : section)),
    );
  const move = (index: number, delta: number) =>
    setDraft((current) => {
      const next = [...current];
      const [section] = next.splice(index, 1);
      next.splice(index + delta, 0, section);
      return next;
    });

  const available = (Object.keys(SECTION_TYPES) as HomepageSectionType[]).filter(
    (type) => !SECTION_TYPES[type].single || !sections.some((section) => section.type === type),
  );

  return (
    <SettingsPanel
      id="sections"
      title="Homepage sections"
      description="Everything below the top of the homepage, in this order. A section with nothing to show — no products on sale, say — stays hidden."
      dirty={form.dirty}
      busy={form.busy}
      onSave={form.save}
      onReset={form.reset}
      testId="storefront-sections"
    >
      <ol className={styles.stack2}>
        {sections.map((section, index) => {
          const meta = SECTION_TYPES[section.type];
          const expanded = open === section.id;
          const sectionErrors = errorsUnder(form.errors, `sections.${index}`);
          const title = "title" in section && section.title ? section.title : meta.name;
          return (
            <li
              key={section.id}
              className={`${styles.sectionRow} ${Object.keys(sectionErrors).length > 0 ? styles.sectionRowInvalid : ""} ${
                !section.enabled ? styles.sectionRowDisabled : ""
              }`}
            >
              <div className={styles.sectionRowTop}>
                <span className={styles.moveCol}>
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    className={styles.sectionMoveBtn}
                    aria-label={`Move ${title} up`}
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === sections.length - 1}
                    className={styles.sectionMoveBtn}
                    aria-label={`Move ${title} down`}
                  >
                    <ArrowDown size={14} />
                  </button>
                </span>
                <span className={styles.sectionIconBadge}>{meta.icon}</span>
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : section.id)}
                  className={styles.sectionSummaryBtn}
                  aria-expanded={expanded}
                >
                  <span className={styles.sectionSummaryTitleRow}>
                    <span className={styles.sectionSummaryTitle}>{title}</span>
                    {!section.enabled && <Pill tone="muted">Hidden</Pill>}
                  </span>
                  <span className={styles.sectionSummarySub}>{summary(section, collections)}</span>
                </button>
                <label className={styles.sectionDesktopShow}>
                  <input
                    type="checkbox"
                    checked={section.enabled}
                    onChange={(event) => update(index, { enabled: event.target.checked })}
                    className={styles.checkbox}
                  />
                  Show
                </label>
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : section.id)}
                  className={styles.sectionChevronBtn}
                  aria-label={expanded ? `Close ${title}` : `Edit ${title}`}
                >
                  <ChevronDown size={16} className={`${styles.chevron} ${expanded ? styles.chevronOpen : ""}`} />
                </button>
              </div>
              {expanded && (
                <div className={styles.sectionExpandedBody}>
                  <label className={styles.sectionMobileShow}>
                    <input
                      type="checkbox"
                      checked={section.enabled}
                      onChange={(event) => update(index, { enabled: event.target.checked })}
                      className={styles.checkbox}
                    />
                    Show this section
                  </label>
                  <SectionFields
                    section={section}
                    errors={sectionErrors}
                    collections={collections}
                    links={links}
                    onChange={(changes) => update(index, changes)}
                  />
                  <div className={styles.flexEnd}>
                    <button
                      type="button"
                      onClick={() => setDraft((current) => current.filter((_, position) => position !== index))}
                      className={styles.removeActionBtn}
                    >
                      <Trash2 size={14} /> Remove section
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {sections.length === 0 && (
        <Notice tone="info">No sections: the homepage shows only its top banner. Add one below.</Notice>
      )}

      {sections.length < 16 &&
        (adding ? (
          <div className={styles.addSectionBox}>
            <p className={styles.addSectionHeading}>Add a section</p>
            <div className={styles.grid2Sm}>
              {available.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    const section = newSection(type, collections);
                    setDraft((current) => [...current, section]);
                    setOpen(section.id);
                    setAdding(false);
                  }}
                  className={styles.addSectionChoice}
                >
                  <span className={styles.addSectionIcon}>{SECTION_TYPES[type].icon}</span>
                  <span>
                    <span className={styles.addSectionName}>{SECTION_TYPES[type].name}</span>
                    <span className={styles.addSectionDesc}>{SECTION_TYPES[type].text}</span>
                  </span>
                </button>
              ))}
            </div>
            <div className={`${styles.mt2} ${styles.flexEnd}`}>
              <button type="button" onClick={() => setAdding(false)} className={buttonClass({ variant: "ghost", size: "sm" })}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className={buttonClass({ variant: "outline", size: "sm", className: styles.mt4 })}
            data-testid="add-section"
          >
            <Plus size={15} /> Add section
          </button>
        ))}
    </SettingsPanel>
  );
}

function SectionFields({
  section,
  errors,
  collections,
  links,
  onChange,
}: {
  section: HomepageSection;
  errors: Record<string, string>;
  collections: GroupingRef[];
  links: LinkSuggestion[];
  onChange: (changes: Partial<HomepageSection>) => void;
}) {
  const listId = `links-${section.id}`;
  switch (section.type) {
    case "categories":
    case "collections":
      return (
        <TextField
          label="Heading"
          optional
          value={section.title}
          maxLength={80}
          error={errors.title}
          onChange={(event) => onChange({ title: event.target.value })}
        />
      );
    case "highlights":
      return (
        <p className={styles.mutedText}>
          Nothing to write here: this section reads your delivery options, free-delivery amount and payment methods from
          Settings, so it is always accurate.
        </p>
      );
    case "products":
      return (
        <div className={styles.grid2Md}>
          <TextField
            label="Heading"
            optional
            value={section.title}
            maxLength={80}
            error={errors.title}
            onChange={(event) => onChange({ title: event.target.value })}
          />
          <SelectField
            label="Show"
            value={section.source}
            onChange={(event) => {
              const source = event.target.value as (typeof section)["source"];
              onChange({
                source,
                collectionId: source === "collection" ? (section.collectionId ?? collections[0]?.id ?? null) : section.collectionId,
              });
            }}
          >
            {(Object.keys(SOURCE_LABELS) as (keyof typeof SOURCE_LABELS)[]).map((source) => (
              <option key={source} value={source} disabled={source === "collection" && collections.length === 0}>
                {SOURCE_LABELS[source]}
              </option>
            ))}
          </SelectField>
          {section.source === "collection" && (
            <SelectField
              label="Collection"
              value={section.collectionId ?? ""}
              error={errors.collectionId}
              onChange={(event) => onChange({ collectionId: event.target.value || null })}
            >
              <option value="">Choose…</option>
              {collections.map((collection) => (
                <option key={collection.id} value={collection.id}>
                  {collection.name}
                </option>
              ))}
            </SelectField>
          )}
          <SelectField
            label="How many"
            value={String(section.limit)}
            onChange={(event) => onChange({ limit: Number(event.target.value) })}
          >
            {[2, 3, 4, 6, 8, 10, 12].map((count) => (
              <option key={count} value={count}>
                Up to {count}
              </option>
            ))}
          </SelectField>
          {section.source === "featured" && (
            <p className={`${styles.fieldHint} ${styles.mdColSpan2}`}>
              Mark products as featured in their editor. Until you do, this row picks from across the shop, newest first.
            </p>
          )}
        </div>
      );
    case "banner":
      return (
        <div className={styles.grid2LgGap4}>
          <div className={styles.stack4}>
            <TextField
              label="Small line"
              optional
              value={section.eyebrow}
              maxLength={60}
              onChange={(event) => onChange({ eyebrow: event.target.value })}
            />
            <TextField
              label="Headline"
              value={section.heading}
              maxLength={100}
              error={errors.heading}
              onChange={(event) => onChange({ heading: event.target.value })}
            />
            <TextAreaField
              label="Text"
              optional
              rows={2}
              maxLength={240}
              value={section.text}
              onChange={(event) => onChange({ text: event.target.value })}
            />
            <div className={styles.grid2Sm}>
              <TextField
                label="Button"
                optional
                value={section.linkLabel}
                maxLength={40}
                onChange={(event) => onChange({ linkLabel: event.target.value })}
              />
              <TextField
                label="Button goes to"
                optional
                list={listId}
                value={section.linkHref}
                error={errors.linkHref}
                placeholder="/collections/…"
                onChange={(event) => onChange({ linkHref: event.target.value })}
              />
              <LinkSuggestions id={listId} links={links} />
            </div>
          </div>
          <div className={styles.stack4}>
            <ImagePicker
              label="Photo"
              value={section.imageUrl}
              onChange={(url) => onChange({ imageUrl: url })}
              aspect="2/1"
              hint="Wide, at least 2000 px."
            />
            <SelectField
              label="Text card"
              value={section.align}
              onChange={(event) => onChange({ align: event.target.value as "start" | "end" })}
            >
              <option value="start">On the left</option>
              <option value="end">On the right</option>
            </SelectField>
          </div>
        </div>
      );
  }
}
