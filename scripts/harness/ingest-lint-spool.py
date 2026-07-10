#!/usr/bin/env python3
"""Ingest the lappe-linter spool JSONL into a sqlite lint_events table.

Usage: ingest-lint-spool.py <db-path> [spool-path]

Reads spool lines emitted by lint-on-write.sh (CLI --json output-version 1,
annotated with session_id and ts) and upserts one row per violation into
lint_events. Idempotent on replay: each row's content_hash is derived from
the sha256 of the raw spool line (suffixed with the violation index so a
multi-violation line yields distinct rows), enforced by a UNIQUE constraint
and INSERT OR IGNORE.

This is the artifact HC-4 in docs/plans/harness-changes.md adapts into the
session-data repo. Python 3 stdlib only.
"""

import hashlib
import json
import os
import sqlite3
import sys

DEFAULT_SPOOL = os.path.join(
    os.path.expanduser('~'), '.claude', 'telemetry', 'lint-spool.jsonl'
)

SCHEMA = """
CREATE TABLE IF NOT EXISTS lint_events (
    ts TEXT,
    session_id TEXT,
    path TEXT,
    profile TEXT,
    rule TEXT,
    fixed INTEGER,
    message TEXT,
    output_version INTEGER,
    content_hash TEXT UNIQUE
)
"""

INSERT = """
INSERT OR IGNORE INTO lint_events
    (ts, session_id, path, profile, rule, fixed, message, output_version, content_hash)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
"""


def rows_for_line(raw):
    obj = json.loads(raw)
    if not isinstance(obj, dict):
        raise ValueError('spool line is not a JSON object')
    digest = hashlib.sha256(raw.encode('utf-8')).hexdigest()
    ts = obj.get('ts')
    session_id = obj.get('session_id')
    path = obj.get('path')
    profile = obj.get('profile')
    output_version = obj.get('output-version')
    violations = obj.get('violations') or []
    rows = []
    for index, violation in enumerate(violations):
        if not isinstance(violation, dict):
            continue
        rows.append((
            ts,
            session_id,
            path,
            profile,
            violation.get('rule'),
            1 if violation.get('fixed') else 0,
            violation.get('message'),
            output_version,
            '%s:%d' % (digest, index),
        ))
    return rows


def ingest(db_path, spool_path):
    conn = sqlite3.connect(db_path)
    try:
        conn.execute(SCHEMA)
        lines = 0
        skipped = 0
        inserted = 0
        with open(spool_path, 'r', encoding='utf-8') as spool:
            for raw in spool:
                raw = raw.rstrip('\n')
                if not raw.strip():
                    continue
                lines += 1
                try:
                    rows = rows_for_line(raw)
                except (ValueError, json.JSONDecodeError):
                    skipped += 1
                    print(
                        'ingest-lint-spool: skipping malformed line %d' % lines,
                        file=sys.stderr,
                    )
                    continue
                for row in rows:
                    cursor = conn.execute(INSERT, row)
                    inserted += cursor.rowcount
        conn.commit()
        print(
            'ingest-lint-spool: %d lines read, %d rows inserted, %d malformed lines skipped'
            % (lines, inserted, skipped)
        )
    finally:
        conn.close()
    return 0


def main(argv):
    if len(argv) < 2 or len(argv) > 3:
        print('usage: ingest-lint-spool.py <db-path> [spool-path]', file=sys.stderr)
        return 2
    db_path = argv[1]
    spool_path = argv[2] if len(argv) == 3 else DEFAULT_SPOOL
    if not os.path.exists(spool_path):
        print(
            'ingest-lint-spool: spool not found, nothing to ingest: %s' % spool_path,
            file=sys.stderr,
        )
        return 0
    return ingest(db_path, spool_path)


if __name__ == '__main__':
    sys.exit(main(sys.argv))
