import json
import subprocess
import tempfile
from pathlib import Path
from typing import Optional, Dict, Any


def run_trivy_image(image: str, output_path: Optional[str] = None, timeout: int = 300) -> Dict[str, Any]:
    """Run `trivy image --format json` on the given image and return parsed JSON.

    Requires the `trivy` binary to be installed and available on PATH.
    If `output_path` is provided the raw JSON will also be written to that file.
    """
    if output_path:
        out_file = Path(output_path)
    else:
        tmp = tempfile.NamedTemporaryFile(prefix="trivy-", suffix=".json", delete=False)
        out_file = Path(tmp.name)
        tmp.close()

    cmd = [
        "trivy",
        "image",
        "--format",
        "json",
        "-o",
        str(out_file),
        image,
    ]

    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    if proc.returncode != 0:
        raise RuntimeError(f"Trivy scan failed: {proc.returncode}: {proc.stderr}")

    with out_file.open("r", encoding="utf-8") as f:
        data = json.load(f)

    return data


def parse_trivy_json(path: str) -> Dict[str, Any]:
    """Load a Trivy JSON file and return it as a dict."""
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Run Trivy image scan (wrapper)")
    parser.add_argument("image", help="Container image to scan, e.g. alpine:3.18")
    parser.add_argument("--output", "-o", help="Write trivy JSON to this file")
    args = parser.parse_args()

    result = run_trivy_image(args.image, output_path=args.output)
    print(json.dumps(result, indent=2))
