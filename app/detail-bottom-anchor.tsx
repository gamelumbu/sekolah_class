"use client";

import { useEffect } from "react";

export default function DetailBottomAnchor() {
  useEffect(() => {
    let arranging = false;
    const keepDetailLast = () => {
      if (arranging) return;
      const body = document.querySelector<HTMLElement>(".dashboard-body");
      const detail = body?.querySelector<HTMLElement>(".detail-section");
      if (!body || !detail || detail.parentElement !== body) return;

      arranging = true;
      try {
        while (detail.nextSibling) body.insertBefore(detail.nextSibling, detail);
      } finally {
        arranging = false;
      }
    };

    keepDetailLast();
    const observer = new MutationObserver(keepDetailLast);
    observer.observe(document.body, { subtree: true, childList: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
