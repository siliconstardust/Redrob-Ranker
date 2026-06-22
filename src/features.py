"""
features.py — Extracts structured, scoring-ready features from a raw candidate record.

Design note (important for the methodology writeup):
The career_history.description fields in this dataset are frequently inconsistent
with their paired title/company (e.g. a "Project Manager" entry whose description
reads as brand-design work). This looks like synthetic-data noise, not signal, and
spot-checks suggest it affects a meaningful fraction of career_history entries.
Because of this, we do NOT trust individual career_history.description text as a
ground-truth account of what a candidate did in that specific role. Instead we:
  - Trust profile.current_title and profile.summary heavily (these read as coherent
    and consistent across the sample).
  - Use career_history only in aggregate (industries touched, company-size trend,
    tenure/duration pattern, total span) rather than parsing individual descriptions
    for specific technical claims.
  - Use the skills[] list (with proficiency/endorsements/duration_months) as the
    primary source of specific technical-claim evidence, since it carries explicit
    trust signals (duration_months, endorsements) that descriptions don't.
"""

from __future__ import annotations
import re
import datetime as dt
from dataclasses import dataclass, field


TODAY = dt.date(2026, 6, 21)  # pipeline "as-of" date; override via CLI if needed

# ---------------------------------------------------------------------------
# Reference vocabularies (derived from job_description.md, hand-curated)
# ---------------------------------------------------------------------------

# Title families that map directly onto "owns the intelligence layer" work.
CORE_TITLE_PATTERNS = [
    r"\bml\b", r"machine learning", r"\bai\b engineer", r"applied scientist",
    r"recommendation", r"ranking", r"retrieval", r"search engineer",
    r"\bnlp\b", r"data scien(ce|tist)", r"research engineer",
]

# Title families that are plausible-adjacent (production eng with IR/data exposure)
ADJACENT_TITLE_PATTERNS = [
    r"backend engineer", r"data engineer", r"platform engineer",
    r"software engineer", r"full stack", r"infrastructure engineer",
]

# Titles the JD explicitly does not want as the core profile, regardless of
# how many AI keywords appear in their skills list.
OFF_TARGET_TITLE_PATTERNS = [
    r"marketing", r"sales", r"\bhr\b", r"human resources", r"recruiter",
    r"accountant", r"finance", r"operations manager", r"business analyst",
    r"customer support", r"graphic designer", r"civil engineer",
    r"mechanical engineer", r"project manager", r"product manager",
]

# Pure CV/speech/robotics without NLP/IR crossover — explicit JD exclusion.
CV_SPEECH_ROBOTICS_PATTERNS = [
    r"computer vision", r"\bcv engineer\b", r"speech recognition",
    r"robotics", r"autonomous", r"slam\b",
]

CONSULTING_FIRMS = [
    "tcs", "tata consultancy", "infosys", "wipro", "accenture",
    "cognizant", "capgemini",
]

# Skills central to the JD's "things you absolutely need" section.
CORE_SKILLS = {
    "embeddings": 3.0, "sentence transformers": 3.0, "bge": 2.5, "e5": 2.0,
    "vector search": 3.0, "vector database": 3.0, "pinecone": 2.0, "weaviate": 2.0,
    "qdrant": 2.0, "milvus": 2.0, "opensearch": 2.0, "elasticsearch": 2.5,
    "faiss": 2.5, "hybrid search": 3.0, "bm25": 2.0,
    "python": 1.5, "ranking": 3.0, "learning to rank": 3.0, "ndcg": 2.5,
    "recommendation systems": 3.0, "information retrieval": 3.0,
    "nlp": 2.0, "llm": 2.0, "rag": 2.5, "fine-tuning llms": 1.5,
    "transformers": 1.5, "hugging face transformers": 1.5,
}

# Nice-to-have skills (lower weight, do not gate)
NICE_SKILLS = {
    "lora": 1.0, "qlora": 1.0, "peft": 1.0, "xgboost": 1.0,
    "distributed systems": 1.0, "pytorch": 0.8, "tensorflow": 0.8,
    "langchain": 0.3,  # explicitly flagged in JD as a weak/overused signal alone
    "openai api": 0.3,
}

PRODUCTION_EVIDENCE_TERMS = [
    "production", "deployed", "scale", "real-time", "real users",
    "users", "latency", "throughput", "a/b test", "ab test",
]

RESEARCH_ONLY_TERMS = [
    "research lab", "academic", "phd thesis", "publication only",
]

TIER1_INDIA_CITIES = {
    "pune", "noida", "delhi", "new delhi", "mumbai", "bengaluru",
    "bangalore", "hyderabad", "gurgaon", "gurugram", "delhi ncr",
}


