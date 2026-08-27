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

test("prioritizes wearable no-sew transformations for a good T-shirt", () => {
  const ideas = findMatchingRestyleIdeas({
    garmentType: "Tops",
    fabric: "Cotton",
    condition: "good",
    sewingSkill: "No sewing",
    tools: ["scissors", "measuring-tape"],
    difficulty: "Easy",
    preference: "any"
  });
  assert.deepEqual(ideas.slice(0, 2).map((idea) => idea.id), ["tshirt-to-tank", "top-to-crop"]);
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

test("every catalog idea is reachable and has a complete verified guide", () => {
  const expectedIds = new Set([
    "shirt-to-tote", "top-to-crop", "top-to-cushion", "denim-to-shorts",
    "denim-to-skirt", "denim-pocket-organizer", "dress-to-skirt", "jacket-to-vest",
    "fabric-headband", "reusable-gift-wrap", "visible-mending-feature",
    "sleeve-drawstring-pouch", "denim-coasters", "skirt-to-tote", "satin-neck-scarf",
    "sweater-arm-warmers", "jacket-pocket-pouch", "trouser-panel-apron",
    "fabric-wall-art", "fabric-flower-brooch", "tshirt-to-tank",
    "tshirt-yarn-bag", "tshirt-braided-tote", "denim-pocket-crossbody",
    "denim-lunch-bag", "denim-zip-pouch", "denim-bottle-carrier",
    "skirt-drawstring-bag", "skirt-to-summer-top", "skirt-kitchen-apron",
    "skirt-envelope-cushion"
  ]);
  const foundIds = new Set<string>();
  const garmentAndFabricPairs = [
    ["Tops", "Cotton"], ["Shirts", "Linen"], ["Bottoms", "Denim"],
    ["Bottoms", "Cotton"], ["Dresses", "Satin"], ["Dresses", "Cotton"],
    ["Skirts", "Denim"], ["Skirts", "Cotton"], ["Jackets", "Denim"], ["Jackets", "Wool"],
    ["Sweaters", "Knit"]
  ];
  const tools = [
    "scissors", "needle-thread", "sewing-machine", "fabric-glue",
    "measuring-tape", "iron", "paint-dye", "crochet-hook"
  ];

  for (const [garmentType, fabric] of garmentAndFabricPairs) {
    for (const condition of ["good", "stained", "torn", "worn"]) {
      for (const preference of ["any", "clothing", "bag", "accessory", "home"]) {
        const ideas = findMatchingRestyleIdeas({
          garmentType,
          fabric,
          condition,
          sewingSkill: "Advanced",
          tools,
          difficulty: "Challenging",
          preference
        });
        ideas.forEach((idea) => foundIds.add(idea.id));
      }
    }
  }

  assert.deepEqual(foundIds, expectedIds);
  for (const ideaId of foundIds) {
    const guide = getVerifiedRestyleGuide(ideaId);
    assert.ok(guide, `${ideaId} must have a guide`);
    assert.ok(guide.steps.length >= 5, `${ideaId} must have at least five steps`);
    assert.ok(guide.tips.length > 0, `${ideaId} must have a tip`);
    assert.ok(guide.warnings.length > 0, `${ideaId} must have a warning`);
  }
});
