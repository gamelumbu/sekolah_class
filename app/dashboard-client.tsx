"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";

export type Teacher = {
  nik: string;
  name: string;
  gender: string;
  status: string;
  payroll: string;
  school: string;
  groupJenjang: string;
  jenjang: string;
  program: string;
  teacherCategory: string;
  subject: string;
  schoolCount: number;
  crossLevel: string;
  locations: string[];
  statusIndividu: string;
  isWakasek: boolean;
  isBK: boolean;
  jtm: number;
  taskHours: number;
  actual: number;
  taskCount: number;
  tasks: string[];
  className: string;
  compliance: string;
  year: string;
};

type FilterState = {
  year: string[];
  groupJenjang: string[];
  jenjang: string[];
  program: string[];
  teacherCategory: string[];
  school: string[];
  status: string[];
  individual: string[];
};

type Segments = Record<string, string[]>;

type ChartExportContextValue = {
  people: Teacher[];
  standard: number;
};

const ChartExportContext = createContext<ChartExportContextValue>({ people: [], standard: 24 });
const ALL = "Semua";
const palette = ["#2e6eb5", "#e3ad2f", "#7556c7", "#2f8a68", "#e16a54", "#5f7898"];
const complianceColors: Record<string, string> = {
  "Di bawah standar": "#d64c4c",
  "Tepat standar": "#e1a928",
  "Di atas standar": "#2e6eb5",
};

function standardForTeacher(teacher: Teacher, standard = 24) {
  return teacher.jenjang === "Internasional" ? 30 : standard;
}

function complianceAtStandard(teacher: Teacher, standard = 24) {
  const effectiveStandard = standardForTeacher(teacher, standard);
  if (teacher.actual < effectiveStandard) return "Di bawah standar";
  if (teacher.actual === effectiveStandard) return "Tepat standar";
  return "Di atas standar";
}

function isBelowStandard(teacher: Teacher, standard = 24) {
  return teacher.actual < standardForTeacher(teacher, standard);
}

const menuItems = [
  { id: "summary", index: "01", label: "Ringkasan Lintas Jenjang", short: "Ringkasan" },
  { id: "workload", index: "02", label: "Beban Kerja & Kepatuhan", short: "Beban Kerja" },
  { id: "tasks", index: "03", label: "Tugas Tambahan & Peran", short: "Tugas & Peran" },
  { id: "organization", index: "04", label: "Sekolah, Mapel & Lokasi", short: "Organisasi" },
  { id: "simulation", index: "05", label: "Simulasi & Perencanaan", short: "Simulasi" },
];

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "id"));
}

function countBy<T>(data: T[], getter: (item: T) => string) {
  const map = new Map<string, number>();
  data.forEach((item) => {
    const key = getter(item) || "Tidak tersedia";
    map.set(key, (map.get(key) || 0) + 1);
  });
  return [...map.entries()].map(([label, value]) => ({ label, value }));
}

function numericLabel(value: number) {
  return Number.isInteger(value) ? String(value) : new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(value);
}

function countByNumber(data: Teacher[], metric: (teacher: Teacher) => number) {
  return countBy(data, (teacher) => numericLabel(metric(teacher))).sort((a, b) => Number(a.label.replace(",", ".")) - Number(b.label.replace(",", ".")));
}

function averageBy(data: Teacher[], group: (teacher: Teacher) => string, metric: (teacher: Teacher) => number) {
  const map = new Map<string, { total: number; count: number }>();
  data.forEach((teacher) => {
    const key = group(teacher);
    const current = map.get(key) || { total: 0, count: 0 };
    current.total += metric(teacher);
    current.count += 1;
    map.set(key, current);
  });
  return [...map.entries()].map(([label, value]) => ({ label, value: value.count ? value.total / value.count : 0 }));
}

function formatNumber(value: number, digits = 0) {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: digits }).format(value);
}

function bucketHours(value: number) {
  if (value < 12) return "<12";
  if (value < 18) return "12-17";
  if (value < 24) return "18-23";
  if (value === 24) return "24";
  if (value <= 30) return "25-30";
  return ">30";
}

function matchesSegment(teacher: Teacher, group: string, value: string, standard: number) {
  if (group === "jenjang") return teacher.jenjang === value;
  if (group === "program") return teacher.program === value;
  if (group === "teacherCategory") return teacher.statusIndividu === "Non-Kasek" && teacher.teacherCategory === value;
  if (group === "status") return teacher.status === value;
  if (group === "payroll") return teacher.payroll === value;
  if (group === "gender") return teacher.gender === value;
  if (group === "school") return teacher.school === value;
  if (group === "subject") return teacher.subject === value;
  if (group === "compliance") return teacher.compliance === value;
  if (group === "schoolCount") return String(teacher.schoolCount) === value;
  if (group === "taskCount") return String(teacher.taskCount) === value;
  if (group === "taskType") return teacher.tasks.includes(value);
  if (group === "hasTask") return value === "Dengan tugas tambahan" ? teacher.taskHours > 0 : teacher.taskHours === 0;
  if (group === "nik") return teacher.nik === value;
  if (group === "role") {
    if (value === "Kasek") return teacher.statusIndividu === "Kasek";
    if (value === "Wakasek") return teacher.isWakasek;
    if (value === "BK") return teacher.isBK;
  }
  if (group === "jtmBucket") return bucketHours(teacher.jtm) === value;
  if (group === "taskBucket") return bucketHours(teacher.taskHours) === value;
  if (group === "actualBucket") return bucketHours(teacher.actual) === value;
  if (group === "jtmValue") return numericLabel(teacher.jtm) === value;
  if (group === "taskHoursValue") return numericLabel(teacher.taskHours) === value;
  if (group === "actualValue") return numericLabel(teacher.actual) === value;
  if (group === "scenario") {
    return complianceAtStandard(teacher, standard) === value;
  }
  return true;
}

function filterBySegments(data: Teacher[], segments: Segments, standard: number) {
  const entries = Object.entries(segments).filter(([, values]) => values.length);
  if (!entries.length) return data;
  return data.filter((teacher) => entries.every(([group, values]) => values.some((value) => matchesSegment(teacher, group, value, standard))));
}

function MultiSelectControl({ label, selected, values, onChange }: { label: string; selected: string[]; values: string[]; onChange: (value: string[]) => void }) {
  const [query, setQuery] = useState("");
  const visibleValues = values.filter((item) => item.toLowerCase().includes(query.trim().toLowerCase()));
  const summary = selected.length === 0 ? ALL : selected.length === 1 ? selected[0] : `${selected.length} dipilih`;

  function toggle(value: string) {
    onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
  }

  return (
    <div className="filter-control">
      <span>{label}</span>
      <details className="multi-select">
        <summary aria-label={`${label}: ${summary}`}><span>{summary}</span><b>{selected.length ? selected.length : ""}</b></summary>
        <div className="multi-menu">
          <input className="multi-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Cari ${label.toLowerCase()}...`} aria-label={`Cari ${label}`} />
          <div className="multi-actions"><button type="button" onClick={() => onChange(values)}>Pilih semua</button><button type="button" onClick={() => onChange([])}>Hapus pilihan</button></div>
          <div className="multi-options">
            {visibleValues.map((item) => <label key={item}><input type="checkbox" checked={selected.includes(item)} onChange={() => toggle(item)} /><span>{item}</span></label>)}
            {!visibleValues.length && <p>Tidak ada pilihan ditemukan.</p>}
          </div>
        </div>
      </details>
    </div>
  );
}

