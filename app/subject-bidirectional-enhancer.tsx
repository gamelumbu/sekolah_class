"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { Teacher } from "./dashboard-client";
import styles from "./subject-bidirectional.module.css";

type FilterSnapshot = {
  year: string[];
  groupJenjang: string[];
  jenjang: string[];
  program: string[];
  teacherCategory: string[];
  school: string[];
  status: string[];
  individual: string[];
  standardMode: string;
  visible: boolean;
};

type SubjectRow = {
  subject: string;
  below: number;
  equal: number;
  above: number;
  total: number;
};

type SubjectSummaryRow = {
  subject: string;
  count: number;
  avgActual: number;
};

const EMPTY_FILTERS: FilterSnapshot = {
  year: [], groupJenjang: [], jenjang: [], program: [], teacherCategory: [], school: [], status: [], individual: [], standardMode: "Gabungan", visible: false,
};

function readControl(label: string) {
  const controls = Array.from(document.querySelectorAll<HTMLElement>(".filter-control"));
  const control = controls.find((item) => item.querySelector(":scope > span")?.textContent?.trim() === label);
  if (!control) return [];
  return Array.from(control.querySelectorAll<HTMLInputElement>('.multi-options input[type="checkbox"]:checked'))
    .map((input) => input.closest("label")?.querySelector("span")?.textContent?.trim() || "")
    .filter(Boolean);
}

function readDashboardState(): FilterSnapshot {
  const pageTitle = document.querySelector(".topbar h1")?.textContent?.trim() || "";
  const activeTabs = Array.from(document.querySelectorAll<HTMLButtonElement>(".tab-row button.active")).map((button) => button.textContent?.trim() || "");
  const mode = Array.from(document.querySelectorAll<HTMLButtonElement>(".standard-filter-options button.active"))[0]?.textContent?.trim() || "Gabungan";
  const levelButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.level-chips div[role="group"] button.active'))
    .map((button) => button.textContent?.trim() || "")
    .filter((value) => value && value !== "Semua");

  return {
    year: readControl("Tahun Pelajaran"),
    groupJenjang: readControl("Grup Jenjang"),
    jenjang: levelButtons,
    program: readControl("Program"),
    teacherCategory: readControl("Kategori Guru"),
    school: readControl("Sekolah"),
    status: readControl("Status Kontrak"),
    individual: readControl("Status Individu"),
    standardMode: mode,
    visible: pageTitle === "Sekolah, Mapel & Lokasi" && activeTabs.includes("Mata Pelajaran"),
  };
}

