import json
import subprocess
import tempfile
from pathlib import Path
from typing import Optional, Dict, Any
import shutil
import os


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


def run_trivy_on_bytes(content: bytes, filename: str, output_path: Optional[str] = None, timeout: int = 300) -> Optional[Dict[str, Any]]:
    """Run an appropriate Trivy scan on in-memory file bytes.

    - If `filename` looks like a Dockerfile / IaC (yaml, tf, Dockerfile), runs `trivy config`.
    - If filename is a tar/tar.gz/tgz image archive, runs `trivy image --input`.
    - Otherwise returns None (no scan performed).

    Returns parsed JSON dict when scan runs, or None if unsupported file type.
    """
    # helper to get extension
    ext = os.path.splitext(filename.lower())[1]
    is_dockerfile = os.path.basename(filename) == "dockerfile" or os.path.basename(filename).startswith("dockerfile.")

    # prepare temporary location
    tmpdir = None
    tmpfile_path = None
    try:
        if is_dockerfile or ext in {".yml", ".yaml", ".tf", ".json"}:
            # write file into a temp directory and run `trivy config` against that dir
            tmpdir = tempfile.mkdtemp(prefix="trivy-config-")
            target = os.path.join(tmpdir, filename)
            with open(target, "wb") as f:
                f.write(content)

            out_tmp = tempfile.NamedTemporaryFile(prefix="trivy-config-", suffix=".json", delete=False)
            out_tmp.close()
            cmd = ["trivy", "config", "--format", "json", "-o", out_tmp.name, tmpdir]
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
            if proc.returncode != 0:
                raise RuntimeError(f"Trivy config scan failed: {proc.returncode}: {proc.stderr}")
            data = parse_trivy_json(out_tmp.name)
            if output_path:
                with open(output_path, "w", encoding="utf-8") as f:
                    json.dump(data, f, indent=2)
            return data

        if ext in {".tar", ".tar.gz", ".tgz"}:
            # write archive and use trivy image --input
            tmpfile = tempfile.NamedTemporaryFile(prefix="trivy-image-", suffix=ext, delete=False)
            tmpfile_path = tmpfile.name
            tmpfile.write(content)
            tmpfile.close()

            out_tmp = tempfile.NamedTemporaryFile(prefix="trivy-image-", suffix=".json", delete=False)
            out_tmp.close()
            cmd = ["trivy", "image", "--format", "json", "--input", tmpfile_path, "-o", out_tmp.name]
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
            if proc.returncode != 0:
                raise RuntimeError(f"Trivy image (input) scan failed: {proc.returncode}: {proc.stderr}")
            data = parse_trivy_json(out_tmp.name)
            if output_path:
                with open(output_path, "w", encoding="utf-8") as f:
                    json.dump(data, f, indent=2)
            return data

        # unsupported file types for scanning
        return None
    finally:
        if tmpdir and os.path.isdir(tmpdir):
            shutil.rmtree(tmpdir, ignore_errors=True)
        if tmpfile_path and os.path.exists(tmpfile_path):
            try:
                os.remove(tmpfile_path)
            except Exception:
                pass


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Run Trivy image scan (wrapper)")
    parser.add_argument("image", help="Container image to scan, e.g. alpine:3.18")
    parser.add_argument("--output", "-o", help="Write trivy JSON to this file")
    args = parser.parse_args()

    result = run_trivy_image(args.image, output_path=args.output)
    print(json.dumps(result, indent=2))