function KpiCard({ label, value, helper, tone = "blue" }: { label: string; value: string; helper: string; tone?: string }) {
  return (
    <article className={`kpi-card tone-${tone}`}>
      <div className="kpi-mark" aria-hidden="true" />
      <div><p>{label}</p><strong>{value}</strong><span>{helper}</span></div>
    </article>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return <div className="empty-state"><div className="empty-symbol">i</div><div><h3>{title}</h3><p>{body}</p></div></div>;
}

function exportFileName(title: string) {
  return title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "chart";
}

function triggerDownload(href: string, filename: string) {
  const link = document.createElement("a");
  link.download = filename;
  link.href = href;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function ChartCard({ title, subtitle, children, wide = false, exportPeople }: { title: string; subtitle?: string; children: React.ReactNode; wide?: boolean; exportPeople?: Teacher[] }) {
  const captureRef = useRef<HTMLDivElement>(null);
  const exportContext = useContext(ChartExportContext);
  const [exporting, setExporting] = useState<"png" | "excel" | null>(null);
  const [exportError, setExportError] = useState("");
  const [exportNotice, setExportNotice] = useState("");

  async function exportPng() {
    if (!captureRef.current) return;
    setExporting("png");
    setExportError("");
    setExportNotice("");
    const capture = captureRef.current;
    const scrollers = [...capture.querySelectorAll<HTMLElement>(".data-studio-scroll")];
    const captureStyle = { width: capture.style.width, maxWidth: capture.style.maxWidth };
    const scrollStyles = scrollers.map((element) => ({ element, width: element.style.width, overflow: element.style.overflow }));
    try {
      const { toPng } = await import("html-to-image");
      const exportWidth = Math.max(capture.clientWidth, ...scrollers.map((element) => element.scrollWidth));
      if (exportWidth > capture.clientWidth) {
        capture.style.width = `${exportWidth + 8}px`;
        capture.style.maxWidth = "none";
        scrollers.forEach((element) => { element.style.width = `${element.scrollWidth}px`; element.style.overflow = "visible"; });
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      }
      const dataUrl = await toPng(capture, { backgroundColor: "#ffffff", cacheBust: true, pixelRatio: 2, skipFonts: true });
      triggerDownload(dataUrl, `${exportFileName(title)}.png`);
    } catch {
      setExportError("PNG gagal dibuat. Silakan coba lagi.");
    } finally {
      capture.style.width = captureStyle.width;
      capture.style.maxWidth = captureStyle.maxWidth;
      scrollStyles.forEach(({ element, width, overflow }) => { element.style.width = width; element.style.overflow = overflow; });
      setExporting(null);
    }
  }

  async function exportExcel() {
    if (!captureRef.current) return;
    setExporting("excel");
    setExportError("");
    setExportNotice("");
    try {
      const source = captureRef.current.querySelector<HTMLElement>("[data-export-json]");
      const summaryRows = JSON.parse(source?.dataset.exportJson || "[]") as Record<string, string | number>[];
      const criteriaSource = captureRef.current.querySelector<HTMLElement>("[data-export-group]");
      const criteriaGroup = criteriaSource?.dataset.exportGroup || "";
      const criteriaValues = JSON.parse(criteriaSource?.dataset.exportValues || "[]") as string[];
      const sourcePeople = exportPeople ?? exportContext.people;
      const people = criteriaGroup && criteriaValues.length
        ? sourcePeople.filter((teacher) => criteriaValues.some((value) => matchesSegment(teacher, criteriaGroup, value, exportContext.standard)))
        : sourcePeople;
      if (!people.length) throw new Error("Data karyawan chart kosong");
      const detailRows = people.map((teacher) => ({
        NIK: teacher.nik,
        "Nama Lengkap": teacher.name,
        "Grup Jenjang": teacher.groupJenjang,
        Jenjang: teacher.jenjang,
        Sekolah: teacher.school,
        Payroll: teacher.payroll,
        "Status Kontrak": teacher.status,
        Program: teacher.program,
        "Status Individu": teacher.statusIndividu,
        "Kategori Guru": teacher.teacherCategory,
        "Bidang Studi": teacher.subject,
        "Total JP Tatap Muka Per Individu": teacher.jtm,
        "Total JP Tugas Tambahan Per Individu": teacher.taskHours,
        "Jumlah Jabatan Tambahan Per Individu": teacher.taskCount,
        "Total Jam Aktual Final Per Individu": teacher.actual,
        "Standar JP": standardForTeacher(teacher),
        Kepatuhan: teacher.compliance,
        "Jumlah Lokasi": teacher.schoolCount,
        "Lokasi Mengajar": teacher.locations.join(", ") || "-",
        "Tugas Tambahan": teacher.tasks.join("; ") || "-",
      }));
      const XLSX = await import("xlsx");
      const detailWorksheet = XLSX.utils.json_to_sheet(detailRows);
      detailWorksheet["!cols"] = Object.keys(detailRows[0]).map((key) => ({ wch: Math.min(Math.max(key.length + 2, ...detailRows.map((row) => String(row[key as keyof typeof row] ?? "").length + 2)), 42) }));
      if (detailWorksheet["!ref"]) detailWorksheet["!autofilter"] = { ref: detailWorksheet["!ref"] };
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, detailWorksheet, "Detail Karyawan");
      if (summaryRows.length) {
        const summaryWorksheet = XLSX.utils.json_to_sheet(summaryRows);
        summaryWorksheet["!cols"] = Object.keys(summaryRows[0]).map((key) => ({ wch: Math.min(Math.max(key.length + 2, ...summaryRows.map((row) => String(row[key] ?? "").length + 2)), 42) }));
        if (summaryWorksheet["!ref"]) summaryWorksheet["!autofilter"] = { ref: summaryWorksheet["!ref"] };
        XLSX.utils.book_append_sheet(workbook, summaryWorksheet, "Ringkasan Chart");
      }
      const file = XLSX.write(workbook, { bookType: "xlsx", type: "array", compression: true });
      const url = URL.createObjectURL(new Blob([file], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      triggerDownload(url, `${exportFileName(title)}.xlsx`);
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setExportNotice(`${formatNumber(people.length)} karyawan dimasukkan ke Excel.`);
    } catch {
      setExportError("Excel gagal dibuat. Data karyawan chart tidak tersedia.");
    } finally {
      setExporting(null);
    }
  }

  return (
    <section className={`chart-card ${wide ? "chart-wide" : ""}`}>
      <div className="chart-export-actions" aria-label={`Ekspor ${title}`}>
        <button type="button" className="chart-export-button png" onClick={exportPng} disabled={exporting !== null} title="Unduh chart sebagai PNG" aria-label={`Unduh ${title} sebagai PNG`}><span aria-hidden="true">▧</span>{exporting === "png" ? "Memproses" : "PNG"}</button>
        <button type="button" className="chart-export-button excel" onClick={exportExcel} disabled={exporting !== null} title="Unduh tabel karyawan chart sebagai Excel" aria-label={`Unduh tabel karyawan ${title} sebagai Excel`}><span aria-hidden="true">↓</span>{exporting === "excel" ? "Memproses" : "Excel"}</button>
      </div>
      <div className="chart-capture-area" ref={captureRef}>
        <div className="chart-heading"><div><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div></div>
        {children}
      </div>
      {exportError && <p className="chart-export-error" role="status">{exportError}</p>}
      {exportNotice && <p className="chart-export-notice" role="status">{exportNotice}</p>}
    </section>
  );
}

function HorizontalBars({ data, group, segments, onToggle, maxItems = 10, valueSuffix = "", colors: customColors }: {
  data: { label: string; value: number }[];
  group: string;
  segments: Segments;
  onToggle: (group: string, value: string) => void;
  maxItems?: number;
  valueSuffix?: string;
  colors?: string[];
}) {
  const sorted = [...data].sort((a, b) => b.value - a.value).slice(0, maxItems);
  const max = Math.max(...sorted.map((item) => item.value), 1);
  const barColors = customColors || palette;
  return (
    <div className="horizontal-bars" data-export-json={JSON.stringify(sorted.map((item) => ({ Kategori: item.label, Nilai: item.value })))} data-export-group={group} data-export-values={JSON.stringify(sorted.map((item) => item.label))}>
      {sorted.map((item, index) => {
        const selected = segments[group]?.includes(item.label);
        return (
          <button className={`bar-row ${selected ? "is-selected" : ""}`} key={item.label} onClick={() => onToggle(group, item.label)} title={`Klik untuk memfilter: ${item.label}`}>
            <span className="bar-label">{item.label}</span>
            <span className="bar-track"><span className="bar-fill" style={{ width: `${Math.max((item.value / max) * 100, 2)}%`, background: barColors[index % barColors.length] }} /></span>
            <strong>{formatNumber(item.value, valueSuffix ? 1 : 0)}{valueSuffix}</strong>
          </button>
        );
      })}
    </div>
  );
}

function ColumnChart({ data, group, segments, onToggle, scrollable = false }: {
  data: { label: string; value: number }[];
  group: string;
  segments: Segments;
  onToggle: (group: string, value: string) => void;
  scrollable?: boolean;
}) {
  const max = Math.max(...data.map((item) => item.value), 1);
  const chart = (
    <div className="column-chart" style={scrollable ? { minWidth: `${Math.max(data.length * 50, 720)}px` } : undefined} data-export-json={JSON.stringify(data.map((item) => ({ Kategori: item.label, Jumlah_Guru: item.value })))} data-export-group={group} data-export-values={JSON.stringify(data.map((item) => item.label))}>
      {data.map((item, index) => {
        const selected = segments[group]?.includes(item.label);
        return (
          <button className={`column-item ${selected ? "is-selected" : ""}`} key={item.label} onClick={() => onToggle(group, item.label)} title={`Klik ${item.label}`}>
            <strong>{formatNumber(item.value)}</strong>
            <span className="column-track"><span style={{ height: `${Math.max((item.value / max) * 100, 4)}%`, background: palette[index % palette.length] }} /></span>
            <small>{item.label}</small>
          </button>
        );
      })}
    </div>
  );
  return scrollable ? <div style={{ overflowX: "auto", paddingBottom: 8 }}>{chart}</div> : chart;
}

function DataStudioBarChart({ data, group, segments, onToggle, axisTitle }: {
  data: { label: string; value: number }[];
  group: string;
  segments: Segments;
  onToggle: (group: string, value: string) => void;
  axisTitle: string;
}) {
  const max = Math.max(...data.map((item) => item.value), 1);
  const minWidth = Math.max(data.length * (data.length <= 8 ? 112 : 58), 720);
  return (
    <div className="data-studio-scroll">
      <div className="data-studio-column-chart" style={{ minWidth }} data-export-json={JSON.stringify(data.map((item) => ({ Kategori: item.label, Jumlah_Guru: item.value })))} data-export-group={group} data-export-values={JSON.stringify(data.map((item) => item.label))}>
        <div className="data-studio-bars">
          {data.map((item) => {
            const selected = segments[group]?.includes(item.label);
            const height = Math.max((item.value / max) * 100, 1.5);
            const labelInside = height >= 13;
            return (
              <button type="button" className={`data-studio-column ${selected ? "is-selected" : ""}`} key={item.label} onClick={() => onToggle(group, item.label)} title={`Klik untuk memfilter: ${item.label} (${formatNumber(item.value)} guru)`}>
                <span className="data-studio-bar-space">
                  <span className="data-studio-bar" style={{ height: `${height}%` }}>
                    <strong className={labelInside ? "inside" : "outside"}>{formatNumber(item.value)}</strong>
                  </span>
                </span>
                <small>{item.label}</small>
              </button>
            );
          })}
        </div>
        <p className="data-studio-axis-title">{axisTitle}</p>
      </div>
    </div>
  );
}

function TaskPresencePie({ data, segments, onToggle }: { data: Teacher[]; segments: Segments; onToggle: (group: string, value: string) => void }) {
  const rows = [
    { label: "Dengan tugas tambahan", value: data.filter((teacher) => teacher.taskHours > 0).length, color: "#4285f4" },
    { label: "Tanpa Tugas Tambahan", value: data.filter((teacher) => teacher.taskHours === 0).length, color: "#f6a04d" },
  ];
  const total = Math.max(rows.reduce((sum, item) => sum + item.value, 0), 1);
  let cursor = -90;
  const slices = rows.map((item) => {
    const start = cursor;
    const end = start + item.value / total * 360;
    cursor = end;
    const point = (angle: number, radius: number) => ({ x: 120 + radius * Math.cos(angle * Math.PI / 180), y: 120 + radius * Math.sin(angle * Math.PI / 180) });
    const startPoint = point(start, 105);
    const endPoint = point(end, 105);
    const labelPoint = point((start + end) / 2, 67);
    return { ...item, start, end, startPoint, endPoint, labelPoint, largeArc: end - start > 180 ? 1 : 0 };
  });
  return (
    <div className="task-pie-layout" data-export-json={JSON.stringify(rows.map((item) => ({ Kategori: item.label, Jumlah_Tenaga_Pendidik: item.value })))} data-export-group="hasTask" data-export-values={JSON.stringify(rows.map((item) => item.label))}>
      <svg className="task-pie" viewBox="0 0 240 240" role="img" aria-label="Tenaga pendidik berdasarkan tugas tambahan">
        {slices.map((slice) => <g key={slice.label} role="button" tabIndex={0} className={segments.hasTask?.includes(slice.label) ? "is-selected" : ""} onClick={() => onToggle("hasTask", slice.label)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onToggle("hasTask", slice.label); }}>
          <path d={`M 120 120 L ${slice.startPoint.x} ${slice.startPoint.y} A 105 105 0 ${slice.largeArc} 1 ${slice.endPoint.x} ${slice.endPoint.y} Z`} fill={slice.color} stroke="#fff" strokeWidth="2" />
          <text x={slice.labelPoint.x} y={slice.labelPoint.y} textAnchor="middle" dominantBaseline="middle">{formatNumber(slice.value)}</text>
        </g>)}
      </svg>
      <div className="task-pie-legend">{rows.map((item) => <button type="button" key={item.label} className={segments.hasTask?.includes(item.label) ? "is-selected" : ""} onClick={() => onToggle("hasTask", item.label)}><i style={{ background: item.color }} /><span>{item.label}</span><strong>{formatNumber(item.value)}</strong></button>)}</div>
    </div>
  );
}

function TaskBubbleChart({ data, segments, onToggle }: { data: Teacher[]; segments: Segments; onToggle: (group: string, value: string) => void }) {
  const grouped = new Map<string, { hours: number; tasks: number; value: number }>();
  data.forEach((teacher) => {
    const key = `${teacher.taskHours}|${teacher.taskCount}`;
    const current = grouped.get(key) || { hours: teacher.taskHours, tasks: teacher.taskCount, value: 0 };
    current.value += 1;
    grouped.set(key, current);
  });
  const points = [...grouped.values()].sort((a, b) => a.hours - b.hours || a.tasks - b.tasks);
  const maxHours = Math.max(...points.map((item) => item.hours), 18);
  const maxValue = Math.max(...points.map((item) => item.value), 1);
  const colors = ["#f1c987", "#3f8bd9", "#9a78d7", "#a9bd5f"];
  const left = 58, right = 20, top = 24, bottom = 48, width = 650, height = 320;
  const plotWidth = width - left - right, plotHeight = height - top - bottom;
  const x = (value: number) => left + value / maxHours * plotWidth;
  const y = (value: number) => top + (3 - Math.min(value, 3)) / 3 * plotHeight;
  return (
    <div className="task-bubble-wrap" data-export-json={JSON.stringify(points.map((item) => ({ Total_JP_Tugas_Tambahan: item.hours, Jumlah_Jabatan_Tambahan: item.tasks, Jumlah_Tenaga_Pendidik: item.value })))} data-export-group="taskHoursValue" data-export-values={JSON.stringify(unique(points.map((item) => numericLabel(item.hours))))}>
      <div className="task-bubble-legend">{[0, 1, 2, 3].map((count) => <span key={count}><i style={{ background: colors[count] }} />{count} tugas</span>)}<strong>Ukuran gelembung = jumlah guru</strong></div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Jumlah tenaga pendidik berdasarkan tugas tambahan">
        {[0, 1, 2, 3].map((tick) => <g key={`y-${tick}`}><line x1={left} y1={y(tick)} x2={width - right} y2={y(tick)} className="bubble-grid" /><text x={left - 10} y={y(tick) + 4} textAnchor="end">{tick}</text></g>)}
        {Array.from({ length: Math.floor(maxHours / 3) + 1 }, (_, index) => index * 3).map((tick) => <g key={`x-${tick}`}><line x1={x(tick)} y1={top} x2={x(tick)} y2={height - bottom} className="bubble-grid" /><text x={x(tick)} y={height - bottom + 18} textAnchor="middle">{tick}</text></g>)}
        {points.map((point) => {
          const selected = segments.taskHoursValue?.includes(numericLabel(point.hours)) && segments.taskCount?.includes(String(point.tasks));
          const radius = 4 + Math.sqrt(point.value / maxValue) * 28;
          return <circle key={`${point.hours}-${point.tasks}`} className={`task-bubble ${selected ? "is-selected" : ""}`} cx={x(point.hours)} cy={y(point.tasks)} r={radius} fill={colors[Math.min(point.tasks, 3)]} opacity=".72" onClick={() => { onToggle("taskHoursValue", numericLabel(point.hours)); onToggle("taskCount", String(point.tasks)); }}><title>{numericLabel(point.hours)} JP · {point.tasks} tugas · {formatNumber(point.value)} guru</title></circle>;
        })}
        <text x={left + plotWidth / 2} y={height - 8} textAnchor="middle" className="bubble-axis-title">Total JP Tugas Tambahan Per Individu</text>
        <text x="14" y={top + plotHeight / 2} textAnchor="middle" className="bubble-axis-title" transform={`rotate(-90 14 ${top + plotHeight / 2})`}>Jumlah Jabatan Tambahan Per Individu</text>
      </svg>
    </div>
  );
}

function GroupedTaskBars({ data, categoryGetter, categoryGroup, categoryOrder, numericCategories = false, series, segments, onToggle, axisTitle }: {
  data: Teacher[];
  categoryGetter: (teacher: Teacher) => string;
  categoryGroup: string;
  categoryOrder?: string[];
  numericCategories?: boolean;
  series: number[];
  segments: Segments;
  onToggle: (group: string, value: string) => void;
  axisTitle: string;
}) {
  const categories = unique(data.map(categoryGetter)).sort((a, b) => categoryOrder ? categoryOrder.indexOf(a) - categoryOrder.indexOf(b) : numericCategories ? Number(a.replace(",", ".")) - Number(b.replace(",", ".")) : a.localeCompare(b, "id"));
  const rows = categories.flatMap((category) => series.map((taskCount) => ({ category, taskCount, value: data.filter((teacher) => categoryGetter(teacher) === category && teacher.taskCount === taskCount).length })));
  const max = Math.max(...rows.map((item) => item.value), 1);
  const colors: Record<number, string> = { 0: "#f29a4a", 1: "#4285f4", 2: "#9a78d7", 3: "#a9bd5f" };
  return (
    <div className="data-studio-scroll">
      <div className="grouped-task-chart" style={{ minWidth: Math.max(categories.length * (categories.length <= 6 ? 125 : 72), 720) }} data-export-json={JSON.stringify(rows.map((item) => ({ Kategori: item.category, Jumlah_Jabatan: item.taskCount, Jumlah_Tenaga_Pendidik: item.value })))} data-export-group={categoryGroup} data-export-values={JSON.stringify(categories)}>
        <div className="grouped-task-legend">{series.map((item) => <span key={item}><i style={{ background: colors[item] }} />{item}</span>)}</div>
        <div className="grouped-task-bars">
          {categories.map((category) => <div className="grouped-task-category" key={category}><div className="grouped-task-bar-set">{series.map((taskCount) => {
            const value = rows.find((item) => item.category === category && item.taskCount === taskCount)?.value || 0;
            const selected = segments[categoryGroup]?.includes(category) && segments.taskCount?.includes(String(taskCount));
            return <button type="button" key={taskCount} className={`grouped-task-bar ${selected ? "is-selected" : ""} ${value === 0 ? "is-empty" : ""}`} style={{ height: `${value ? Math.max(value / max * 100, 2) : 0}%`, background: colors[taskCount] }} disabled={value === 0} onClick={() => { onToggle(categoryGroup, category); onToggle("taskCount", String(taskCount)); }} title={`${category} · ${taskCount} tugas · ${formatNumber(value)} guru`}><strong>{value ? formatNumber(value) : ""}</strong></button>;
          })}</div><small>{category}</small></div>)}
        </div>
        <p className="data-studio-axis-title">{axisTitle}</p>
      </div>
    </div>
  );
}

function Histogram({ data, metric, group, segments, onToggle }: {
  data: Teacher[];
  metric: (teacher: Teacher) => number;
  group: string;
  segments: Segments;
  onToggle: (group: string, value: string) => void;
}) {
  const order = ["<12", "12-17", "18-23", "24", "25-30", ">30"];
  const counts = new Map(order.map((item) => [item, 0]));
  data.forEach((teacher) => counts.set(bucketHours(metric(teacher)), (counts.get(bucketHours(metric(teacher))) || 0) + 1));
  return <ColumnChart data={order.map((label) => ({ label, value: counts.get(label) || 0 }))} group={group} segments={segments} onToggle={onToggle} />;
}

function DonutChart({ data, group, segments, onToggle }: {
  data: { label: string; value: number }[];
  group: string;
  segments: Segments;
  onToggle: (group: string, value: string) => void;
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0) || 1;
  const stops = data.map((item, index) => {
    const start = data.slice(0, index).reduce((sum, current) => sum + current.value, 0) / total * 100;
    const end = start + item.value / total * 100;
    return `${palette[index % palette.length]} ${start}% ${end}%`;
  }).join(", ");
  return (
    <div className="donut-layout" data-export-json={JSON.stringify(data.map((item) => ({ Kategori: item.label, Jumlah: item.value, Persentase: Number((item.value / total * 100).toFixed(2)) })))} data-export-group={group} data-export-values={JSON.stringify(data.map((item) => item.label))}>
      <div className="donut" style={{ background: `conic-gradient(${stops})` }}><div className="donut-hole"><div><strong>{formatNumber(total)}</strong><span>Total guru</span></div></div></div>
      <div className="donut-legend">
        {data.map((item, index) => (
          <button className={segments[group]?.includes(item.label) ? "is-selected" : ""} key={item.label} onClick={() => onToggle(group, item.label)}>
            <i style={{ background: palette[index % palette.length] }} /><span>{item.label}</span><strong>{Math.round((item.value / total) * 100)}%</strong>
          </button>
        ))}
      </div>
    </div>
  );
}

function GroupedComplianceBars({ data, segments, onToggle, standard }: {
  data: Teacher[];
  segments: Segments;
  onToggle: (group: string, value: string) => void;
  standard?: number;
}) {
  const levels = ["TK", "SD", "SMP", "SLTA", "Internasional"];
  const labels = ["Di bawah standar", "Tepat standar", "Di atas standar"];
  const chartRows = levels.flatMap((level) => {
    const scoped = data.filter((teacher) => teacher.jenjang === level);
    return labels.map((label) => ({
      Jenjang: level,
      Status: label,
      Jumlah: scoped.filter((teacher) => complianceAtStandard(teacher, standard ?? 24) === label).length,
    }));
  });
  const maxValue = Math.max(...chartRows.map((item) => item.Jumlah), 1);
  const statusGroup = standard ? "scenario" : "compliance";
  return (
    <div className="grouped-compliance-chart" data-export-json={JSON.stringify(chartRows)}>
      <div className="grouped-compliance-viewport">
        <div className="grouped-compliance-plot">
          <span className="grouped-axis-label">Jumlah guru</span>
          <div className="grouped-grid" aria-hidden="true"><i /><i /><i /><i /></div>
          {levels.map((level) => {
            const counts = chartRows.filter((item) => item.Jenjang === level).map((item) => ({ label: item.Status, value: item.Jumlah }));
            return (
              <div className="grouped-category" key={level}>
                <div className="grouped-bars">
                  {counts.map((item) => {
                    const selected = segments[statusGroup]?.includes(item.label) && segments.jenjang?.includes(level);
                    return (
                      <button
                        type="button"
                        className={`grouped-bar ${selected ? "is-selected" : ""} ${item.value === 0 ? "is-empty" : ""}`}
                        key={item.label}
                        style={{ height: `${item.value === 0 ? 2 : Math.max((item.value / maxValue) * 100, 5)}%`, background: complianceColors[item.label] }}
                        onClick={() => { if (item.value > 0) { onToggle("jenjang", level); onToggle(statusGroup, item.label); } }}
                        title={`${level}: ${item.label} (${formatNumber(item.value)} guru)`}
                        aria-label={`${level}, ${item.label}, ${formatNumber(item.value)} guru`}
                        disabled={item.value === 0}
                      ><span>{item.value ? formatNumber(item.value) : ""}</span></button>
                    );
                  })}
                </div>
                <strong>{level}</strong>
              </div>
            );
          })}
        </div>
      </div>
      <div className="grouped-legend">{labels.map((label) => <span key={label}><i style={{ background: complianceColors[label] }} />{label}</span>)}</div>
    </div>
  );
}

const StackedCompliance = GroupedComplianceBars;

function ScatterPlot({ data, segments, onToggle, mode = "workload" }: { data: Teacher[]; segments: Segments; onToggle: (group: string, value: string) => void; mode?: "workload" | "location" }) {
  const sample = data.filter((_, index) => index % Math.max(Math.floor(data.length / 140), 1) === 0).slice(0, 160);
  const levels = ["TK", "SD", "SMP", "SLTA", "Internasional"];
  return (
    <div className="scatter-wrap" data-export-json={JSON.stringify(sample.map((teacher) => ({ NIK: teacher.nik, Nama: teacher.name, Jenjang: teacher.jenjang, JTM: teacher.jtm, Jumlah_Lokasi: teacher.schoolCount, Jam_Aktual: teacher.actual })))}>
      <svg viewBox="0 0 620 255" role="img" aria-label={mode === "location" ? "Hubungan jumlah lokasi dan jam aktual" : "Hubungan jam tatap muka dan jam aktual"}>
        {[40, 80, 120, 160, 200].map((y) => <line key={y} x1="48" y1={y} x2="598" y2={y} className="grid-line" />)}
        <line x1="48" y1="216" x2="598" y2="216" className="axis-line" /><line x1="48" y1="20" x2="48" y2="216" className="axis-line" />
        {sample.map((teacher) => {
          const xValue = mode === "location" ? teacher.schoolCount : teacher.jtm;
          const xMax = mode === "location" ? Math.max(...data.map((item) => item.schoolCount), 1) : 55;
          const x = 48 + Math.min(xValue, xMax) / xMax * 550;
          const y = 216 - Math.min(teacher.actual, 65) / 65 * 196;
          const selected = segments.nik?.includes(teacher.nik);
          return <circle key={teacher.nik} cx={x} cy={y} r={selected ? 6 : 3.5} fill={palette[Math.max(levels.indexOf(teacher.jenjang), 0) % palette.length]} opacity={selected ? 1 : .72} className="scatter-point" onClick={() => onToggle("nik", teacher.nik)}><title>{teacher.name}: {mode === "location" ? `Lokasi ${teacher.schoolCount}` : `JTM ${teacher.jtm}`}, Aktual {teacher.actual}</title></circle>;
        })}
        <text x="290" y="246">{mode === "location" ? "Jumlah Lokasi" : "Jam Tatap Muka"}</text><text x="9" y="126" transform="rotate(-90 9 126)">Jam Aktual</text>
      </svg>
    </div>
  );
}

function SimulationLine({ data, standard, setStandard }: { data: Teacher[]; standard: number; setStandard: (value: number) => void }) {
  const values = [24, 25, 26, 27, 28, 29, 30].map((threshold) => ({ threshold, value: data.filter((teacher) => isBelowStandard(teacher, threshold)).length }));
  const max = Math.max(...values.map((item) => item.value), 1);
  const points = values.map((item, index) => `${55 + index * 82},${215 - (item.value / max) * 165}`).join(" ");
  return (
    <div className="line-wrap" data-export-json={JSON.stringify(values.map((item) => ({ Standar_JP: item.threshold, Jumlah_Di_Bawah_Standar: item.value })))}><svg className="simulation-svg" viewBox="0 0 620 260" role="img" aria-label="Perubahan guru di bawah standar berdasarkan simulasi JP">
      {[50, 90, 130, 170, 215].map((y) => <line key={y} x1="45" y1={y} x2="585" y2={y} className="grid-line" />)}
      <polyline points={points} fill="none" stroke="#2e6eb5" strokeWidth="4" strokeLinejoin="round" />
      {values.map((item, index) => { const x = 55 + index * 82; const y = 215 - (item.value / max) * 165; return <g key={item.threshold} className="line-point" onClick={() => { setStandard(item.threshold); window.dispatchEvent(new CustomEvent("dashboard-scenario-filter", { detail: item.threshold })); }}><circle cx={x} cy={y} r={standard === item.threshold ? 8 : 5} fill={standard === item.threshold ? "#e3ad2f" : "#2e6eb5"} /><text x={x} y={y - 12} textAnchor="middle">{item.value}</text><text x={x} y="242" textAnchor="middle">{item.threshold} JP</text></g>; })}
    </svg></div>
  );
}

function DetailTable({ data, segments, clearSegments, page }: { data: Teacher[]; segments: Segments; clearSegments: () => void; page: string }) {
  const [search, setSearch] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const pageSize = 12;
  const searched = useMemo(() => { const query = search.trim().toLowerCase(); return query ? data.filter((teacher) => `${teacher.nik} ${teacher.name} ${teacher.school} ${teacher.subject}`.toLowerCase().includes(query)) : data; }, [data, search]);
  const maxPage = Math.max(Math.ceil(searched.length / pageSize) - 1, 0);
  const safePage = Math.min(pageIndex, maxPage);
  const displayed = searched.slice(safePage * pageSize, safePage * pageSize + pageSize);
  const active = Object.entries(segments).flatMap(([group, values]) => values.map((value) => ({ group, value })));

  function exportCsv() {
    const header = ["NIK", "Nama", "Grup Jenjang", "Jenjang", "Program Sekolah", "Kategori Guru", "Sekolah", "Status", "Bidang Studi", "JTM", "Jam Tambahan", "Jumlah Jabatan Tambahan", "Jam Aktual", "Standar JP", "Kepatuhan"];
    const rows = searched.map((teacher) => [teacher.nik, teacher.name, teacher.groupJenjang, teacher.jenjang, teacher.program, teacher.teacherCategory, teacher.school, teacher.status, teacher.subject, teacher.jtm, teacher.taskHours, teacher.taskCount, teacher.actual, standardForTeacher(teacher), teacher.compliance]);
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `data-karyawan-${page}.csv`; link.click(); URL.revokeObjectURL(url);
  }

  return (
    <section className="detail-section">
      <div className="detail-header"><div><p className="eyebrow">Detail terpilih</p><h3>Data Karyawan Sesuai Pilihan Chart</h3><p>{formatNumber(searched.length)} karyawan ditemukan</p></div><div className="detail-actions"><input className="table-search" value={search} onChange={(event) => { setSearch(event.target.value); setPageIndex(0); }} placeholder="Cari nama atau NIK..." aria-label="Cari nama atau NIK" /><button className="export-button" onClick={exportCsv}>Unduh CSV</button></div></div>
      {active.length > 0 && <div className="active-filters"><span>Filter chart aktif:</span>{active.map((item) => <em className="filter-chip" key={`${item.group}-${item.value}`}>{item.value}</em>)}<button className="clear-button" onClick={clearSegments}>Hapus semua</button></div>}
      <div className="table-wrap"><table><thead><tr><th>NIK</th><th>Nama Lengkap</th><th>Grup Jenjang</th><th>Jenjang</th><th>Program</th><th>Kategori Guru</th><th>Sekolah / Payroll</th><th>Status</th><th>Bidang Studi</th><th>JTM</th><th>Jam Tugas</th><th>Jumlah Jabatan</th><th>Aktual</th><th>Kepatuhan</th></tr></thead><tbody>{displayed.map((teacher) => <tr key={teacher.nik}><td className="mono">{teacher.nik}</td><td><strong>{teacher.name}</strong><small>{teacher.statusIndividu}{teacher.isWakasek ? " • Wakasek" : ""}{teacher.isBK ? " • BK" : ""}</small></td><td><span className="group-badge">{teacher.groupJenjang}</span></td><td><span className="level-badge">{teacher.jenjang}</span></td><td>{teacher.program}</td><td>{teacher.teacherCategory}</td><td>{teacher.school}<small>{teacher.payroll}</small></td><td>{teacher.status}</td><td>{teacher.subject}</td><td>{teacher.jtm}</td><td>{teacher.taskHours}</td><td>{teacher.taskCount}</td><td><strong>{teacher.actual}</strong></td><td><span className={`status-pill status-${teacher.compliance.toLowerCase().replaceAll(" ", "-")}`}>{teacher.compliance}</span></td></tr>)}</tbody></table>{!displayed.length && <div className="table-empty">Tidak ada data yang sesuai dengan filter aktif.</div>}</div>
      <div className="pagination"><span>Menampilkan {displayed.length ? safePage * pageSize + 1 : 0}-{Math.min((safePage + 1) * pageSize, searched.length)} dari {formatNumber(searched.length)}</span><div><button disabled={safePage === 0} onClick={() => setPageIndex(Math.max(safePage - 1, 0))}>Sebelumnya</button><strong>{safePage + 1} / {maxPage + 1}</strong><button disabled={safePage >= maxPage} onClick={() => setPageIndex(Math.min(safePage + 1, maxPage))}>Berikutnya</button></div></div>
    </section>
  );
}

export default function DashboardClient({ initialTeachers }: { initialTeachers: Teacher[] }) {
  const teachers = useMemo(() => initialTeachers.map((teacher) => ({
    ...teacher,
    compliance: complianceAtStandard(teacher),
  })), [initialTeachers]);
  const [activePage, setActivePage] = useState("summary");
  const [mobileNav, setMobileNav] = useState(false);
  const [filters, setFilters] = useState<FilterState>({ year: [], groupJenjang: [], jenjang: [], program: [], teacherCategory: [], school: [], status: [], individual: [] });
  const [segments, setSegments] = useState<Segments>({});
  const [workTab, setWorkTab] = useState("Tatap Muka");
  const [taskTab, setTaskTab] = useState("Umum");
  const [orgTab, setOrgTab] = useState("Sekolah");
  const [simTab, setSimTab] = useState("Standar JP");
  const [standard, setStandard] = useState(24);
  const [extraHours, setExtraHours] = useState(3);

  useEffect(() => {
    const selectScenario = (event: Event) => {
      const threshold = (event as CustomEvent<number>).detail;
      window.setTimeout(() => {
        setStandard(threshold);
        setSegments({ scenario: ["Di bawah standar"] });
      }, 0);
    };
    window.addEventListener("dashboard-scenario-filter", selectScenario);
    return () => window.removeEventListener("dashboard-scenario-filter", selectScenario);
  }, []);

  const options = useMemo(() => ({ years: unique(teachers.map((teacher) => teacher.year)), groupLevels: ["TK", "SD", "SMP", "SLTA", "Primary", "Secondary"].filter((group) => teachers.some((teacher) => teacher.groupJenjang === group)), levels: ["TK", "SD", "SMP", "SLTA", "Internasional"], programs: unique(teachers.map((teacher) => teacher.program)), teacherCategories: ["Guru Nasional", "Guru Bilingual", "Guru Internasional"].filter((category) => teachers.some((teacher) => teacher.statusIndividu === "Non-Kasek" && teacher.teacherCategory === category)), schools: unique(teachers.filter((teacher) => (filters.groupJenjang.length === 0 || filters.groupJenjang.includes(teacher.groupJenjang)) && (filters.jenjang.length === 0 || filters.jenjang.includes(teacher.jenjang))).map((teacher) => teacher.school)), statuses: unique(teachers.map((teacher) => teacher.status)) }), [filters.groupJenjang, filters.jenjang, teachers]);
  const baseData = useMemo(() => teachers.filter((teacher) => (filters.year.length === 0 || filters.year.includes(teacher.year)) && (filters.groupJenjang.length === 0 || filters.groupJenjang.includes(teacher.groupJenjang)) && (filters.jenjang.length === 0 || filters.jenjang.includes(teacher.jenjang)) && (filters.program.length === 0 || filters.program.includes(teacher.program)) && (filters.teacherCategory.length === 0 || (teacher.statusIndividu === "Non-Kasek" && filters.teacherCategory.includes(teacher.teacherCategory))) && (filters.school.length === 0 || filters.school.includes(teacher.school)) && (filters.status.length === 0 || filters.status.includes(teacher.status)) && (filters.individual.length === 0 || filters.individual.includes(teacher.statusIndividu))), [filters, teachers]);
  const filteredData = useMemo(() => filterBySegments(baseData, segments, standard), [baseData, segments, standard]);

  function updateFilter(key: keyof FilterState, value: string[]) { setFilters((current) => ({ ...current, [key]: value, ...((key === "jenjang" || key === "groupJenjang") ? { school: [] } : {}) })); setSegments({}); }
  function toggleLevel(level: string) { updateFilter("jenjang", filters.jenjang.includes(level) ? filters.jenjang.filter((item) => item !== level) : [...filters.jenjang, level]); }
  function toggleSegment(group: string, value: string) { setSegments((current) => { const values = current[group] || []; return { ...current, [group]: values.includes(value) ? values.filter((item) => item !== value) : [...values, value] }; }); }
  function navigate(page: string) { setActivePage(page); setSegments({}); setMobileNav(false); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function resetAll() { setFilters({ year: [], groupJenjang: [], jenjang: [], program: [], teacherCategory: [], school: [], status: [], individual: [] }); setSegments({}); }

  const summaryData = baseData.filter((teacher) => teacher.statusIndividu === "Non-Kasek");
  const summaryFilteredData = filterBySegments(summaryData, segments, standard);
  const avgActual = summaryData.length ? summaryData.reduce((sum, teacher) => sum + teacher.actual, 0) / summaryData.length : 0;
  const usesNonKasekPopulation = activePage === "summary" || activePage === "workload" || (activePage === "organization" && orgTab !== "Status");
  const activeRecordData = usesNonKasekPopulation ? summaryFilteredData : filteredData;
  const teacherCategoryCount = (category: string) => summaryData.filter((teacher) => teacher.teacherCategory === category).length;
  let pageData = filteredData;
  if (usesNonKasekPopulation) pageData = summaryFilteredData;
  if (activePage === "tasks" && taskTab !== "Umum") pageData = filteredData.filter((teacher) => taskTab === "Wakasek" ? teacher.isWakasek : taskTab === "BK" ? teacher.isBK : teacher.statusIndividu === "Kasek");
  const taskChartData = taskTab === "Umum" ? baseData : pageData;

  return (
    <ChartExportContext.Provider value={{ people: pageData, standard }}>
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <div className="brand"><div className="brand-mark"><Image src="/logo-bpk-penabur-jakarta.png" alt="Logo BPK PENABUR Jakarta" width={55} height={64} priority /></div><div className="brand-copy"><strong>BPK PENABUR Jakarta</strong><small>Bagian Sistem dan Analitik Data</small><small>Bagian Riset dan Pengembangan</small></div></div>
        <nav>{menuItems.map((item) => <button key={item.id} onClick={() => navigate(item.id)} className={activePage === item.id ? "active" : ""}><span>{item.index}</span><div><strong>{item.short}</strong><small>{item.label}</small></div></button>)}</nav>
        <div className="sidebar-footer"><p>Data Tahun Pelajaran</p><strong>2025 / 2026</strong><span>2.230 tenaga pendidik</span></div>
      </aside>

      <main className="main-content">
        <header className="topbar"><button className="mobile-menu" onClick={() => setMobileNav((current) => !current)} aria-label="Buka menu">☰</button><div><p>Dashboard Analitik</p><h1>{menuItems.find((item) => item.id === activePage)?.label}</h1></div><div className="topbar-meta"><span className="live-dot" /><div><strong>Data terverifikasi</strong><small>Diperbarui 22 Juli 2026</small></div><form action="/api/auth/logout" method="post"><button className="logout-button" type="submit">Keluar</button></form></div></header>
        <section className="filter-panel">
          <div className="level-chips"><span>Jenjang · bisa pilih lebih dari satu</span><div><button className={filters.jenjang.length === 0 ? "active" : ""} onClick={() => updateFilter("jenjang", [])}>Semua</button>{options.levels.map((level) => <button className={filters.jenjang.includes(level) ? "active" : ""} onClick={() => toggleLevel(level)} key={level}>{level}</button>)}</div></div>
          <div className="filter-row">
            <MultiSelectControl label="Tahun Pelajaran" selected={filters.year} values={options.years} onChange={(value) => updateFilter("year", value)} />
            <MultiSelectControl label="Grup Jenjang" selected={filters.groupJenjang} values={options.groupLevels} onChange={(value) => updateFilter("groupJenjang", value)} />
            <MultiSelectControl label="Program" selected={filters.program} values={options.programs} onChange={(value) => updateFilter("program", value)} />
            <MultiSelectControl label="Kategori Guru" selected={filters.teacherCategory} values={options.teacherCategories} onChange={(value) => updateFilter("teacherCategory", value)} />
            <MultiSelectControl label="Sekolah" selected={filters.school} values={options.schools} onChange={(value) => updateFilter("school", value)} />
            <MultiSelectControl label="Status Kontrak" selected={filters.status} values={options.statuses} onChange={(value) => updateFilter("status", value)} />
            <MultiSelectControl label="Status Individu" selected={filters.individual} values={["Non-Kasek", "Kasek"]} onChange={(value) => updateFilter("individual", value)} />
            <button className="reset-button" onClick={resetAll}>Atur ulang</button>
          </div>
        </section>

        <section className="dashboard-body">
          <div className="page-intro"><div><p className="eyebrow">TP 2025/2026</p><h2>{menuItems.find((item) => item.id === activePage)?.label}</h2><p>Gunakan filter atau klik elemen chart untuk menampilkan karyawan yang termasuk dalam pilihan.</p></div><div className="record-count"><span>Data aktif</span><strong>{formatNumber(activeRecordData.length)}</strong><small>{usesNonKasekPopulation ? "guru Non-Kasek" : `dari ${formatNumber(teachers.length)} NIK`}</small></div></div>
          <div className="standard-policy-note"><strong>Standar kepatuhan:</strong><span>24 JP untuk TK, SD, SMP, dan SLTA</span><i aria-hidden="true" /><span>30 JP untuk Internasional</span></div>

          {activePage === "summary" && <><div className="kpi-grid"><KpiCard label="Total Guru" value={formatNumber(summaryData.length)} helper="Non-Kasek · sesuai Data Studio" tone="navy" /><KpiCard label="Guru Nasional" value={formatNumber(teacherCategoryCount("Guru Nasional"))} helper="Kategori Guru Final" /><KpiCard label="Guru Bilingual" value={formatNumber(teacherCategoryCount("Guru Bilingual"))} helper="Kategori Guru Final" tone="gold" /><KpiCard label="Guru Internasional" value={formatNumber(teacherCategoryCount("Guru Internasional"))} helper="Kategori Guru Final" tone="green" /><KpiCard label="Di Bawah Standar" value={formatNumber(summaryData.filter((teacher) => isBelowStandard(teacher)).length)} helper="Khusus guru Non-Kasek" tone="red" /></div><div className="chart-grid"><ChartCard title="Jumlah Guru per Jenjang" subtitle="Khusus Non-Kasek · klik batang untuk melihat detail"><ColumnChart data={countBy(summaryData, (teacher) => teacher.jenjang)} group="jenjang" segments={segments} onToggle={toggleSegment} /></ChartCard><ChartCard title="Kepatuhan Jam Aktual Guru" subtitle="Non-Kasek · batang vertikal berdampingan per jenjang"><GroupedComplianceBars data={summaryData} segments={segments} onToggle={toggleSegment} /></ChartCard><ChartCard title="Komposisi Kategori Guru" subtitle="Kategori Guru Final · khusus Non-Kasek"><DonutChart data={countBy(summaryData, (teacher) => teacher.teacherCategory)} group="teacherCategory" segments={segments} onToggle={toggleSegment} /></ChartCard><ChartCard title="Sekolah dengan Guru Terbanyak" subtitle="Non-Kasek · 10 unit teratas"><HorizontalBars data={countBy(summaryData, (teacher) => teacher.school)} group="school" segments={segments} onToggle={toggleSegment} /></ChartCard></div></>}

          {activePage === "workload" && <><div className="tab-row">{["Tatap Muka", "Tugas Tambahan", "Jam Aktual", "Kepatuhan"].map((tab) => <button className={workTab === tab ? "active" : ""} key={tab} onClick={() => { setWorkTab(tab); setSegments({}); }}>{tab}</button>)}</div><div className="kpi-grid compact"><KpiCard label="Rata-rata Tatap Muka" value={`${formatNumber(summaryData.reduce((s, t) => s + t.jtm, 0) / Math.max(summaryData.length, 1), 1)} JP`} helper="Total JP Tatap Muka Per Individu" /><KpiCard label="Rata-rata Tugas Tambahan" value={`${formatNumber(summaryData.reduce((s, t) => s + t.taskHours, 0) / Math.max(summaryData.length, 1), 1)} JP`} helper="Total JP Tugas Tambahan Per Individu" tone="gold" /><KpiCard label="Rata-rata Jam Aktual" value={`${formatNumber(avgActual, 1)} JP`} helper="Total Jam Aktual Final Per Individu" tone="green" /><KpiCard label="Di Bawah Standar" value={formatNumber(summaryData.filter((teacher) => isBelowStandard(teacher)).length)} helper="Guru Non-Kasek · Internasional 30 JP" tone="red" /></div><div className="chart-grid">{workTab !== "Kepatuhan" && <ChartCard title={workTab === "Tatap Muka" ? "Total Jam Tatap Muka" : workTab === "Tugas Tambahan" ? "Total Tugas Jam Tambahan" : "Total Jam Aktual"} subtitle={workTab === "Tatap Muka" ? "Jumlah guru menurut Total JP Tatap Muka Per Individu" : workTab === "Tugas Tambahan" ? "Jumlah guru menurut Total JP Tugas Tambahan Per Individu" : "Jumlah guru menurut Total Jam Aktual Final Per Individu"} wide><DataStudioBarChart data={countByNumber(summaryData, workTab === "Tatap Muka" ? (teacher) => teacher.jtm : workTab === "Tugas Tambahan" ? (teacher) => teacher.taskHours : (teacher) => teacher.actual)} group={workTab === "Tatap Muka" ? "jtmValue" : workTab === "Tugas Tambahan" ? "taskHoursValue" : "actualValue"} segments={segments} onToggle={toggleSegment} axisTitle={workTab === "Tatap Muka" ? "Total JP Tatap Muka Per Individu" : workTab === "Tugas Tambahan" ? "Total JP Tugas Tambahan Per Individu" : "Total Jam Aktual Final Per Individu"} /></ChartCard>}{workTab !== "Kepatuhan" && <ChartCard title={`Rata-rata ${workTab} per Jenjang`} subtitle="Khusus guru Non-Kasek · dalam JP"><HorizontalBars data={averageBy(summaryData, (teacher) => teacher.jenjang, workTab === "Tatap Muka" ? (teacher) => teacher.jtm : workTab === "Tugas Tambahan" ? (teacher) => teacher.taskHours : (teacher) => teacher.actual)} group="jenjang" segments={segments} onToggle={toggleSegment} valueSuffix=" JP" maxItems={6} /></ChartCard>}{workTab === "Kepatuhan" && <ChartCard title="Kepatuhan per Jenjang" subtitle="Guru Non-Kasek · standar 24 JP, Internasional 30 JP" wide><GroupedComplianceBars data={summaryData} segments={segments} onToggle={toggleSegment} /></ChartCard>}<ChartCard title="Hubungan JTM dan Jam Aktual" subtitle="Guru Non-Kasek · klik titik untuk memilih individu" wide={workTab === "Kepatuhan"}><ScatterPlot data={summaryData} segments={segments} onToggle={toggleSegment} /></ChartCard></div></>}

          {activePage === "tasks" && <>
            <div className="tab-row">{["Umum", "Wakasek", "BK", "Kasek"].map((tab) => <button className={taskTab === tab ? "active" : ""} key={tab} onClick={() => { setTaskTab(tab); setSegments(tab === "Umum" ? {} : { role: [tab] }); }}>{tab}</button>)}</div>
            <div className="kpi-grid compact"><KpiCard label="Dengan Tugas Tambahan" value={formatNumber(pageData.filter((teacher) => teacher.taskHours > 0).length)} helper="Memiliki konversi jam" tone="gold" /><KpiCard label="Tanpa Tugas Tambahan" value={formatNumber(pageData.filter((teacher) => teacher.taskHours === 0).length)} helper="Tidak ada konversi tugas" /><KpiCard label="Rata-rata Jam Tugas" value={`${formatNumber(pageData.reduce((s, t) => s + t.taskHours, 0) / Math.max(pageData.length, 1), 1)} JP`} helper={`Kelompok ${taskTab}`} tone="green" /><KpiCard label="Lebih dari Satu Tugas" value={formatNumber(pageData.filter((teacher) => teacher.taskCount > 1).length)} helper="Perlu pemantauan beban" tone="red" /></div>
            {taskTab === "Umum" ? <div className="chart-grid">
              <ChartCard title="TENAGA PENDIDIK BERDASARKAN TUGAS TAMBAHAN" subtitle="Satu NIK per tenaga pendidik"><TaskPresencePie data={taskChartData} segments={segments} onToggle={toggleSegment} /></ChartCard>
              <ChartCard title="Jumlah Tenaga Pendidik berdasarkan Tugas Tambahan" subtitle="Posisi: jam dan jumlah jabatan · ukuran: jumlah guru"><TaskBubbleChart data={taskChartData} segments={segments} onToggle={toggleSegment} /></ChartCard>
              <ChartCard title="Total Jam Tatap Muka" subtitle="Jumlah tenaga pendidik menurut Total JP Tatap Muka Per Individu" wide><DataStudioBarChart data={countByNumber(taskChartData, (teacher) => teacher.jtm)} group="jtmValue" segments={segments} onToggle={toggleSegment} axisTitle="Total JP Tatap Muka Per Individu" /></ChartCard>
              <ChartCard title="Tenaga Pendidik dengan Tugas Tambahan" subtitle="Grouped vertical bars non-stacked menurut jumlah jabatan" wide><GroupedTaskBars data={taskChartData.filter((teacher) => teacher.taskCount > 0)} categoryGetter={(teacher) => numericLabel(teacher.jtm)} categoryGroup="jtmValue" numericCategories series={[1, 2, 3]} segments={segments} onToggle={toggleSegment} axisTitle="Total JP Tatap Muka Per Individu" /></ChartCard>
              <ChartCard title="Jumlah Jabatan Tambahan" subtitle="Jumlah NIK unik per banyaknya jabatan"><DataStudioBarChart data={countByNumber(taskChartData, (teacher) => teacher.taskCount)} group="taskCount" segments={segments} onToggle={toggleSegment} axisTitle="Jumlah Jabatan Tambahan Per Individu" /></ChartCard>
              <ChartCard title="Jenis Tugas Tambahan" subtitle="10 jenis tugas terbanyak"><HorizontalBars data={countBy(taskChartData.flatMap((teacher) => teacher.tasks.map((task) => ({ task }))), (item) => item.task)} group="taskType" segments={segments} onToggle={toggleSegment} maxItems={10} /></ChartCard>
              <ChartCard title="Status Kontrak dan Jumlah Jabatan Tambahan" subtitle="Grouped vertical bars non-stacked · seluruh NIK unik" wide><GroupedTaskBars data={taskChartData} categoryGetter={(teacher) => teacher.status} categoryGroup="status" categoryOrder={["PKWTT", "PKWT Penuh Waktu", "PKWT Pensiun", "PKWT Paruh Waktu", "PKWT Ekspatriat"]} series={[0, 1, 2, 3]} segments={segments} onToggle={toggleSegment} axisTitle="Status Kontrak" /></ChartCard>
            </div> : <div className="chart-grid">
              <ChartCard title={`Jenis Tugas Tambahan - ${taskTab}`} subtitle="Klik jenis tugas untuk melihat nama karyawan"><HorizontalBars data={countBy(taskChartData.flatMap((teacher) => teacher.tasks.map((task) => ({ task }))), (item) => item.task)} group="taskType" segments={segments} onToggle={toggleSegment} maxItems={10} /></ChartCard>
              <ChartCard title="Jumlah Tugas per Individu" subtitle="Distribusi banyaknya tugas"><ColumnChart data={countBy(taskChartData, (teacher) => String(teacher.taskCount))} group="taskCount" segments={segments} onToggle={toggleSegment} /></ChartCard>
              <ChartCard title="Jam Tugas Tambahan" subtitle="Distribusi konversi jam"><Histogram data={taskChartData} metric={(teacher) => teacher.taskHours} group="taskBucket" segments={segments} onToggle={toggleSegment} /></ChartCard>
              <ChartCard title="Persebaran per Jenjang" subtitle={`Tenaga pendidik dalam kelompok ${taskTab}`}><HorizontalBars data={countBy(taskChartData, (teacher) => teacher.jenjang)} group="jenjang" segments={segments} onToggle={toggleSegment} maxItems={6} /></ChartCard>
            </div>}
          </>}

          {activePage === "organization" && <><div className="tab-row">{["Sekolah", "Mata Pelajaran", "Payroll", "Lokasi", "Status"].map((tab) => <button className={orgTab === tab ? "active" : ""} key={tab} onClick={() => { setOrgTab(tab); setSegments({}); }}>{tab}</button>)}</div><div className="chart-grid">{orgTab === "Sekolah" && <><ChartCard title="Jumlah Guru per Sekolah" subtitle="Guru Non-Kasek · 15 sekolah teratas" wide><HorizontalBars data={countBy(summaryData, (teacher) => teacher.school)} group="school" segments={segments} onToggle={toggleSegment} maxItems={15} /></ChartCard><ChartCard title="Rata-rata Jam Aktual per Sekolah" subtitle="Guru Non-Kasek · 10 unit teratas"><HorizontalBars data={averageBy(summaryData, (teacher) => teacher.school, (teacher) => teacher.actual)} group="school" segments={segments} onToggle={toggleSegment} valueSuffix=" JP" /></ChartCard></>}{orgTab === "Mata Pelajaran" && <><ChartCard title="Jumlah Guru per Mata Pelajaran" subtitle="Guru Non-Kasek · 15 mapel teratas" wide><HorizontalBars data={countBy(summaryData, (teacher) => teacher.subject)} group="subject" segments={segments} onToggle={toggleSegment} maxItems={15} /></ChartCard><ChartCard title="Rata-rata Jam Aktual per Mapel" subtitle="Guru Non-Kasek · 10 mapel dengan rata-rata tertinggi"><HorizontalBars data={averageBy(summaryData, (teacher) => teacher.subject, (teacher) => teacher.actual)} group="subject" segments={segments} onToggle={toggleSegment} valueSuffix=" JP" /></ChartCard></>}{orgTab === "Payroll" && <ChartCard title="Jumlah Guru Berdasarkan Lokasi Payroll" subtitle="Jumlah guru Non-Kasek menurut parameter Payroll · geser chart untuk melihat seluruh lokasi" wide><DataStudioBarChart data={countBy(summaryData, (teacher) => teacher.payroll).sort((a, b) => a.label.localeCompare(b.label, "id"))} group="payroll" segments={segments} onToggle={toggleSegment} axisTitle="Payroll" /></ChartCard>}{orgTab === "Lokasi" && <><ChartCard title="Guru Berdasarkan Jumlah Lokasi" subtitle="Guru Non-Kasek · klik batang untuk melihat nama"><ColumnChart data={countBy(summaryData, (teacher) => String(teacher.schoolCount))} group="schoolCount" segments={segments} onToggle={toggleSegment} /></ChartCard><ChartCard title="Jumlah Lokasi vs Jam Aktual" subtitle="Sebaran guru Non-Kasek"><ScatterPlot data={summaryData} segments={segments} onToggle={toggleSegment} mode="location" /></ChartCard></>}{orgTab === "Status" && <ChartCard title="STATUS GURU" subtitle={`Seluruh ${formatNumber(baseData.length)} NIK unik · klik batang untuk melihat detail`} wide><DataStudioBarChart data={countBy(baseData, (teacher) => teacher.status)} group="status" segments={segments} onToggle={toggleSegment} axisTitle="Status Kontrak" /></ChartCard>}</div></>}

          {activePage === "simulation" && <><div className="tab-row">{["Standar JP", "Kebutuhan Guru", "Pemerataan Tugas", "Perbandingan Jenjang"].map((tab) => <button className={simTab === tab ? "active" : ""} key={tab} onClick={() => { setSimTab(tab); setSegments({}); }}>{tab}</button>)}</div>{simTab === "Standar JP" && <><div className="scenario-panel"><div><p>Standar simulasi jenjang lain</p><strong>{standard} JP</strong></div><input type="range" min="24" max="30" value={standard} onChange={(event) => { setStandard(Number(event.target.value)); setSegments({}); }} /><span>24 JP</span><span>30 JP</span></div><div className="kpi-grid compact"><KpiCard label="Di Bawah Standar" value={formatNumber(baseData.filter((teacher) => isBelowStandard(teacher, standard)).length)} helper={`Jenjang lain ${standard} JP · Internasional 30 JP`} tone="red" /><KpiCard label="Tepat Standar" value={formatNumber(baseData.filter((teacher) => teacher.actual === standardForTeacher(teacher, standard)).length)} helper={`Jenjang lain ${standard} JP · Internasional 30 JP`} tone="gold" /><KpiCard label="Di Atas Standar" value={formatNumber(baseData.filter((teacher) => teacher.actual > standardForTeacher(teacher, standard)).length)} helper={`Jenjang lain ${standard} JP · Internasional 30 JP`} tone="green" /></div><div className="chart-grid"><ChartCard title="Dampak Perubahan Standar 24-30 JP" subtitle="Internasional tetap menggunakan standar 30 JP" exportPeople={pageData.filter((teacher) => isBelowStandard(teacher, standard))}><SimulationLine data={baseData} standard={standard} setStandard={(value) => { setStandard(value); setSegments({}); }} /></ChartCard><ChartCard title="Kategori per Jenjang" subtitle={`Jenjang lain ${standard} JP · Internasional 30 JP`}><StackedCompliance data={baseData} segments={segments} onToggle={toggleSegment} standard={standard} /></ChartCard></div></>}{simTab === "Kebutuhan Guru" && <div className="readiness-grid"><EmptyState title="Data formasi belum tersedia" body="Perhitungan kebutuhan guru per mapel memerlukan jumlah rombel, JP kurikulum per mapel, dan formasi guru per sekolah. Dashboard tidak membuat estimasi tanpa sumber resmi." /><ChartCard title="Data yang Sudah Tersedia" subtitle="Siap digunakan ketika data formasi ditambahkan"><HorizontalBars data={countBy(baseData, (teacher) => teacher.subject)} group="subject" segments={segments} onToggle={toggleSegment} maxItems={12} /></ChartCard></div>}{simTab === "Pemerataan Tugas" && <><div className="scenario-panel"><div><p>Tambahan jam simulasi</p><strong>+{extraHours} JP</strong></div><input type="range" min="0" max="12" step="3" value={extraHours} onChange={(event) => setExtraHours(Number(event.target.value))} /><span>0 JP</span><span>12 JP</span></div><div className="kpi-grid compact"><KpiCard label="Di Bawah Sebelum" value={formatNumber(baseData.filter((teacher) => isBelowStandard(teacher)).length)} helper="24 JP · Internasional 30 JP" tone="red" /><KpiCard label="Memenuhi Setelah Simulasi" value={formatNumber(baseData.filter((teacher) => isBelowStandard(teacher) && teacher.actual + extraHours >= standardForTeacher(teacher)).length)} helper={`Berubah setelah +${extraHours} JP`} tone="green" /><KpiCard label="Masih Di Bawah" value={formatNumber(baseData.filter((teacher) => teacher.actual + extraHours < standardForTeacher(teacher)).length)} helper="Perlu tindak lanjut" tone="gold" /></div><ChartCard title="Dampak Pemerataan per Jenjang" subtitle="Mencapai standar 24 JP · Internasional 30 JP" wide exportPeople={pageData.filter((teacher) => isBelowStandard(teacher) && teacher.actual + extraHours >= standardForTeacher(teacher))}><HorizontalBars data={["TK", "SD", "SMP", "SLTA", "Internasional"].map((level) => ({ label: level, value: baseData.filter((teacher) => teacher.jenjang === level && isBelowStandard(teacher) && teacher.actual + extraHours >= standardForTeacher(teacher)).length }))} group="jenjang" segments={segments} onToggle={toggleSegment} maxItems={6} /></ChartCard></>}{simTab === "Perbandingan Jenjang" && <div className="chart-grid"><ChartCard title="Jumlah Tenaga Pendidik" subtitle="Perbandingan seluruh jenjang"><ColumnChart data={countBy(baseData, (teacher) => teacher.jenjang)} group="jenjang" segments={segments} onToggle={toggleSegment} /></ChartCard><ChartCard title="Kepatuhan Jam Aktual" subtitle="24 JP · Internasional 30 JP"><StackedCompliance data={baseData} segments={segments} onToggle={toggleSegment} /></ChartCard></div>}</>}

          <DetailTable data={pageData} segments={segments} clearSegments={() => setSegments({})} page={activePage} />
        </section>
        <footer><span>Bagian Riset dan Pengembangan</span><strong>BPK PENABUR Jakarta</strong><span>TP 2025/2026</span></footer>
      </main>
      {mobileNav && <button className="nav-backdrop" onClick={() => setMobileNav(false)} aria-label="Tutup menu" />}
    </div>
    </ChartExportContext.Provider>
  );
}
