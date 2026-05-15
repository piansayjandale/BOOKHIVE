import { NextResponse } from "next/server";

import { store } from "@/lib/data/store";
import { extractUploadContext } from "@/lib/search/uploads";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") ?? "";
  const department = searchParams.get("department") ?? "All";
  return NextResponse.json({
    results: await store.searchBooks(query, {
      department,
    }),
  });
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const query = String(formData.get("query") ?? "");
    const department = String(formData.get("department") ?? "All");
    const files = formData.getAll("files").filter((file): file is File => file instanceof File);
    const uploadContext = await extractUploadContext(files);

    return NextResponse.json({
      results: await store.searchBooks(query, {
        department,
        uploadedContext: uploadContext.text,
        uploadedFileNames: uploadContext.fileNames,
      }),
    });
  }

  const payload = (await request.json()) as {
    query?: string;
    department?: string;
    files?: string[];
    uploadedContext?: string;
  };
  return NextResponse.json({
    results: await store.searchBooks(payload.query ?? "", {
      department: payload.department,
      uploadedContext: payload.uploadedContext,
      uploadedFileNames: payload.files ?? [],
    }),
  });
}
