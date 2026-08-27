import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { authCookie, verifySession } from "@/lib/auth";
import { googleSheetExportUrl, parseImportWorkbook } from "@/lib/data-import";

export const runtime = "nodejs";

async function readSource(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  const googleUrl = String(form.get("googleUrl") || "").trim();
  if (file instanceof File && file.size > 0) return { buffer: await file.arrayBuffer(), sourceName: file.name };
  if (googleUrl) {
    const response = await fetch(googleSheetExportUrl(googleUrl), { cache: "no-store" });
    if (!response.ok) throw new Error("Google Sheets tidak dapat dibaca. Pastikan link dapat diakses oleh siapa pun yang memiliki link.");
    return { buffer: await response.arrayBuffer(), sourceName: "Google Sheets" };
  }
  throw new Error("Pilih file Excel atau masukkan link Google Sheets.");
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = await verifySession(cookieStore.get(authCookie.name)?.value);
  if (!session) return NextResponse.json({ message: "Sesi tidak valid." }, { status: 401 });
  if (!process.env.DATABASE_URL) return NextResponse.json({ message: "DATABASE_URL belum dikonfigurasi pada server dashboard." }, { status: 503 });

  try {
    const { buffer, sourceName } = await readSource(request);
    const parsed = parseImportWorkbook(buffer);
    if (parsed.errors.length) return NextResponse.json({ ok: false, message: "Import dibatalkan karena masih ada error validasi.", errors: parsed.errors, warnings: parsed.warnings }, { status: 400 });

    const sql = neon(process.env.DATABASE_URL);
    const yearsJson = JSON.stringify(parsed.years);
    const existingYears = await sql`SELECT code FROM academic_years WHERE code IN (SELECT value FROM jsonb_array_elements_text(${yearsJson}::jsonb))` as { code: string }[];
    const existing = new Set(existingYears.map((item) => item.code));
    const missingYears = parsed.years.filter((item) => !existing.has(item));
    if (missingYears.length) return NextResponse.json({ ok: false, message: `Tahun Pelajaran belum terdaftar di database: ${missingYears.join(", ")}. Tambahkan tahun pelajaran dan standar JP terlebih dahulu.` }, { status: 400 });

    const profilesJson = JSON.stringify(parsed.profiles);
    const assignmentsJson = JSON.stringify(parsed.assignments);
    const tasksJson = JSON.stringify(parsed.tasks);

    await sql.transaction([
      sql`
        WITH source AS (
          SELECT * FROM jsonb_to_recordset(${profilesJson}::jsonb) AS x(
            year text, nik text, name text, gender text, status text, "statusIndividu" text,
            "teacherCategory" text, school text, payroll text, "groupJenjang" text, jenjang text,
            program text, subject text, "crossLevel" text, "className" text, "isWakasek" boolean,
            "isBK" boolean, jtm numeric
          )
        ), teacher_upsert AS (
          INSERT INTO teachers(nik, full_name, gender)
          SELECT DISTINCT nik, name, gender FROM source
          ON CONFLICT (nik) DO UPDATE SET full_name = EXCLUDED.full_name, gender = EXCLUDED.gender, updated_at = now()
          RETURNING id
        ), school_upsert AS (
          INSERT INTO schools(name, payroll, jenjang, group_jenjang, program)
          SELECT DISTINCT school, NULLIF(payroll,''), jenjang, "groupJenjang", program FROM source WHERE school <> ''
          ON CONFLICT (name) DO UPDATE SET payroll = EXCLUDED.payroll, jenjang = EXCLUDED.jenjang, group_jenjang = EXCLUDED.group_jenjang, program = EXCLUDED.program, updated_at = now()
          RETURNING id
        ), subject_upsert AS (
          INSERT INTO subjects(name) SELECT DISTINCT subject FROM source WHERE subject <> ''
          ON CONFLICT (name) DO NOTHING RETURNING id
        )
        INSERT INTO teacher_year_profiles(
          teacher_id, academic_year_id, status_contract, status_individu, teacher_category,
          primary_school_id, group_jenjang, jenjang, program, primary_subject_id, cross_level,
          class_name, is_wakasek, is_bk, jtm, task_hours, updated_at
        )
        SELECT t.id, ay.id, s.status, s."statusIndividu", s."teacherCategory", sc.id,
               s."groupJenjang", s.jenjang, s.program, sub.id, COALESCE(NULLIF(s."crossLevel",''),'-'),
               COALESCE(NULLIF(s."className",''),'-'), s."isWakasek", s."isBK", s.jtm, 0, now()
        FROM source s
        JOIN teachers t ON t.nik = s.nik
        JOIN academic_years ay ON ay.code = s.year
        LEFT JOIN schools sc ON sc.name = s.school
        LEFT JOIN subjects sub ON sub.name = s.subject
        ON CONFLICT (teacher_id, academic_year_id) DO UPDATE SET
          status_contract=EXCLUDED.status_contract, status_individu=EXCLUDED.status_individu,
          teacher_category=EXCLUDED.teacher_category, primary_school_id=EXCLUDED.primary_school_id,
          group_jenjang=EXCLUDED.group_jenjang, jenjang=EXCLUDED.jenjang, program=EXCLUDED.program,
          primary_subject_id=EXCLUDED.primary_subject_id, cross_level=EXCLUDED.cross_level,
          class_name=EXCLUDED.class_name, is_wakasek=EXCLUDED.is_wakasek, is_bk=EXCLUDED.is_bk,
          jtm=EXCLUDED.jtm, task_hours=0, updated_at=now()
      `,
      sql`
        WITH source AS (
          SELECT * FROM jsonb_to_recordset(${assignmentsJson}::jsonb) AS x(year text, nik text, school text, subject text, "className" text, jtm numeric, "isPrimary" boolean)
        ), school_upsert AS (
          INSERT INTO schools(name) SELECT DISTINCT school FROM source WHERE school <> ''
          ON CONFLICT (name) DO NOTHING RETURNING id
        ), subject_upsert AS (
          INSERT INTO subjects(name) SELECT DISTINCT subject FROM source WHERE subject <> ''
          ON CONFLICT (name) DO NOTHING RETURNING id
        ), targets AS (
          SELECT p.id FROM teacher_year_profiles p JOIN teachers t ON t.id=p.teacher_id JOIN academic_years ay ON ay.id=p.academic_year_id
          WHERE (ay.code || '|' || t.nik) IN (SELECT year || '|' || nik FROM source)
        ), deleted AS (DELETE FROM teacher_assignments WHERE profile_id IN (SELECT id FROM targets))
        INSERT INTO teacher_assignments(profile_id, school_id, subject_id, class_name, jtm, is_primary)
        SELECT p.id, sc.id, sub.id, COALESCE(NULLIF(s."className",''),'-'), s.jtm, s."isPrimary"
        FROM source s JOIN teachers t ON t.nik=s.nik JOIN academic_years ay ON ay.code=s.year
        JOIN teacher_year_profiles p ON p.teacher_id=t.id AND p.academic_year_id=ay.id
        JOIN schools sc ON sc.name=s.school LEFT JOIN subjects sub ON sub.name=s.subject
        ON CONFLICT (profile_id, school_id, subject_id, class_name) DO UPDATE SET jtm=EXCLUDED.jtm, is_primary=EXCLUDED.is_primary
      `,
      sql`
        WITH source AS (
          SELECT * FROM jsonb_to_recordset(${tasksJson}::jsonb) AS x(year text, nik text, "taskName" text, "taskCategory" text, hours numeric, "isPrimary" boolean)
        ), targets AS (
          SELECT p.id FROM teacher_year_profiles p JOIN teachers t ON t.id=p.teacher_id JOIN academic_years ay ON ay.id=p.academic_year_id
          WHERE (ay.code || '|' || t.nik) IN (SELECT year || '|' || nik FROM source)
        ), deleted AS (DELETE FROM teacher_tasks WHERE profile_id IN (SELECT id FROM targets)), inserted AS (
          INSERT INTO teacher_tasks(profile_id, task_name, task_category, hours, is_primary)
          SELECT p.id, s."taskName", NULLIF(s."taskCategory",''), s.hours, s."isPrimary"
          FROM source s JOIN teachers t ON t.nik=s.nik JOIN academic_years ay ON ay.code=s.year
          JOIN teacher_year_profiles p ON p.teacher_id=t.id AND p.academic_year_id=ay.id
          ON CONFLICT (profile_id, task_name) DO UPDATE SET task_category=EXCLUDED.task_category, hours=EXCLUDED.hours, is_primary=EXCLUDED.is_primary
          RETURNING profile_id
        )
        UPDATE teacher_year_profiles p SET task_hours = COALESCE(x.total_hours,0), updated_at=now()
        FROM (
          SELECT target.id AS profile_id, COALESCE(SUM(tt.hours),0) AS total_hours
          FROM targets target LEFT JOIN teacher_tasks tt ON tt.profile_id=target.id GROUP BY target.id
        ) x WHERE p.id=x.profile_id
      `,
      sql`
        INSERT INTO import_batches(academic_year_id, source_filename, status, total_rows, valid_rows, invalid_rows, published_at, notes)
        SELECT ay.id, ${sourceName}, 'published', ${parsed.profiles.length}, ${parsed.profiles.length}, 0, now(),
               ${`Imported by ${session.username}; profiles=${parsed.profiles.length}; assignments=${parsed.assignments.length}; tasks=${parsed.tasks.length}`}
        FROM academic_years ay WHERE ay.code=${parsed.years[0] || ""}
      `,
    ]);

    return NextResponse.json({ ok: true, message: "Data berhasil diimport ke database.", years: parsed.years, counts: { profiles: parsed.profiles.length, assignments: parsed.assignments.length, tasks: parsed.tasks.length }, warnings: parsed.warnings });
  } catch (error) {
    console.error("Academic year import failed", error);
    const message = error instanceof Error ? error.message : "Import database gagal.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
