import { unzipSync, inflateSync } from "fflate";

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

function decodePdfString(str: string): string {
  return str
    .replace(/\\([\d]{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
    .replace(/\\(.)/g, (_, char) => {
      switch (char) {
        case "n": return "\n";
        case "r": return "\r";
        case "t": return "\t";
        case "b": return "\b";
        case "f": return "\f";
        default: return char;
      }
    });
}

async function extractPdfText(file: File) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const streams: string[] = [];
    let index = 0;

    while (index < buffer.length) {
      const streamStart = buffer.indexOf("stream", index);
      if (streamStart === -1) break;

      let dataStart = streamStart + 6;
      if (buffer[dataStart] === 13) dataStart++; // \r
      if (buffer[dataStart] === 10) dataStart++; // \n

      const streamEnd = buffer.indexOf("endstream", dataStart);
      if (streamEnd === -1) break;

      let dataEnd = streamEnd;
      if (buffer[dataEnd - 1] === 10) dataEnd--; // \n
      if (buffer[dataEnd - 1] === 13) dataEnd--; // \r

      const slice = buffer.slice(dataStart, dataEnd);

      try {
        const decompressed = inflateSync(new Uint8Array(slice));
        const text = new TextDecoder("utf-8").decode(decompressed);
        streams.push(text);
      } catch (e) {
        try {
          const text = new TextDecoder("ascii").decode(slice);
          if (text.includes("BT") && text.includes("ET")) {
            streams.push(text);
          }
        } catch (err) {
          // Ignore binary stream failures
        }
      }

      index = streamEnd + 9;
    }

    let extractedText = "";
    for (const stream of streams) {
      const btMatches = stream.match(/BT[\s\S]*?ET/g);
      if (btMatches) {
        for (const block of btMatches) {
          const tjRegex = /\((.*?)\)\s*Tj/g;
          let tjMatch;
          while ((tjMatch = tjRegex.exec(block)) !== null) {
            extractedText += decodePdfString(tjMatch[1]) + " ";
          }

          const TJRegex = /\[([\s\S]*?)\]\s*TJ/g;
          let TJMatch;
          while ((TJMatch = TJRegex.exec(block)) !== null) {
            const inner = TJMatch[1];
            const partsRegex = /\((.*?)\)/g;
            let partMatch;
            while ((partMatch = partsRegex.exec(inner)) !== null) {
              extractedText += decodePdfString(partMatch[1]) + " ";
            }
          }
        }
      }
    }

    return truncate(extractedText.replace(/\s+/g, " ").trim());
  } catch (error) {
    console.error("Error parsing PDF attachment:", error);
    return "";
  }
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

  if (lowerName.endsWith(".pdf") || mimeType === "application/pdf") {
    return extractPdfText(file);
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

