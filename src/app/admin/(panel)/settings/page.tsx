import type { Metadata } from "next";
import styles from "@/components/admin/admin.module.css";
import {
  AccountPanel,
  CheckoutPanel,
  ContactPanel,
  DeliveryPanel,
  DemoPanel,
  PoliciesPanel,
  SocialPanel,
  StorePanel,
} from "@/components/admin/SettingsForms";
import { SettingsProvider } from "@/components/admin/settings-kit";
import { PageHeader } from "@/components/admin/ui";
import { detectDemoSettings } from "@/lib/demo/seed";
import { requireAdmin } from "@/server/admin";
import { getBackend } from "@/server/backend";

export const metadata: Metadata = { title: "Settings" };

const SECTIONS = [
  { id: "store", label: "Store" },
  { id: "contact", label: "Contact and WhatsApp" },
  { id: "checkout", label: "Checkout and payment" },
  { id: "delivery", label: "Delivery" },
  { id: "pages", label: "Pages" },
  { id: "social", label: "Social links" },
  { id: "demo", label: "Demo content" },
  { id: "account", label: "Your account" },
];

export default async function SettingsPage() {
  const admin = await requireAdmin();
  const [settings, catalog] = await Promise.all([admin.loadSettings(), admin.loadCatalog()]);
  const counts = {
    products: catalog.products.filter((product) => product.isDemo).length,
    categories: catalog.categories.filter((category) => category.isDemo).length,
    collections: catalog.collections.filter((collection) => collection.isDemo).length,
  };
  const demoSettingsHits = detectDemoSettings(settings);

  return (
    <>
      <PageHeader title="Settings" description="Each panel saves on its own. Changes are live in the shop as soon as you save." />
      <div className={styles.settingsGrid}>
        <nav aria-label="Settings sections" className={styles.settingsNav}>
          <ul className={styles.settingsNavList}>
            {SECTIONS.filter((section) => !admin.preview || section.id !== "account").map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`} className={styles.settingsNavLink}>
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <SettingsProvider initial={settings}>
          <div className={styles.settingsContent}>
            <StorePanel />
            <ContactPanel />
            <CheckoutPanel />
            <DeliveryPanel />
            <PoliciesPanel />
            <SocialPanel />
            <DemoPanel counts={counts} demoSettingsHits={demoSettingsHits} preview={admin.preview} />
            {!admin.preview && <AccountPanel email={admin.user.email} backend={getBackend().kind} />}
          </div>
        </SettingsProvider>
      </div>
    </>
  );
}
