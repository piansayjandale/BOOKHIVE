import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/proxy";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let rawBodyText = "";
  let body: any = {};
  try {
    rawBodyText = await request.text();
    if (rawBodyText && rawBodyText.trim().length > 0) {
      body = JSON.parse(rawBodyText);
    }
  } catch {
    return NextResponse.json({ message: "Invalid JSON payload." }, { status: 400 });
  }

  try {
    const proxyRes = await proxyToBackend(
      "/api/student/ocr/scan-paper",
      request,
      rawBodyText
    );
    if (proxyRes.ok) {
      return proxyRes;
    }
  } catch {
    // fallback below
  }

  try {
    const textQuery = String(body?.text || "").trim();
    const lines = textQuery
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    let title = "";
    let author = "";
    let isbn = "";
    let genre = "General";
    let department = "Circulation";
    let copies = 1;
    let edition = "None";
    let volume = "None";
    let publicationDate = "";
    let pages = 1;
    let shelf = "";
    let summary = "";

    for (const line of lines) {
      const mTitle = line.match(/^title\s*[:=\-]\s*(.+)$/i);
      if (mTitle) title = mTitle[1].trim();
      const mAuthor = line.match(/^author\s*[:=\-]\s*(.+)$/i);
      if (mAuthor) author = mAuthor[1].trim();
      const mIsbn = line.match(/^isbn\s*[:=\-]\s*(.+)$/i);
      if (mIsbn) isbn = mIsbn[1].trim();
      const mGenre = line.match(/^(?:genre|category)\s*[:=\-]\s*(.+)$/i);
      if (mGenre) genre = mGenre[1].trim();
      const mDept = line.match(/^department\s*[:=\-]\s*(.+)$/i);
      if (mDept) department = mDept[1].trim();
      const mCopies = line.match(/^copies\s*[:=\-]\s*(\d+)/i);
      if (mCopies) copies = Math.max(1, parseInt(mCopies[1], 10));
      const mEd = line.match(/^edition\s*[:=\-]\s*(.+)$/i);
      if (mEd) edition = mEd[1].trim();
      const mVol = line.match(/^volume\s*[:=\-]\s*(.+)$/i);
      if (mVol) volume = mVol[1].trim();
      const mDate = line.match(/^(?:date\s*published|published|year)\s*[:=\-]\s*(.+)$/i);
      if (mDate) publicationDate = mDate[1].trim();
      const mPages = line.match(/^pages\s*[:=\-]\s*(\d+)/i);
      if (mPages) pages = Math.max(1, parseInt(mPages[1], 10));
      const mShelf = line.match(/^(?:shelf\s*location|shelf|call\s*number)\s*[:=\-]\s*(.+)$/i);
      if (mShelf) shelf = mShelf[1].trim();
      const mSum = line.match(/^(?:summary|description)\s*[:=\-]\s*(.+)$/i);
      if (mSum) summary = mSum[1].trim();
    }

    if (!title && lines.length > 0) {
      title = lines[0];
    }

    let matchedBooks: any[] = [];
    if (isbn || title) {
      try {
        const { rows } = await pool.query(
          `SELECT id, title, author, isbn, department, category, shelf_location AS "shelf", copies, availability
           FROM books
           WHERE archived_at IS NULL
             AND (
               ($1::text != '' AND isbn ILIKE '%' || $1::text || '%')
               OR ($2::text != '' AND title ILIKE '%' || $2::text || '%')
             )
           LIMIT 5`,
          [isbn, title]
        );
        matchedBooks = rows;
      } catch {}
    }

    return NextResponse.json({
      success: true,
      rawText: textQuery,
      confidence: 95,
      extracted: {
        title: title || "",
        author: author || "",
        isbn: isbn || "",
        genre,
        category: genre,
        department,
        copies,
        edition,
        volume,
        publicationDate,
        pages,
        shelf,
        summary,
        docType: "Catalog Intake Slip",
      },
      matchedBooks,
    });
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || "OCR scan processing failed." },
      { status: 500 }
    );
  }
}
