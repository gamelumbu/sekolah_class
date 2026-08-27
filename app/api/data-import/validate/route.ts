import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { authCookie, verifySession } from "@/lib/auth";
import { googleSheetExportUrl, parseImportWorkbook } from "@/lib/data-import";

export const runtime = "nodejs";

async function readSource(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  const googleUrl = String(form.get("googleUrl") || "").trim();

  if (file instanceof File && file.size > 0) {
    if (!/\.(xlsx|xls)$/i.test(file.name)) throw new Error("File harus berformat .xlsx atau .xls.");
    if (file.size > 15 * 1024 * 1024) throw new Error("Ukuran file maksimal 15 MB.");
    return { buffer: await file.arrayBuffer(), sourceName: file.name };
  }

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

  try {
    const { buffer, sourceName } = await readSource(request);
    const parsed = parseImportWorkbook(buffer);
    return NextResponse.json({
      ok: parsed.errors.length === 0,
      sourceName,
      years: parsed.years,
      counts: { profiles: parsed.profiles.length, assignments: parsed.assignments.length, tasks: parsed.tasks.length },
      errors: parsed.errors,
      warnings: parsed.warnings,
      preview: parsed.profiles.slice(0, 12).map((item) => ({ year: item.year, nik: item.nik, name: item.name, jenjang: item.jenjang, school: item.school, subject: item.subject, jtm: item.jtm })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "File tidak dapat diproses.";
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }
}
