import Link from "next/link";
import type { ReactNode } from "react";
import styles from "@/components/admin/admin.module.css";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.authWrap}>
      <div className={styles.authInner}>
        {children}
        <p className={styles.authBackWrap}>
          <Link href="/" className={styles.authBackLink}>
            ← Back to the store
          </Link>
        </p>
      </div>
    </div>
  );
}
