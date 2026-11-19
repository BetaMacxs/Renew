import type { ReactNode } from "react";
import styles from "./store.module.css";

/**
 * The order summary as a receipt: amounts in a monospace face on dotted
 * leaders, and a torn edge at the bottom. Used at checkout and on the
 * confirmation page, so what a shopper agrees to and what they get back look
 * the same.
 */

export function Receipt({ title, children, footer }: { title: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className={styles.receiptOuter}>
      <div className={`receipt-edge ${styles.receiptCard}`}>
        <p className={`eyebrow ${styles.receiptTitle}`}>{title}</p>
        {children}
        {footer}
      </div>
    </div>
  );
}

export function ReceiptLine({
  label,
  detail,
  amount,
  strong = false,
  muted = false,
}: {
  label: ReactNode;
  detail?: ReactNode;
  amount: ReactNode;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={`${styles.receiptLine} ${strong ? styles.receiptLineStrong : ""} ${
        muted ? styles.receiptLineMuted : ""
      }`.trim()}
    >
      <div className={styles.receiptLineTop}>
        <span className={styles.receiptLineLabel}>{label}</span>
        <span className={styles.receiptDots} aria-hidden="true" />
        <span className="mono">{amount}</span>
      </div>
      {detail && <div className={styles.receiptDetail}>{detail}</div>}
    </div>
  );
}

export function ReceiptRule() {
  return <div className={styles.receiptRule} aria-hidden="true" />;
}
