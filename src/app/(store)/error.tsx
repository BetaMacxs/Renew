"use client";

import { useEffect } from "react";
import { buttonClass } from "@/components/ui/button";
import { useStore } from "@/components/store/StoreProvider";
import styles from "@/components/store/store.module.css";

export default function StoreError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useStore();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className={styles.errorWrap}>
      <h1 className={`display ${styles.errorTitle}`}>{t.error.title}</h1>
      <p className={styles.errorText}>{t.error.text}</p>
      <button type="button" onClick={reset} className={buttonClass({ variant: "dark", className: styles.errorBtn })}>
        {t.common.retry}
      </button>
    </div>
  );
}
