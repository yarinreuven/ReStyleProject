interface RestyleDetails {
  garmentType: string;
  fabric: string;
  condition: string;
  sewingSkill: string;
  tools: string[];
  difficulty: string;
  preference: string;
}

interface CatalogIdea {
  id: string;
  title: string;
  description: string;
  garmentTypes: string[];
  fabrics: string[];
  conditions: string[];
  difficulty: "Easy" | "Medium" | "Challenging";
  outputType: "clothing" | "bag" | "accessory" | "home";
  timeMinutes: number;
  sewingRequired: boolean;
  minimumSewingSkill: number;
  requiredTools: string[];
  materials: string[];
  icon: string;
}

interface GuideStep {
  id: string;
  title: string;
  instruction: string;
}

interface RestyleGuide {
  ideaId: string;
  steps: GuideStep[];
  tips: string[];
  warnings: string[];
  verifiedVideo: { title: string; url: string; source: string } | null;
}

const sewingLevels: Record<string, number> = {
  "No sewing": 0,
  "Basic hand sewing": 1,
  Confident: 2,
  Advanced: 3
};
const difficultyLevels = { Easy: 1, Medium: 2, Challenging: 3 };

const conditionGuidance: Record<string, { title: string; description: string; actions: { title: string; description: string }[] }> = {
  good: {
    title: "Keep it in use",
    description: "The garment is still usable, so the most responsible backup is to keep its value in circulation.",
    actions: [
      { title: "Refresh the fit", description: "Try simple reversible styling, hemming or tailoring before cutting the garment." },
      { title: "Pass it forward", description: "Donate or swap it while it is still in wearable condition." }
    ]
  },
  stained: {
    title: "Treat, cover or reclaim",
    description: "Start with the least destructive option and only cut the garment if the stain cannot be treated safely.",
    actions: [
      { title: "Test stain treatment", description: "Check the care label and test a suitable cleaner on a hidden area first." },
      { title: "Cover the affected area", description: "Use a verified patch, embroidery or fabric-paint technique that suits the fabric." },
      { title: "Recover clean fabric", description: "If treatment fails, keep only strong, clean sections for a smaller project." }
    ]
  },
  torn: {
    title: "Repair before transforming",
    description: "A tear does not always require a full redesign. Stabilizing it first can preserve more of the garment.",
    actions: [
      { title: "Inspect the damage", description: "Check whether the tear is limited to a seam or extends through weakened fabric." },
      { title: "Choose a repair", description: "Use a reinforced seam, visible mending or a patch appropriate for the fabric." },
      { title: "Recycle unsafe fabric", description: "Use textile recycling when the surrounding fabric tears under gentle pressure." }
    ]
  },
  "too-small": {
    title: "Refit or pass it forward",
    description: "Avoid irreversible cutting until you know whether the seams allow a safe size adjustment.",
    actions: [
      { title: "Check seam allowance", description: "A tailor can confirm whether side seams can be released or panels can be added." },
      { title: "Swap or donate", description: "If the garment is sound, passing it to the right size preserves its original value." }
    ]
  },
  "too-large": {
    title: "Tailor with minimal waste",
    description: "An oversized garment often has several safe routes before it needs a complete transformation.",
    actions: [
      { title: "Pin the desired fit", description: "Test reversible shaping and mark adjustments while wearing the garment over another layer." },
      { title: "Ask for tailoring", description: "Use professional alteration when fit changes affect closures, lining or structure." }
    ]
  },
  worn: {
    title: "Use only fabric that is still strong",
    description: "Worn fabric must be checked carefully before it becomes a new item.",
    actions: [
      { title: "Perform a strength check", description: "Gently pull several areas. Do not reuse sections that thin, split or shed heavily." },
      { title: "Salvage sound sections", description: "Strong pockets, panels, buttons and trims may still support a smaller project." },
      { title: "Choose textile recycling", description: "Recycle the garment when most of the fabric is no longer structurally sound." }
    ]
  }
};

