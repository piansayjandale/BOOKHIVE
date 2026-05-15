import { unzipSync } from "fflate";

function truncate(value: string, maxLength = 6000) {
  if (value.length <= maxLength) {
    return value;
  }

  return value.slice(0, maxLength);
}

function stripXml(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function extractOfficeText(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension || !["docx", "pptx"].includes(extension)) {
    return "";
  }

  const archive = unzipSync(new Uint8Array(await file.arrayBuffer()));
  const relevantEntries = Object.entries(archive).filter(([entryName]) => {
    if (extension === "docx") {
      return entryName.startsWith("word/") && entryName.endsWith(".xml");
    }

    return entryName.startsWith("ppt/slides/") && entryName.endsWith(".xml");
  });

  return truncate(
    relevantEntries
      .map(([, content]) => stripXml(new TextDecoder().decode(content)))
      .join(" "),
  );
}

async function extractFileText(file: File) {
  const lowerName = file.name.toLowerCase();
  const mimeType = file.type.toLowerCase();

  if (
    mimeType.startsWith("text/") ||
    [".txt", ".md", ".csv", ".json", ".xml"].some((extension) => lowerName.endsWith(extension))
  ) {
    return truncate(await file.text());
  }

  if (lowerName.endsWith(".docx") || lowerName.endsWith(".pptx")) {
    return extractOfficeText(file);
  }

  return "";
}

export async function extractUploadContext(files: File[]) {
  const extractedTexts = await Promise.all(
    files.map(async (file) => {
      const text = await extractFileText(file);
      return {
        name: file.name,
        text,
      };
    }),
  );

  const text = truncate(
    extractedTexts
      .map(({ name, text: extractedText }) =>
        extractedText ? `${name} ${extractedText}` : name.replace(/\.[a-z0-9]+$/i, ""),
      )
      .join(" "),
    12000,
  );

  return {
    text,
    fileNames: files.map((file) => file.name),
  };
}

