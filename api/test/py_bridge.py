#!/usr/bin/env python3
"""Parity bridge: drives the game's CompactExternalVoucherGenerator directly.

Usage:
  py_bridge.py generate <uuid> <amount> <days> <share>
  py_bridge.py validate <code> <uuid>

Prints JSON. Avoids the CLI's argparse (broken on Python 3.14 due to '%' in help).
"""
import json
import os
import sys

_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..'))
if _REPO_ROOT not in sys.path:
    sys.path.insert(0, _REPO_ROOT)


def main() -> int:
    if len(sys.argv) < 2:
        print(json.dumps({"error": "usage: py_bridge.py generate|validate ..."}))
        return 2

    cmd = sys.argv[1]
    try:
        from compact_external_voucher import CompactExternalVoucherGenerator

        gen = CompactExternalVoucherGenerator()
        if cmd == "generate" and len(sys.argv) >= 6:
            uuid, amount, days, share = sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5])
            code = gen.make_voucher(uuid, amount, days, share)
            print(json.dumps({"code": code}))
            return 0
        if cmd == "validate" and len(sys.argv) >= 4:
            code, uuid = sys.argv[2], sys.argv[3]
            res = gen.validate_voucher(code, uuid)
            print(json.dumps(res))
            return 0
        print(json.dumps({"error": "bad args"}))
        return 2
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        return 1


if __name__ == "__main__":
    sys.exit(main())
