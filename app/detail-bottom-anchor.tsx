"use client";

import { useEffect } from "react";

const ANCHOR_ID = "dashboard-enhancer-slot";

function findDetailSection(body: HTMLElement) {
  const candidates = Array.from(body.querySelectorAll<HTMLElement>("section,div"));
  return candidates.find((element) => {
    const text = element.textContent || "";
    return text.includes("Detail terpilih") && text.includes("Data Karyawan Sesuai Pilihan Chart");
  }) || null;
}

export default function DetailBottomAnchor() {
  useEffect(() => {
    const ensureAnchor = () => {
      const body = document.querySelector<HTMLElement>(".dashboard-body");
      if (!body) return;

      let anchor = document.getElementById(ANCHOR_ID);
      if (!anchor) {
        anchor = document.createElement("div");
        anchor.id = ANCHOR_ID;
        anchor.style.display = "contents";
      }

      const detail = findDetailSection(body);
      if (detail?.parentElement) {
        detail.parentElement.insertBefore(anchor, detail);
      } else if (!anchor.parentElement) {
        body.appendChild(anchor);
      }
    };

    ensureAnchor();
    const observer = new MutationObserver(ensureAnchor);
    observer.observe(document.body, { subtree: true, childList: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