@dataclass
class Features:
    candidate_id: str
    title_core_hit: bool = False
    title_adjacent_hit: bool = False
    title_off_target: bool = False
    title_cv_speech_robotics: bool = False
    yoe: float = 0.0
    current_company: str = ""
    is_consulting_only: bool = False
    core_skill_score: float = 0.0
    nice_skill_score: float = 0.0
    skill_trust_avg: float = 0.0   # avg trust multiplier across matched core skills
    production_evidence_hits: int = 0
    research_only_flag: bool = False
    tenure_chaser_flag: bool = False  # median tenure < 18mo across >=3 jobs
    location_fit: float = 0.0
    willing_relocate: bool = False
    notice_period_days: int = 0
    education_tier_min: str = "unknown"
    honeypot_flags: list = field(default_factory=list)
    behavioral_recency_days: int = 9999
    recruiter_response_rate: float = 0.0
    open_to_work: bool = False
    verified_count: int = 0
    interview_completion_rate: float = 0.0
    profile_completeness: float = 0.0
    raw_text_blob: str = ""  # title + summary + skill names, for TF-IDF


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s.lower()).strip()


def _any_match(patterns, text):
    return any(re.search(p, text) for p in patterns)


def extract_features(cand: dict) -> Features:
    p = cand["profile"]
    title = _norm(p["current_title"])
    summary = _norm(p["summary"])
    headline = _norm(p.get("headline", ""))
    combined_title_text = f"{title} {headline}"

    f = Features(candidate_id=cand["candidate_id"])
    f.yoe = p.get("years_of_experience", 0.0)
    f.current_company = p.get("current_company", "")
    f.profile_completeness = cand.get("redrob_signals", {}).get("profile_completeness_score", 0.0)

    f.title_core_hit = _any_match(CORE_TITLE_PATTERNS, combined_title_text)
    f.title_adjacent_hit = _any_match(ADJACENT_TITLE_PATTERNS, combined_title_text)
    f.title_off_target = _any_match(OFF_TARGET_TITLE_PATTERNS, combined_title_text)
    f.title_cv_speech_robotics = _any_match(CV_SPEECH_ROBOTICS_PATTERNS, combined_title_text + " " + summary)

    # Consulting-only career check: every career_history company is a consulting firm
    companies = [_norm(ch.get("company", "")) for ch in cand.get("career_history", [])]
    if companies and all(any(cf in c for cf in CONSULTING_FIRMS) for c in companies):
        f.is_consulting_only = True

    # Skills: trust-weighted core/nice scoring
    skill_names_seen = []
    core_trust_vals = []
    for sk in cand.get("skills", []):
        name = _norm(sk.get("name", ""))
        skill_names_seen.append(name)
        prof = sk.get("proficiency", "beginner")
        endorsements = sk.get("endorsements", 0)
        duration = sk.get("duration_months", 0)
        prof_mult = {"beginner": 0.4, "intermediate": 0.7, "advanced": 1.0, "expert": 1.2}.get(prof, 0.5)
        # Trust multiplier: an "expert" skill with 0 duration and 0 endorsements
        # is a stuffing signature -> discount heavily.
        trust = 0.3 + 0.5 * min(duration / 24.0, 1.0) + 0.2 * min(endorsements / 10.0, 1.0)
        trust = min(trust, 1.3)
        if prof == "expert" and duration == 0 and endorsements == 0:
            trust *= 0.25  # stuffing red flag

        for kw, weight in CORE_SKILLS.items():
            if kw in name:
                f.core_skill_score += weight * prof_mult * trust
                core_trust_vals.append(trust)
        for kw, weight in NICE_SKILLS.items():
            if kw in name:
                f.nice_skill_score += weight * prof_mult * trust

    f.skill_trust_avg = sum(core_trust_vals) / len(core_trust_vals) if core_trust_vals else 0.5

    # Production evidence & research-only language, scanned across summary +
    # ALL career descriptions in aggregate (not attributed to a specific role,
    # given the title/description pairing noise documented above).
    all_text = summary + " " + " ".join(_norm(ch.get("description", "")) for ch in cand.get("career_history", []))
    f.production_evidence_hits = sum(1 for t in PRODUCTION_EVIDENCE_TERMS if t in all_text)
    f.research_only_flag = _any_match(RESEARCH_ONLY_TERMS, all_text) and f.production_evidence_hits == 0

    # Tenure-chaser heuristic, tightened to match what the JD actually
    # describes: escalating seniority titles (Senior -> Staff -> Principal,
    # or equivalent) combined with short tenures. Short tenure alone is
    # common and expected for early/mid-career engineers moving between
    # product companies in a fast-moving field, and is NOT in itself a
    # red flag the JD raises -- conflating the two produced false positives
    # in testing (e.g. a 6-year candidate with 4 roles of ~14mo each, each
    # a clear lateral/upward move in relevant titles, is a normal trajectory,
    # not the "switching every 1.5 years for the title" pattern described).
    SENIORITY_WORDS = ["senior", "staff", "principal", "lead", "head of"]
    durations = [ch.get("duration_months", 0) for ch in cand.get("career_history", [])]
    titles_hist = [_norm(ch.get("title", "")) for ch in cand.get("career_history", [])]
    seniority_levels = [next((i for i, w in enumerate(SENIORITY_WORDS) if w in t), -1) for t in titles_hist]
    has_escalation = len(set(seniority_levels)) > 1 and -1 not in set(seniority_levels[:1])
    if len(durations) >= 4:
        sd = sorted(durations)
        median = sd[len(sd) // 2]
        if median < 15 and any(s >= 0 for s in seniority_levels) and len(set(seniority_levels)) > 1:
            f.tenure_chaser_flag = True

    # Location fit
    loc = _norm(p.get("location", ""))
    country = _norm(p.get("country", ""))
    f.willing_relocate = cand.get("redrob_signals", {}).get("willing_to_relocate", False)
    if any(c in loc for c in TIER1_INDIA_CITIES) and "india" in country:
        f.location_fit = 1.0
    elif "india" in country:
        f.location_fit = 0.6
    elif f.willing_relocate:
        f.location_fit = 0.3
    else:
        f.location_fit = 0.05  # outside India, not relocating -> JD says no visa sponsorship

    # Education tier (lowest/most-recent degree tier as a light signal only —
    # JD does not gate on pedigree, so this is intentionally low-weight downstream)
    tiers = [e.get("tier", "unknown") for e in cand.get("education", [])]
    if tiers:
        order = {"tier_1": 0, "tier_2": 1, "tier_3": 2, "tier_4": 3, "unknown": 4}
        f.education_tier_min = sorted(tiers, key=lambda t: order.get(t, 4))[0]

    # Behavioral signals
    rs = cand.get("redrob_signals", {})
    try:
        last_active = dt.date.fromisoformat(rs.get("last_active_date", "1970-01-01"))
        f.behavioral_recency_days = (TODAY - last_active).days
    except Exception:
        f.behavioral_recency_days = 9999
    f.recruiter_response_rate = rs.get("recruiter_response_rate", 0.0) or 0.0
    f.open_to_work = bool(rs.get("open_to_work_flag", False))
    f.verified_count = sum([
        bool(rs.get("verified_email", False)),
        bool(rs.get("verified_phone", False)),
        bool(rs.get("linkedin_connected", False)),
    ])
    f.interview_completion_rate = rs.get("interview_completion_rate", 0.0) or 0.0
    f.notice_period_days = rs.get("notice_period_days", 999)

    # Honeypot / impossibility checks
    f.honeypot_flags = detect_honeypot_flags(cand, f)

    # Text blob for TF-IDF semantic-ish title/summary matching against JD
    f.raw_text_blob = f"{title} {headline} {summary} " + " ".join(skill_names_seen)

    return f


def detect_honeypot_flags(cand: dict, f: Features) -> list:
    """Internal-consistency checks for subtly impossible profiles."""
    flags = []
    p = cand["profile"]

    # 1. YOE vs. sum of career_history duration_months wildly mismatched
    total_months = sum(ch.get("duration_months", 0) for ch in cand.get("career_history", []))
    yoe = p.get("years_of_experience", 0.0)
    if total_months > 0 and abs(total_months / 12.0 - yoe) > 5:
        flags.append("yoe_career_history_mismatch")

    # 2. "Expert" proficiency claimed on >=4 skills with 0 duration_months each
    zero_duration_experts = sum(
        1 for sk in cand.get("skills", [])
        if sk.get("proficiency") == "expert" and sk.get("duration_months", 0) == 0
    )
    if zero_duration_experts >= 4:
        flags.append("mass_zero_duration_expert_claims")

    # 3. current company tenure (is_current=True entry) longer than the
    #    company itself could plausibly have existed is not directly checkable
    #    without a founding-date field, so we instead flag absurd single-entry
    #    tenure: one career_history entry covering > 30 years at one company
    #    while total YOE is much lower than that entry's duration implies
    for ch in cand.get("career_history", []):
        if ch.get("duration_months", 0) > 360:  # >30 years in one role
            flags.append("implausible_single_role_tenure")
            break

    # 4. Education end_year in the future relative to a low YOE, combined with
    #    high YOE claimed (graduated very recently but claims senior experience)
    for e in cand.get("education", []):
        end_year = e.get("end_year")
        if end_year and end_year >= 2024 and yoe >= 10:
            flags.append("recent_grad_high_yoe_conflict")
            break

    # 5. notice_period_days at schema max edge with willing_to_relocate True but
    #    last_active_date implausibly far in the future relative to TODAY
    last_active = cand.get("redrob_signals", {}).get("last_active_date", "")
    try:
        la = dt.date.fromisoformat(last_active)
        if la > TODAY:
            flags.append("future_last_active_date")
    except Exception:
        pass

    return flags
