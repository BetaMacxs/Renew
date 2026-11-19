"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { WhatsAppIcon } from "@/components/icons/brands";
import { buttonClass } from "@/components/ui/button";
import { useStore } from "./StoreProvider";
import styles from "./store.module.css";

/**
 * The last step of a WhatsApp checkout. The order is only *prepared* at this
 * point; it exists as an order request only once the shopper sends this
 * message and the store confirms it. Tapping the button records that WhatsApp
 * was opened — which the dashboard still shows as unverified.
 */
export function WhatsAppHandoff({
  url,
  message,
  orderId,
  accessKey,
}: {
  /** `null` when the store has no WhatsApp number: demo preview only. */
  url: string | null;
  message: string;
  orderId: string;
  accessKey: string;
}) {
  const { t } = useStore();
  const [copied, setCopied] = useState(false);

  const recordOpened = () => {
    const body = JSON.stringify({ key: accessKey });
    const endpoint = `/api/orders/${orderId}/whatsapp-opened`;
    if (!navigator.sendBeacon?.(endpoint, new Blob([body], { type: "application/json" }))) {
      void fetch(endpoint, { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true });
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the message is still selectable on screen.
    }
  };

  return (
    <div>
      {/* The message, as it will appear in the chat. */}
      <div className={styles.waPreviewBox}>
        <div className={styles.waBubble}>
          <pre className={styles.waPre} data-testid="whatsapp-message">
            {message}
          </pre>
        </div>
      </div>

      <div className={styles.waActions}>
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={recordOpened}
            className={buttonClass({ variant: "whatsapp", size: "lg", className: styles.waOpenBtn })}
            data-testid="open-whatsapp"
          >
            <WhatsAppIcon size={20} />
            {t.order.openWhatsApp}
          </a>
        ) : null}
        <button type="button" onClick={copy} className={buttonClass({ variant: "outline", size: "lg" })}>
          {copied ? <Check size={18} /> : <Copy size={18} />}
          {copied ? t.order.copied : t.order.copyMessage}
        </button>
      </div>
      {url && <p className={styles.waHint}>{t.order.whatsappSentHint}</p>}
    </div>
  );
}
