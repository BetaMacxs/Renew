import { discountPercent, formatMoney, type MoneyFormat } from "@/lib/domain/money";
import styles from "./store.module.css";

/**
 * A price, optionally with the "was" price struck through. The struck price
 * is only shown when it is a genuine discount.
 */
export function Price({
  amount,
  compareAt,
  money,
  from,
  wasLabel,
  className = "",
  size = "md",
}: {
  amount: number;
  compareAt?: number | null;
  money: MoneyFormat;
  /** Prefix such as "From $89" when variants differ. */
  from?: (price: string) => string;
  wasLabel?: (price: string) => string;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const discounted = discountPercent(amount, compareAt) !== null;
  const now = formatMoney(amount, money);
  const sizeClass =
    size === "sm" ? styles.priceAmountSm : size === "lg" ? styles.priceAmountLg : styles.priceAmountMd;
  return (
    <span className={`${styles.priceWrap} ${className}`.trim()}>
      <span className={`price ${styles.priceAmount} ${sizeClass} ${discounted ? styles.priceAmountDiscount : ""}`.trim()}>
        {from ? from(now) : now}
      </span>
      {discounted && compareAt != null && (
        <s className={`price ${styles.priceCompare} ${size === "lg" ? styles.priceCompareLg : ""}`.trim()}>
          <span className="sr-only">{wasLabel ? wasLabel(formatMoney(compareAt, money)) : ""}</span>
          <span aria-hidden={wasLabel ? true : undefined}>{formatMoney(compareAt, money)}</span>
        </s>
      )}
    </span>
  );
}
