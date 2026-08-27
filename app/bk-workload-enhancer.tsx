"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { Teacher } from "./dashboard-client";
import styles from "./bk-workload.module.css";

type DashboardFilters = {
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

const EMPTY_FILTERS: DashboardFilters = {
  year: [], groupJenjang: [], jenjang: [], program: [], teacherCategory: [], school: [], status: [], individual: [], standardMode: "Gabungan", visible: false,
};

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "id"));
}

function numericLabel(value: number) {
  return Number.isInteger(value) ? String(value) : new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("id-ID").format(value);
}

function readControl(label: string) {
  const controls = Array.from(document.querySelectorAll<HTMLElement>(".filter-control"));
  const control = controls.find((item) => item.querySelector(":scope > span")?.textContent?.trim() === label);
  if (!control) return [];
  return Array.from(control.querySelectorAll<HTMLInputElement>('.multi-options input[type="checkbox"]:checked'))
    .map((input) => input.closest("label")?.querySelector("span")?.textContent?.trim() || "")
    .filter(Boolean);
}

function readDashboardFilters(): DashboardFilters {
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
    visible: pageTitle === "Tugas Tambahan & Peran" && activeTabs.includes("BK"),
  };
}

function sameFilters(a: DashboardFilters, b: DashboardFilters) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function applyDashboardFilters(teachers: Teacher[], filters: DashboardFilters) {
  return teachers.filter((teacher) => {
    if (!teacher.isBK) return false;
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

function countByMetric(data: Teacher[], getter: (teacher: Teacher) => number) {
  const counts = new Map<number, number>();
  data.forEach((teacher) => {
    const value = getter(teacher);
    counts.set(value, (counts.get(value) || 0) + 1);
  });
  return [...counts.entries()].sort((a, b) => a[0] - b[0]).map(([value, count]) => ({ value, count }));
}

function MetricChart({ title, data, getter, axisTitle }: { title: string; data: Teacher[]; getter: (teacher: Teacher) => number; axisTitle: string }) {
  const rows = countByMetric(data, getter);
  const max = Math.max(...rows.map((row) => row.count), 1);
  return <section className={styles.card}>
    <header><h3>{title}</h3><p>Jumlah NIK unik berdasarkan nilai {axisTitle.toLowerCase()}</p></header>
    <div className={styles.chartScroll}>
      <div className={styles.chart} style={{ minWidth: `${Math.max(620, rows.length * 42)}px` }}>
        <div className={styles.plot}>
          {rows.map((row) => <div className={styles.barGroup} key={row.value} title={`${numericLabel(row.value)} JP · ${formatNumber(row.count)} guru`}>
            <strong>{formatNumber(row.count)}</strong>
            <div className={styles.barTrack}><i style={{ height: `${Math.max((row.count / max) * 100, 2)}%` }} /></div>
            <span>{numericLabel(row.value)}</span>
          </div>)}
          {!rows.length && <div className={styles.empty}>Tidak ada data untuk kombinasi filter ini.</div>}
        </div>
        <div className={styles.axisTitle}>{axisTitle}</div>
      </div>
    </div>
  </section>;
}

export default function BKWorkloadEnhancer({ teachers }: { teachers: Teacher[] }) {
  const [filters, setFilters] = useState<DashboardFilters>(EMPTY_FILTERS);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [jenjang, setJenjang] = useState("");
  const [subject, setSubject] = useState("");
  const [task, setTask] = useState("");

  useEffect(() => {
    const sync = () => {
      const next = readDashboardFilters();
      setFilters((current) => sameFilters(current, next) ? current : next);
      setTarget(document.querySelector<HTMLElement>(".dashboard-body"));
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "checked"] });
    document.addEventListener("change", sync, true);
    document.addEventListener("click", sync, true);
    return () => { observer.disconnect(); document.removeEventListener("change", sync, true); document.removeEventListener("click", sync, true); };
  }, []);

  const base = useMemo(() => applyDashboardFilters(teachers, filters), [teachers, filters]);
  const jenjangOptions = useMemo(() => unique(base.map((teacher) => teacher.jenjang)), [base]);
  const afterJenjang = useMemo(() => jenjang ? base.filter((teacher) => teacher.jenjang === jenjang) : base, [base, jenjang]);
  const subjectOptions = useMemo(() => unique(afterJenjang.flatMap((teacher) => teacher.subject.split(/\s*\/\s*/g).map((item) => item.trim()))), [afterJenjang]);
  const afterSubject = useMemo(() => subject ? afterJenjang.filter((teacher) => teacher.subject.split(/\s*\/\s*/g).map((item) => item.trim()).includes(subject)) : afterJenjang, [afterJenjang, subject]);
  const taskOptions = useMemo(() => unique(afterSubject.flatMap((teacher) => teacher.tasks)), [afterSubject]);
  const data = useMemo(() => task ? afterSubject.filter((teacher) => teacher.tasks.includes(task)) : afterSubject, [afterSubject, task]);

  useEffect(() => { if (jenjang && !jenjangOptions.includes(jenjang)) setJenjang(""); }, [jenjang, jenjangOptions]);
  useEffect(() => { if (subject && !subjectOptions.includes(subject)) setSubject(""); }, [subject, subjectOptions]);
  useEffect(() => { if (task && !taskOptions.includes(task)) setTask(""); }, [task, taskOptions]);

  if (!filters.visible || !target) return null;

  return createPortal(<section className={styles.panel} aria-label="Analisis khusus Bimbingan Konseling">
    <div className={styles.heading}><div><p>Tugas Tambahan & Peran</p><h2>Bimbingan Konseling (BK)</h2><span>Distribusi jam berbasis database dan mengikuti seluruh filter dashboard aktif.</span></div><div className={styles.nikCard}><span>NIK</span><strong>{formatNumber(data.length)}</strong><small>BK sesuai filter</small></div></div>
    <div className={styles.filters}>
      <label><span>Jenjang</span><select value={jenjang} onChange={(event) => { setJenjang(event.target.value); setSubject(""); setTask(""); }}><option value="">Semua Jenjang</option>{jenjangOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      <label><span>Bidang Studi</span><select value={subject} onChange={(event) => { setSubject(event.target.value); setTask(""); }}><option value="">Semua Bidang Studi</option>{subjectOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      <label><span>Kategori Detail Tugas Tambahan</span><select value={task} onChange={(event) => setTask(event.target.value)}><option value="">Semua Detail Tugas Tambahan</option>{taskOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
    </div>
    <div className={styles.grid}>
      <MetricChart title="Jumlah Jam Tatap Muka" data={data} getter={(teacher) => teacher.jtm} axisTitle="Jam Tatap Muka" />
      <MetricChart title="Jumlah Jam Aktual" data={data} getter={(teacher) => teacher.actual} axisTitle="Jam Aktual" />
      <MetricChart title="Jumlah Jam Tugas Tambahan" data={data} getter={(teacher) => teacher.taskHours} axisTitle="Jam Tugas Tambahan" />
    </div>
  </section>, target);
}
