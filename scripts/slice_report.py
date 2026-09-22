#!/usr/bin/env python3
"""Split a UNION ALL report into runnable slices.

query-mcp has a request-size ceiling: a 6.3 KB statement runs, an 11.9 KB one
comes back HTTP 431 (see docs/sprint-23-known-limitations.md). That leaves
reports/exception-dashboard.sql, whose whole point is breadth -- 16 exception
branches over one shared set of CTEs -- unrunnable in one piece through the
MCP transport, though it is fine in Fulcrum's own Query UI and over REST.

Rather than leave it unverified, this emits the shared prelude plus a chosen
subset of the UNION ALL branches, with the leading branch's "UNION ALL"
stripped so the slice is valid SQL on its own. Run every slice and every
branch has been executed against the live schema; only the concatenation
itself is untested, and a UNION ALL of column lists that each already
compiled is not where the bugs are.

Usage:
    python3 scripts/slice_report.py reports/exception-dashboard.sql 0 1 2 3
    python3 scripts/slice_report.py reports/exception-dashboard.sql --list
"""
import io, re, sys
sys.path.insert(0, 'scripts')
from flatten_report import flatten

def split(path):
    src = io.open(path, encoding='utf-8').read()
    lines = src.split('\n')

    # The branch chain lives inside the last CTE before the final SELECT.
    open_i = next(i for i, l in enumerate(lines) if re.match(r'^f AS \($', l))
    # its closing ")" is the last bare ")" before the final top-level SELECT
    sel_i = next(i for i, l in enumerate(lines)
                 if i > open_i and re.match(r'^SELECT$', l))
    close_i = max(i for i, l in enumerate(lines)
                  if open_i < i < sel_i and re.match(r'^\)$', l))

    starts = [i for i in range(open_i + 1, close_i)
              if re.match(r'^UNION ALL SELECT\b', lines[i])
              or re.match(r'^SELECT l\._record_id\b', lines[i])]

    branches = []
    for n, s in enumerate(starts):
        e = starts[n + 1] if n + 1 < len(starts) else close_i
        branches.append('\n'.join(lines[s:e]))

    return {
        'prelude': '\n'.join(lines[:open_i + 1]),
        'branches': branches,
        'tail': '\n'.join(lines[close_i:]),
    }

if __name__ == '__main__':
    path = sys.argv[1]
    parts = split(path)
    if '--list' in sys.argv:
        for i, b in enumerate(parts['branches']):
            name = re.search(r"'([^']+)'", b)
            print('%2d  %-34s %5d bytes' % (i, name.group(1) if name else '?', len(b)))
        sys.exit(0)
    picked = [int(a) for a in sys.argv[2:] if a.isdigit()]
    # Branch 0 always leads. Only the FIRST branch of a UNION carries the
    # column aliases (exception_type, severity, detail, see_also,
    # value_at_risk), and the final SELECT addresses f by those names. Promote
    # any other branch to the front and those columns become auto-named, so
    # the whole slice fails on "column f.severity does not exist" - which says
    # nothing about the branch under test. Re-running branch 0 in every slice
    # costs one predicate and keeps each slice addressable.
    if 0 not in picked:
        picked = [0] + picked
    body = []
    for n, i in enumerate(picked):
        b = parts['branches'][i]
        if n == 0:
            b = re.sub(r'^UNION ALL SELECT\b', 'SELECT', b)
        body.append(b)
    sql = parts['prelude'] + '\n' + '\n'.join(body) + '\n' + parts['tail']
    print(flatten(sql, mcp=True))
