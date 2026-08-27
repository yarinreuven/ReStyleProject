export interface RestyleDetails {
  garmentType: string;
  fabric: string;
  condition: string;
  sewingSkill: string;
  tools: string[];
  difficulty: string;
  preference: string;
}

export type RestyleIdea = ReturnType<typeof findMatchingRestyleIdeas>[number];

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
  videoSearch?: { title: string; url: string };
}

export const RESTYLE_CATALOG_VERSION = 3;

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
    sewingRequired: false,
    minimumSewingSkill: 0,
    requiredTools: ["scissors", "measuring-tape"],
    materials: ["Tailor's chalk or washable marker", "Optional fabric glue for a bonded hem"],
    icon: "shirt"
  },
  {
    id: "tshirt-to-tank",
    title: "No-sew relaxed tank top",
    description: "Reshape a soft T-shirt into a casual tank while preserving enough fabric around the neckline and side seams.",
    garmentTypes: ["Tops", "Shirts"],
    fabrics: ["Cotton", "Knit", "Polyester"],
    conditions: ["good", "stained", "torn", "too-large", "worn"],
    difficulty: "Easy",
    outputType: "clothing",
    timeMinutes: 30,
    sewingRequired: false,
    minimumSewingSkill: 0,
    requiredTools: ["scissors", "measuring-tape"],
    materials: ["Tailor's chalk or washable marker", "A well-fitting tank top as an optional template"],
    icon: "shirt"
  },
  {
    id: "tshirt-yarn-bag",
    title: "Crocheted T-shirt-yarn bag",
    description: "Cut a knit T-shirt into continuous yarn and crochet it into a sturdy reusable bag.",
    garmentTypes: ["Tops", "Shirts", "Dresses"],
    fabrics: ["Cotton", "Knit"],
    conditions: ["good", "stained", "torn", "too-small", "too-large", "worn"],
    difficulty: "Medium",
    outputType: "bag",
    timeMinutes: 180,
    sewingRequired: false,
    minimumSewingSkill: 0,
    requiredTools: ["scissors", "crochet-hook"],
    materials: ["Large crochet hook suitable for T-shirt yarn", "Optional stitch marker"],
    icon: "bag-shopping"
  },
  {
    id: "tshirt-braided-tote",
    title: "Braided T-shirt-strip tote",
    description: "Braid long knit strips and hand-join the braids into a soft, washable tote without crochet.",
    garmentTypes: ["Tops", "Shirts", "Dresses"],
    fabrics: ["Cotton", "Knit"],
    conditions: ["good", "stained", "torn", "too-small", "too-large", "worn"],
    difficulty: "Medium",
    outputType: "bag",
    timeMinutes: 140,
    sewingRequired: true,
    minimumSewingSkill: 1,
    requiredTools: ["scissors", "needle-thread"],
    materials: ["Strong thread", "Clips", "Optional fabric lining"],
    icon: "bag-shopping"
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
  },
  {
    id: "fabric-headband",
    title: "Braided fabric headband",
    description: "Turn narrow strips of soft fabric into a comfortable braided headband.",
    garmentTypes: ["Tops", "Shirts", "Dresses", "Skirts"],
    fabrics: ["Cotton", "Knit", "Polyester"],
    conditions: ["good", "stained", "torn", "too-small", "too-large", "worn"],
    difficulty: "Easy",
    outputType: "accessory",
    timeMinutes: 30,
    sewingRequired: false,
    minimumSewingSkill: 0,
    requiredTools: ["scissors", "fabric-glue"],
    materials: ["Small elastic band", "Optional ribbon for the join"],
    icon: "ribbon"
  },
  {
    id: "reusable-gift-wrap",
    title: "Reusable fabric gift wrap",
    description: "Save a clean square of attractive fabric as reusable knot-tied gift wrapping.",
    garmentTypes: ["Tops", "Shirts", "Dresses", "Skirts"],
    fabrics: ["Cotton", "Linen", "Satin", "Polyester"],
    conditions: ["good", "stained", "torn", "too-small", "too-large", "worn"],
    difficulty: "Easy",
    outputType: "home",
    timeMinutes: 25,
    sewingRequired: false,
    minimumSewingSkill: 0,
    requiredTools: ["scissors", "measuring-tape"],
    materials: ["Fabric-safe anti-fray liquid or optional fabric glue"],
    icon: "gift"
  },
  {
    id: "visible-mending-feature",
    title: "Decorative visible-mending patch",
    description: "Stabilize a local tear or stain with a deliberate contrasting patch and simple stitches.",
    garmentTypes: ["Tops", "Bottoms", "Dresses", "Skirts", "Jackets", "Shirts", "Sweaters"],
    fabrics: ["Denim", "Cotton", "Knit", "Linen", "Wool", "Polyester"],
    conditions: ["stained", "torn", "worn"],
    difficulty: "Easy",
    outputType: "clothing",
    timeMinutes: 40,
    sewingRequired: true,
    minimumSewingSkill: 1,
    requiredTools: ["scissors", "needle-thread"],
    materials: ["Compatible patch fabric", "Contrasting thread", "Pins or clips"],
    icon: "bandage"
  },
  {
    id: "sleeve-drawstring-pouch",
    title: "Sleeve drawstring pouch",
    description: "Reuse an intact shirt or sweater sleeve as a small organizer with a simple drawstring closure.",
    garmentTypes: ["Tops", "Shirts", "Sweaters", "Jackets"],
    fabrics: ["Cotton", "Knit", "Linen", "Wool", "Polyester"],
    conditions: ["good", "stained", "torn", "too-small", "too-large", "worn"],
    difficulty: "Easy",
    outputType: "bag",
    timeMinutes: 45,
    sewingRequired: true,
    minimumSewingSkill: 1,
    requiredTools: ["scissors", "needle-thread"],
    materials: ["Cord or ribbon", "Safety pin", "Strong thread"],
    icon: "sack-xmark"
  },
  {
    id: "denim-coasters",
    title: "Layered denim coasters",
    description: "Laminate small sound denim sections into sturdy washable table coasters.",
    garmentTypes: ["Bottoms", "Skirts", "Jackets"],
    fabrics: ["Denim"],
    conditions: ["stained", "torn", "too-small", "too-large", "worn"],
    difficulty: "Easy",
    outputType: "home",
    timeMinutes: 35,
    sewingRequired: false,
    minimumSewingSkill: 0,
    requiredTools: ["scissors", "fabric-glue", "measuring-tape"],
    materials: ["Washable fabric glue", "Card template"],
    icon: "layer-group"
  },
  {
    id: "skirt-to-tote",
    title: "Skirt-shape market tote",
    description: "Use the existing skirt side seams as the body of a roomy market bag.",
    garmentTypes: ["Skirts", "Dresses"],
    fabrics: ["Denim", "Cotton", "Linen", "Polyester"],
    conditions: ["good", "stained", "torn", "too-small", "too-large", "worn"],
    difficulty: "Medium",
    outputType: "bag",
    timeMinutes: 80,
    sewingRequired: true,
    minimumSewingSkill: 1,
    requiredTools: ["scissors", "needle-thread", "measuring-tape"],
    materials: ["Strong webbing or fabric handles", "Heavy-duty thread"],
    icon: "basket-shopping"
  },
  {
    id: "satin-neck-scarf",
    title: "Soft neck scarf",
    description: "Recover an undamaged satin panel and finish it as a lightweight square neck scarf.",
    garmentTypes: ["Tops", "Shirts", "Dresses", "Skirts"],
    fabrics: ["Satin"],
    conditions: ["good", "stained", "torn", "too-small", "too-large"],
    difficulty: "Medium",
    outputType: "accessory",
    timeMinutes: 55,
    sewingRequired: true,
    minimumSewingSkill: 1,
    requiredTools: ["scissors", "needle-thread", "measuring-tape", "iron"],
    materials: ["Fine matching thread", "Lightweight sewing needle"],
    icon: "user-tie"
  },
  {
    id: "sweater-arm-warmers",
    title: "Cozy arm warmers",
    description: "Turn two sound sweater sleeves into a matching pair of soft arm warmers.",
    garmentTypes: ["Sweaters"],
    fabrics: ["Knit", "Wool"],
    conditions: ["good", "stained", "torn", "too-small", "too-large", "worn"],
    difficulty: "Easy",
    outputType: "accessory",
    timeMinutes: 40,
    sewingRequired: true,
    minimumSewingSkill: 1,
    requiredTools: ["scissors", "needle-thread", "measuring-tape"],
    materials: ["Stretch-compatible thread", "Optional narrow elastic"],
    icon: "mitten"
  },
  {
    id: "jacket-pocket-pouch",
    title: "Zip pocket travel pouch",
    description: "Salvage a working jacket pocket and its closure as a compact travel organizer.",
    garmentTypes: ["Jackets"],
    fabrics: ["Denim", "Cotton", "Linen", "Polyester", "Wool"],
    conditions: ["stained", "torn", "too-small", "too-large", "worn"],
    difficulty: "Medium",
    outputType: "bag",
    timeMinutes: 65,
    sewingRequired: true,
    minimumSewingSkill: 1,
    requiredTools: ["scissors", "needle-thread"],
    materials: ["Backing fabric", "Strong matching thread"],
    icon: "wallet"
  },
  {
    id: "trouser-panel-apron",
    title: "Utility waist apron",
    description: "Combine strong trouser panels and existing pockets into a practical waist apron.",
    garmentTypes: ["Bottoms"],
    fabrics: ["Denim", "Cotton", "Linen", "Polyester"],
    conditions: ["good", "stained", "torn", "too-small", "too-large", "worn"],
    difficulty: "Medium",
    outputType: "home",
    timeMinutes: 90,
    sewingRequired: true,
    minimumSewingSkill: 1,
    requiredTools: ["scissors", "needle-thread", "measuring-tape"],
    materials: ["Cotton tape or fabric ties", "Strong thread"],
    icon: "kitchen-set"
  },
  {
    id: "fabric-wall-art",
    title: "Framed textile wall art",
    description: "Preserve an attractive print, embroidery or texture as a clean framed textile panel.",
    garmentTypes: ["Tops", "Bottoms", "Dresses", "Skirts", "Jackets", "Shirts", "Sweaters"],
    fabrics: ["Denim", "Cotton", "Knit", "Satin", "Linen", "Wool", "Polyester"],
    conditions: ["good", "stained", "torn", "too-small", "too-large", "worn"],
    difficulty: "Easy",
    outputType: "home",
    timeMinutes: 30,
    sewingRequired: false,
    minimumSewingSkill: 0,
    requiredTools: ["scissors", "measuring-tape"],
    materials: ["Picture frame or embroidery hoop", "Acid-free backing card"],
    icon: "image"
  },
  {
    id: "fabric-flower-brooch",
    title: "Layered fabric flower brooch",
    description: "Shape small clean offcuts into a layered flower that can decorate a bag or jacket.",
    garmentTypes: ["Tops", "Bottoms", "Dresses", "Skirts", "Jackets", "Shirts"],
    fabrics: ["Denim", "Cotton", "Satin", "Linen", "Polyester"],
    conditions: ["stained", "torn", "too-small", "too-large", "worn"],
    difficulty: "Easy",
    outputType: "accessory",
    timeMinutes: 35,
    sewingRequired: false,
    minimumSewingSkill: 0,
    requiredTools: ["scissors", "fabric-glue"],
    materials: ["Brooch back or safety pin", "Fabric-safe glue", "Optional button"],
    icon: "fan"
  },
  {
    id: "denim-pocket-crossbody", title: "Denim pocket crossbody bag", description: "Turn a sturdy jeans pocket and leg panel into a compact everyday phone bag.",
    garmentTypes: ["Bottoms"], fabrics: ["Denim"], conditions: ["good", "stained", "torn", "too-small", "too-large", "worn"], difficulty: "Medium", outputType: "bag", timeMinutes: 90,
    sewingRequired: true, minimumSewingSkill: 1, requiredTools: ["scissors", "needle-thread", "measuring-tape"], materials: ["Strong strap or denim strips", "Snap or button", "Strong thread"], icon: "mobile-screen"
  },
  {
    id: "denim-lunch-bag", title: "Insulated denim lunch bag", description: "Reuse strong jean legs as a washable outer shell for a practical lunch bag.",
    garmentTypes: ["Bottoms"], fabrics: ["Denim"], conditions: ["good", "stained", "torn", "too-large", "worn"], difficulty: "Challenging", outputType: "bag", timeMinutes: 150,
    sewingRequired: true, minimumSewingSkill: 2, requiredTools: ["scissors", "sewing-machine", "measuring-tape"], materials: ["Washable food-safe lining", "Insulated batting", "Hook-and-loop tape"], icon: "bag-shopping"
  },
  {
    id: "denim-zip-pouch", title: "Everyday denim zip pouch", description: "Make a durable pencil case, makeup pouch or cable organizer from a clean denim panel.",
    garmentTypes: ["Bottoms", "Skirts", "Jackets"], fabrics: ["Denim"], conditions: ["good", "stained", "torn", "too-small", "too-large", "worn"], difficulty: "Medium", outputType: "accessory", timeMinutes: 75,
    sewingRequired: true, minimumSewingSkill: 1, requiredTools: ["scissors", "needle-thread", "measuring-tape"], materials: ["Zipper", "Strong thread", "Optional cotton lining"], icon: "pencil"
  },
  {
    id: "denim-bottle-carrier", title: "Denim bottle carrier", description: "Create a reusable handled carrier from a strong jeans leg for a daily water bottle.",
    garmentTypes: ["Bottoms"], fabrics: ["Denim"], conditions: ["good", "stained", "torn", "too-large", "worn"], difficulty: "Medium", outputType: "bag", timeMinutes: 70,
    sewingRequired: true, minimumSewingSkill: 1, requiredTools: ["scissors", "needle-thread", "measuring-tape"], materials: ["Strong thread", "Cotton webbing or denim handle"], icon: "bottle-water"
  },
  {
    id: "skirt-drawstring-bag", title: "Skirt drawstring day bag", description: "Use the skirt body and finished hem to make a roomy everyday drawstring bag.",
    garmentTypes: ["Skirts", "Dresses"], fabrics: ["Denim", "Cotton", "Linen", "Polyester"], conditions: ["good", "stained", "torn", "too-small", "too-large", "worn"], difficulty: "Medium", outputType: "bag", timeMinutes: 90,
    sewingRequired: true, minimumSewingSkill: 1, requiredTools: ["scissors", "needle-thread", "measuring-tape"], materials: ["Two lengths of strong cord", "Strong thread"], icon: "bag-shopping"
  },
  {
    id: "skirt-to-summer-top", title: "Gathered summer top", description: "Reshape a lightweight gathered skirt into a simple elastic-neck summer top.",
    garmentTypes: ["Skirts"], fabrics: ["Cotton", "Linen", "Polyester"], conditions: ["good", "too-large"], difficulty: "Challenging", outputType: "clothing", timeMinutes: 140,
    sewingRequired: true, minimumSewingSkill: 2, requiredTools: ["scissors", "sewing-machine", "measuring-tape"], materials: ["Garment elastic", "Matching thread", "Pins or clips"], icon: "shirt"
  },
  {
    id: "skirt-kitchen-apron", title: "Everyday kitchen apron", description: "Preserve the skirt front and waistband as a useful apron with ties and an optional pocket.",
    garmentTypes: ["Skirts"], fabrics: ["Denim", "Cotton", "Linen", "Polyester"], conditions: ["good", "stained", "torn", "too-small", "too-large", "worn"], difficulty: "Easy", outputType: "home", timeMinutes: 60,
    sewingRequired: true, minimumSewingSkill: 1, requiredTools: ["scissors", "needle-thread", "measuring-tape"], materials: ["Cotton tape or fabric ties", "Strong thread"], icon: "kitchen-set"
  },
  {
    id: "skirt-envelope-cushion", title: "Envelope cushion from a skirt", description: "Reuse wide skirt panels and an existing finished edge as a removable cushion cover.",
    garmentTypes: ["Skirts"], fabrics: ["Denim", "Cotton", "Linen", "Wool", "Polyester"], conditions: ["good", "stained", "torn", "too-large", "worn"], difficulty: "Medium", outputType: "home", timeMinutes: 75,
    sewingRequired: true, minimumSewingSkill: 1, requiredTools: ["scissors", "needle-thread", "measuring-tape"], materials: ["Cushion insert", "Strong matching thread"], icon: "couch"
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
      { id: "finish", title: "Choose the edge finish", instruction: "Leave stable jersey raw for a rolled edge, or turn a narrow hem inward and secure it with flexible fabric glue." },
      { id: "inspect", title: "Let it set and inspect", instruction: "Allow any adhesive to cure fully, try the top on, and check that the edge hangs evenly without pulling." }
    ],
    tips: ["Measure from several points along the original hem to keep the new edge level.", "Soft jersey usually rolls slightly and can be left unfinished for a casual look."],
    warnings: ["Cut less than you think you need; more length can always be removed later.", "Test fabric glue on an offcut and use a flexible washable formula."],
    verifiedVideo: null,
    videoSearch: { title: "Find a no-sew crop-top video", url: "https://www.youtube.com/results?search_query=no+sew+tshirt+crop+top+tutorial" }
  },
  "tshirt-to-tank": {
    ideaId: "tshirt-to-tank",
    steps: [
      { id: "template", title: "Plan the tank shape", instruction: "Lay the T-shirt flat and place a well-fitting tank on top, or mark shallow armhole curves by hand." },
      { id: "mark", title: "Mark conservative cut lines", instruction: "Leave at least 2 cm more shoulder and side coverage than the intended final shape." },
      { id: "first", title: "Cut the first armhole", instruction: "Cut one layer slowly along the first marked curve without cutting into the neckline or side seam." },
      { id: "mirror", title: "Mirror the second side", instruction: "Fold the shirt exactly in half and use the first armhole as a guide for a symmetrical second cut." },
      { id: "finish", title: "Shape and test", instruction: "Gently stretch stable jersey edges so they roll, try the tank on over another layer, and make only small final adjustments." }
    ],
    tips: ["Start with smaller armholes; they can always be enlarged after the first fitting."],
    warnings: ["Never cut the shirt while wearing it and do not cut through side seams unless you plan to reconstruct them."],
    verifiedVideo: null,
    videoSearch: { title: "Find a no-sew tank-top video", url: "https://www.youtube.com/results?search_query=no+sew+tshirt+to+tank+top+tutorial" }
  },
  "tshirt-yarn-bag": {
    ideaId: "tshirt-yarn-bag",
    steps: [
      { id: "prepare", title: "Prepare the knit tube", instruction: "Lay a clean T-shirt flat, remove the hem and cut straight across below the sleeves to keep the torso tube." },
      { id: "strips", title: "Cut connected strips", instruction: "Cut parallel 2 to 3 cm strips from the folded edge while stopping several centimeters before the opposite edge." },
      { id: "continuous", title: "Create continuous yarn", instruction: "Open the uncut spine and make diagonal connecting cuts so the strips become one continuous length." },
      { id: "stretch", title: "Form and join the yarn", instruction: "Stretch the strip gently so jersey curls inward, then join additional yarn with secure low-bulk knots if required." },
      { id: "crochet", title: "Crochet and inspect the bag", instruction: "Crochet a firm base and sides with an appropriate large hook, form reinforced handles, and test every join with light weight." }
    ],
    tips: ["Consistent strip width produces more even yarn and a stronger finished bag."],
    warnings: ["Avoid weak, brittle or heavily perforated fabric in load-bearing areas and increase weight gradually during testing."],
    verifiedVideo: null,
    videoSearch: { title: "Find a T-shirt-yarn bag video", url: "https://www.youtube.com/results?search_query=tshirt+yarn+crochet+bag+tutorial" }
  },
  "tshirt-braided-tote": {
    ideaId: "tshirt-braided-tote",
    steps: [
      { id: "strips", title: "Cut long knit strips", instruction: "Recover sound jersey areas and cut even strips, avoiding damaged sections that tear under gentle tension." },
      { id: "join", title: "Join strip lengths", instruction: "Join short strips into three long working lengths with small secure overlaps or low-bulk knots." },
      { id: "braid", title: "Braid without twisting", instruction: "Braid the three lengths with steady tension and add strips gradually until the braid is long enough." },
      { id: "shape", title: "Coil and shape the body", instruction: "Coil the braid into an oval base, then build upward while clipping adjacent rows together." },
      { id: "stitch", title: "Hand-join and add handles", instruction: "Use strong thread to join each row, form two reinforced handles, and load-test the finished tote gradually." }
    ],
    tips: ["Keep the braid relaxed; an overly tight braid makes the bag stiff and uneven."],
    warnings: ["Reinforce every handle connection and do not carry heavy items until all joins have been inspected."],
    verifiedVideo: null,
    videoSearch: { title: "Find a braided T-shirt bag video", url: "https://www.youtube.com/results?search_query=braided+tshirt+yarn+bag+tutorial" }
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
  },
  "fabric-headband": {
    ideaId: "fabric-headband",
    steps: [
      { id: "select", title: "Select soft, strong fabric", instruction: "Choose a clean section that stretches comfortably and does not thin when gently pulled." },
      { id: "measure", title: "Measure and cut strips", instruction: "Measure around the head, then cut three even strips slightly longer than that measurement." },
      { id: "braid", title: "Make an even braid", instruction: "Secure one end temporarily and braid without pulling so tightly that the fabric curls." },
      { id: "fit", title: "Test the fit", instruction: "Wrap the braid around the head and mark a comfortable length before trimming the ends." },
      { id: "join", title: "Join and cover the ends", instruction: "Glue both ends securely to a short elastic loop and cover the join with a glued fabric tab." }
    ],
    tips: ["Knit fabric rolls naturally and gives a soft finished edge."],
    warnings: ["Allow fabric glue to cure fully before wearing the headband."],
    verifiedVideo: null
  },
  "reusable-gift-wrap": {
    ideaId: "reusable-gift-wrap",
    steps: [
      { id: "inspect", title: "Find a clean square", instruction: "Identify a sound area large enough to wrap the intended gift while avoiding stains and weak sections." },
      { id: "measure", title: "Mark equal sides", instruction: "Use a measuring tape to mark a square with straight, equal sides." },
      { id: "cut", title: "Cut the panel", instruction: "Lay the fabric flat and cut slowly along the marked lines with fabric scissors." },
      { id: "finish", title: "Control the raw edges", instruction: "Apply a very thin line of fabric-safe anti-fray liquid or glue and let it dry flat." },
      { id: "wrap", title: "Practice the knot wrap", instruction: "Place an object diagonally in the center, bring opposite corners together, and finish with a secure square knot." }
    ],
    tips: ["A contrasting care-label tag can remind recipients to reuse the wrap."],
    warnings: ["Do not use shedding or dye-transfer fabric around food or delicate gifts."],
    verifiedVideo: null
  },
  "visible-mending-feature": {
    ideaId: "visible-mending-feature",
    steps: [
      { id: "assess", title: "Assess the damaged area", instruction: "Check that the fabric around the damage remains strong enough to hold stitches." },
      { id: "patch", title: "Prepare the patch", instruction: "Cut a compatible patch at least 2 cm larger than the damage on every side and round its corners." },
      { id: "position", title: "Position and secure", instruction: "Place the patch behind or over the damaged area and hold it flat with pins or clips." },
      { id: "stitch", title: "Stitch the perimeter", instruction: "Use small even running stitches around the patch without pulling the fabric into puckers." },
      { id: "reinforce", title: "Reinforce and inspect", instruction: "Add parallel decorative stitch lines across weak areas, knot securely, and test the repair gently." }
    ],
    tips: ["Wash and dry both fabrics before patching to reduce uneven shrinkage."],
    warnings: ["Do not patch fabric that continues tearing under gentle pressure; recycle it instead."],
    verifiedVideo: null
  },
  "sleeve-drawstring-pouch": {
    ideaId: "sleeve-drawstring-pouch",
    steps: [
      { id: "choose", title: "Choose an intact sleeve", instruction: "Select a sleeve section with a finished cuff and enough sound fabric for the intended pouch." },
      { id: "cut", title: "Cut the pouch body", instruction: "Measure from the cuff, add a seam allowance, and cut straight across the sleeve." },
      { id: "close", title: "Close the base", instruction: "Turn the sleeve inside out and sew the cut edge with small reinforced stitches." },
      { id: "channel", title: "Prepare the drawstring channel", instruction: "Use the cuff channel if suitable, or fold and stitch a narrow channel near the opening." },
      { id: "cord", title: "Insert and test the cord", instruction: "Guide cord through the channel with a safety pin, knot the ends, and test the closed pouch with light items." }
    ],
    tips: ["A button cuff can become a useful design detail on the pouch."],
    warnings: ["Do not use loose knit fabric for small objects unless the pouch is lined."],
    verifiedVideo: null
  },
  "denim-coasters": {
    ideaId: "denim-coasters",
    steps: [
      { id: "test", title: "Test and clean the denim", instruction: "Use only clean, colorfast denim that remains strong when gently pulled." },
      { id: "template", title: "Make a template", instruction: "Cut an even square or circle template between 9 and 11 cm wide." },
      { id: "layers", title: "Cut matching layers", instruction: "Trace and cut two or three denim pieces for each coaster." },
      { id: "bond", title: "Bond the layers", instruction: "Apply washable fabric glue sparingly between layers and press them flat under a protected weight." },
      { id: "finish", title: "Trim and cure", instruction: "Trim uneven edges only after bonding, then allow the glue to cure for the full manufacturer time." }
    ],
    tips: ["Alternate denim grain direction between layers to reduce curling."],
    warnings: ["Use only glue labeled washable and suitable for fabric; keep uncured glue away from table surfaces."],
    verifiedVideo: null
  },
  "skirt-to-tote": {
    ideaId: "skirt-to-tote",
    steps: [
      { id: "inspect", title: "Inspect the skirt body", instruction: "Check the side seams, waistband and intended base for weak fabric or hidden openings." },
      { id: "shape", title: "Mark the bag shape", instruction: "Lay the garment flat and mark a level lower edge that preserves the strongest fabric." },
      { id: "base", title: "Close and reinforce the base", instruction: "Turn the garment inside out, stitch the lower edge twice, and reinforce both corners." },
      { id: "handles", title: "Prepare the handles", instruction: "Cut or measure two equal handles and finish any raw edges before attachment." },
      { id: "attach", title: "Attach and load-test", instruction: "Sew each handle with a reinforced square, turn the bag out, and test gradually with light weight." }
    ],
    tips: ["Existing skirt pockets can remain as useful tote pockets."],
    warnings: ["Do not rely on fabric glue for load-bearing handles."],
    verifiedVideo: null
  },
  "satin-neck-scarf": {
    ideaId: "satin-neck-scarf",
    steps: [
      { id: "select", title: "Select an undamaged panel", instruction: "Choose satin without pulls, stains or weakened fold lines and press it on a safe low setting." },
      { id: "square", title: "Measure a true square", instruction: "Mark a square of at least 45 cm per side, checking both diagonals for equal length." },
      { id: "cut", title: "Cut one layer at a time", instruction: "Place the satin on a non-slip surface and cut slowly with sharp scissors." },
      { id: "hem", title: "Form a narrow rolled hem", instruction: "Turn a very narrow edge twice, press carefully, and secure it with fine hand stitches." },
      { id: "finish", title: "Finish corners and press", instruction: "Tuck each corner neatly, complete the hem, and press through a protective cloth." }
    ],
    tips: ["Extra pins or clips help prevent satin layers from shifting."],
    warnings: ["Test iron temperature on an offcut; excess heat can permanently mark satin."],
    verifiedVideo: null
  },
  "sweater-arm-warmers": {
    ideaId: "sweater-arm-warmers",
    steps: [
      { id: "inspect", title: "Inspect both sleeves", instruction: "Confirm that both sleeves have similar stretch and no runs that continue opening." },
      { id: "measure", title: "Measure the finished length", instruction: "Measure from wrist to the desired point and mark both sleeves equally with seam allowance." },
      { id: "cut", title: "Cut without stretching", instruction: "Lay each sleeve flat and cut across one layer at a time without pulling the knit." },
      { id: "secure", title: "Secure the cut edges", instruction: "Turn the raw edge inward and use a loose stretch-friendly stitch that preserves elasticity." },
      { id: "fit", title: "Test and finish the pair", instruction: "Try both warmers on, check circulation and movement, then reinforce any loose thread ends." }
    ],
    tips: ["Use the original sweater cuffs as the finished wrist edges."],
    warnings: ["The finished edge must not feel tight or restrict circulation."],
    verifiedVideo: null
  },
  "jacket-pocket-pouch": {
    ideaId: "jacket-pocket-pouch",
    steps: [
      { id: "test", title: "Test the pocket closure", instruction: "Open and close the zipper or fastener repeatedly and inspect the pocket fabric for damage." },
      { id: "remove", title: "Remove the pocket panel", instruction: "Cut around the pocket with an even seam allowance while preserving its complete construction." },
      { id: "back", title: "Cut a matching back", instruction: "Use the pocket panel as a template to cut a sound matching backing piece." },
      { id: "join", title: "Join both panels", instruction: "Place the correct sides together and stitch around every edge without catching the zipper opening." },
      { id: "turn", title: "Turn and inspect", instruction: "Open the zipper, turn the pouch right side out, push out the corners gently, and inspect all seams." }
    ],
    tips: ["Keep an original label or trim as a recognizable detail."],
    warnings: ["Never cut across a metal zipper with fabric scissors."],
    verifiedVideo: null
  },
  "trouser-panel-apron": {
    ideaId: "trouser-panel-apron",
    steps: [
      { id: "plan", title: "Plan the apron panel", instruction: "Choose a strong trouser leg or back panel and mark a comfortable apron shape." },
      { id: "cut", title: "Cut and finish the panel", instruction: "Cut with seam allowance, fold raw edges twice, and stitch or secure them evenly." },
      { id: "pocket", title: "Salvage a pocket", instruction: "Remove an intact pocket with surrounding allowance and position it within easy reach." },
      { id: "ties", title: "Prepare waist ties", instruction: "Measure two strong equal ties long enough for a comfortable knot and finish their ends." },
      { id: "assemble", title: "Attach and test", instruction: "Reinforce the pocket and ties with repeated stitches, then test the apron with only light tools." }
    ],
    tips: ["A trouser waistband section can provide extra structure at the top edge."],
    warnings: ["This apron is not heat resistant and should not be used as oven protection."],
    verifiedVideo: null
  },
  "fabric-wall-art": {
    ideaId: "fabric-wall-art",
    steps: [
      { id: "choose", title: "Choose the focal section", instruction: "Select a clean print, texture or embroidery with enough margin around the desired composition." },
      { id: "template", title: "Trace the frame opening", instruction: "Use the frame backing or hoop to mark the visible area and add several centimeters around it." },
      { id: "cut", title: "Cut the display panel", instruction: "Flatten the fabric and cut the larger marked shape without stretching it." },
      { id: "mount", title: "Mount without distortion", instruction: "Center the design, smooth it over acid-free backing, and secure it at the rear with removable stitches or tabs." },
      { id: "frame", title: "Close and inspect", instruction: "Close the frame or tighten the hoop, check that the grain remains straight, and trim only excess hidden fabric." }
    ],
    tips: ["Keep mounting reversible so the textile can be removed later."],
    warnings: ["Keep valuable or delicate fabric away from direct sunlight and moisture."],
    verifiedVideo: null
  },
  "fabric-flower-brooch": {
    ideaId: "fabric-flower-brooch",
    steps: [
      { id: "select", title: "Select clean offcuts", instruction: "Choose small sound areas and avoid any fabric that frays excessively or transfers dye." },
      { id: "templates", title: "Make petal templates", instruction: "Draw three simple flower shapes in gradually smaller sizes and cut them from card." },
      { id: "cut", title: "Cut the fabric layers", instruction: "Trace each template and cut the layers carefully with sharp fabric scissors." },
      { id: "assemble", title: "Assemble the flower", instruction: "Stack the layers from largest to smallest and bond each center with a minimal amount of fabric glue." },
      { id: "back", title: "Attach a safe backing", instruction: "Cover the sharp side of a brooch back or safety pin with a small fabric tab and let all glue cure fully." }
    ],
    tips: ["Mixing a plain layer with a patterned layer makes the shape easier to read."],
    warnings: ["A brooch contains a sharp pin and is not suitable for young children."],
    verifiedVideo: null
  },
  "denim-pocket-crossbody": {
    ideaId: "denim-pocket-crossbody",
    steps: [
      { id: "measure", title: "Measure the phone and pocket", instruction: "Confirm that the phone fits inside the pocket with at least 2 cm of seam allowance around it." },
      { id: "cut", title: "Cut the backing panel", instruction: "Cut a matching denim panel from a strong leg section without worn or stretchy areas." },
      { id: "closure", title: "Add the closure", instruction: "Attach a snap, button loop or hook-and-loop tab where it will not scratch the phone." },
      { id: "join", title: "Join and reinforce", instruction: "Sew the pocket to the backing and reinforce both upper corners with repeated stitches." },
      { id: "strap", title: "Attach and test the strap", instruction: "Attach an adjustable strap securely and test the finished bag gradually with a light object." }
    ], tips: ["Keep the original pocket stitching visible for a finished look."], warnings: ["Do not carry valuables until every strap attachment has passed a gentle pull test."], verifiedVideo: null,
    videoSearch: { title: "Find a jeans pocket crossbody tutorial", url: "https://www.youtube.com/results?search_query=jeans+pocket+crossbody+bag+tutorial" }
  },
  "denim-lunch-bag": {
    ideaId: "denim-lunch-bag",
    steps: [
      { id: "plan", title: "Plan the bag dimensions", instruction: "Measure the intended lunch containers and draw a rectangular pattern with base and seam allowances." },
      { id: "layers", title: "Cut the three layers", instruction: "Cut matching denim, insulated batting and washable food-safe lining panels." },
      { id: "shell", title: "Sew the outer shell", instruction: "Join the denim panels, box the lower corners and reinforce the handle positions." },
      { id: "lining", title: "Assemble the lining", instruction: "Sew the lining and insulation without leaving exposed batting inside the bag." },
      { id: "finish", title: "Add closure and handles", instruction: "Join both layers, add handles and hook-and-loop closure, then inspect and wash before use." }
    ], tips: ["A wide flat base keeps containers upright."], warnings: ["Use only washable lining sold as suitable for food-contact projects; this bag does not replace refrigeration."], verifiedVideo: null,
    videoSearch: { title: "Find a recycled denim lunch bag tutorial", url: "https://www.youtube.com/results?search_query=recycled+denim+insulated+lunch+bag+tutorial" }
  },
  "denim-zip-pouch": {
    ideaId: "denim-zip-pouch",
    steps: [
      { id: "size", title: "Choose the pouch size", instruction: "Measure the intended contents and mark two equal denim rectangles with seam allowance." },
      { id: "zipper", title: "Prepare the zipper", instruction: "Choose a zipper slightly longer than the opening and secure its ends before trimming." },
      { id: "attach", title: "Attach both panels", instruction: "Sew one panel to each side of the zipper while keeping the teeth clear." },
      { id: "join", title: "Close the pouch", instruction: "Open the zipper halfway, place right sides together and sew around the remaining edges." },
      { id: "finish", title: "Turn and inspect", instruction: "Trim bulky corners, turn through the open zipper and test the closure repeatedly." }
    ], tips: ["Use a former jeans label or pocket detail on the front panel."], warnings: ["Keep fingers away from the zipper path while stitching, especially with a machine."], verifiedVideo: null,
    videoSearch: { title: "Find a denim zipper pouch tutorial", url: "https://www.youtube.com/results?search_query=upcycled+jeans+denim+zipper+pouch+tutorial" }
  },
  "denim-bottle-carrier": {
    ideaId: "denim-bottle-carrier",
    steps: [
      { id: "measure", title: "Measure the bottle", instruction: "Measure around the widest point and from base to neck, adding room for seams and easy removal." },
      { id: "cut", title: "Cut the body and base", instruction: "Cut a leg tube or rectangle plus a circular base from strong, clean denim." },
      { id: "base", title: "Attach the base", instruction: "Pin evenly around the lower edge and sew twice for a secure weight-bearing seam." },
      { id: "top", title: "Finish the opening", instruction: "Fold and stitch the top edge without making the opening too narrow for the bottle." },
      { id: "handle", title: "Reinforce the handle", instruction: "Attach a webbing or folded-denim handle with boxed stitching and test it over a soft surface." }
    ], tips: ["An intact jeans leg reduces the number of side seams."], warnings: ["Load-test with an unbreakable bottle before carrying glass or hot liquids."], verifiedVideo: null,
    videoSearch: { title: "Find a denim bottle carrier tutorial", url: "https://www.youtube.com/results?search_query=upcycled+jeans+water+bottle+holder+tutorial" }
  },
  "skirt-drawstring-bag": {
    ideaId: "skirt-drawstring-bag",
    steps: [
      { id: "inspect", title: "Inspect the skirt body", instruction: "Choose a clean strong section and decide whether the existing hem can become the cord channel." },
      { id: "shape", title: "Cut the bag shape", instruction: "Mark and cut two equal panels while preserving as much finished edge as possible." },
      { id: "channel", title: "Prepare cord channels", instruction: "Fold and stitch a channel at the top of each panel, leaving both ends open." },
      { id: "join", title: "Join the body", instruction: "Place right sides together and sew the sides and base without closing the channel openings." },
      { id: "cord", title: "Thread and test the cords", instruction: "Thread two cords in opposite directions, knot securely and test the bag with light contents." }
    ], tips: ["A lined version is useful when the original skirt fabric is lightweight."], warnings: ["Keep long cords away from young children and reinforce every load-bearing seam."], verifiedVideo: null,
    videoSearch: { title: "Find a skirt drawstring bag tutorial", url: "https://www.youtube.com/results?search_query=upcycle+skirt+drawstring+bag+tutorial" }
  },
  "skirt-to-summer-top": {
    ideaId: "skirt-to-summer-top",
    steps: [
      { id: "fit", title: "Check available width", instruction: "Wrap the skirt body around the torso over a fitted top and confirm comfortable ease before cutting." },
      { id: "pattern", title: "Mark the top shape", instruction: "Use a simple loose top as a template and add generous seam and casing allowances." },
      { id: "cut", title: "Cut symmetrical panels", instruction: "Flatten the fabric and cut front and back panels on the grain without stretching." },
      { id: "sew", title: "Join and finish", instruction: "Sew side seams, finish raw edges and create a smooth elastic casing at the neckline." },
      { id: "elastic", title: "Fit the elastic safely", instruction: "Insert elastic, test the fit over another layer, secure the overlap and close the casing." }
    ], tips: ["Light cotton or linen with generous skirt width works best."], warnings: ["Do not cut until the full pattern fits inside the skirt; elastic must not restrict breathing or movement."], verifiedVideo: null,
    videoSearch: { title: "Find a skirt-to-top tutorial", url: "https://www.youtube.com/results?search_query=upcycle+skirt+into+summer+top+tutorial" }
  },
  "skirt-kitchen-apron": {
    ideaId: "skirt-kitchen-apron",
    steps: [
      { id: "choose", title: "Choose the apron front", instruction: "Center the strongest skirt panel and mark a comfortable width and length." },
      { id: "open", title: "Open the skirt back", instruction: "Remove the back section carefully while preserving the front waistband when possible." },
      { id: "edges", title: "Finish the raw edges", instruction: "Fold raw side edges twice and secure them with even hand or machine stitching." },
      { id: "ties", title: "Add waist ties", instruction: "Attach strong cotton tape or folded fabric ties at both waistband ends with reinforced stitching." },
      { id: "pocket", title: "Add and test a pocket", instruction: "Reuse an intact pocket, stitch around three sides and test the apron with lightweight utensils." }
    ], tips: ["An existing waistband can make the upper edge look professionally finished."], warnings: ["Keep synthetic fabric and loose ties away from open flames and hot cooking surfaces."], verifiedVideo: null,
    videoSearch: { title: "Find a skirt-to-apron tutorial", url: "https://www.youtube.com/results?search_query=upcycle+old+skirt+into+kitchen+apron+tutorial" }
  },
  "skirt-envelope-cushion": {
    ideaId: "skirt-envelope-cushion",
    steps: [
      { id: "measure", title: "Measure the cushion", instruction: "Measure the insert and add seam allowance plus enough overlap for an envelope opening." },
      { id: "panels", title: "Cut the panels", instruction: "Cut one front and two overlapping back panels from sound skirt fabric." },
      { id: "finish", title: "Finish the opening edges", instruction: "Use an existing skirt hem where possible or double-fold both exposed back edges." },
      { id: "assemble", title: "Assemble the envelope", instruction: "Place right sides together with back panels overlapping and sew around all four sides." },
      { id: "turn", title: "Turn and fit", instruction: "Trim bulky corners, turn the cover right side out and insert the cushion through the overlap." }
    ], tips: ["Position a decorative skirt detail in the center of the cushion front."], warnings: ["Do not reuse weak fabric that separates when the filled cushion is gently compressed."], verifiedVideo: null,
    videoSearch: { title: "Find a skirt cushion-cover tutorial", url: "https://www.youtube.com/results?search_query=upcycle+skirt+envelope+cushion+cover+tutorial" }
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
        (idea.requiredTools.length <= 2 ? 4 : 1) +
        (details.preference === "any" && details.condition === "good"
          ? idea.outputType === "clothing" ? 10 : idea.outputType === "bag" ? 4 : 0
          : 0)
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
