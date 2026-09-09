"use client";

import { useState } from "react";
import styles from "./admin.module.css";

type CopyButtonProps = {
  value: string;
  label?: string;
};

/** Copies a handover snippet to the clipboard, with a short confirmation. */
export default function CopyButton({ value, label = "Copy" }: CopyButtonProps) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
    } catch {
      setState("failed");
    }
    setTimeout(() => setState("idle"), 2000);
  }

  return (
    <button type="button" className={styles.copyButton} onClick={handleCopy}>
      {state === "copied"
        ? "Copied"
        : state === "failed"
          ? "Select and copy manually"
          : label}
    </button>
  );
}
