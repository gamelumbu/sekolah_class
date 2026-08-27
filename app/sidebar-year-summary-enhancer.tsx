"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { Teacher } from "./dashboard-client";

function formatNumber(value: number) {
  return new Intl.NumberFormat("id-ID").format(value);
}

function findYearControl() {
  return [...document.querySelectorAll<HTMLElement>(".filter-control")].find((control) => control.querySelector(":scope > span")?.textContent?.trim() === "Tahun Pelajaran") || null;
}

export default function SidebarYearSummaryEnhancer({ teachers }: { teachers: Teacher[] }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [selectedYears, setSelectedYears] = useState<string[]>([]);

  useEffect(() => {
    const sync = () => {
      setTarget(document.querySelector<HTMLElement>(".sidebar-footer"));
      const control = findYearControl();
      if (!control) return;
      const selected = [...control.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:checked')]
        .map((input) => input.closest("label")?.querySelector("span")?.textContent?.trim() || "")
        .filter(Boolean);
      setSelectedYears(selected);
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["checked"] });
    document.addEventListener("change", sync, true);
    return () => {
      observer.disconnect();
      document.removeEventListener("change", sync, true);
    };
  }, []);

  const availableYears = useMemo(() => [...new Set(teachers.map((teacher) => teacher.year).filter(Boolean))].sort(), [teachers]);
  const effectiveYears = selectedYears.length ? selectedYears : availableYears;
  const matchingRows = useMemo(() => teachers.filter((teacher) => effectiveYears.includes(teacher.year)), [effectiveYears, teachers]);

  const title = selectedYears.length === 1
    ? selectedYears[0]
    : selectedYears.length > 1
      ? `${selectedYears.length} Tahun Dipilih`
      : availableYears.length === 1
        ? availableYears[0]
        : "Semua Tahun Pelajaran";

  const helper = selectedYears.length <= 1 && availableYears.length <= 1
    ? `${formatNumber(matchingRows.length)} tenaga pendidik`
    : selectedYears.length === 1
      ? `${formatNumber(matchingRows.length)} tenaga pendidik`
      : `${availableYears.length} tahun pelajaran tersedia`;

  if (!target) return null;

  return createPortal(
    <>
      <style>{`
        .sidebar-footer > p, .sidebar-footer > strong, .sidebar-footer > span { display: none !important; }
        .sidebar-footer { position: relative; overflow: hidden; min-height: 112px; padding: 16px 86px 16px 16px; background: linear-gradient(145deg, rgba(255,255,255,.08), rgba(255,255,255,.045)); }
        .sidebar-year-summary { position: relative; z-index: 2; min-width: 0; }
        .sidebar-year-summary p { margin: 0 0 6px; color: rgba(255,255,255,.54); font-size: 9px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
        .sidebar-year-summary strong { display: block; color: var(--gold-500); font-size: 16px; line-height: 1.2; }
        .sidebar-year-summary span { display: block; margin-top: 6px; color: rgba(255,255,255,.66); font-size: 10.5px; line-height: 1.35; }
        .sidebar-year-mascot { position: absolute; z-index: 1; right: -8px; bottom: -6px; width: 92px; height: 92px; object-fit: contain; opacity: .92; filter: drop-shadow(0 6px 10px rgba(0,0,0,.22)); pointer-events: none; }
        @media (max-height: 760px) { .sidebar-year-mascot { width: 76px; height: 76px; } .sidebar-footer { min-height: 98px; padding-right: 70px; } }
      `}</style>
      <div className="sidebar-year-summary">
        <p>Data Tahun Pelajaran</p>
        <strong>{title}</strong>
        <span>{helper}</span>
      </div>
      <img className="sidebar-year-mascot" src="/penabur-mascot-sidebar.svg" alt="" aria-hidden="true" />
    </>,
    target
  );
}
