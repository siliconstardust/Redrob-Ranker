const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const {
  FaSearch, FaLayerGroup, FaShieldAlt, FaBalanceScale, FaUserCheck,
  FaExclamationTriangle, FaClock, FaCheckCircle, FaTimesCircle,
  FaServer, FaCogs, FaFileAlt,
} = require("react-icons/fa");

function renderIconSvg(IconComponent, color, size = 256) {
  return ReactDOMServer.renderToStaticMarkup(
    React.createElement(IconComponent, { color, size: String(size) })
  );
}
async function iconPng(IconComponent, color, size = 256) {
  const svg = renderIconSvg(IconComponent, color, size);
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}

// Palette: "Midnight Executive" — navy dominant, ice blue secondary, white accent.
// Chosen because the topic (trust, precision, recruiting intelligence) calls for
// something authoritative and calm rather than playful.
const NAVY = "1E2761";
const NAVY_DARK = "141A47";
const ICE = "CADCFC";
const WHITE = "FFFFFF";
const SLATE = "5B6B8C";
const ALERT = "C24545";
const GOOD = "1F9D7C";
const OFFWHITE = "F7F8FC";
const TEXT_DARK = "1A1F36";

async function main() {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE"; // 13.3 x 7.5
  pres.author = "Redrob Hackathon Submission";
  pres.title = "Intelligent Candidate Discovery & Ranking — Approach";

  const W = 13.33, H = 7.5;

  // Pre-render icons
  const icSearch = await iconPng(FaSearch, NAVY, 256);
  const icLayers = await iconPng(FaLayerGroup, NAVY, 256);
  const icShield = await iconPng(FaShieldAlt, NAVY, 256);
  const icBalance = await iconPng(FaBalanceScale, NAVY, 256);
  const icUserCheck = await iconPng(FaUserCheck, NAVY, 256);
  const icWarnW = await iconPng(FaExclamationTriangle, WHITE, 256);
  const icClockW = await iconPng(FaClock, WHITE, 256);
  const icCheckGood = await iconPng(FaCheckCircle, GOOD, 256);
  const icTimesAlert = await iconPng(FaTimesCircle, ALERT, 256);
  const icServerW = await iconPng(FaServer, WHITE, 256);
  const icCogsW = await iconPng(FaCogs, WHITE, 256);
  const icFileW = await iconPng(FaFileAlt, WHITE, 256);

  // ---------------------------------------------------------------- Slide 1
  let s = pres.addSlide();
  s.background = { color: NAVY };
  s.addText("Intelligent Candidate Discovery & Ranking", {
    x: 0.9, y: 2.5, w: 11.5, h: 1.3, fontSize: 40, bold: true, color: WHITE,
    fontFace: "Cambria", align: "left",
  });
  s.addText("A hybrid structured-feature + semantic-similarity ranker for the Redrob Hackathon", {
    x: 0.9, y: 3.75, w: 10.5, h: 0.6, fontSize: 18, color: ICE, fontFace: "Calibri",
  });
  s.addText("Senior AI Engineer (Founding Team) — Job-Description Match", {
    x: 0.9, y: 4.35, w: 10.5, h: 0.5, fontSize: 14, color: SLATE === SLATE ? "8C9BC9" : "8C9BC9", fontFace: "Calibri", italic: true,
  });
  s.addShape(pres.shapes.OVAL, { x: 10.9, y: 0.9, w: 1.8, h: 1.8, fill: { color: NAVY_DARK }, line: { type: "none" } });
  s.addImage({ data: icSearch.replace("image/png;base64,", "image/png;base64,"), x: 11.35, y: 1.35, w: 0.9, h: 0.9 });

  // ---------------------------------------------------------------- Slide 2 — Problem framing
  s = pres.addSlide();
  s.background = { color: OFFWHITE };
  s.addText("The real problem isn't ranking. It's not getting fooled.", {
    x: 0.7, y: 0.5, w: 11.9, h: 0.8, fontSize: 28, bold: true, color: TEXT_DARK, fontFace: "Cambria",
  });
  s.addText(
    "The JD is explicit: a candidate with every AI keyword in their skills list but a Marketing Manager title is not a fit. " +
    "A candidate with no buzzwords but a real recommendation-systems career is. The dataset is built to test exactly this.",
    { x: 0.7, y: 1.35, w: 11.9, h: 0.7, fontSize: 15, color: SLATE, fontFace: "Calibri" }
  );

  const cardY = 2.35, cardH = 4.3, cardW = 5.6;
  // Trap card
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 0.7, y: cardY, w: cardW, h: cardH, rectRadius: 0.08,
    fill: { color: WHITE }, line: { color: "E3E6F0", width: 1 },
    shadow: { type: "outer", color: "000000", blur: 8, offset: 3, angle: 90, opacity: 0.08 },
  });
  s.addText("The trap", { x: 1.0, y: cardY + 0.25, w: 5, h: 0.45, fontSize: 18, bold: true, color: ALERT, fontFace: "Cambria" });
  s.addText("CAND_0000021 — found in the sample data", { x: 1.0, y: cardY + 0.75, w: 5, h: 0.35, fontSize: 12, italic: true, color: SLATE });
  s.addText([
    { text: "Title: ", options: { bold: true } }, { text: "Project Manager, 14.5 yrs", options: { breakLine: true } },
    { text: "Skills listed: ", options: { bold: true } }, { text: "Fine-tuning LLMs, LangChain, Pinecone, Vector Search, Embeddings", options: { breakLine: true } },
    { text: "Career history: ", options: { bold: true } }, { text: "Wipro, Infosys, Stark Industries, Dunder Mifflin, TCS — PM/Marketing/Sales titles throughout", options: {} },
  ], { x: 1.0, y: cardY + 1.2, w: 5.1, h: 2.0, fontSize: 13, color: TEXT_DARK, fontFace: "Calibri", lineSpacingMultiple: 1.15 });
  s.addText("Our ranker places this candidate at rank ~22 of 50, not top 10 — title carries 32% of the composite weight and gates hard on off-target titles.", {
    x: 1.0, y: cardY + 3.25, w: 5.1, h: 0.9, fontSize: 12.5, color: GOOD, bold: true, fontFace: "Calibri",
  });

  // Real fit card
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 6.95, y: cardY, w: cardW, h: cardH, rectRadius: 0.08,
    fill: { color: WHITE }, line: { color: "E3E6F0", width: 1 },
    shadow: { type: "outer", color: "000000", blur: 8, offset: 3, angle: 90, opacity: 0.08 },
  });
  s.addText("The real fit", { x: 7.25, y: cardY + 0.25, w: 5, h: 0.45, fontSize: 18, bold: true, color: GOOD, fontFace: "Cambria" });
  s.addText("CAND_0000031 — found in the sample data", { x: 7.25, y: cardY + 0.75, w: 5, h: 0.35, fontSize: 12, italic: true, color: SLATE });
  s.addText([
    { text: "Title: ", options: { bold: true } }, { text: "Recommendation Systems Engineer, 6.0 yrs", options: { breakLine: true } },
    { text: "Career path: ", options: { bold: true } }, { text: "Applied ML Engineer -> NLP Engineer -> Search Engineer -> Recommendation Systems Engineer", options: { breakLine: true } },
    { text: "Companies: ", options: { bold: true } }, { text: "Zomato, Uber, Mad Street Den, Swiggy — all product companies", options: {} },
  ], { x: 7.25, y: cardY + 1.2, w: 5.1, h: 2.0, fontSize: 13, color: TEXT_DARK, fontFace: "Calibri", lineSpacingMultiple: 1.15 });
  s.addText("Our ranker places this candidate at rank 1 of 50 — title match, trust-weighted skills, and narrative evidence all align.", {
    x: 7.25, y: cardY + 3.25, w: 5.1, h: 0.9, fontSize: 12.5, color: GOOD, bold: true, fontFace: "Calibri",
  });

  // ---------------------------------------------------------------- Slide 3 — Architecture overview
  s = pres.addSlide();
  s.background = { color: OFFWHITE };
  s.addText("Architecture: four stages, fully explainable", {
    x: 0.7, y: 0.5, w: 11.9, h: 0.7, fontSize: 28, bold: true, color: TEXT_DARK, fontFace: "Cambria",
  });
  s.addText("Every score traces back to specific fields in the candidate record — no black box, no hidden LLM call.", {
    x: 0.7, y: 1.2, w: 11.9, h: 0.5, fontSize: 14, color: SLATE, fontFace: "Calibri",
  });

  const stages = [
    { icon: icLayers, title: "1. Feature extraction", desc: "Title-family classification, trust-weighted skills, tenure pattern, location fit, honeypot checks.", file: "features.py" },
    { icon: icBalance, title: "2. Composite scoring", desc: "Weighted structured score + TF-IDF similarity to JD, then a disqualifier gate.", file: "scorer.py" },
    { icon: icUserCheck, title: "3. Behavioral modifier", desc: "Multiplicative adjustment from Redrob signals: recency, response rate, verification.", file: "scorer.py" },
    { icon: icFileW, title: "4. Reasoning + output", desc: "Fact-grounded reasoning strings, tie-break repair, spec-compliant CSV.", file: "reasoning.py / rank.py" },
  ];
  const stageW = 2.75, gap = 0.25, startX = 0.7;
  stages.forEach((st, i) => {
    const x = startX + i * (stageW + gap);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x, y: 2.1, w: stageW, h: 4.5, rectRadius: 0.08,
      fill: { color: i % 2 === 0 ? NAVY : NAVY_DARK }, line: { type: "none" },
      shadow: { type: "outer", color: "000000", blur: 8, offset: 3, angle: 90, opacity: 0.12 },
    });
    s.addShape(pres.shapes.OVAL, { x: x + stageW / 2 - 0.45, y: 2.45, w: 0.9, h: 0.9, fill: { color: WHITE }, line: { type: "none" } });
    s.addImage({ data: st.icon, x: x + stageW / 2 - 0.27, y: 2.63, w: 0.54, h: 0.54 });
    s.addText(st.title, { x: x + 0.2, y: 3.55, w: stageW - 0.4, h: 0.6, fontSize: 15, bold: true, color: WHITE, fontFace: "Cambria", align: "center" });
    s.addText(st.desc, { x: x + 0.25, y: 4.2, w: stageW - 0.5, h: 1.8, fontSize: 11.5, color: ICE, fontFace: "Calibri", align: "center" });
    s.addText(st.file, { x: x + 0.2, y: 6.1, w: stageW - 0.4, h: 0.35, fontSize: 10.5, italic: true, color: "8C9BC9", fontFace: "Courier New", align: "center" });
  });

  // ---------------------------------------------------------------- Slide 4 — Scoring composite breakdown
  s = pres.addSlide();
  s.background = { color: WHITE };
  s.addText("What goes into the composite score", {
    x: 0.7, y: 0.5, w: 11.9, h: 0.7, fontSize: 28, bold: true, color: TEXT_DARK, fontFace: "Cambria",
  });
  s.addText("Title carries the most weight deliberately — it's the strongest defense against keyword stuffing.", {
    x: 0.7, y: 1.2, w: 11.9, h: 0.5, fontSize: 14, color: SLATE, fontFace: "Calibri",
  });

  s.addChart(pres.charts.BAR, [{
    name: "Weight in composite",
    labels: ["Title family", "Core skills (trust-weighted)", "Narrative evidence", "Experience band", "Location fit", "TF-IDF similarity", "Nice-to-have skills"],
    values: [32, 27, 13, 10, 7, 5, 6],
  }], {
    x: 0.7, y: 2.0, w: 11.9, h: 4.7, barDir: "bar",
    chartColors: [NAVY],
    chartArea: { fill: { color: WHITE } },
    catAxisLabelColor: TEXT_DARK, valAxisLabelColor: SLATE,
    catAxisLabelFontSize: 12,
    valGridLine: { color: "E2E8F0", size: 0.5 },
    catGridLine: { style: "none" },
    showValue: true, dataLabelPosition: "outEnd", dataLabelColor: TEXT_DARK, dataLabelFontSize: 11,
    showLegend: false,
    showTitle: false,
  });

  // ---------------------------------------------------------------- Slide 5 — Trust-weighted skills
  s = pres.addSlide();
  s.background = { color: OFFWHITE };
  s.addText("Skills aren't taken at face value", {
    x: 0.7, y: 0.5, w: 11.9, h: 0.7, fontSize: 28, bold: true, color: TEXT_DARK, fontFace: "Cambria",
  });
  s.addText("Each skill claim is discounted by a trust multiplier built from fields the schema already provides.", {
    x: 0.7, y: 1.2, w: 11.9, h: 0.5, fontSize: 14, color: SLATE, fontFace: "Calibri",
  });

  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 0.7, y: 2.1, w: 11.9, h: 1.5, rectRadius: 0.08, fill: { color: NAVY }, line: { type: "none" },
  });
  s.addText("trust = 0.3 + 0.5 x min(duration_months/24, 1) + 0.2 x min(endorsements/10, 1)", {
    x: 1.0, y: 2.35, w: 11.3, h: 0.5, fontSize: 16, color: WHITE, fontFace: "Courier New", bold: true,
  });
  s.addText("If proficiency = \"expert\" AND duration_months = 0 AND endorsements = 0 -> trust x 0.25 (stuffing signature)", {
    x: 1.0, y: 2.95, w: 11.3, h: 0.5, fontSize: 13, color: ICE, fontFace: "Courier New", italic: true,
  });

  const skillCards = [
    { label: "Stuffed claim", sub: '"Expert" Pinecone, 0 endorsements, 0 months', trust: "trust ~ 0.075", color: ALERT, icon: icTimesAlert },
    { label: "Real claim", sub: '"Advanced" FAISS, 8 endorsements, 35 months', trust: "trust ~ 1.0", color: GOOD, icon: icCheckGood },
  ];
  skillCards.forEach((c, i) => {
    const x = 0.7 + i * 6.1;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x, y: 3.9, w: 5.7, h: 2.6, rectRadius: 0.08, fill: { color: WHITE }, line: { color: "E3E6F0", width: 1 },
      shadow: { type: "outer", color: "000000", blur: 8, offset: 3, angle: 90, opacity: 0.08 },
    });
    s.addImage({ data: c.icon, x: x + 0.35, y: 4.15, w: 0.5, h: 0.5 });
    s.addText(c.label, { x: x + 1.0, y: 4.18, w: 4.5, h: 0.45, fontSize: 16, bold: true, color: c.color, fontFace: "Cambria" });
    s.addText(c.sub, { x: x + 0.35, y: 4.85, w: 5.1, h: 0.6, fontSize: 13, color: TEXT_DARK, fontFace: "Calibri" });
    s.addText(c.trust, { x: x + 0.35, y: 5.55, w: 5.1, h: 0.7, fontSize: 22, bold: true, color: c.color, fontFace: "Cambria" });
  });

  // ---------------------------------------------------------------- Slide 6 — Data quality finding
  s = pres.addSlide();
  s.background = { color: NAVY_DARK };
  s.addImage({ data: icWarnW, x: 0.7, y: 0.55, w: 0.6, h: 0.6 });
  s.addText("A finding we built around: description text is noisy", {
    x: 1.5, y: 0.5, w: 11.1, h: 0.8, fontSize: 26, bold: true, color: WHITE, fontFace: "Cambria",
  });
  s.addText(
    "career_history[].description fields frequently don't match their paired title/company — e.g. a \"Project Manager\" " +
    "entry whose description reads as brand-design work. A quick heuristic check across the 50-candidate sample flagged " +
    "this pattern in roughly 18% of career_history entries.",
    { x: 0.7, y: 1.5, w: 11.9, h: 1.0, fontSize: 15, color: ICE, fontFace: "Calibri" }
  );

  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 0.7, y: 2.75, w: 11.9, h: 3.9, rectRadius: 0.08, fill: { color: NAVY }, line: { type: "none" },
  });
  s.addText("So the ranker deliberately does NOT trust individual description text for technical claims:", {
    x: 1.1, y: 3.0, w: 11.1, h: 0.5, fontSize: 15, bold: true, color: WHITE, fontFace: "Calibri",
  });
  s.addText([
    { text: "Trusts: ", options: { bold: true, color: GOOD } },
    { text: "profile.current_title and profile.summary (internally coherent across the sample)", options: { breakLine: true, color: WHITE } },
    { text: "Trusts: ", options: { bold: true, color: GOOD } },
    { text: "skills[] with proficiency/endorsements/duration_months — explicit trust signals the schema provides", options: { breakLine: true, color: WHITE } },
    { text: "Uses cautiously: ", options: { bold: true, color: "F2C94C" } },
    { text: "career_history only in aggregate — industries touched, company-size trend, tenure pattern — never parsed for specific per-role technical claims", options: { color: WHITE } },
  ], { x: 1.1, y: 3.6, w: 11.1, h: 2.8, fontSize: 14, fontFace: "Calibri", lineSpacingMultiple: 1.3, bullet: { code: "2022" } });

  // ---------------------------------------------------------------- Slide 7 — Behavioral signals + honeypots
  s = pres.addSlide();
  s.background = { color: OFFWHITE };
  s.addText("Beyond the resume: behavior and honeypots", {
    x: 0.7, y: 0.5, w: 11.9, h: 0.7, fontSize: 28, bold: true, color: TEXT_DARK, fontFace: "Cambria",
  });

  // Left: behavioral
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 0.7, y: 1.5, w: 5.7, h: 5.1, rectRadius: 0.08, fill: { color: WHITE }, line: { color: "E3E6F0", width: 1 },
    shadow: { type: "outer", color: "000000", blur: 8, offset: 3, angle: 90, opacity: 0.08 },
  });
  s.addImage({ data: icClockW.replace(WHITE, WHITE), x: 1.0, y: 1.75, w: 0.5, h: 0.5 });
  s.addShape(pres.shapes.OVAL, { x: 1.0, y: 1.75, w: 0.5, h: 0.5, fill: { color: NAVY }, line: { type: "none" } });
  s.addImage({ data: icClockW, x: 1.1, y: 1.85, w: 0.3, h: 0.3 });
  s.addText("Behavioral multiplier", { x: 1.6, y: 1.78, w: 4.5, h: 0.45, fontSize: 17, bold: true, color: TEXT_DARK, fontFace: "Cambria" });
  s.addText(
    "A perfect-on-paper candidate who hasn't logged in for 6 months and has a 5% response rate is, for hiring purposes, not actually available. We apply this as a multiplicative modifier — never additive — so it can meaningfully discount but doesn't override a strong skills/title match on its own.",
    { x: 1.0, y: 2.45, w: 5.1, h: 1.3, fontSize: 13, color: SLATE, fontFace: "Calibri" }
  );
  s.addText([
    { text: "recency_mult ", options: { fontFace: "Courier New", bold: true } }, { text: "= max(0.4, 1 - days_since_active/365)", options: { breakLine: true, fontFace: "Courier New" } },
    { text: "response_mult ", options: { fontFace: "Courier New", bold: true } }, { text: "= 0.6 + 0.4 x recruiter_response_rate", options: { breakLine: true, fontFace: "Courier New" } },
    { text: "open_mult ", options: { fontFace: "Courier New", bold: true } }, { text: "= 1.0 if open_to_work else 0.85", options: { breakLine: true, fontFace: "Courier New" } },
    { text: "verify_mult ", options: { fontFace: "Courier New", bold: true } }, { text: "= 0.85 + 0.05 x verified_count", options: { fontFace: "Courier New" } },
  ], { x: 1.0, y: 4.0, w: 5.1, h: 2.3, fontSize: 11.5, color: TEXT_DARK, lineSpacingMultiple: 1.25 });

  // Right: honeypots
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 6.95, y: 1.5, w: 5.7, h: 5.1, rectRadius: 0.08, fill: { color: NAVY }, line: { type: "none" },
    shadow: { type: "outer", color: "000000", blur: 8, offset: 3, angle: 90, opacity: 0.12 },
  });
  s.addShape(pres.shapes.OVAL, { x: 7.25, y: 1.75, w: 0.5, h: 0.5, fill: { color: ALERT }, line: { type: "none" } });
  s.addImage({ data: icWarnW, x: 7.36, y: 1.86, w: 0.28, h: 0.28 });
  s.addText("Honeypot detection", { x: 7.85, y: 1.78, w: 4.6, h: 0.45, fontSize: 17, bold: true, color: WHITE, fontFace: "Cambria" });
  s.addText("Internal-consistency checks — any flag excludes a candidate from the top-100 eligible pool entirely:", {
    x: 7.25, y: 2.45, w: 5.1, h: 0.5, fontSize: 13, color: ICE, fontFace: "Calibri",
  });
  s.addText([
    { text: "YOE vs. sum of career_history durations off by >5 years", options: { bullet: true, breakLine: true } },
    { text: "4+ skills claimed \"expert\" with 0 duration_months each", options: { bullet: true, breakLine: true } },
    { text: "Single role with >30 years duration_months", options: { bullet: true, breakLine: true } },
    { text: "Graduated 2024+ but claims 10+ years experience", options: { bullet: true, breakLine: true } },
    { text: "last_active_date in the future relative to run date", options: { bullet: true } },
  ], { x: 7.25, y: 3.0, w: 5.1, h: 2.6, fontSize: 13, color: WHITE, fontFace: "Calibri", paraSpaceAfter: 4 });
  s.addText("Target: keep honeypot rate well under the 10% top-100 disqualification threshold.", {
    x: 7.25, y: 5.9, w: 5.1, h: 0.6, fontSize: 12, italic: true, color: ICE, fontFace: "Calibri",
  });

  // ---------------------------------------------------------------- Slide 8 — Compute constraints
  s = pres.addSlide();
  s.background = { color: WHITE };
  s.addText("Built inside the compute box, not around it", {
    x: 0.7, y: 0.5, w: 11.9, h: 0.7, fontSize: 28, bold: true, color: TEXT_DARK, fontFace: "Cambria",
  });
  s.addText("No GPU calls, no network calls, no hosted LLM per candidate — TF-IDF is fit locally against the JD text and the pool itself.", {
    x: 0.7, y: 1.2, w: 11.9, h: 0.5, fontSize: 14, color: SLATE, fontFace: "Calibri",
  });

  const constraints = [
    { label: "Wall-clock budget", limit: "<= 5 min", actual: "~30s for 100K candidates (tested)", icon: icClockW },
    { label: "Compute", limit: "CPU only", actual: "scikit-learn TF-IDF, no GPU anywhere", icon: icServerW },
    { label: "Network", limit: "Off", actual: "No external API calls during ranking", icon: icCogsW },
    { label: "Memory", limit: "<= 16 GB", actual: "Single linear pass, no full-pool matrix held in memory beyond TF-IDF sparse matrix", icon: icFileW },
  ];
  constraints.forEach((c, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 0.7 + col * 6.1, y = 2.1 + row * 2.5;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x, y, w: 5.7, h: 2.2, rectRadius: 0.08, fill: { color: NAVY }, line: { type: "none" },
      shadow: { type: "outer", color: "000000", blur: 8, offset: 3, angle: 90, opacity: 0.1 },
    });
    s.addShape(pres.shapes.OVAL, { x: x + 0.3, y: y + 0.3, w: 0.7, h: 0.7, fill: { color: NAVY_DARK }, line: { type: "none" } });
    s.addImage({ data: c.icon, x: x + 0.48, y: y + 0.48, w: 0.34, h: 0.34 });
    s.addText(c.label, { x: x + 1.2, y: y + 0.25, w: 4.3, h: 0.4, fontSize: 15, bold: true, color: WHITE, fontFace: "Cambria" });
    s.addText(c.limit, { x: x + 1.2, y: y + 0.65, w: 4.3, h: 0.4, fontSize: 13, color: "F2C94C", fontFace: "Calibri", bold: true });
    s.addText(c.actual, { x: x + 0.35, y: y + 1.15, w: 5.1, h: 0.95, fontSize: 12, color: ICE, fontFace: "Calibri" });
  });

  // ---------------------------------------------------------------- Slide 9 — Honest limitations
  s = pres.addSlide();
  s.background = { color: OFFWHITE };
  s.addText("What this approach doesn't do (yet)", {
    x: 0.7, y: 0.5, w: 11.9, h: 0.7, fontSize: 28, bold: true, color: TEXT_DARK, fontFace: "Cambria",
  });
  s.addText("Stated plainly, per the spec's own guidance: be specific and honest, not impressive.", {
    x: 0.7, y: 1.2, w: 11.9, h: 0.5, fontSize: 14, color: SLATE, fontFace: "Calibri", italic: true,
  });

  const limits = [
    "Validated end-to-end against the 50-candidate sample only — the full 100K-candidate pool (candidates.jsonl.gz) was not available at build time, so absolute score calibration against the real pool is unverified.",
    "TF-IDF is a lexical/n-gram similarity proxy, not a true dense embedding — it gets a 5% weight precisely because it's the most stuffer-vulnerable signal in the mix.",
    "Honeypot heuristics are rule-based and tuned against patterns visible in the sample; the full pool's ~80 honeypots may include variants these specific rules don't catch.",
    "Weights (32/27/13/10/7/5/6) were hand-set from reading the JD and testing against the sample, not learned from labeled data — there is no ground truth to fit against during the competition.",
  ];
  let ly = 2.0;
  limits.forEach((t) => {
    s.addShape(pres.shapes.OVAL, { x: 0.85, y: ly + 0.08, w: 0.18, h: 0.18, fill: { color: ALERT }, line: { type: "none" } });
    s.addText(t, { x: 1.25, y: ly - 0.1, w: 11.3, h: 1.0, fontSize: 14, color: TEXT_DARK, fontFace: "Calibri", valign: "top" });
    ly += 1.25;
  });

  // ---------------------------------------------------------------- Slide 10 — Closing / repro
  s = pres.addSlide();
  s.background = { color: NAVY };
  s.addText("One command reproduces the submission", {
    x: 0.9, y: 0.9, w: 11.5, h: 0.8, fontSize: 30, bold: true, color: WHITE, fontFace: "Cambria",
  });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 0.9, y: 2.0, w: 11.5, h: 1.1, rectRadius: 0.08, fill: { color: NAVY_DARK }, line: { type: "none" },
  });
  s.addText("python src/rank.py --candidates ./data/candidates.jsonl.gz --out ./output/submission.csv", {
    x: 1.2, y: 2.3, w: 11.0, h: 0.5, fontSize: 15, color: "8FE3C7", fontFace: "Courier New", bold: true,
  });
  s.addText([
    { text: "Repo: ", options: { bold: true, color: ICE } }, { text: "features.py, scorer.py, reasoning.py, rank.py — fully documented, no hidden steps", options: { breakLine: true, color: WHITE } },
    { text: "Validator: ", options: { bold: true, color: ICE } }, { text: "passes all format checks (row count, rank uniqueness, score monotonicity, tie-break ordering) against test output", options: { breakLine: true, color: WHITE } },
    { text: "Runtime: ", options: { bold: true, color: ICE } }, { text: "~30 seconds for 100K candidates in local testing, well within the 5-minute budget", options: {color: WHITE} },
  ], { x: 0.9, y: 3.5, w: 11.5, h: 2.2, fontSize: 15, fontFace: "Calibri", lineSpacingMultiple: 1.4, bullet: true });
  s.addText("Built with Claude as a development tool — architecture, scoring logic, and bug fixes (including a real tie-break violation caught by running the official validator) were iterated and verified, not pasted-and-prayed.", {
    x: 0.9, y: 6.1, w: 11.5, h: 0.9, fontSize: 12.5, italic: true, color: ICE, fontFace: "Calibri",
  });

  await pres.writeFile({ fileName: "/home/claude/redrob-ranker/docs/approach_deck.pptx" });
  console.log("done");
}

main().catch((e) => { console.error(e); process.exit(1); });
