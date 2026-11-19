import { Mail, MapPin, Phone } from "lucide-react";
import Link from "next/link";
import {
  FacebookIcon,
  InstagramIcon,
  PinterestIcon,
  TikTokIcon,
  WhatsAppIcon,
  XIcon,
  YouTubeIcon,
} from "@/components/icons/brands";
import { formatInternational } from "@/lib/domain/phone";
import { enabledCheckoutMethods, isWhatsAppConfigured, type StoreSettings } from "@/lib/domain/settings";
import type { Category } from "@/lib/domain/types";
import type { Dictionary } from "@/lib/i18n";
import { Wordmark } from "./Header";
import styles from "./store.module.css";

const SOCIAL = [
  { key: "instagram", label: "Instagram", Icon: InstagramIcon },
  { key: "facebook", label: "Facebook", Icon: FacebookIcon },
  { key: "tiktok", label: "TikTok", Icon: TikTokIcon },
  { key: "youtube", label: "YouTube", Icon: YouTubeIcon },
  { key: "x", label: "X", Icon: XIcon },
  { key: "pinterest", label: "Pinterest", Icon: PinterestIcon },
] as const;

export function Footer({
  settings,
  categories,
  t,
  hasDemoContent,
}: {
  settings: StoreSettings;
  categories: Category[];
  t: Dictionary;
  hasDemoContent: boolean;
}) {
  const { contact } = settings;
  const socials = SOCIAL.filter((entry) => settings.social[entry.key]);
  const methods = enabledCheckoutMethods(settings).map((method) =>
    method === "cod" ? t.highlights.cod : method === "bank_transfer" ? t.highlights.bank : t.highlights.whatsapp,
  );
  const help = [
    { href: "/pages/about", label: t.footer.about, show: Boolean(settings.policies.about) },
    { href: "/pages/shipping", label: t.footer.shipping, show: true },
    { href: "/pages/returns", label: t.footer.returns, show: true },
    { href: "/pages/privacy", label: t.footer.privacy, show: true },
    { href: "/pages/contact", label: t.footer.contact, show: true },
  ].filter((link) => link.show);

  return (
    <footer className={styles.footer}>
      <div className={styles.footerGrid}>
        <div className={styles.footerBrand}>
          <Wordmark settings={settings} />
          {(settings.store.tagline || settings.store.description) && (
            <p className={styles.footerTagline}>
              {settings.store.tagline || settings.store.description}
            </p>
          )}
          {socials.length > 0 && (
            <div className={styles.footerFollow}>
              <p className="eyebrow">{t.footer.follow}</p>
              <ul className={styles.footerSocialList}>
                {socials.map(({ key, label, Icon }) => (
                  <li key={key}>
                    <a
                      href={settings.social[key]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.footerSocialLink}
                      aria-label={label}
                    >
                      <Icon size={18} />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <nav aria-label={t.footer.shop}>
          <p className="eyebrow">{t.footer.shop}</p>
          <ul className={styles.footerLinksList}>
            <li>
              <Link href="/shop" className={styles.footerLink}>
                {t.nav.allProducts}
              </Link>
            </li>
            {categories.map((category) => (
              <li key={category.id}>
                <Link href={`/categories/${category.slug}`} className={styles.footerLink}>
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label={t.footer.help}>
          <p className="eyebrow">{t.footer.help}</p>
          <ul className={styles.footerLinksList}>
            {help.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className={styles.footerLink}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <p className="eyebrow">{t.footer.contact}</p>
          <ul className={styles.footerContactList}>
            {isWhatsAppConfigured(settings) && (
              <li className={styles.footerContactItem}>
                <WhatsAppIcon size={16} />
                <a href={`https://wa.me/${contact.whatsapp}`} className={styles.footerLink} dir="ltr">
                  {formatInternational(contact.whatsapp)}
                </a>
              </li>
            )}
            {contact.phone && (
              <li className={styles.footerContactItem}>
                <Phone size={16} />
                <a href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`} className={styles.footerLink} dir="ltr">
                  {contact.phone}
                </a>
              </li>
            )}
            {contact.email && (
              <li className={styles.footerContactItem}>
                <Mail size={16} />
                <a href={`mailto:${contact.email}`} className={styles.footerLink}>
                  {contact.email}
                </a>
              </li>
            )}
            {contact.address && (
              <li className={styles.footerContactAddress}>
                <MapPin size={16} className={styles.footerPinIcon} />
                <span>{contact.address}</span>
              </li>
            )}
            {contact.hours && <li className={styles.footerHours}>{contact.hours}</li>}
          </ul>
          {methods.length > 0 && (
            <div className={styles.footerPayments}>
              <p className="eyebrow">{t.footer.paymentsTitle}</p>
              <p className={styles.footerPaymentsText}>{methods.join(" · ")}</p>
            </div>
          )}
        </div>
      </div>
      <div className={styles.footerBottom}>
        <div className={styles.footerBottomInner}>
          <p>{t.footer.rights(new Date().getFullYear(), settings.store.name)}</p>
          {hasDemoContent && (
            <p className={styles.footerDemoWrap}>
              <span className={styles.footerDemoPill}>{t.common.demoStore}</span>
            </p>
          )}
        </div>
      </div>
    </footer>
  );
}
