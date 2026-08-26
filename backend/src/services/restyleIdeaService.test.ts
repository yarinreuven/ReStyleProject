import assert from "node:assert/strict";
import test from "node:test";

import { findMatchingRestyleIdeas, getResponsibleFallback, getVerifiedRestyleGuide } from "./restyleIdeaService.ts";

const denimDetails = {
  garmentType: "Bottoms",
  fabric: "Denim",
  condition: "worn",
  sewingSkill: "Confident",
  tools: ["scissors", "needle-thread", "sewing-machine", "measuring-tape"],
  difficulty: "Challenging",
  preference: "any"
};

test("returns only curated ideas that match the garment and tools", () => {
  const ideas = findMatchingRestyleIdeas(denimDetails);
  assert.ok(ideas.length > 0);
  assert.ok(ideas.every((idea) => idea.requiredTools.every((tool) => denimDetails.tools.includes(tool))));
  assert.ok(ideas.some((idea) => idea.id === "denim-to-shorts"));
  assert.ok(ideas.every((idea, index) => index === 0 || ideas[index - 1].matchScore >= idea.matchScore));
  assert.ok(ideas.every((idea) => idea.matchLabel));
});

test("always provides a responsible next path when transformation is unsupported", () => {
  const details = { ...denimDetails, garmentType: "Other", fabric: "Leather", condition: "worn" };
  assert.deepEqual(findMatchingRestyleIdeas(details), []);
  const fallback = getResponsibleFallback(details);
  assert.equal(fallback.kind, "recycle");
  assert.ok(fallback.actions.length > 0);
  assert.match(fallback.reason, /leather/i);
});

test("does not invent ideas for unsupported accessories", () => {
  const ideas = findMatchingRestyleIdeas({
    ...denimDetails,
    garmentType: "Other",
    fabric: "Leather"
  });
  assert.deepEqual(ideas, []);
});

test("respects no-sewing and difficulty constraints", () => {
  const ideas = findMatchingRestyleIdeas({
    ...denimDetails,
    sewingSkill: "No sewing",
    tools: ["scissors", "measuring-tape"],
    difficulty: "Easy",
    preference: "clothing"
  });
  assert.deepEqual(ideas.map((idea) => idea.id), ["denim-to-shorts"]);
});

test("returns no result instead of weakening tool requirements", () => {
  const ideas = findMatchingRestyleIdeas({
    ...denimDetails,
    tools: ["none"]
  });
  assert.deepEqual(ideas, []);
});

test("every returned idea has a curated guide without a fabricated video", () => {
  const ideas = findMatchingRestyleIdeas(denimDetails);
  for (const idea of ideas) {
    const guide = getVerifiedRestyleGuide(idea.id);
    assert.ok(guide);
    assert.ok(guide.steps.length >= 5);
    assert.equal(guide.verifiedVideo, null);
  }
});
