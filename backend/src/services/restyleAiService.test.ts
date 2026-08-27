import assert from "node:assert/strict";
import test from "node:test";

import { personalizeRestyleIdeas } from "./restyleAiService.ts";
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
