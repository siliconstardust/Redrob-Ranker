#!/usr/bin/env python3
"""
rank.py — End-to-end ranking pipeline.

Usage:
    python rank.py --candidates ./data/candidates.jsonl.gz --out ./output/submission.csv

Reads the full candidate pool, extracts features, scores every candidate,
excludes detected honeypots from the top 100, and writes a spec-compliant
submission CSV (candidate_id, rank, score, reasoning).

Compute profile (validated against submission_spec.md Section 3):
    - CPU only, no GPU calls anywhere in this file or its imports.
    - No network calls — TfidfVectorizer is fit locally on the candidate
      pool itself plus the static JD_TEXT constant; no model download.
    - Designed to comfortably clear the 5-minute / 16GB budget on the full
      100K-candidate pool (TF-IDF + a single linear pass of feature
      extraction over 100K JSON records is on the order of tens of seconds
      on a single CPU core).
"""

from __future__ import annotations
import argparse
import csv
import gzip
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from features import extract_features
from scorer import build_tfidf_scores, composite_score
from reasoning import generate_reasoning

TOP_N = 100
HONEYPOT_MAX_FLAGS_TO_EXCLUDE = 1  # any candidate with >=1 honeypot flag is excluded from top 100


def load_candidates(path: str):
    p = Path(path)
    opener = gzip.open if p.suffix == ".gz" else open
    candidates = []
    with opener(p, "rt", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            candidates.append(json.loads(line))
    return candidates


def run(candidates_path: str, out_path: str, top_n: int = TOP_N):
    t0 = time.time()
    print(f"[rank.py] Loading candidates from {candidates_path} ...")
    candidates = load_candidates(candidates_path)
    print(f"[rank.py] Loaded {len(candidates)} candidates in {time.time()-t0:.1f}s")

    t1 = time.time()
    all_features = [extract_features(c) for c in candidates]
    print(f"[rank.py] Extracted features in {time.time()-t1:.1f}s")

    t2 = time.time()
    tfidf_scores = build_tfidf_scores(all_features)
    print(f"[rank.py] Computed TF-IDF similarity in {time.time()-t2:.1f}s")

    cand_by_id = {c["candidate_id"]: c for c in candidates}
    scored = []
    for f in all_features:
        sim = tfidf_scores.get(f.candidate_id, 0.0)
        score, components = composite_score(f, sim)
        scored.append((f, components, score))

    # Honeypot exclusion: keep them out of the eligible pool for top N,
    # per submission_spec.md Section 7 (>10% honeypot rate in top 100 disqualifies).
    eligible = [(f, c, s) for (f, c, s) in scored if len(f.honeypot_flags) < HONEYPOT_MAX_FLAGS_TO_EXCLUDE]
    excluded = len(scored) - len(eligible)
    print(f"[rank.py] Excluded {excluded} candidates flagged as probable honeypots")

    eligible.sort(key=lambda x: (-x[2], x[0].candidate_id))
    top = eligible[:top_n]

    rows = []
    for rank, (f, components, score) in enumerate(top, start=1):
        cand = cand_by_id[f.candidate_id]
        reasoning = generate_reasoning(cand, f, components, score, rank)
        rows.append({
            "candidate_id": f.candidate_id,
            "rank": rank,
            "score": round(score, 8),
            "reasoning": reasoning,
        })

    # Enforce non-increasing score by construction (already sorted), but
    # guard against float rounding producing an apparent increase, AND
    # against rounding collapsing two distinct scores into a displayed tie
    # whose candidate_id order doesn't match ascending (the validator checks
    # ties against the *written* score, not our internal full-precision one).
    for i in range(1, len(rows)):
        if rows[i]["score"] > rows[i - 1]["score"]:
            rows[i]["score"] = rows[i - 1]["score"]
    # Tie-break repair: any contiguous run of rows sharing the same *written*
    # score (post-rounding) must be ordered by candidate_id ascending. We
    # find each run and re-sort it in place, then reassign ranks/positions
    # so this is correct even for runs longer than 2.
    i = 0
    while i < len(rows):
        j = i
        while j + 1 < len(rows) and rows[j + 1]["score"] == rows[i]["score"]:
            j += 1
        if j > i:
            run = sorted(rows[i:j + 1], key=lambda r: r["candidate_id"])
            for k, row in enumerate(run):
                row["rank"] = rows[i + k]["rank"]  # preserve original rank sequence for this slice
            rows[i:j + 1] = run
        i = j + 1

    out = Path(out_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["candidate_id", "rank", "score", "reasoning"])
        writer.writeheader()
        writer.writerows(rows)

    elapsed = time.time() - t0
    print(f"[rank.py] Wrote {len(rows)} rows to {out} in {elapsed:.1f}s total")
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--candidates", required=True, help="Path to candidates.jsonl or candidates.jsonl.gz")
    ap.add_argument("--out", required=True, help="Path to write the submission CSV")
    ap.add_argument("--top-n", type=int, default=TOP_N)
    args = ap.parse_args()
    run(args.candidates, args.out, args.top_n)


if __name__ == "__main__":
    main()
