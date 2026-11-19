import { Clock, Mail, MapPin, Phone } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WhatsAppIcon } from "@/components/icons/brands";
import { Container } from "@/components/store/HomeSections";
import { RichText } from "@/components/store/RichText";
import styles from "@/components/store/store.module.css";
import { formatInternational } from "@/lib/domain/phone";
import { isWhatsAppConfigured } from "@/lib/domain/settings";
import { getDictionary } from "@/lib/i18n";
import { getStorefront } from "@/server/storefront";

/**
 * About, delivery, returns, privacy and contact — written by the owner in
 * Settings → Policies, so none of them needs a code change.
 */

const PAGES = ["about", "shipping", "returns", "privacy", "contact"] as const;
type PageSlug = (typeof PAGES)[number];

type Props = { params: Promise<{ slug: string }> };

function isPage(slug: string): slug is PageSlug {
  return (PAGES as readonly string[]).includes(slug);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!isPage(slug)) return {};
  const { settings } = await getStorefront();
  return { title: getDictionary(settings.store.language).pages[slug] };
}

export default async function InfoPage({ params }: Props) {
  const { slug } = await params;
  if (!isPage(slug)) notFound();
  const { settings } = await getStorefront();
  const t = getDictionary(settings.store.language);
  const { contact } = settings;

  if (slug === "contact") {
    const rows = [
      isWhatsAppConfigured(settings) && {
        icon: <WhatsAppIcon size={18} />,
        label: t.pages.whatsapp,
        value: (
          <a href={`https://wa.me/${contact.whatsapp}`} target="_blank" rel="noopener noreferrer" className={styles.infoLink} dir="ltr">
            {formatInternational(contact.whatsapp)}
          </a>
        ),
      },
      contact.phone && {
        icon: <Phone size={18} />,
        label: t.pages.phone,
        value: (
          <a href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`} className={styles.infoLink} dir="ltr">
            {contact.phone}
          </a>
        ),
      },
      contact.email && {
        icon: <Mail size={18} />,
        label: t.pages.email,
        value: (
          <a href={`mailto:${contact.email}`} className={styles.infoLink}>
            {contact.email}
          </a>
        ),
      },
      contact.address && { icon: <MapPin size={18} />, label: t.pages.address, value: contact.address },
      contact.hours && { icon: <Clock size={18} />, label: t.pages.hours, value: contact.hours },
    ].filter(Boolean) as { icon: React.ReactNode; label: string; value: React.ReactNode }[];

    return (
      <Container className={styles.infoContainer}>
        <h1 className={`display ${styles.infoTitle}`}>{t.pages.contact}</h1>
        <p className={styles.infoIntro}>{t.pages.contactIntro}</p>
        <dl className={styles.infoContactList}>
          {rows.map((row) => (
            <div key={row.label} className={styles.infoContactRow}>
              <span className={styles.infoContactIcon}>{row.icon}</span>
              <div>
                <dt className="eyebrow">{row.label}</dt>
                <dd className={styles.infoContactValue}>{row.value}</dd>
              </div>
            </div>
          ))}
        </dl>
      </Container>
    );
  }

  const text = settings.policies[slug];
  return (
    <Container className={styles.infoContainer}>
      <h1 className={`display ${styles.infoTitle}`}>{t.pages[slug]}</h1>
      <div className={styles.infoPolicyBody}>
        {text ? <RichText text={text} /> : <p className={styles.infoEmptyPolicy}>{t.pages.emptyPolicy}</p>}
      </div>
    </Container>
  );
}
