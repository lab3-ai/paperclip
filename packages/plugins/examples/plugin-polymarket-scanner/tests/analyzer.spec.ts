import { describe, it, expect } from "vitest";
import {
  buildAnalysisPrompt,
  parseAnalysisResponse,
} from "../src/analyzer.js";
import type { Market } from "../src/types.js";

describe("buildAnalysisPrompt", () => {
  it("includes markets and keywords in the prompt", () => {
    const markets: Market[] = [
      {
        market_id: "m1",
        question: "Will AI pass the bar exam?",
        description: "About AI capabilities",
        category: "technology",
        outcome_prices: { Yes: 0.8, No: 0.2 },
        volume: 5000,
        liquidity: 1000,
        end_date: null,
        status: "active",
        url: null,
        raw_data: {},
      },
    ];
    const prompt = buildAnalysisPrompt(markets, ["AI", "technology"]);
    expect(prompt).toContain("AI, technology");
    expect(prompt).toContain("m1");
    expect(prompt).toContain("Will AI pass the bar exam?");
    expect(prompt).toContain("About AI capabilities");
    expect(prompt).toContain('"Yes":0.8');
    expect(prompt).toContain("relevance_score");
  });

  it("handles markets with null description and category", () => {
    const markets: Market[] = [
      {
        market_id: "m2",
        question: "Q",
        description: null,
        category: null,
        outcome_prices: {},
        volume: 0,
        liquidity: 0,
        end_date: null,
        status: "active",
        url: null,
        raw_data: {},
      },
    ];
    const prompt = buildAnalysisPrompt(markets, ["test"]);
    expect(prompt).toContain("N/A");
  });
});

describe("parseAnalysisResponse", () => {
  it("parses valid JSON response", () => {
    const response = JSON.stringify({
      results: [
        {
          market_id: "m1",
          relevance_score: 0.85,
          analysis: "Highly relevant to AI",
        },
      ],
    });
    const results = parseAnalysisResponse(response);
    expect(results).toHaveLength(1);
    expect(results[0].market_id).toBe("m1");
    expect(results[0].relevance_score).toBe(0.85);
    expect(results[0].analysis).toBe("Highly relevant to AI");
  });

  it("extracts JSON from code blocks", () => {
    const response = `Here is the analysis:
\`\`\`json
{
  "results": [
    { "market_id": "m2", "relevance_score": 0.5, "analysis": "Moderate relevance" }
  ]
}
\`\`\``;
    const results = parseAnalysisResponse(response);
    expect(results).toHaveLength(1);
    expect(results[0].market_id).toBe("m2");
    expect(results[0].relevance_score).toBe(0.5);
  });

  it("returns empty array for invalid JSON", () => {
    const results = parseAnalysisResponse("not json at all");
    expect(results).toEqual([]);
  });

  it("returns empty array when results field is missing", () => {
    const results = parseAnalysisResponse('{"data": []}');
    expect(results).toEqual([]);
  });

  it("returns empty array when results is not an array", () => {
    const results = parseAnalysisResponse('{"results": "not-array"}');
    expect(results).toEqual([]);
  });

  it("handles missing analysis field gracefully", () => {
    const response = JSON.stringify({
      results: [{ market_id: "m3", relevance_score: 0.3 }],
    });
    const results = parseAnalysisResponse(response);
    expect(results).toHaveLength(1);
    expect(results[0].analysis).toBe("");
  });
});