function sameSnapshot(a: FilterSnapshot, b: FilterSnapshot) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function splitSubjects(value: string) {
  const seen = new Set<string>();
  return String(value || "")
    .split(/\s*\/\s*/g)
    .map((subject) => subject.trim())
    .filter(Boolean)
    .filter((subject) => {
      const key = subject.toLocaleLowerCase("id-ID");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function deriveStandards(data: Teacher[]) {
  const byLevel = new Map<string, Teacher[]>();
  data.forEach((teacher) => byLevel.set(teacher.jenjang, [...(byLevel.get(teacher.jenjang) || []), teacher]));
  const standards = new Map<string, number>();

  for (const [level, rows] of byLevel) {
    const exactCounts = new Map<number, number>();
    rows.filter((teacher) => teacher.compliance === "Tepat standar").forEach((teacher) => exactCounts.set(teacher.actual, (exactCounts.get(teacher.actual) || 0) + 1));
    const exact = [...exactCounts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0];
    if (exact !== undefined) {
      standards.set(level, exact);
      continue;
    }

    const below = rows.filter((teacher) => teacher.compliance === "Di bawah standar").map((teacher) => teacher.actual);
    const above = rows.filter((teacher) => teacher.compliance === "Di atas standar").map((teacher) => teacher.actual);
    const belowMax = below.length ? Math.max(...below) : undefined;
    const aboveMin = above.length ? Math.min(...above) : undefined;
    if (belowMax !== undefined && aboveMin !== undefined && belowMax < aboveMin) standards.set(level, belowMax + 1);
    else if (belowMax !== undefined) standards.set(level, belowMax + 1);
    else if (aboveMin !== undefined) standards.set(level, Math.max(0, aboveMin - 1));
  }

  return standards;
}

function filterTeachers(teachers: Teacher[], filters: FilterSnapshot) {
  return teachers.filter((teacher) => {
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

function groupTeachersBySubject(data: Teacher[]) {
  const groups = new Map<string, { label: string; teachers: Teacher[] }>();
  data.forEach((teacher) => {
    splitSubjects(teacher.subject).forEach((subject) => {
      const key = subject.toLocaleLowerCase("id-ID");
      const current = groups.get(key) || { label: subject, teachers: [] };
      current.teachers.push(teacher);
      groups.set(key, current);
    });
  });
  return [...groups.values()];
}

function buildSummaryRows(data: Teacher[]) {
  return groupTeachersBySubject(data).map(({ label, teachers }) => ({
    subject: label,
    count: new Set(teachers.map((teacher) => teacher.nik)).size,
    avgActual: teachers.length ? teachers.reduce((sum, teacher) => sum + teacher.actual, 0) / teachers.length : 0,
  }));
}

function buildRows(data: Teacher[], standards: Map<string, number>, metric: "jtm" | "actual") {
  return groupTeachersBySubject(data)
    .map(({ label, teachers: rows }): SubjectRow => {
      let below = 0, equal = 0, above = 0;
      rows.forEach((teacher) => {
        const threshold = standards.get(teacher.jenjang);
        if (threshold === undefined) return;
        const value = metric === "jtm" ? teacher.jtm : teacher.actual;
        if (value < threshold) below += 1;
        else if (value === threshold) equal += 1;
        else above += 1;
      });
      return { subject: label, below, equal, above, total: below + equal + above };
    })
    .filter((row) => row.total > 0)
    .sort((a, b) => a.subject.localeCompare(b.subject, "id"));
}

function standardCaption(standards: Map<string, number>, data: Teacher[]) {
  const active = [...new Set(data.map((teacher) => standards.get(teacher.jenjang)).filter((value): value is number => value !== undefined))].sort((a, b) => a - b);
  if (!active.length) return "Standar mengikuti data kepatuhan aktif";
  if (active.length === 1) return `Standar ${active[0]} JP`;
  return `Standar aktif ${active.join(" / ")} JP sesuai jenjang`;
}

function SummaryChart({ title, rows, metric }: { title: string; rows: SubjectSummaryRow[]; metric: "count" | "avg" }) {
  const ordered = [...rows]
    .sort((a, b) => metric === "count" ? b.count - a.count || a.subject.localeCompare(b.subject, "id") : b.avgActual - a.avgActual || a.subject.localeCompare(b.subject, "id"))
    .slice(0, metric === "count" ? 15 : 10);
  const max = Math.max(...ordered.map((row) => metric === "count" ? row.count : row.avgActual), 1);
  return <section className={styles.card}>
    <header className={styles.cardHeader}><div><p>Analisis Mata Pelajaran</p><h3>{title}</h3><span>Mapel dipisahkan per kategori dan mengikuti jenjang serta seluruh filter aktif</span></div></header>
    <div className={styles.summaryList}>{ordered.map((row) => {
      const value = metric === "count" ? row.count : row.avgActual;
      return <div className={styles.summaryRow} key={row.subject}><span title={row.subject}>{row.subject}</span><i><b style={{ width: `${Math.max(value / max * 100, 2)}%` }} /></i><strong>{metric === "count" ? row.count : `${row.avgActual.toLocaleString("id-ID", { maximumFractionDigits: 1 })} JP`}</strong></div>;
    })}</div>
  </section>;
}

function DivergingChart({ title, metric, rows, caption }: { title: string; metric: "jtm" | "actual"; rows: SubjectRow[]; caption: string }) {
  const maxValue = Math.max(...rows.flatMap((row) => [row.below, row.above]), 1);
  const metricLabel = metric === "jtm" ? "JTM" : "Jam Aktual";
  return (
    <section className={styles.card}>
      <header className={styles.cardHeader}>
        <div><p>Analisis Mata Pelajaran</p><h3>{title}</h3><span>{caption} · dihitung dari database dan seluruh filter aktif</span></div>
      </header>
      <div className={styles.scroller}>
        <div className={styles.chart}>
          <div className={styles.head}><span>{metricLabel} di bawah standar</span><strong>Mata Pelajaran</strong><span>{metricLabel} di atas standar</span></div>
          <div className={styles.rows}>
            {rows.map((row) => <div className={styles.row} key={row.subject}>
              <div className={`${styles.side} ${styles.left}`} title={`${row.subject}: ${row.below} guru di bawah standar`}><strong>{row.below || "–"}</strong><span className={styles.track}><i style={{ width: `${row.below ? Math.max(row.below / maxValue * 100, 2) : 0}%` }} /></span></div>
              <div className={styles.subject} title={`${row.subject}: ${row.equal} guru tepat standar`}><span>{row.subject}</span><small>{row.equal ? `${row.equal} tepat` : ""}</small></div>
              <div className={`${styles.side} ${styles.right}`} title={`${row.subject}: ${row.above} guru di atas standar`}><span className={styles.track}><i style={{ width: `${row.above ? Math.max(row.above / maxValue * 100, 2) : 0}%` }} /></span><strong>{row.above || "–"}</strong></div>
            </div>)}
          </div>
        </div>
      </div>
      <footer className={styles.note}>Setiap mata pelajaran ditampilkan sebagai kategori terpisah. Daftar mapel dibentuk setelah filter jenjang dan filter dashboard lain diterapkan, sehingga mapel yang tidak ada pada jenjang aktif tidak ditampilkan.</footer>
    </section>
  );
}

function hideLegacySubjectCharts(hidden: boolean) {
  const titles = new Set(["Jumlah Guru per Mata Pelajaran", "Rata-rata Jam Aktual per Mapel"]);
  document.querySelectorAll<HTMLElement>(".dashboard-body .chart-card").forEach((card) => {
    const title = card.querySelector(".chart-heading h3")?.textContent?.trim() || "";
    if (titles.has(title)) card.style.display = hidden ? "none" : "";
  });
}

export default function SubjectBidirectionalEnhancer({ teachers }: { teachers: Teacher[] }) {
  const [filters, setFilters] = useState<FilterSnapshot>(EMPTY_FILTERS);
  const [target, setTarget] = useState<Element | null>(null);

  useEffect(() => {
    let timer = 0;
    const sync = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const next = readDashboardState();
        setFilters((current) => sameSnapshot(current, next) ? current : next);
        const nextTarget = next.visible ? document.querySelector(".dashboard-body .chart-grid") : null;
        setTarget((current) => current === nextTarget ? current : nextTarget);
        hideLegacySubjectCharts(next.visible);
      }, 0);
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "open"] });
    document.addEventListener("click", sync, true);
    document.addEventListener("change", sync, true);
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
      document.removeEventListener("click", sync, true);
      document.removeEventListener("change", sync, true);
      hideLegacySubjectCharts(false);
    };
  }, []);

  const filtered = useMemo(() => filterTeachers(teachers, filters), [teachers, filters]);
  const standards = useMemo(() => deriveStandards(teachers), [teachers]);
  const summaryRows = useMemo(() => buildSummaryRows(filtered), [filtered]);
  const jtmRows = useMemo(() => buildRows(filtered, standards, "jtm"), [filtered, standards]);
  const actualRows = useMemo(() => buildRows(filtered, standards, "actual"), [filtered, standards]);
  const caption = useMemo(() => standardCaption(standards, filtered), [standards, filtered]);

  if (!filters.visible || !target || !filtered.length) return null;
  return createPortal(<>
    <SummaryChart title="Jumlah Guru per Mata Pelajaran" rows={summaryRows} metric="count" />
    <SummaryChart title="Rata-rata Jam Aktual per Mapel" rows={summaryRows} metric="avg" />
    <DivergingChart title="Mapel Berdasarkan Jam Tatap Muka" metric="jtm" rows={jtmRows} caption={caption} />
    <DivergingChart title="Mapel Berdasarkan Jam Aktual" metric="actual" rows={actualRows} caption={caption} />
  </>, target);
}
