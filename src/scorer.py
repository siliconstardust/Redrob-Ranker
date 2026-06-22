"""
scorer.py — Combines structured features (features.py) with a lightweight
TF-IDF cosine-similarity signal (JD text vs candidate title+summary+skills)
into a single composite fit score, then applies a multiplicative behavioral
modifier and honeypot exclusion.

Why TF-IDF instead of a neural embedding model:
The compute spec (submission_spec.md Section 3) requires CPU-only, no GPU,
no network, <=5 min wall-clock, <=16GB RAM, for the ranking step itself.
A from-scratch TF-IDF + cosine-similarity retrieval signal over 100K candidates
runs in seconds on CPU with scikit-learn and needs no model download at
ranking time, so it cleanly satisfies the constraint while still giving a
genuine semantic-overlap signal beyond raw keyword presence (TF-IDF down-
weights generic terms like "experience" or "team" automatically via IDF).
It is deliberately combined with — not used instead of — the structured
features in features.py, because pure text similarity is exactly the
keyword-stuffer-vulnerable approach the JD warns against. TF-IDF here plays
a supporting role (roughly 15% of the composite); title-family and trust-
weighted skill signals carry the rest.
"""

from __future__ import annotations
import datetime as dt
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from features import Features, TODAY

JD_TEXT = """
Senior AI Engineer founding team. Own the intelligence layer: ranking,
retrieval, and matching systems. Production experience with embeddings-based
retrieval systems, sentence-transformers, BGE, E5 embeddings deployed to real
users. Production experience with vector databases or hybrid search
infrastructure: Pinecone, Weaviate, Qdrant, Milvus, OpenSearch, Elasticsearch,
FAISS. Strong Python. Evaluation frameworks for ranking systems: NDCG, MRR,
MAP, offline to online correlation, A/B testing. Shipped end to end ranking,
search, or recommendation system to real users at meaningful scale. Hybrid
retrieval, dense vs sparse, LLM based re-ranking, learning to rank,
information retrieval, NLP. Product company experience, not pure research,
not consulting only, not closed source only without external validation.
"""


def build_tfidf_scores(all_features: list[Features]) -> dict[str, float]:
    """Returns candidate_id -> cosine similarity to JD_TEXT, scaled 0-1."""
    corpus = [JD_TEXT] + [f.raw_text_blob for f in all_features]
    vec = TfidfVectorizer(stop_words="english", ngram_range=(1, 2), max_features=20000)
    tfidf = vec.fit_transform(corpus)
    sims = cosine_similarity(tfidf[0:1], tfidf[1:]).flatten()
    # Min-max scale across the pool so it behaves consistently regardless of
    # corpus size/sparsity.
    lo, hi = sims.min(), sims.max()
    rng = (hi - lo) or 1.0
    scaled = (sims - lo) / rng
    return {f.candidate_id: float(s) for f, s in zip(all_features, scaled)}


def composite_score(f: Features, tfidf_sim: float) -> tuple[float, dict]:
    """
    Returns (final_score, component_breakdown) where component_breakdown is
    used to generate human-readable reasoning strings downstream.
    """
    components = {}

    # ---- Hard disqualifier gate -------------------------------------------
    # JD explicit disqualifiers. We don't hard-zero (a single false-positive
    # regex shouldn't nuke a candidate to literally unrankable), but we apply
    # a severe multiplicative penalty that will push them out of top 100
    # under any reasonable pool unless every other signal is exceptional.
    gate_mult = 1.0
    gate_reasons = []
    if f.research_only_flag:
        gate_mult *= 0.15
        gate_reasons.append("research_only_no_production_evidence")
    if f.is_consulting_only:
        gate_mult *= 0.35
        gate_reasons.append("consulting_only_career")
    if f.title_cv_speech_robotics:
        gate_mult *= 0.2
        gate_reasons.append("cv_speech_robotics_without_nlp_ir")
    if f.title_off_target and not f.title_core_hit and not f.title_adjacent_hit:
        gate_mult *= 0.12
        gate_reasons.append("off_target_title")
    if f.tenure_chaser_flag:
        gate_mult *= 0.55
        gate_reasons.append("short_median_tenure_title_chasing_pattern")
    components["gate_mult"] = gate_mult
    components["gate_reasons"] = gate_reasons

    # ---- Title / role fit (structured, dominant signal) -------------------
    if f.title_core_hit:
        title_score = 1.0
    elif f.title_adjacent_hit:
        title_score = 0.55
    else:
        title_score = 0.15
    components["title_score"] = title_score

    # ---- Trust-weighted skills ---------------------------------------------
    # Normalize core_skill_score against a reasonable ceiling observed from
    # the weight table (sum of top weights for a strong real fit ~ 12-18).
    skill_score = min(f.core_skill_score / 14.0, 1.0)
    nice_bonus = min(f.nice_skill_score / 6.0, 1.0) * 0.3  # capped, minor
    components["skill_score"] = skill_score
    components["nice_bonus"] = nice_bonus

    # ---- Production evidence in narrative (aggregate, not per-role) -------
    evidence_score = min(f.production_evidence_hits / 4.0, 1.0)
    components["evidence_score"] = evidence_score

    # ---- Experience band fit (soft, JD explicitly says range not rule) ----
    if 5 <= f.yoe <= 9:
        exp_score = 1.0
    elif 3 <= f.yoe < 5 or 9 < f.yoe <= 12:
        exp_score = 0.6
    else:
        exp_score = 0.25
    components["exp_score"] = exp_score

    # ---- Location / logistics ----------------------------------------------
    components["location_score"] = f.location_fit

    # ---- Semantic similarity (TF-IDF) --------------------------------------
    components["tfidf_score"] = tfidf_sim

    # ---- Weighted base composite (sums to 1.0 before gate/behavioral) -----
    base = (
        0.32 * title_score +
        0.27 * skill_score +
        0.06 * nice_bonus +
        0.13 * evidence_score +
        0.10 * exp_score +
        0.07 * f.location_fit +
        0.05 * tfidf_sim
    )
    components["base_pre_gate"] = base

    gated = base * gate_mult
    components["gated_score"] = gated

    # ---- Behavioral multiplier (multiplicative modifier per JD/signals doc)
    # Recency: decays smoothly; candidates inactive >180d get a strong haircut
    # but are not zeroed (they may still resurface).
    recency_mult = max(0.4, 1.0 - (f.behavioral_recency_days / 365.0))
    response_mult = 0.6 + 0.4 * f.recruiter_response_rate
    open_mult = 1.0 if f.open_to_work else 0.85
    verify_mult = 0.85 + 0.05 * f.verified_count  # 0.85 - 1.0
    behavioral_mult = recency_mult * response_mult * open_mult * verify_mult
    behavioral_mult = max(0.3, min(behavioral_mult, 1.15))
    components["behavioral_mult"] = behavioral_mult

    final = gated * behavioral_mult
    components["final_pre_honeypot"] = final

    return final, components
