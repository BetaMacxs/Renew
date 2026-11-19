"use client";

import { ImagePlus, LoaderCircle, Trash2 } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import { uploadImage } from "@/lib/image-upload";
import styles from "./admin.module.css";
import { useToast } from "./ui";

type AspectOption = "4/5" | "3/1" | "16/9" | "2/1" | "3/2";

const ASPECT_CLASS: Record<AspectOption, string> = {
  "4/5": styles.aspect4x5,
  "3/1": styles.aspect3x1,
  "16/9": styles.aspect16x9,
  "2/1": styles.aspect2x1,
  "3/2": styles.aspect3x2,
};

/**
 * A single image (logo, category photo, hero, banner): upload or replace,
 * preview, remove.
 */
export function ImagePicker({
  label,
  value,
  onChange,
  aspect = "4/5",
  hint,
  fit = "cover",
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  aspect?: AspectOption;
  hint?: string;
  fit?: "cover" | "contain";
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const uploaded = await uploadImage(file);
      onChange(uploaded.url);
    } catch (error) {
      toast("danger", error instanceof Error ? error.message : "The upload failed.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div>
      <p className={styles.pickerLabel}>{label}</p>
      <div
        className={`${styles.pickerBox} ${ASPECT_CLASS[aspect]}`}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          void pick(event.dataTransfer.files[0]);
        }}
      >
        {value ? (
          <Image src={value} alt="" fill sizes="320px" className={fit === "contain" ? styles.pickerContain : styles.pickerCover} />
        ) : (
          <button type="button" onClick={() => input.current?.click()} className={styles.pickerUploadBtn}>
            <ImagePlus size={22} />
            Upload a photo
          </button>
        )}
        {busy && (
          <span className={styles.pickerBusyOverlay}>
            <LoaderCircle size={22} className="animate-spin" />
          </span>
        )}
      </div>
      <div className={styles.pickerActions}>
        {value && (
          <>
            <button type="button" onClick={() => input.current?.click()} className={styles.pickerReplaceBtn}>
              Replace
            </button>
            <button type="button" onClick={() => onChange("")} className={styles.pickerRemoveBtn}>
              <Trash2 size={14} /> Remove
            </button>
          </>
        )}
        {hint && <span className={styles.fieldHint}>{hint}</span>}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className={styles.hiddenInput}
        onChange={(event) => void pick(event.target.files?.[0])}
      />
    </div>
  );
}
