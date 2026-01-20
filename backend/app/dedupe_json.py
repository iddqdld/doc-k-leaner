import json
from pathlib import Path
from typing import Any, Dict, Set, Tuple


def _vuln_key(vuln: Dict[str, Any]) -> Tuple:
    """Create a dedupe key for a vulnerability dict.

    Prefer `VulnerabilityID` and `PkgName` when available, else fall back to full dict items.
    """
    if not isinstance(vuln, dict):
        return (str(vuln),)
    vid = vuln.get("VulnerabilityID") or vuln.get("id")
    pkg = vuln.get("PkgName") or vuln.get("package")
    if vid or pkg:
        return (vid, pkg)
    # Fallback: use tuple of sorted items
    return tuple(sorted((k, json.dumps(vuln[k], sort_keys=True)) for k in vuln))


def dedupe_trivy_json(input_path: str, output_path: str = None) -> Dict[str, Any]:
    """Load a Trivy JSON report, remove duplicate vulnerabilities and return cleaned dict.

    Duplicates are removed per `Results` entry, keeping the first occurrence.
    """
    p = Path(input_path)
    with p.open("r", encoding="utf-8") as f:
        data = json.load(f)

    results = data.get("Results")
    if isinstance(results, list):
        for res in results:
            vulns = res.get("Vulnerabilities")
            if not isinstance(vulns, list):
                continue
            seen: Set[Tuple] = set()
            deduped = []
            for v in vulns:
                key = _vuln_key(v)
                if key in seen:
                    continue
                seen.add(key)
                deduped.append(v)
            res["Vulnerabilities"] = deduped

    if output_path:
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    return data


def dedupe_generic_json_file(input_path: str, output_path: str = None) -> Any:
    """Load a generic JSON file and attempt to remove duplicate dict entries in lists.

    This is a best-effort utility: it will remove exact-duplicate items in lists.
    """
    p = Path(input_path)
    with p.open("r", encoding="utf-8") as f:
        data = json.load(f)

    def _dedupe(obj):
        if isinstance(obj, list):
            seen = set()
            out = []
            for item in obj:
                key = json.dumps(item, sort_keys=True)
                if key in seen:
                    continue
                seen.add(key)
                out.append(_dedupe(item))
            return out
        if isinstance(obj, dict):
            return {k: _dedupe(v) for k, v in obj.items()}
        return obj

    cleaned = _dedupe(data)

    if output_path:
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(cleaned, f, indent=2, ensure_ascii=False)

    return cleaned


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Deduplicate JSON files (Trivy-aware)")
    parser.add_argument("input", help="Input JSON file")
    parser.add_argument("--output", "-o", help="Output JSON file (defaults to overwrite input)")
    args = parser.parse_args()

    out = args.output or args.input
    try:
        result = dedupe_trivy_json(args.input, out)
    except Exception:
        result = dedupe_generic_json_file(args.input, out)

    print("Wrote:", out)
