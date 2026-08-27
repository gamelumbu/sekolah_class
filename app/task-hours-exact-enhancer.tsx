"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { Teacher } from "./dashboard-client";
import styles from "./task-hours-exact.module.css";

type TaskTab = "Umum" | "Wakasek" | "BK" | "Kasek" | "";

type Filters = {
  year: string[];
  groupJenjang: string[];
  jenjang: string[];
  program: string[];
  teacherCategory: string[];
  school: string[];
  status: string[];
  individual: string[];
  standardMode: string;
  tab: TaskTab;
  visible: boolean;
};

const EMPTY: Filters = { year: [], groupJenjang: [], jenjang: [], program: [], teacherCategory: [], school: [], status: [], individual: [], standardMode: "Gabungan", tab: "", visible: false };

function readControl(label: string) {
  const controls = Array.from(document.querySelectorAll<HTMLElement>(".filter-control"));
  const control = controls.find((item) => item.querySelector(":scope > span")?.textContent?.trim() === label);
  if (!control) return [];
  return Array.from(control.querySelectorAll<HTMLInputElement>('.multi-options input[type="checkbox"]:checked'))
    .map((input) => input.closest("label")?.querySelector("span")?.textContent?.trim() || "")
    .filter(Boolean);
}

function readState(): Filters {
  const pageTitle = document.querySelector(".topbar h1")?.textContent?.trim() || "";
  const activeTabs = Array.from(document.querySelectorAll<HTMLButtonElement>(".tab-row button.active")).map((button) => button.textContent?.trim() || "");
  const tab = (["Wakasek", "BK", "Kasek", "Umum"].find((value) => activeTabs.includes(value)) || "") as TaskTab;
  const mode = Array.from(document.querySelectorAll<HTMLButtonElement>(".standard-filter-options button.active"))[0]?.textContent?.trim() || "Gabungan";
  const levelButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.level-chips div[role="group"] button.active'))
    .map((button) => button.textContent?.trim() || "")
    .filter((value) => value && value !== "Semua");
  return {
    year: readControl("Tahun Pelajaran"), groupJenjang: readControl("Grup Jenjang"), jenjang: levelButtons,
    program: readControl("Program"), teacherCategory: readControl("Kategori Guru"), school: readControl("Sekolah"),
    status: readControl("Status Kontrak"), individual: readControl("Status Individu"), standardMode: mode, tab,
    visible: pageTitle === "Tugas Tambahan & Peran" && ["Wakasek", "Kasek"].includes(tab),
  };
}

function applyFilters(data: Teacher[], filters: Filters) {
  return data.filter((teacher) => {
    if (filters.tab === "Wakasek" && !teacher.isWakasek) return false;
    if (filters.tab === "Kasek" && teacher.statusIndividu !== "Kasek") return false;
    if (filters.standardMode.includes("Internasional") && teacher.jenjang !== "Internasional") return false;
    if (filters.standardMode.includes("TK–SLTA") && teacher.jenjang === "Internasional") return false;
    if (filters.year.length && !filters.year.includes(teacher.year)) return false;
    if (filters.groupJenjang.length && !filters.groupJenjang.includes(teacher.groupJenjang)) return false;
    if (filters.jenjang.length && !filters.jenjang.includes(teacher.jenjang)) return false;
    if (filters.program.length && !filters.program.includes(teacher.program)) return false;
    if (filters.teacherCategory.length && !filters.teacherCategory.includes(teacher.teacherCategory)) return false;
    if (filters.school.length && !filters.school.includes(teacher.school)) return false;
    if (filters.status.length && !filters.status.includes(teacher.status)) return false;
    if (filters.individual.length && !filters.individual.includes(teacher.statusIndividu)) return false;
    return true;
  });
}

function format(value: number) { return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(value); }

export default function TaskHoursExactEnhancer({ teachers }: { teachers: Teacher[] }) {
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const sync = () => {
      const next = readState();
      setFilters((current) => JSON.stringify(current) === JSON.stringify(next) ? current : next);
      setTarget(document.querySelector<HTMLElement>(".dashboard-body"));
      document.querySelectorAll<HTMLElement>(".chart-card").forEach((card) => {
        const title = card.querySelector("h3")?.textContent?.trim() || "";
        const shouldHide = next.tab === "Wakasek" ? title === "Jam Tugas Tambahan Wakasek" : next.tab === "BK" || next.tab === "Kasek" ? title === "Jam Tugas Tambahan" : false;
        card.style.display = shouldHide ? "none" : "";
      });
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "checked"] });
    document.addEventListener("change", sync, true);
    document.addEventListener("click", sync, true);
    return () => { observer.disconnect(); document.removeEventListener("change", sync, true); document.removeEventListener("click", sync, true); };
  }, []);

  const data = useMemo(() => applyFilters(teachers, filters), [teachers, filters]);
  const rows = useMemo(() => {
    const counts = new Map<number, number>();
    data.forEach((teacher) => counts.set(teacher.taskHours, (counts.get(teacher.taskHours) || 0) + 1));
    return [...counts.entries()].sort((a, b) => a[0] - b[0]).map(([hours, count]) => ({ hours, count }));
  }, [data]);
  const max = Math.max(...rows.map((row) => row.count), 1);

  if (!filters.visible || !target) return null;

  return createPortal(
    <section className={styles.card} aria-label={`Distribusi Jam Tugas Tambahan ${filters.tab}`}>
      <header><div><h3>{filters.tab === "Wakasek" ? "Jam Tugas Tambahan Wakasek" : `Jam Tugas Tambahan ${filters.tab}`}</h3><p>Distribusi nilai JP exact berdasarkan database dan seluruh filter aktif.</p></div></header>
      <div className={styles.scroll}>
        <div className={styles.chart} style={{ minWidth: `${Math.max(620, rows.length * 48)}px` }}>
          <div className={styles.plot}>
            {rows.map((row) => <div className={styles.group} key={row.hours} title={`${format(row.hours)} JP · ${format(row.count)} guru`}>
              <strong>{format(row.count)}</strong>
              <div className={styles.track}><i style={{ height: `${Math.max((row.count / max) * 100, 2)}%` }} /></div>
              <span>{format(row.hours)}</span>
            </div>)}
          </div>
          <div className={styles.axis}>Jam Tugas Tambahan (JP)</div>
        </div>
      </div>
    </section>, target
  );
}
