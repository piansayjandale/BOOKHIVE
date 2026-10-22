import { NextResponse } from "next/server";
import { GET as getCardByQr } from "@/app/api/student/card-by-qr/[qr]/route";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ qr: string }> }
) {
  const accept = request.headers.get("accept") || "";
  const res = await getCardByQr(request, context);

  if (accept.includes("application/json") && !accept.includes("text/html")) {
    return res;
  }

  if (!res.ok) {
    return new NextResponse(
      `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Student Not Found | BookHive</title></head><body style="background:#0B132B;color:#fff;font-family:sans-serif;padding:40px 20px;text-align:center;"><h2>Student Account Not Found</h2><p style="color:#94A3B8;">The scanned QR code does not match any active student record in BookHive.</p></body></html>`,
      { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  const data = await res.json();
  const s = data.student || {};
  const card = data.libraryCard || {};
  const borrowed = card.borrowedBooks || data.borrowedBooks || [];
  const reserved = card.reservedBooks || data.reservedBooks || [];
  const violations = data.violations || [];
  const hasViolations = Boolean(data.hasViolations || violations.length > 0);
  const totalFine = Number(data.totalFine || 0);

  const combinedRows = [
    ...borrowed.map((b: any) => ({ ...b, isRes: false })),
    ...reserved.map((r: any) => ({ ...r, isRes: true })),
  ];

  const cardRowsHtml =
    combinedRows.length > 0
      ? combinedRows
          .map(
            (b: any) => `
          <tr>
            <td style="padding:10px 8px;border-bottom:1px solid #334155;font-size:12px;color:#CBD5E1;">${b.dateBorrowed || b.dateRequested || "N/A"}</td>
            <td style="padding:10px 8px;border-bottom:1px solid #334155;font-size:12px;font-weight:700;color:${b.isRes ? "#C084FC" : b.isOverdue ? "#F87171" : "#86EFAC"};">${b.isRes ? "Reservation" : b.dueDate || "N/A"}</td>
            <td style="padding:10px 8px;border-bottom:1px solid #334155;font-size:12px;font-weight:700;color:#FFF;">${b.title || "Untitled Book"}</td>
            <td style="padding:10px 8px;border-bottom:1px solid #334155;font-size:11px;font-weight:800;color:${b.isRes ? "#C084FC" : b.isOverdue ? "#F87171" : "#86EFAC"};">${b.status || (b.isRes ? "Reserved" : "Active")}</td>
          </tr>`
          )
          .join("")
      : `<tr><td colspan="4" style="text-align:center;color:#94A3B8;padding:18px;">No active borrowed or reserved books.</td></tr>`;

  const violationsHtml =
    violations.length > 0
      ? violations
          .map(
            (v: any) => `
          <div style="background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.35);border-radius:12px;padding:12px;margin-bottom:8px;">
            <div style="display:flex;justify-content:space-between;font-weight:800;color:#F87171;font-size:13px;">
              <span>⚠️ ${v.type || "Overdue Book"}</span>
              <span>₱${Number(v.fineAmount || 0).toFixed(2)}</span>
            </div>
            <div style="color:#E2E8F0;font-size:12px;margin-top:4px;"><strong>Book:</strong> ${v.bookTitle || "Library Resource"}</div>
            <div style="color:#CBD5E1;font-size:11px;margin-top:2px;">${v.description || ""}</div>
          </div>`
          )
          .join("")
      : `<div style="background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.35);border-radius:12px;padding:14px;color:#6EE7B7;font-weight:700;font-size:13px;text-align:center;">✅ Clear Record — No Active Violations or Unpaid Fines</div>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${s.name || "Student"} | BookHive Digital Library Card</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: #0B132B; color: #F8FAFC; padding: 16px; }
    .container { max-width: 520px; margin: 0 auto; }
    .header-bar { display: flex; align-items: center; justify-content: space-between; background: linear-gradient(135deg, #0072CE, #004C99); padding: 14px 18px; border-radius: 16px; margin-bottom: 14px; border: 1px solid rgba(255,255,255,0.15); }
    .brand { font-size: 16px; font-weight: 900; letter-spacing: 0.5px; color: #FCD400; }
    .badge { background: rgba(16,185,129,0.2); color: #6EE7B7; border: 1px solid #10B981; padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 800; }
    .section { background: #1E293B; border: 1px solid #334155; border-radius: 16px; padding: 16px; margin-bottom: 14px; }
    .section-title { font-size: 12px; font-weight: 800; letter-spacing: 0.8px; color: #FCD400; margin-bottom: 12px; text-transform: uppercase; }
    .id-toggle-btn { background: rgba(252, 212, 0, 0.15); color: #FCD400; border: 1px solid rgba(252, 212, 0, 0.45); border-radius: 10px; padding: 6px 12px; font-size: 11px; font-weight: 800; cursor: pointer; }
    .id-cards-drawer { display: none; margin-top: 14px; padding-top: 14px; border-top: 1px solid #334155; }
    .id-cards-drawer.open { display: block; }
    .id-cards-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .id-card-slot { background: #0F172A; border: 1px solid #334155; border-radius: 10px; padding: 8px; text-align: center; }
    .id-card-label { font-size: 10px; font-weight: 800; color: #94A3B8; text-transform: uppercase; margin-bottom: 6px; }
    .id-card-img { width: 100%; height: 95px; object-fit: cover; border-radius: 6px; border: 1px solid #1E293B; }
    .id-card-empty { height: 95px; display: flex; align-items: center; justify-content: center; font-size: 11px; color: #64748B; font-style: italic; background: rgba(15, 23, 42, 0.6); border-radius: 6px; border: 1px dashed #334155; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; font-size: 10px; text-transform: uppercase; color: #94A3B8; padding: 8px; border-bottom: 1px solid #334155; }
    .legend-box { display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; margin-top: 12px; padding: 10px; background: #0F172A; border-radius: 10px; border: 1px solid #334155; font-size: 11px; font-weight: 700; color: #CBD5E1; }
    .legend-dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 5px; }
    .footer-tag { text-align: center; font-size: 11px; font-weight: 800; color: #94A3B8; padding: 16px 0 32px; letter-spacing: 0.6px; }
  </style>
  <script>
    function toggleStudentIds() {
      var drawer = document.getElementById('student-ids-drawer');
      var btn = document.getElementById('toggle-ids-btn');
      if (!drawer || !btn) return;
      var isOpen = drawer.classList.toggle('open');
      btn.innerHTML = isOpen ? '🪪 Hide IDs' : '🪪 Show IDs';
    }
  </script>
</head>
<body>
  <div class="container">
    <div class="header-bar">
      <div class="brand">🐝 BOOKHIVE VERIFICATION</div>
      <div class="badge">${s.status || "Active"}</div>
    </div>

    <div class="section">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <div class="section-title" style="margin-bottom:0;">👤 STUDENT INFORMATION</div>
        <button id="toggle-ids-btn" type="button" class="id-toggle-btn" onclick="toggleStudentIds()">🪪 Show IDs</button>
      </div>
      <div style="font-size:18px;font-weight:900;color:#FFF;margin-bottom:4px;">${s.name || "STI Student"}</div>
      <div style="font-size:13px;font-weight:800;color:#FCD400;margin-bottom:8px;">ID: ${s.idNumber || "N/A"}</div>
      <div style="font-size:12px;color:#CBD5E1;"><strong>Department / Course:</strong> ${s.department || "CICT"} • ${s.course || "BSIT"}</div>
      <div style="font-size:12px;color:#CBD5E1;margin-top:4px;"><strong>Email:</strong> ${s.email || "N/A"}</div>

      <div id="student-ids-drawer" class="id-cards-drawer">
        <div style="font-size:11px;font-weight:800;color:#FCD400;margin-bottom:8px;letter-spacing:0.5px;">REGISTERED SCHOOL &amp; LIBRARY IDs</div>
        <div class="id-cards-grid">
          <div class="id-card-slot">
            <div class="id-card-label">School ID (Front)</div>
            ${s.schoolIdFront ? `<img src="${s.schoolIdFront}" class="id-card-img" alt="School ID Front" />` : `<div class="id-card-empty">Not Uploaded</div>`}
          </div>
          <div class="id-card-slot">
            <div class="id-card-label">School ID (Back)</div>
            ${s.schoolIdBack ? `<img src="${s.schoolIdBack}" class="id-card-img" alt="School ID Back" />` : `<div class="id-card-empty">Not Uploaded</div>`}
          </div>
          <div class="id-card-slot">
            <div class="id-card-label">Library ID (Front)</div>
            ${s.libraryIdFront ? `<img src="${s.libraryIdFront}" class="id-card-img" alt="Library ID Front" />` : `<div class="id-card-empty">Not Uploaded</div>`}
          </div>
          <div class="id-card-slot">
            <div class="id-card-label">Library ID (Back)</div>
            ${s.libraryIdBack ? `<img src="${s.libraryIdBack}" class="id-card-img" alt="Library ID Back" />` : `<div class="id-card-empty">Not Uploaded</div>`}
          </div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">📚 STUDENT LIBRARY CARD</div>
      <table>
        <thead>
          <tr>
            <th>Borrow Date</th>
            <th>Due Return</th>
            <th>Book Title</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${cardRowsHtml}
        </tbody>
      </table>
      <div class="legend-box">
        <div><span class="legend-dot" style="background:#86EFAC;"></span>Green: Borrow (Active)</div>
        <div><span class="legend-dot" style="background:#F87171;"></span>Red: Due to Return</div>
        <div><span class="legend-dot" style="background:#C084FC;"></span>Violet: Reservation</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title" style="color:${hasViolations ? "#F87171" : "#6EE7B7"};">🛡️ VIOLATION &amp; PENALTY RECORD</div>
      ${violationsHtml}
      ${
        hasViolations && totalFine > 0
          ? `<div style="margin-top:10px;padding:10px;background:rgba(239,68,68,0.15);border:1px solid #EF4444;border-radius:8px;text-align:right;font-weight:800;color:#F87171;font-size:13px;">Total Outstanding Fines: ₱${totalFine.toFixed(2)}</div>`
          : ""
      }
    </div>

    <div class="footer-tag">OFFICIAL BOOKHIVE VERIFICATION SYSTEM • ALL RIGHTS RESERVED</div>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
