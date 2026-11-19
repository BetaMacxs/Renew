"use client";

import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import styles from "./store.module.css";

export type DirectoryEntry = {
  href: string;
  name: string;
  countLabel: string;
  imageUrl: string | null;
};

/**
 * The store directory: departments listed like the board by a shop's
 * entrance, in large signage type with a live item count. On wide screens
 * the photo of whichever department is under the pointer fills the panel
 * beside the list; on phones each row carries its own thumbnail.
 */
export function Directory({ entries }: { entries: DirectoryEntry[] }) {
  const [active, setActive] = useState(0);
  const withImages = entries.some((entry) => entry.imageUrl);

  return (
    <div className={`${styles.directoryGrid} ${withImages ? styles.directoryGridWithImages : ""}`.trim()}>
      <ul className={styles.directoryList} onMouseLeave={() => setActive((current) => current)}>
        {entries.map((entry, index) => (
          <li key={entry.href}>
            <Link
              href={entry.href}
              onMouseEnter={() => setActive(index)}
              onFocus={() => setActive(index)}
              className={styles.directoryRow}
            >
              {entry.imageUrl && (
                <span className={styles.directoryThumb}>
                  <Image src={entry.imageUrl} alt="" fill sizes="80px" className={styles.imgCover} />
                </span>
              )}
              <span className={`display ${styles.directoryName}`}>
                {entry.name}
              </span>
              <span className={`price ${styles.directoryCount}`}>{entry.countLabel}</span>
              <span className={styles.directoryArrow}>
                <ArrowRight size={18} className="flip-rtl" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {withImages && (
        <div className={styles.directoryPreview}>
          {entries.map((entry, index) =>
            entry.imageUrl ? (
              <Image
                key={entry.href}
                src={entry.imageUrl}
                alt=""
                fill
                sizes="28rem"
                className={`${styles.directoryPreviewImg} ${index === active ? styles.directoryPreviewImgActive : ""}`.trim()}
              />
            ) : null,
          )}
          <span className={`display ${styles.directoryPreviewLabel}`}>
            {entries[active]?.name}
          </span>
        </div>
      )}
    </div>
  );
}
