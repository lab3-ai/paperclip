import type { Market } from "./types.js";

export interface AnalysisResult {
  market_id: string;
  relevance_score: number;
  analysis: string;
}

export function buildAnalysisPrompt(
  markets: Market[],
  keywords: string[],
): string {
  const marketList = markets
    .map(
      (m) =>
        `- ID: ${m.market_id}\n  Question: ${m.question}\n  Description: ${m.description ?? "N/A"}\n  Category: ${m.category ?? "N/A"}\n  Odds: ${JSON.stringify(m.outcome_prices)}`,
    )
    .join("\n\n");

  return `Analyze the following Polymarket markets for relevance to these topics: ${keywords.join(", ")}

For each market, rate its relevance from 0 to 1 and provide a brief analysis explaining why.

Markets:
${marketList}

Respond with JSON in this exact format:
{
  "results": [
    { "market_id": "<id>", "relevance_score": <0-1>, "analysis": "<brief reasoning>" }
  ]
}`;
}

export function parseAnalysisResponse(response: string): AnalysisResult[] {
  try {
    const codeBlockMatch = response.match(
      /```(?:json)?\s*\n?([\s\S]*?)\n?```/,
    );
    const jsonStr = codeBlockMatch ? codeBlockMatch[1] : response;
    const parsed = JSON.parse(jsonStr.trim());
    if (!parsed.results || !Array.isArray(parsed.results)) return [];
    return parsed.results.map((r: Record<string, unknown>) => ({
      market_id: String(r.market_id),
      relevance_score: Number(r.relevance_score) || 0,
      analysis: String(r.analysis || ""),
    }));
  } catch {
    return [];
  }
}
