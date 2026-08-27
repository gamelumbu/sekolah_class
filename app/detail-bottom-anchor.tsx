"use client";

import { useEffect } from "react";

const ANCHOR_ID = "dashboard-enhancer-slot";

export default function DetailBottomAnchor() {
  useEffect(() => {
    const ensureAnchor = () => {
      const body = document.querySelector<HTMLElement>(".dashboard-body");
      if (!body) return;

      let anchor = document.getElementById(ANCHOR_ID);
      if (!anchor) {
        anchor = document.createElement("div");
        anchor.id = ANCHOR_ID;
        anchor.style.display = "grid";
        anchor.style.gap = "18px";
        anchor.style.marginTop = "18px";
      }

      const detail = body.querySelector<HTMLElement>(".detail-section");
      if (detail?.parentElement) {
        if (anchor.parentElement !== detail.parentElement || anchor.nextElementSibling !== detail) {
          detail.parentElement.insertBefore(anchor, detail);
        }
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
