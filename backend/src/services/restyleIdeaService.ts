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

const sewingLevels: Record<string, number> = {
  "No sewing": 0,
  "Basic hand sewing": 1,
  Confident: 2,
  Advanced: 3
};
const difficultyLevels = { Easy: 1, Medium: 2, Challenging: 3 };

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
    .slice(0, 4)
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
      whyItFits: `Matched to ${details.fabric.toLowerCase()} fabric, ${details.condition.replace("-", " ")} condition and your ${details.difficulty.toLowerCase()} difficulty preference.`
    }));
}