const catalog: CatalogIdea[] = [
  {
    id: "shirt-to-tote",
    title: "Everyday fabric tote",
    description: "Reuse the strongest front and back panels as a lightweight everyday bag.",
    garmentTypes: ["Tops", "Shirts", "Dresses"],
    fabrics: ["Cotton", "Linen", "Denim", "Polyester"],
    conditions: ["good", "stained", "torn", "too-small", "too-large", "worn"],
    difficulty: "Medium",
    outputType: "bag",
    timeMinutes: 90,
    sewingRequired: true,
    minimumSewingSkill: 1,
    requiredTools: ["scissors", "needle-thread"],
    materials: ["Strong thread", "Pins or clips", "Optional lining"],
    icon: "bag-shopping"
  },
  {
    id: "top-to-crop",
    title: "Clean-cut crop top",
    description: "Shorten a top with a measured hem while keeping its original neckline and sleeves.",
    garmentTypes: ["Tops", "Shirts", "Sweaters"],
    fabrics: ["Cotton", "Knit", "Linen", "Polyester"],
    conditions: ["good", "too-large", "worn"],
    difficulty: "Easy",
    outputType: "clothing",
    timeMinutes: 40,
    sewingRequired: true,
    minimumSewingSkill: 1,
    requiredTools: ["scissors", "needle-thread", "measuring-tape"],
    materials: ["Matching thread", "Tailor's chalk or washable marker"],
    icon: "shirt"
  },
  {
    id: "top-to-cushion",
    title: "Soft cushion cover",
    description: "Cut around damaged areas and turn two usable fabric panels into a removable cover.",
    garmentTypes: ["Tops", "Shirts", "Sweaters", "Dresses"],
    fabrics: ["Cotton", "Knit", "Linen", "Wool", "Polyester"],
    conditions: ["good", "stained", "torn", "too-small", "too-large", "worn"],
    difficulty: "Medium",
    outputType: "home",
    timeMinutes: 75,
    sewingRequired: true,
    minimumSewingSkill: 1,
    requiredTools: ["scissors", "needle-thread", "measuring-tape"],
    materials: ["Cushion insert", "Strong matching thread"],
    icon: "couch"
  },
  {
    id: "denim-to-shorts",
    title: "Finished denim shorts",
    description: "Shorten wearable jeans and finish the edge with a clean fold or controlled fray.",
    garmentTypes: ["Bottoms"],
    fabrics: ["Denim"],
    conditions: ["good", "torn", "worn"],
    difficulty: "Easy",
    outputType: "clothing",
    timeMinutes: 45,
    sewingRequired: false,
    minimumSewingSkill: 0,
    requiredTools: ["scissors", "measuring-tape"],
    materials: ["Tailor's chalk or washable marker", "Sandpaper for an optional frayed edge"],
    icon: "scissors"
  },
  {
    id: "denim-to-skirt",
    title: "Panelled denim skirt",
    description: "Open the inner seams and rebuild the legs as front and back skirt panels.",
    garmentTypes: ["Bottoms"],
    fabrics: ["Denim"],
    conditions: ["good", "torn", "too-large", "worn"],
    difficulty: "Challenging",
    outputType: "clothing",
    timeMinutes: 150,
    sewingRequired: true,
    minimumSewingSkill: 2,
    requiredTools: ["scissors", "sewing-machine", "measuring-tape"],
    materials: ["Denim needle", "Heavy-duty thread", "Pins or clips"],
    icon: "person-dress"
  },
  {
    id: "denim-pocket-organizer",
    title: "Hanging pocket organizer",
    description: "Reuse intact denim pockets and leg panels as sturdy wall storage.",
    garmentTypes: ["Bottoms", "Jackets"],
    fabrics: ["Denim"],
    conditions: ["good", "stained", "torn", "too-small", "too-large", "worn"],
    difficulty: "Medium",
    outputType: "home",
    timeMinutes: 90,
    sewingRequired: true,
    minimumSewingSkill: 1,
    requiredTools: ["scissors", "needle-thread"],
    materials: ["Wooden dowel or strong hanger", "Cord", "Heavy-duty thread"],
    icon: "table-cells-large"
  },
  {
    id: "dress-to-skirt",
    title: "Waist-finished skirt",
    description: "Keep the usable skirt section of a dress and add a comfortable elastic waist.",
    garmentTypes: ["Dresses"],
    fabrics: ["Cotton", "Linen", "Denim", "Satin", "Polyester", "Knit"],
    conditions: ["good", "stained", "torn", "too-large", "worn"],
    difficulty: "Medium",
    outputType: "clothing",
    timeMinutes: 100,
    sewingRequired: true,
    minimumSewingSkill: 1,
    requiredTools: ["scissors", "needle-thread", "measuring-tape"],
    materials: ["Waistband elastic", "Matching thread", "Safety pin"],
    icon: "person-dress"
  },
  {
    id: "jacket-to-vest",
    title: "Structured sleeveless vest",
    description: "Remove damaged sleeves and finish the arm openings while preserving the jacket body.",
    garmentTypes: ["Jackets"],
    fabrics: ["Denim", "Cotton", "Linen", "Polyester"],
    conditions: ["good", "torn", "too-small", "too-large", "worn"],
    difficulty: "Medium",
    outputType: "clothing",
    timeMinutes: 110,
    sewingRequired: true,
    minimumSewingSkill: 1,
    requiredTools: ["scissors", "needle-thread"],
    materials: ["Bias tape or matching fabric", "Strong thread"],
    icon: "vest"
  }
];

