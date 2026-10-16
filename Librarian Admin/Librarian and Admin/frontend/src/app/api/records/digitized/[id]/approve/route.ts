import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/proxy";
import { catalogRepository } from "@/lib/catalog/repository";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const proxyRes = await proxyToBackend(`/api/admin/digitized-books/${id}/approve`, request);
    if (proxyRes.ok) {
      return proxyRes;
    }
  } catch (err) {
    // try direct
  }

  try {
    const proxyDirect = await proxyToBackend(`/api/digitized-books/${id}/approve`, request);
    if (proxyDirect.ok) {
      return proxyDirect;
    }
  } catch (err) {
    console.warn(`Proxy POST to /api/digitized-books/${id}/approve failed, falling back:`, err);
  }

function sanitizeIsbn(val?: string | null): string {
  if (!val) return "";
  return String(val)
    .replace(/[—–]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .trim();
}

  try {
    const body = await request.json();
    const created = await catalogRepository.addBook({
      title: body.title,
      author: body.author,
      isbn: sanitizeIsbn(body.isbn) || `CAT-${Date.now().toString().slice(-6)}`,
      department: body.department || "Circulation",
      category: body.category || body.genre || "General",
      genres: body.genres || body.genre || "General",
      shelfLocation: body.shelfLocation || "Circulation Desk",
      accessionNumber: body.accessionNumber || undefined,
      copies: Number(body.copies || 1),
      edition: body.edition || "1st Edition",
      volume: body.volume || "Vol. 1",
      publisher: body.publisher || "",
      publishedDate: body.publishedDate || body.publicationDate || new Date().toISOString().split("T")[0],
      summary: body.summary || "",
      availability: "Available",
      coverImg: "",
    } as any);

    return NextResponse.json({
      book: created,
      success: true,
      message: "Officially cataloged and added to records.",
    });
  } catch (error: any) {
    console.error("Approve digitized book fallback error:", error);
    return NextResponse.json(
      { message: error?.message || "Failed to approve and catalog book." },
      { status: 500 }
    );
  }
}
