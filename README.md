# Redrob Hackathon — Candidate Ranker

A hybrid (structured-feature + lightweight semantic-similarity) ranker for the
Intelligent Candidate Discovery & Ranking Challenge.

## What this is

Ranks the 100,000-candidate pool against the Senior AI Engineer (Founding
Team) job description and produces the top-100 submission CSV required by
`submission_spec.md`.

## Quickstart

```bash
pip install -r requirements.txt

python src/rank.py \
  --candidates ./data/candidates.jsonl.gz \
  --out ./output/submission.csv
```

This is the single reproduce command (also recorded in
`submission_metadata.yaml`). It accepts either `candidates.jsonl` or the
gzipped `candidates.jsonl.gz` directly — no separate unzip step needed.

To validate the output against the official spec before submitting:

```bash
python validate_submission.py output/submission.csv
```

## How it works (short version — see the PDF deck for the full writeup)

1. **`src/features.py`** — Parses each raw candidate JSON into a structured
   `Features` object: title-family classification (core / adjacent /
   off-target / CV-speech-robotics), trust-weighted skill scoring
   (proficiency × endorsements × duration_months, with a specific discount
   for "expert, 0 duration, 0 endorsements" stuffing patterns), career
   tenure/seniority analysis, location fit, education tier, and a battery of
   honeypot/internal-consistency checks.

2. **`src/scorer.py`** — Combines those structured features with a TF-IDF +
   cosine-similarity score (candidate title/summary/skills text vs. the JD
   text) into a weighted composite, then applies (a) a multiplicative gate
   for the JD's explicit disqualifiers and (b) a multiplicative behavioral
   modifier built from the Redrob signals (recency, recruiter response rate,
   open-to-work flag, verification status).

3. **`src/reasoning.py`** — Generates the `reasoning` column. Every fact used
   in a reasoning string is read directly from the candidate's own record or
   from a computed feature — there is no free-text generation — so a
   reasoning string cannot reference a skill, employer, or signal the
   candidate doesn't actually have. Reasoning tone is selected based on the
   candidate's actual final rank, not just which heuristics fired, to avoid
   tone/rank mismatches.

4. **`src/rank.py`** — Orchestrates the above over the full pool, excludes
   detected honeypots from the top-100 eligible set, sorts, repairs any
   rounding-induced score ties (re-sorting tied runs by `candidate_id`
   ascending, per spec), and writes the CSV.

## Compute profile

CPU-only, no GPU, no network calls during ranking (TF-IDF is fit locally on
the candidate pool + a static JD text constant — no model download).
Feature extraction + TF-IDF over the full 100K-candidate pool runs in well
under a minute on a single CPU core in testing, comfortably inside the
5-minute / 16GB budget in `submission_spec.md` Section 3.

## A note on the dataset

The `career_history[].description` fields in this dataset frequently don't
match their paired `title`/`company` (e.g., a "Project Manager" entry whose
description reads as brand-design work). Spot-checks against the 50-record
sample suggest this affects a meaningful share of entries and looks like
synthetic-data noise rather than signal. The ranker therefore does **not**
treat individual `career_history.description` text as a reliable account of
what a candidate did in that specific role — it trusts `profile.current_title`
and `profile.summary` (which read as internally coherent) and uses
`career_history` only in aggregate (industries, company-size trend, tenure
pattern), leaning on the `skills[]` list — which carries explicit trust
signals via `proficiency`/`endorsements`/`duration_months` — as the primary
source for specific technical claims.

## Repo layout

```
src/
  features.py    # raw candidate -> structured Features
  scorer.py       # Features + TF-IDF -> composite score
  reasoning.py    # Features + score -> reasoning string
  rank.py         # CLI entry point / orchestration
data/             # candidates.jsonl.gz goes here (not committed — see below)
output/           # submission.csv written here
```

`candidates.jsonl.gz` is not committed to this repo (52MB+, and provided by
the organizers) — drop it into `data/` before running.

## App live at: 
            https://redrob-ranker-kxwycamofmnppg8qcl24v8.streamlit.app/