const guides: Record<string, RestyleGuide> = {
  "shirt-to-tote": {
    ideaId: "shirt-to-tote",
    steps: [
      { id: "inspect", title: "Inspect and mark usable fabric", instruction: "Lay the garment flat, identify stains or tears, and mark two equal panels that avoid weak areas." },
      { id: "cut", title: "Cut the bag panels", instruction: "Cut the front and back panels together so their finished dimensions remain identical." },
      { id: "handles", title: "Prepare the handles", instruction: "Cut two reinforced strips from sleeves or leftover fabric and fold the raw edges inward." },
      { id: "join", title: "Join the bag body", instruction: "Place right sides together and sew the side and bottom seams with a strong backstitch or machine seam." },
      { id: "finish", title: "Attach handles and finish", instruction: "Turn the bag right side out, attach each handle with a reinforced square, and inspect every load-bearing seam." }
    ],
    tips: ["Use the strongest fabric around the torso for the bag body.", "Add a second fabric layer if the original garment is lightweight."],
    warnings: ["Do not reuse fabric that tears when gently pulled.", "Reinforce handle attachment points before carrying weight."],
    verifiedVideo: null
  },
  "top-to-crop": {
    ideaId: "top-to-crop",
    steps: [
      { id: "measure", title: "Choose the finished length", instruction: "Try the top on over another layer and mark the desired finished edge without cutting." },
      { id: "allowance", title: "Add a hem allowance", instruction: "Measure 2 to 3 cm below the finished line and draw a second, parallel cutting line." },
      { id: "cut", title: "Cut evenly", instruction: "Lay the garment flat and cut slowly along the lower marked line through one layer at a time." },
      { id: "press", title: "Fold and press the hem", instruction: "Fold the raw edge inward twice, press it flat, and secure it with pins or clips." },
      { id: "sew", title: "Sew and inspect", instruction: "Stitch around the hem with a stretch-friendly stitch when working with knit fabric, then check that it lies flat." }
    ],
    tips: ["Measure from several points along the original hem to keep the new edge level."],
    warnings: ["Cut less than you think you need; more length can always be removed later.", "Use a stretch stitch for knit fabric to prevent broken seams."],
    verifiedVideo: null
  },
  "top-to-cushion": {
    ideaId: "top-to-cushion",
    steps: [
      { id: "size", title: "Measure the cushion insert", instruction: "Measure the insert and add a 1.5 cm seam allowance on every side." },
      { id: "panels", title: "Cut two sound panels", instruction: "Choose areas without weak spots and cut matching front and back panels." },
      { id: "pin", title: "Align and secure", instruction: "Place right sides together and pin or clip around the edges, leaving an opening for the insert." },
      { id: "seam", title: "Sew the cover", instruction: "Sew around the marked seam line, reinforce the corners, and trim bulky seam allowances." },
      { id: "close", title: "Insert and close", instruction: "Turn the cover right side out, add the cushion, and close the opening with a ladder stitch." }
    ],
    tips: ["Center an existing print or pocket before cutting the front panel."],
    warnings: ["Do not use fabric weakened by sun damage or widespread thinning."],
    verifiedVideo: null
  },
  "denim-to-shorts": {
    ideaId: "denim-to-shorts",
    steps: [
      { id: "mark", title: "Mark the target length", instruction: "Try the jeans on, mark one leg at the preferred length, and remove them before continuing." },
      { id: "allowance", title: "Add finishing allowance", instruction: "For a folded hem, mark 4 cm below the target line; for a frayed edge, add 1 to 2 cm." },
      { id: "first-cut", title: "Cut the first leg", instruction: "Lay the jeans flat and cut the marked leg with strong fabric scissors." },
      { id: "match", title: "Match the second leg", instruction: "Fold the jeans at the center seam and use the first cut as the exact guide for the second leg." },
      { id: "finish", title: "Finish and wash", instruction: "Fold and secure the hem, or gently fray the edge, then wash once to reveal the final length." }
    ],
    tips: ["Keep the back slightly longer than the front for comfortable coverage."],
    warnings: ["Never cut while wearing the jeans.", "Check pocket depth before choosing a very short length."],
    verifiedVideo: null
  },
  "denim-to-skirt": {
    ideaId: "denim-to-skirt",
    steps: [
      { id: "length", title: "Set the skirt length", instruction: "Mark the intended length and cut both legs with enough extra denim for infill panels." },
      { id: "unpick", title: "Open the inner seams", instruction: "Use a seam ripper to open the inseams carefully without cutting the surrounding denim." },
      { id: "overlap", title: "Arrange the front and back", instruction: "Lay the opened legs flat, overlap the curved crotch seams, and pin until the fabric lies smooth." },
      { id: "panels", title: "Add infill panels", instruction: "Cut panels from the removed legs to close the triangular gaps at the front and back." },
      { id: "stitch", title: "Stitch and finish", instruction: "Machine-stitch every overlapped seam with a denim needle, then finish the hem and inspect the fit." }
    ],
    tips: ["Use contrasting topstitching only after testing tension on a denim offcut."],
    warnings: ["A household machine may struggle with several denim layers.", "Stop if the needle bends or skips stitches."],
    verifiedVideo: null
  },
  "denim-pocket-organizer": {
    ideaId: "denim-pocket-organizer",
    steps: [
      { id: "salvage", title: "Salvage intact pockets", instruction: "Cut around usable pockets with at least 2 cm of surrounding denim for attachment." },
      { id: "base", title: "Prepare the base panel", instruction: "Cut a strong rectangular panel from a leg or jacket back and finish its outer edges." },
      { id: "layout", title: "Plan the pocket layout", instruction: "Arrange pockets with enough space for their intended contents and mark every position." },
      { id: "attach", title: "Attach the pockets", instruction: "Sew around the original pocket edges while leaving each opening clear." },
      { id: "hang", title: "Create the hanger channel", instruction: "Fold and sew the top edge around a dowel or attach reinforced loops, then test it with light items." }
    ],
    tips: ["Place larger pockets lower on the organizer for better balance."],
    warnings: ["Do not store heavy or sharp tools unless the backing is reinforced."],
    verifiedVideo: null
  },
  "dress-to-skirt": {
    ideaId: "dress-to-skirt",
    steps: [
      { id: "waist", title: "Choose the new waistline", instruction: "Mark a level line on the dress where the skirt should begin and add casing allowance above it." },
      { id: "separate", title: "Separate the skirt", instruction: "Lay the dress flat and cut across the marked allowance line without stretching the fabric." },
      { id: "casing", title: "Build the elastic casing", instruction: "Fold the upper edge inward twice and sew around it, leaving a small opening." },
      { id: "elastic", title: "Fit the elastic", instruction: "Measure elastic comfortably around the waist, thread it through the casing, overlap the ends, and sew securely." },
      { id: "finish", title: "Close and inspect", instruction: "Close the casing opening, distribute gathers evenly, and verify that the hem remains level." }
    ],
    tips: ["Use a safety pin to guide elastic through the casing."],
    warnings: ["Satin and slippery fabrics require extra pins and slow stitching."],
    verifiedVideo: null
  },
  "jacket-to-vest": {
    ideaId: "jacket-to-vest",
    steps: [
      { id: "inspect", title: "Inspect the armholes", instruction: "Confirm that the jacket body and armhole seams are sound before removing the sleeves." },
      { id: "remove", title: "Remove the sleeves", instruction: "Use a seam ripper to detach sleeves at the original seam while preserving the body seam allowance." },
      { id: "shape", title: "Refine the armhole shape", instruction: "Try the jacket on, mark small adjustments, and make both sides symmetrical." },
      { id: "bind", title: "Bind the raw edges", instruction: "Enclose each raw armhole edge with bias tape or matching fabric and pin carefully around curves." },
      { id: "finish", title: "Sew and press", instruction: "Stitch the binding slowly, press it into shape, and inspect both armholes for pulling or loose sections." }
    ],
    tips: ["Photograph the original sleeve seam before unpicking it for reference."],
    warnings: ["Do not cut through structured shoulder pads or hidden support layers without checking construction first."],
    verifiedVideo: null
  }
};

