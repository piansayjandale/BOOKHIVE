import type { SearchResult, BookRecord } from "@/lib/types";

interface GeminiMatch {
  id: string;
  relevance: number;
  reason: string;
}

export async function queryGemini(
  query: string,
  uploadedContext: string,
  books: BookRecord[]
): Promise<GeminiMatch[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your_gemini_api_key") {
    console.warn("Gemini API key is not configured. Falling back to local search.");
    return [];
  }

  // Create a brief list of books for the prompt to keep context size reasonable
  const catalogBrief = books.map((b) => ({
    id: b.id,
    title: b.title,
    author: b.author,
    summary: b.summary,
    genres: b.genres,
    department: b.department,
  }));

  const systemInstructions = `You are a professional library recommendation AI. Analyze the user's query and the uploaded document text.
Compare them with the provided books from the library catalog.
Identify books that are semantically relevant, share similar themes, or cover related topics.
For each matched book, assign a relevance percentage (0 to 100) and a brief reason.
Return ONLY a JSON array of objects, each containing:
- "id": string (the exact book ID)
- "relevance": number (0-100)
- "reason": string (1-sentence explanation of the connection)
Example response format: [{"id":"book-001","relevance":95,"reason":"Covers core algorithms discussed in section 2 of the syllabus."}]`;

  const prompt = `User query: "${query}"
Uploaded document content: "${uploadedContext}"

Library catalog:
${JSON.stringify(catalogBrief)}`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: `${systemInstructions}\n\n${prompt}` }],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const json = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text?: string;
          }>;
        };
      }>;
    };

    const textResponse = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textResponse) {
      return [];
    }

    const matches = JSON.parse(textResponse.trim()) as GeminiMatch[];
    return Array.isArray(matches) ? matches : [];
  } catch (error) {
    console.error("Gemini search pipeline error:", error);
    return [];
  }
}
