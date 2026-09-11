"""Fail on pip-audit findings unless a current, owned VEX statement exists."""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path


def main() -> int:
    report_path = Path(sys.argv[1] if len(sys.argv) > 1 else "pip-audit.json")
    vex_path = Path(sys.argv[2] if len(sys.argv) > 2 else "../security/vex/chromadb.json")
    report = json.loads(report_path.read_text(encoding="utf-8"))
    vex = json.loads(vex_path.read_text(encoding="utf-8"))
    now = datetime.now(timezone.utc)
    waivers = {
        statement["vulnerability"]: statement
        for statement in vex.get("statements", [])
        if statement.get("status") in {"not_affected", "fixed", "under_investigation"}
        and statement.get("owner")
        and statement.get("impact_statement")
        and statement.get("action_statement")
    }

    unwaived = []
    for dependency in report.get("dependencies", []):
        for vuln in dependency.get("vulns", []):
            waiver = waivers.get(vuln.get("id"))
            if not waiver:
                unwaived.append(f"{dependency.get('name')} {dependency.get('version')} {vuln.get('id')}")
                continue
            expires = waiver.get("expires")
            try:
                expiry = datetime.fromisoformat(expires.replace("Z", "+00:00"))
            except (AttributeError, ValueError):
                unwaived.append(f"invalid VEX expiry for {vuln.get('id')}")
                continue
            if expiry <= now:
                unwaived.append(f"expired VEX for {vuln.get('id')}")
    if unwaived:
        print("Unwaived or expired pip-audit findings:")
        print("\n".join(unwaived))
        return 1
    print("pip-audit: all findings are covered by current owned VEX statements")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
