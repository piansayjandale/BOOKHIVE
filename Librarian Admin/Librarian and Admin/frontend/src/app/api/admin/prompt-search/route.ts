import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth";
import { proxyToBackend } from "@/lib/proxy";
import { extractUploadContext } from "@/lib/search/uploads";
import { BACKEND_URL } from "@/lib/config";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return proxyToBackend("/api/admin/prompt-search", request);
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  
  let payload: {
    query: string;
    department: string;
    mode: string;
    uploadedContext: string;
    fileNames: string[];
  };

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const query = String(formData.get("query") ?? "");
    const department = String(formData.get("department") ?? "All");
    const mode = String(formData.get("mode") ?? "prefix");
    const files = formData.getAll("files").filter((file): file is File => file instanceof File);
    const uploadContext = await extractUploadContext(files);
    
    payload = {
      query,
      department,
      mode,
      uploadedContext: uploadContext.text,
      fileNames: uploadContext.fileNames,
    };
  } else {
    const body = await request.json();
    payload = {
      query: body.query ?? "",
      department: body.department ?? "All",
      mode: body.mode ?? "prefix",
      uploadedContext: body.uploadedContext ?? "",
      fileNames: body.fileNames ?? [],
    };
  }

  const cookieStore = await cookies();
  const token =
    cookieStore.get("bookhive_backend_token")?.value ||
    cookieStore.get(SESSION_COOKIE)?.value;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${BACKEND_URL}/api/admin/prompt-search`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Proxy prompt-search POST failure:", error);
    return NextResponse.json(
      { message: "Failed to communicate with Express backend." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const mode = searchParams.get("mode");
  
  let path = id ? `/api/admin/prompt-search/${id}` : "/api/admin/prompt-search";
  if (!id && mode) {
    path += `?mode=${encodeURIComponent(mode)}`;
  }
  const cleanRequest = new Request(BACKEND_URL + path, {
    method: "DELETE",
    headers: request.headers,
  });
  return proxyToBackend(path, cleanRequest);
}
