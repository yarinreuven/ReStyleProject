import assert from "node:assert/strict";
import test from "node:test";

import { generateRestyleFallbackIdea, personalizeRestyleIdeas } from "./restyleAiService.ts";
import { findMatchingRestyleIdeas } from "./restyleIdeaService.ts";

const details = {
  garmentType: "Bottoms",
  fabric: "Denim",
  condition: "worn",
  sewingSkill: "Confident",
  tools: ["scissors", "needle-thread", "sewing-machine", "measuring-tape"],
  difficulty: "Challenging",
  preference: "any"
};

function withRestyleKey(value?: string) {
  const previous = process.env.GEMINI_RESTYLE_API_KEY;
  if (value === undefined) delete process.env.GEMINI_RESTYLE_API_KEY;
  else process.env.GEMINI_RESTYLE_API_KEY = value;
  return () => {
    if (previous === undefined) delete process.env.GEMINI_RESTYLE_API_KEY;
    else process.env.GEMINI_RESTYLE_API_KEY = previous;
  };
}

test("uses curated ideas without calling Gemini when the dedicated key is missing", async () => {
  const restore = withRestyleKey();
  const candidates = findMatchingRestyleIdeas(details);
  let called = false;
  try {
    const ideas = await personalizeRestyleIdeas(details, candidates, null, async () => {
      called = true;
      throw new Error("should not be called");
    });
    assert.equal(called, false);
    assert.deepEqual(ideas, candidates);
  } finally {
    restore();
  }
});

test("accepts Gemini personalization only for verified catalog IDs", async () => {
  const restore = withRestyleKey("test-key");
  const candidates = findMatchingRestyleIdeas(details);
  const selected = candidates[1] || candidates[0];
  try {
    const ideas = await personalizeRestyleIdeas(details, candidates, null, async () => new Response(JSON.stringify({
      candidates: [{
        content: {
          parts: [{ text: JSON.stringify({
            ideas: [
              {
                id: "invented-unsafe-idea",
                description: "This invented idea must never be displayed to the user.",
                whyItFits: "It is not part of the verified catalog and has no safe guide."
              },
              {
                id: selected.id,
                description: "This version makes thoughtful use of the strongest visible denim panels.",
                whyItFits: "It matches the selected tools, skill level and worn denim condition."
              }
            ]
          }) }]
        }
      }]
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    assert.equal(ideas.length, 1);
    assert.equal(ideas[0].id, selected.id);
    assert.match(ideas[0].description, /strongest visible denim/i);
  } finally {
    restore();
  }
});

test("silently falls back to curated ideas on quota or provider errors", async () => {
  const restore = withRestyleKey("test-key");
  const candidates = findMatchingRestyleIdeas(details);
  try {
    const ideas = await personalizeRestyleIdeas(details, candidates, null, async () => new Response(
      JSON.stringify({ error: { status: "RESOURCE_EXHAUSTED" } }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    ));
    assert.deepEqual(ideas, candidates);
  } finally {
    restore();
  }
});

test("creates a constrained saved guide only when Gemini uses allowed tools", async () => {
  const restore = withRestyleKey("test-key");
  try {
    const ideas = await generateRestyleFallbackIdea(details, null, async () => new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify({ idea: {
        title: "Compact denim key pouch",
        description: "Turn one remaining strong denim section into a small everyday pouch.",
        difficulty: "Medium", outputType: "accessory", timeMinutes: 60, sewingRequired: true,
        requiredTools: ["scissors", "needle-thread"], materials: ["Strong thread", "Small snap"],
        whyItFits: "This uses only the available tools and a small sound section of the worn denim.",
        steps: Array.from({ length: 5 }, (_, index) => ({ title: `Safe step ${index + 1}`, instruction: `Complete careful measured action number ${index + 1} and inspect the fabric before continuing.` })),
        tips: ["Measure twice before cutting the denim panel."], warnings: ["Stop if the remaining denim tears under gentle pressure."],
        youtubeSearchQuery: "upcycled denim key pouch hand sewing tutorial"
      } }) }] } }]
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    assert.equal(ideas.length, 1);
    assert.equal(ideas[0].generatedGuide.steps.length, 5);
    assert.match(ideas[0].generatedGuide.videoSearch.url, /youtube\.com\/results/);
  } finally {
    restore();
  }
});

test("rejects a generated fallback that requires an unavailable tool", async () => {
  const restore = withRestyleKey("test-key");
  try {
    const ideas = await generateRestyleFallbackIdea(details, null, async () => new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify({ idea: {
        title: "Unsafe unavailable-tool project", description: "This project incorrectly requires a tool the user does not own.",
        difficulty: "Medium", outputType: "home", timeMinutes: 60, sewingRequired: false,
        requiredTools: ["industrial-laser"], materials: ["Denim"], whyItFits: "This should be rejected by local validation before display.",
        steps: Array.from({ length: 5 }, (_, index) => ({ title: `Invalid step ${index + 1}`, instruction: `This otherwise valid instruction is long enough for schema validation ${index + 1}.` })),
        tips: ["Never shown to the user."], warnings: ["Never shown to the user."], youtubeSearchQuery: "invalid project"
      } }) }] } }]
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    assert.deepEqual(ideas, []);
  } finally {
    restore();
  }
});
