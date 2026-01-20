from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi_cache import FastAPICache
from fastapi_cache.backends.redis import RedisBackend
from redis import asyncio as aioredis


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize Redis cache
    redis = aioredis.from_url(
        "redis://redis:6379",
        encoding="utf-8",
        decode_responses=True
    )
    FastAPICache.init(RedisBackend(redis), prefix="dockcleaner-cache")
    yield
    # Shutdown: Close Redis connection
    await redis.close()


app = FastAPI(
    title="Doc(k)leaner API",
    description="Security Audit Platform API",
    version="0.1.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"message": "Doc(k)leaner API", "status": "running"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


def _cli():
    import argparse
    from app import trivy_scan, dedupe_json

    parser = argparse.ArgumentParser(prog="dockcleaner", description="Helper CLI for Trivy scan and JSON dedupe")
    sub = parser.add_subparsers(dest="cmd")

    scan_p = sub.add_parser("scan", help="Run trivy scan on a container image")
    scan_p.add_argument("image", help="Image to scan, e.g. alpine:3.18")
    scan_p.add_argument("--output", "-o", help="Write trivy JSON to file")

    dedupe_p = sub.add_parser("dedupe", help="Remove duplicates from a Trivy JSON or generic JSON file")
    dedupe_p.add_argument("input", help="Input JSON file")
    dedupe_p.add_argument("--output", "-o", help="Output JSON file (defaults to overwrite input)")

    args = parser.parse_args()
    if args.cmd == "scan":
        data = trivy_scan.run_trivy_image(args.image, output_path=args.output)
        print("Scan completed. JSON keys:", list(data.keys()))
    elif args.cmd == "dedupe":
        out = args.output or args.input
        try:
            dedupe_json.dedupe_trivy_json(args.input, out)
        except Exception:
            dedupe_json.dedupe_generic_json_file(args.input, out)
        print(f"Wrote deduped file to {out}")
    else:
        parser.print_help()


if __name__ == "__main__":
    _cli()

