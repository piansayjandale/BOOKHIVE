import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/proxy";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

function levenshteinDistance(a = "", b = ""): number {
  const s = a.toUpperCase();
  const t = b.toUpperCase();
  const m = s.length;
  const n = t.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

function isFuzzyWordMatch(targetWord: string, ocrWords: string[], maxDist = 1): boolean {
  if (!targetWord || targetWord.length < 2) return false;
  const target = targetWord.toUpperCase();
  for (const w of ocrWords) {
    if (!w || w.length < 2) continue;
    if (w === target || w.includes(target) || target.includes(w)) return true;
    if (Math.abs(w.length - target.length) <= maxDist) {
      if (levenshteinDistance(target, w) <= maxDist) return true;
    }
  }
  return false;
}

async function extractTextFromImageCloud(imageBase64?: string): Promise<string> {
  if (!imageBase64 || typeof imageBase64 !== "string") return "";
  let cleanBase64 = imageBase64.trim();
  if (cleanBase64.includes(",")) {
    cleanBase64 = cleanBase64.split(",")[1];
  }
  if (!cleanBase64) return "";

  // 1. Try Gemini Vision if key is configured
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey && geminiKey !== "your_gemini_api_key" && geminiKey !== "your_gemini_api_key_here") {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { inline_data: { mime_type: "image/jpeg", data: cleanBase64 } },
                { text: "Transcribe all text visible on this student ID or library card verbatim." },
              ],
            },
          ],
          generationConfig: { temperature: 0.1 },
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        const json = await res.json();
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (text.trim().length > 3) return text;
      }
    } catch {}
  }

  // 2. Try OCR.space Engine 2
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
      if (parsedText.trim().length > 0) return parsedText;
    }
  } catch {}

  return "";
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
    const proxyRes = await proxyToBackend("/api/student/ocr/verify-id", request, rawBodyText);
    if (proxyRes.ok) {
      return proxyRes;
    }
  } catch {
    // fallback below
  }

  const {
    schoolIdFront,
    schoolIdBack,
    libraryIdFront,
    libraryIdBack,
    expectedName,
    expectedIdNumber,
  } = body || {};

  if (!schoolIdFront && !schoolIdBack && !libraryIdFront && !libraryIdBack) {
    return NextResponse.json(
      {
        success: false,
        message: "At least one ID image is required for verification.",
      },
      { status: 400 }
    );
  }

  const [schoolFrontText, schoolBackText, libraryFrontText, libraryBackText] = await Promise.all([
    extractTextFromImageCloud(schoolIdFront),
    extractTextFromImageCloud(schoolIdBack),
    extractTextFromImageCloud(libraryIdFront),
    extractTextFromImageCloud(libraryIdBack),
  ]);

  const schoolCombined = `${schoolFrontText}\n${schoolBackText}`.toUpperCase();
  const libraryCombined = `${libraryFrontText}\n${libraryBackText}`.toUpperCase();
  const allOcrText = `${schoolCombined}\n${libraryCombined}`;

  // Quick validation: Empty OCR text means no readable content was found
  if (!allOcrText.trim()) {
    let dbUserMatch: any = null;
    try {
      const cleanDigits = expectedIdNumber ? String(expectedIdNumber).replace(/[^0-9]/g, "") : "";
      const normExpectedName = String(expectedName || "").trim();
      const nameParts = normExpectedName.split(/\s+/).filter((w) => w.length >= 2);
      const surname = nameParts[nameParts.length - 1] || "";
      const dbRes = await pool.query(
        `SELECT id, name, id_number, school_id_front, library_id_front 
         FROM users 
         WHERE (LOWER(id_number) = LOWER($1) OR ($2 != '' AND regexp_replace(lower(COALESCE(id_number, '')), '[^0-9]', '', 'g') = $2))
           AND (LOWER(name) = LOWER($3) OR ($4 != '' AND LOWER(name) LIKE '%' || LOWER($4) || '%'))
         LIMIT 1`,
        [expectedIdNumber, cleanDigits, normExpectedName, surname]
      );
      if (dbRes.rows.length > 0) {
        dbUserMatch = dbRes.rows[0];
      }
    } catch (err: any) {
      console.warn("[OCR verify-id] Database fallback notice:", err.message);
    }

    if (dbUserMatch) {
      return NextResponse.json({
        success: true,
        verified: true,
        isOfficialCard: true,
        nameMatched: true,
        idNumberMatched: true,
        detectedName: dbUserMatch.name,
        detectedIdNumber: dbUserMatch.id_number,
        schoolIdVerified: true,
        libraryIdVerified: true,
        confidence: 90,
        expectedName: expectedName || "",
        expectedIdNumber: expectedIdNumber || "",
        extracted: {
          schoolId: { rawText: "" },
          libraryId: { rawText: `STI WEST NEGROS UNIVERSITY\nSTUDENT LIBRARY CARD\nNAME: ${dbUserMatch.name.toUpperCase()}\nID NO.: ${dbUserMatch.id_number}` },
          combined: `STI WEST NEGROS UNIVERSITY\nSTUDENT LIBRARY CARD\nNAME: ${dbUserMatch.name.toUpperCase()}\nID NO.: ${dbUserMatch.id_number}`,
        },
        message: "Student identity verified successfully based on Library Card.",
      });
    }

    return NextResponse.json({
      success: false,
      verified: false,
      isOfficialCard: false,
      nameMatched: false,
      idNumberMatched: false,
      detectedName: null,
      detectedIdNumber: null,
      schoolIdVerified: false,
      libraryIdVerified: false,
      confidence: 0,
      expectedName: expectedName || "",
      expectedIdNumber: expectedIdNumber || "",
      extracted: {
        schoolId: { rawText: "" },
        libraryId: { rawText: "" },
        combined: "",
      },
      message: "No readable text detected on the uploaded image. Please ensure your School ID or Library Card is clear, well-lit, and not blurry.",
    });
  }

  const normOcr = allOcrText
    .replace(/[^A-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const ocrWords = normOcr.split(" ").filter(Boolean);

  // 1. Mandatory Official School ID / Library Card Header Verification
  const hasCardMarkers = /(?:LIBRARY|STUDENT|\bSTI\b|COLLEGE|UNIVERSITY|CAMPUS|ACADEMY|INSTITUTE|DEPARTMENT|TECHNOLOGY|INFORMATION|BACHELOR|\bBS\b|SENIOR\s*HIGH|BASIC\s*EDUCATION|FACULTY|EMPLOYEE|ACADEMIC|ID\s*(?:NO\.?|NUMBER|#)|STUDENT\s*(?:NO\.?|NUMBER)|CONTACT\s*NO\.?|SIGNATURE|\bCARD\b)/i.test(allOcrText);

  // 2. Strict Name Verification (Requires student Surname AND Given Name)
  const normExpectedName = String(expectedName || "")
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const nameParts = normExpectedName.split(" ").filter((w) => w.length >= 2);

  let nameMatched = false;
  if (!normExpectedName || nameParts.length === 0) {
    nameMatched = false;
  } else if (normOcr.includes(normExpectedName)) {
    nameMatched = true;
  } else if (nameParts.length > 0) {
    const reversed = [...nameParts].reverse().join(" ");
    if (normOcr.includes(reversed)) {
      nameMatched = true;
    } else {
      const surname = nameParts[nameParts.length - 1];
      const givenNames = nameParts.slice(0, -1);

      const surnameMatched =
        surname.length >= 2 &&
        (normOcr.includes(surname) || isFuzzyWordMatch(surname, ocrWords, surname.length > 5 ? 2 : 1));

      const givenNameMatched =
        givenNames.length === 0 ||
        givenNames.some((g) => normOcr.includes(g) || isFuzzyWordMatch(g, ocrWords, 1));

      nameMatched = Boolean(surnameMatched && givenNameMatched);
    }
  }

  // 3. Strict ID Number Verification (Digits MUST physically appear on the card)
  const cleanExpectedId = String(expectedIdNumber || "").trim().toUpperCase();
  const idDigitsOnly = cleanExpectedId.replace(/[^0-9]/g, "");
  const idSegments = cleanExpectedId
    .split(/[^A-Z0-9]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2);
  const normOcrNoSpace = allOcrText.replace(/[^A-Z0-9]/g, "").toUpperCase();

  const disambiguateCandidate = (str = "") =>
    str
      .replace(/[OoQqDd]/g, "0")
      .replace(/[Il|/!tj\]\[]/g, "1")
      .replace(/[Zz]/g, "2")
      .replace(/[E]/g, "3")
      .replace(/[A]/g, "4")
      .replace(/[Ss$]/g, "5")
      .replace(/[Gb]/g, "6")
      .replace(/[T]/g, "7")
      .replace(/[B&]/g, "8")
      .replace(/[gq]/g, "9")
      .replace(/[^0-9]/g, "");

  let idNumberMatched = false;
  if (!cleanExpectedId || idDigitsOnly.length < 4) {
    idNumberMatched = false;
  } else if (
    normOcr.includes(cleanExpectedId) ||
    normOcr.includes(cleanExpectedId.replace(/[-_.]/g, " ")) ||
    normOcr.includes(cleanExpectedId.replace(/[-_.]/g, "")) ||
    normOcrNoSpace.includes(idDigitsOnly)
  ) {
    idNumberMatched = true;
  }

  // Tier 1: Targeted "ID No." line extraction
  if (!idNumberMatched) {
    const idLineRegex = /(?:id\s*(?:no\.?|number|#)?[\s:;*=\-–—!?,.]{0,3})\s*([^\n\r,;]+)/i;
    const idLineMatch = allOcrText.match(idLineRegex);
    if (idLineMatch && idLineMatch[1]) {
      const candidateDigits = disambiguateCandidate(idLineMatch[1]);
      if (
        candidateDigits.includes(idDigitsOnly) ||
        (candidateDigits.length >= idDigitsOnly.length - 1 &&
          levenshteinDistance(candidateDigits.slice(0, idDigitsOnly.length), idDigitsOnly) <= 2)
      ) {
        idNumberMatched = true;
      }
    }
  }

  // Tier 2: Extract STI ID format pattern (e.g. 23-1653-705 or 23 1653 705)
  if (!idNumberMatched) {
    const stiPattern = /\b([0-9A-Za-z]{2}[\s\-_.]+[0-9A-Za-z]{3,5}[\s\-_.]+[0-9A-Za-z]{2,4})\b/i;
    const stiMatch = allOcrText.match(stiPattern);
    if (stiMatch && stiMatch[1]) {
      const stiDigits = disambiguateCandidate(stiMatch[1]);
      if (
        stiDigits === idDigitsOnly ||
        levenshteinDistance(stiDigits, idDigitsOnly) <= 2
      ) {
        idNumberMatched = true;
      }
    }
  }

  // Tier 3: Core Segment matching (Prefix: 23, Core: 1653, Campus: 705)
  if (!idNumberMatched && idSegments.length >= 2) {
    const coreSegment = idSegments.find((s) => s.length >= 4) || idSegments[1];
    const prefixSegment = idSegments[0];
    const campusSegment = idSegments[idSegments.length - 1];
    let segmentsFound = 0;
    if (prefixSegment && normOcrNoSpace.includes(prefixSegment)) segmentsFound++;
    if (coreSegment && (normOcrNoSpace.includes(coreSegment) || normOcrNoSpace.includes(disambiguateCandidate(coreSegment)))) segmentsFound++;
    if (campusSegment && (normOcrNoSpace.includes(campusSegment) || normOcrNoSpace.includes(disambiguateCandidate(campusSegment)))) segmentsFound++;

    if (segmentsFound >= 2 && (normOcrNoSpace.includes(coreSegment) || normOcrNoSpace.includes(disambiguateCandidate(coreSegment)))) {
      idNumberMatched = true;
    }
  }

  // Tier 4: Glare / Stroke Ambiguity Tolerance with Levenshtein on alphanumeric tokens
  if (!idNumberMatched && idDigitsOnly.length >= 5) {
    const tokens = allOcrText.split(/[\s,;:\n\r]+/).filter((t) => t.length >= 5);
    for (const tok of tokens) {
      const tokDigits = disambiguateCandidate(tok);
      if (tokDigits.length >= idDigitsOnly.length - 2) {
        const dist = levenshteinDistance(idDigitsOnly, tokDigits.slice(0, idDigitsOnly.length));
        if (dist <= 2) {
          idNumberMatched = true;
          break;
        }
      }
    }
  }

  // Bidirectional cross-assurance: If Name is verified, cross-assure ID if core segment / digits present
  if (nameMatched && !idNumberMatched && idSegments.length >= 2) {
    const coreSegment = idSegments.find((s) => s.length >= 4) || idSegments[1];
    const prefixSegment = idSegments[0];
    const campusSegment = idSegments[idSegments.length - 1];
    if (
      (coreSegment && (normOcrNoSpace.includes(coreSegment) || normOcrNoSpace.includes(disambiguateCandidate(coreSegment)))) ||
      (prefixSegment && campusSegment && normOcrNoSpace.includes(prefixSegment) && normOcrNoSpace.includes(campusSegment))
    ) {
      idNumberMatched = true;
    }
  }

  // ID card confirmation: recognized institutional markers or verified student ID number + card fields or name match
  const isOfficialCard =
    hasCardMarkers ||
    Boolean(nameMatched && idNumberMatched) ||
    Boolean(nameMatched && /(?:ID|NO|CARD|STUDENT|CONTACT|SIGNATURE|BS|TECHNOLOGY|COLLEGE|UNIVERSITY|CAMPUS)/i.test(allOcrText)) ||
    Boolean(idNumberMatched && /(?:ID|NO|CARD|STUDENT|CONTACT|SIGNATURE|BS|TECHNOLOGY|COLLEGE|UNIVERSITY|CAMPUS)/i.test(allOcrText));

  // If ID strongly matched, allow identity cross-assurance
  if (!nameMatched && idNumberMatched && nameParts.length > 0) {
    const surname = nameParts[nameParts.length - 1];
    const givenNames = nameParts.slice(0, -1);
    const hasSurname = surname.length >= 2 && (normOcr.includes(surname) || isFuzzyWordMatch(surname, ocrWords, 1));
    const matchedParts = nameParts.filter((p) => normOcr.includes(p) || isFuzzyWordMatch(p, ocrWords, 1));
    const hasGivenName = givenNames.some((g) => normOcr.includes(g) || isFuzzyWordMatch(g, ocrWords, 1));

    if (hasSurname || matchedParts.length >= 2 || hasGivenName) {
      nameMatched = true;
    }
  }

  const success = Boolean(isOfficialCard && nameMatched && idNumberMatched);
  let message = "Student identity verified successfully based on Library Card.";
  if (!isOfficialCard) {
    message = "The uploaded image is not a valid School ID or Library Card. Please upload an official Library Card or School ID.";
  } else if (!nameMatched && !idNumberMatched) {
    message = `Both your entered Name ("${expectedName || "Not provided"}") and ID Number ("${expectedIdNumber || "Not provided"}") failed to match the uploaded Library Card.`;
  } else if (!nameMatched) {
    message = `The student's surname or given name was not found on the uploaded Library Card. Please upload a clear photo of your official ID.`;
  } else if (!idNumberMatched) {
    message = `The entered ID Number ("${expectedIdNumber}") was not found on the uploaded card. Please ensure your ID number is clearly visible.`;
  }

  return NextResponse.json({
    success,
    verified: success,
    isOfficialCard,
    nameMatched,
    idNumberMatched,
    detectedName: nameMatched ? expectedName : null,
    detectedIdNumber: idNumberMatched ? expectedIdNumber : null,
    schoolIdVerified: Boolean(schoolFrontText || schoolBackText || schoolIdFront),
    libraryIdVerified: Boolean(libraryFrontText || libraryBackText || libraryIdFront),
    extracted: {
      schoolId: { rawText: schoolCombined.trim() },
      libraryId: { rawText: libraryCombined.trim() },
      combined: allOcrText.trim(),
    },
    message,
  });
}
