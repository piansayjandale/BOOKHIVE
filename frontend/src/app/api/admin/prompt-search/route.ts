import { NextResponse } from "next/server";

import { adminRepository } from "@/lib/admin/repository";
import { getSession } from "@/lib/auth";
import { extractUploadContext } from "@/lib/search/uploads";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ logs: await adminRepository.getSearchLogs() });
}

export async function POST(request: Request) {
  const session = await getSession();
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const query = String(formData.get("query") ?? "");
    const department = String(formData.get("department") ?? "All");
    const files = formData.getAll("files").filter((file): file is File => file instanceof File);
    const uploadContext = await extractUploadContext(files);

    return NextResponse.json(
      await adminRepository.runPromptSearch({
        query,
        department,
        uploadedContext: uploadContext.text,
        fileNames: uploadContext.fileNames,
        actor: session,
      }),
    );
  }

  const payload = (await request.json()) as {
    query?: string;
    department?: string;
    uploadedContext?: string;
    fileNames?: string[];
  };

  return NextResponse.json(
    await adminRepository.runPromptSearch({
      query: payload.query ?? "",
      department: payload.department,
      uploadedContext: payload.uploadedContext,
      fileNames: payload.fileNames,
      actor: session,
    }),
  );
}
