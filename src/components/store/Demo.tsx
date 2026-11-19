import { Info } from "lucide-react";
import { DemoExploreLink } from "./DemoExploreLink";
import styles from "./store.module.css";
import type { Dictionary } from "@/lib/i18n";

/**
 * Shown only in public demo mode (PUBLIC_DEMO_MODE): a band above the shop
 * that says what it is and opens the dashboard preview, and a note where a
 * shopper might otherwise think an order is real.
 */

export function DemoBar({ storeName, t }: { storeName: string; t: Dictionary }) {
  return (
    <div className={styles.demoBar} data-testid="demo-bar">
      <p className={styles.demoBarText}>
        <span>{t.demo.bar(storeName)}</span>
        <DemoExploreLink className={styles.demoExploreLink}>
          {t.demo.explore}
          <span aria-hidden="true" className={`flip-rtl ${styles.demoExploreArrow}`}>
            →
          </span>
        </DemoExploreLink>
      </p>
    </div>
  );
}

export function DemoNotice({ children }: { children: string }) {
  return (
    <p className={styles.demoNotice} data-testid="demo-notice">
      <Info size={17} className={styles.demoNoticeIcon} />
      {children}
    </p>
  );
}
