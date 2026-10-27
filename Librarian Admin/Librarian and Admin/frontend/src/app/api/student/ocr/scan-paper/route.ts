import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/proxy";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

async function extractTextOrStructuredWithCloud(imageBase64?: string) {
  if (!imageBase64 || typeof imageBase64 !== "string") return null;
  let cleanBase64 = imageBase64.trim();
  if (cleanBase64.includes(",")) {
    cleanBase64 = cleanBase64.split(",")[1];
  }
  if (!cleanBase64) return null;

  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey && geminiKey !== "your_gemini_api_key" && geminiKey !== "your_gemini_api_key_here") {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;
      const promptText = `Analyze this image of a paper document, printed book cover, title page, copyright page, library catalog card, or handwritten intake slip.
Extract library catalog metadata and return ONLY a valid JSON object with these keys:
{
  "title": string,
  "author": string,
  "genre": string,
  "department": string,
  "isbn": string,
  "copies": number,
  "edition": string,
  "volume": string,
  "summary": string,
  "publisher": string,
  "publishedYear": string,
  "pages": string,
  "shelfLocation": string,
  "docType": string,
  "rawText": string,
  "confidence": number
}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { inline_data: { mime_type: "image/jpeg", data: cleanBase64 } },
                { text: promptText },
              ],
            },
          ],
          generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
        }),
        signal: AbortSignal.timeout(20000),
      });
      if (res.ok) {
        const json = await res.json();
        const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (rawText) {
          const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
          return JSON.parse(cleaned);
        }
      }
    } catch {}
  }

  const ocrSpaceKey = process.env.OCR_SPACE_API_KEY || "helloworld";
  try {
    const formData = new URLSearchParams();
    formData.append("apikey", ocrSpaceKey);
    formData.append("base64Image", `data:image/jpeg;base64,${cleanBase64}`);
    formData.append("language", "eng");
    formData.append("OCREngine", "2");
    formData.append("scale", "true");

    const res = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) {
      const data = await res.json();
      const parsedText = data?.ParsedResults?.[0]?.ParsedText || "";
      if (parsedText.trim().length > 0) {
        return { rawText: parsedText };
      }
    }
  } catch {}

  return null;
}

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
    let textQuery = String(body?.text || "").trim();
    const imageInput = body?.image || body?.imageBase64 || body?.base64Image || "";
    let cloudResult: any = null;

    if (!textQuery && imageInput) {
      cloudResult = await extractTextOrStructuredWithCloud(imageInput);
      if (cloudResult?.rawText) {
        textQuery = String(cloudResult.rawText).trim();
      }
    }

    const lines = textQuery
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    let title = cloudResult?.title || "";
    let author = cloudResult?.author || "";
    let isbn = cloudResult?.isbn || "";
    let genre = cloudResult?.genre || "General";
    let department = cloudResult?.department || "Circulation";
    let copies = Number(cloudResult?.copies || 1);
    let edition = cloudResult?.edition || "1st";
    let volume = cloudResult?.volume || "1";
    let publicationDate = cloudResult?.publishedYear || "";
    let publisher = cloudResult?.publisher || "";
    let pages = Number(cloudResult?.pages || 1) || 1;
    let shelf = cloudResult?.shelfLocation || "";
    let summary = cloudResult?.summary || "";
    const docType = cloudResult?.docType || "Handwritten Intake Slip";

    for (const line of lines) {
      const mTitle = line.match(/^title\s*[:=\-]\s*(.+)$/i);
      if (mTitle && !title) title = mTitle[1].trim();
      const mAuthor = line.match(/^author\s*[:=\-]\s*(.+)$/i);
      if (mAuthor && !author) author = mAuthor[1].trim();
      const mIsbn = line.match(/^isbn\s*[:=\-]\s*(.+)$/i);
      if (mIsbn && !isbn) isbn = mIsbn[1].trim();
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
      const mDate = line.match(/^(?:date\s*published|published(?:\s*year|\s*date)?|pub\.?\s*(?:date|year)|year)\s*[:=\-]\s*(.+)$/i);
      if (mDate && !publicationDate) publicationDate = mDate[1].trim();
      const mPub = line.match(/^(?:publisher|published\s*by|imprint|press)\s*[:=\-]\s*(.+)$/i);
      if (mPub && !publisher) publisher = mPub[1].trim();
      const mPages = line.match(/^pages\s*[:=\-]\s*(\d+)/i);
      if (mPages) pages = Math.max(1, parseInt(mPages[1], 10));
      const mShelf = line.match(/^(?:shelf\s*location|shelf|call\s*number)\s*[:=\-]\s*(.+)$/i);
      if (mShelf && !shelf) shelf = mShelf[1].trim();
      const mSum = line.match(/^(?:summary|description|synopsis)\s*[:=\-]\s*(.+)$/i);
      if (mSum && !summary) summary = mSum[1].trim();
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

    const extractedBook = {
      title: title || "Untitled Scanned Book",
      author: author || "Unknown Author",
      isbn: isbn || "",
      genre,
      category: genre,
      department,
      copies,
      edition,
      volume,
      publisher,
      publishedYear: publicationDate,
      publicationDate,
      pages,
      shelf,
      shelfLocation: shelf || "Catalog Shelf (Pending Placement)",
      summary,
      docType,
      rawText: textQuery,
    };

    return NextResponse.json({
      success: true,
      rawText: textQuery,
      confidence: cloudResult?.confidence || 95,
      extracted: extractedBook,
      parsedBook: extractedBook,
      matchedBooks,
    });
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || "OCR scan processing failed." },
      { status: 500 }
    );
  }
}
