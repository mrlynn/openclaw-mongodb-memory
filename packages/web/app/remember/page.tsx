"use client";

import { Download } from "lucide-react";
import { RememberForm } from "@/components/remember/RememberForm";
import styles from "./page.module.css";

export default function RememberPage() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Download size={24} className={styles.headerIcon} />
        <h2 className={styles.title}>Remember</h2>
      </div>
      <p className={styles.description}>
        Store a new memory. It will be embedded and indexed for semantic search.
      </p>
      <div className={styles.formWrap}>
        <RememberForm />
      </div>
    </div>
  );
}