export function findMatchingRestyleIdeas(details: RestyleDetails) {
  const userDifficulty = difficultyLevels[details.difficulty as keyof typeof difficultyLevels] || 0;
  const userSewing = sewingLevels[details.sewingSkill] || 0;
  const toolSet = new Set(details.tools);

  return catalog
    .filter((idea) => idea.garmentTypes.includes(details.garmentType))
    .filter((idea) => details.fabric === "Unknown" || idea.fabrics.includes(details.fabric))
    .filter((idea) => idea.conditions.includes(details.condition))
    .filter((idea) => details.preference === "any" || idea.outputType === details.preference)
    .filter((idea) => difficultyLevels[idea.difficulty] <= userDifficulty)
    .filter((idea) => userSewing >= idea.minimumSewingSkill)
    .filter((idea) => idea.requiredTools.every((tool) => toolSet.has(tool)))
    .map((idea) => ({
      id: idea.id,
      title: idea.title,
      description: idea.description,
      difficulty: idea.difficulty,
      outputType: idea.outputType,
      timeMinutes: idea.timeMinutes,
      sewingRequired: idea.sewingRequired,
      requiredTools: idea.requiredTools,
      materials: idea.materials,
      suitableConditions: idea.conditions,
      icon: idea.icon,
      whyItFits: `Matched to ${details.fabric.toLowerCase()} fabric, ${details.condition.replace("-", " ")} condition and your ${details.difficulty.toLowerCase()} difficulty preference.`,
      matchScore: Math.min(98,
        72 +
        (details.fabric !== "Unknown" ? 8 : 3) +
        (details.preference !== "any" && idea.outputType === details.preference ? 8 : 0) +
        (difficultyLevels[idea.difficulty] === userDifficulty ? 6 : 3) +
        (idea.requiredTools.length <= 2 ? 4 : 1)
      )
    }))
    .sort((a, b) => b.matchScore - a.matchScore || a.timeMinutes - b.timeMinutes)
    .slice(0, 4)
    .map((idea) => ({
      ...idea,
      matchLabel: idea.matchScore >= 92 ? "Best match" : idea.matchScore >= 84 ? "Great match" : "Good match"
    }));
}

export function getResponsibleFallback(details: RestyleDetails) {
  const guidance = conditionGuidance[details.condition] || conditionGuidance.worn;
  return {
    kind: details.condition === "good" ? "circulate" : details.condition === "worn" ? "recycle" : "care",
    title: guidance.title,
    description: guidance.description,
    reason: `Recommended for a ${details.fabric.toLowerCase()} ${details.garmentType.toLowerCase()} in ${details.condition.replace("-", " ")} condition.`,
    actions: guidance.actions
  };
}

export function getVerifiedRestyleGuide(ideaId: string) {
  const idea = catalog.find((entry) => entry.id === ideaId);
  const guide = guides[ideaId];
  if (!idea || !guide) return null;
  return {
    idea: {
      id: idea.id,
      title: idea.title,
      description: idea.description,
      difficulty: idea.difficulty,
      timeMinutes: idea.timeMinutes,
      sewingRequired: idea.sewingRequired,
      requiredTools: idea.requiredTools,
      materials: idea.materials,
      icon: idea.icon
    },
    ...guide
  };
}
