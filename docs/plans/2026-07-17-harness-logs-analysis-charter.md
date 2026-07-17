# harness-logs-analysis — project charter (WS-F)

- Plan ID: `harness-logs-analysis-charter-v1`
- Status: `draft_for_review`
- Parent: `docs/plans/2026-07-17-unified-system-plan.md`

## Mission

A dedicated project space that does one thing: analyze the system's own logs and turn them into recommendations, findings, insights, and identified local maxima — automation candidates and cost-loss areas. It is the connector that closes the flywheel: everything downstream logs; this project reads all of it; its outputs change upstream behavior.

## Why a dedicated project

Log producers exist everywhere (linter runs, sessions, cost ledger, check-runs, security audits) but analysis is ad hoc and scattered across rollup scripts and one-off reports. A project whose sole charter is "analyze thyself" gets: a stable home for queries and findings, a review cadence, and accountability for whether recommendations actually landed upstream.

## Inputs (all existing artifacts — no new producers required)

| Source | Artifact | Producer |
|---|---|---|
| Session evidence | `session-data/sessions.db` (`sessions`, `session_events`) | harness ingestor (host launchd, single writer) |
| Lint telemetry | `lint_events`, new `template_events`, `lint_runs` tables | WS-D pipeline (spool → drop path → ingest) |
| Cost | `daily/rollup.py` outputs, `ledger.py` per-session USD/token cuts | harness daily |
| Check runs | `.telemetry/check-runs.jsonl` (ironlint gap-closure design) | harness checks |
| Committed reports | `docs/reports/lint/*.json` per repo | WS-D CI job |
| Security | `health-reports/security-audits/*.md` | weekly LaunchAgent |
| Fleet | `environments/registry.json`, `fleet-alerts.json` | gen-fleet-health |

Cross-container joins ride the existing session-data contract: containers export append-only bundles to the drop path (v1: manual `lappe-linter export`); host ingest is the sole DB writer; this project only ever reads. Join keys: `run_id`, `session_id`, `repo`, and `work-item-id` (the spine's J1–J8 joins).

## Outputs

1. **Findings reports** (committed markdown + JSON, dated): violation concentrations, template adoption, cost hot spots, "local maxima" — places where more automation or a rule change buys the most.
2. **Recommendations with owners**: each finding proposes a concrete upstream change — a rule digest entry for CLAUDE.md/agent prompts (via the existing `gen-rules-digest.py` pattern), a hook tightening, a template fix, a new automation binding, a schedule change.
3. **Automation candidates list**: recurring manual actions detected in logs that should become automations.
4. **Feeds**: the management plane's Insights panel and the PM plugin's cost view read these outputs (read-only).

## Cadence & loop closure

- Weekly analysis run (manual at first; scheduled once stable).
- Every recommendation gets a status (NEW/INPRG/DONE per the house enum) and a **measured follow-up**: did the targeted metric move in the next period? Recommendations without measurable movement get revisited or dropped — that discipline is what makes it a flywheel rather than a report mill.

## Repo layout (scaffolded via `harness project init --code-analysis`)

```
harness-logs-analysis/
  linter.yaml                 # dogfoods the linter, naturally
  queries/                    # reusable SQL over sessions.db (read-only)
  analysis/                   # analysis scripts (py, stdlib+sqlite3 first)
  findings/YYYY-MM-DD-*.md    # dated findings reports (committed)
  recommendations/            # one file per recommendation, status-tracked
  docs/plans/                 # local plan + ACTIVE-PLAN.pointer
```

## Security posture

This is a data-exploration project over logs, so boundaries are explicit:

- Read-only against `sessions.db` (mounted `ro` per `access-v1`; never a writer).
- Export bundles it consumes are already secret-scrubbed at capture; the analysis layer additionally never quotes raw event payloads into committed findings — only aggregates and hashes.
- Findings that would reveal sensitive paths/hosts get the same redaction pass before commit.
- No network egress required; runs entirely local/in-container per the environment policy.

## v1 → v2

- v1 (manual): run analyses on demand; export bundles moved by hand via `lappe-linter export`; findings committed by the operator.
- v2 (automated): scheduled export automation + scheduled analysis run + auto-opened PRs for findings; same trust boundaries, no new writers.

## Acceptance

- First findings report produced from real data across ≥2 repos and ≥2 containers' worth of logs.
- At least one recommendation lands upstream (hook/digest/template change) and its follow-up measurement is recorded.
- Management plane Insights panel renders the latest findings JSON.
