#!/usr/bin/env python3
"""Flatten a report to a single line so query-mcp can run it.

query-mcp rejects newlines, so comments are stripped and whitespace collapsed.

--mcp additionally works around a TRANSPORT BUG in query-mcp: it form-encodes
the SQL without escaping, so every "+" arrives at the engine as a space.
Proof:  SELECT 'a+b'  ->  'a b'  (length 3).
        SELECT 1 + 1  ->  syntax error at or near "1"

The reports themselves are correct standard SQL and run fine in Fulcrum's own
Query UI and via the REST API. Rather than disfigure 11 reports to route around
a client defect, the canonical SQL keeps "+" and this translator rewrites it
only for MCP execution:

    a + b   ->   a - -b        because  a - (-b)  ==  a + b

A space is kept between the two minus signs so the result can never be read as
a "--" comment. Addition is commutative and associative, so a chain like
"a + b + c" rewrites correctly term by term.

Usage:
    python3 scripts/flatten_report.py reports/remaining-work.sql          # as written
    python3 scripts/flatten_report.py reports/remaining-work.sql --mcp    # MCP-safe
"""
import re, sys, io

def flatten(src, mcp=False):
    src = re.sub(r'--[^\n]*', ' ', src)        # line comments
    src = re.sub(r'\s+', ' ', src).strip()     # collapse whitespace
    src = src.rstrip(';').strip()
    if mcp:
        # Only touch "+" outside string literals. No report uses "+" inside one
        # today, but a concatenated message easily could.
        out, i, in_str = [], 0, False
        while i < len(src):
            c = src[i]
            if c == "'":
                in_str = not in_str
                out.append(c)
            elif c == '+' and not in_str:
                out.append('- -')
            else:
                out.append(c)
            i += 1
        src = ''.join(out)
        src = re.sub(r'\s+', ' ', src)
    return src

if __name__ == '__main__':
    path = sys.argv[1]
    mcp = '--mcp' in sys.argv[2:]
    print(flatten(io.open(path, encoding='utf-8').read(), mcp=mcp))
