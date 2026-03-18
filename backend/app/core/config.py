from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings."""

    redis_url: str = "redis://redis:6379"
    postgres_url: str = "postgresql://dockcleaner:dockcleaner@postgres:5432/dockcleaner"
    storage_dir: str = "data/storage"
    scan_dir: str = "data/scans"
    docker_cli_path: str = "/usr/bin/docker"
    github_repo: str = "iddqdld/doc-k-leaner"
    github_branch: str = "dev"
    trivy_secret_config: str = "/etc/trivy/trivy-secret.yaml"

    max_file_size_mb: int = 20
    max_file_size_bytes: int = 20 * 1024 * 1024  # 20MB comme bytes

    # whitelist
    allowed_extensions: set[str] = {
        # Docker & Container configs
        ".dockerfile",
        # Compose & Orchestration
        ".yml",
        ".yaml",
        # configs
        ".json",
        ".toml",
        ".conf",
        ".cfg",
        ".env",
        ".properties",
        # Terraform
        ".tf",
        ".tfvars",
        ".hcl",
        # SBOM
        ".spdx",
        ".spdx.json",
        ".cdx",
        ".cdx.json",
        # Filesystem demo/support
        ".txt",
    }

    # Allowed MIME types (pour notre service de validation interne)
    allowed_mime_types: set[str] = {
        "text/plain",
        "text/yaml",
        "text/x-yaml",
        "application/x-yaml",
        "application/json",
        "application/toml",
        "text/x-sh",
        "application/x-sh",
        "application/octet-stream",  # Fallback for unknown text files
    }

    # Auth
    jwt_secret: str = "change-me-in-production"
    jwt_expiry_hours: int = 24
    google_client_id: str = ""
    google_client_secret: str = ""

    # SolidityGuard microservice
    solidityguard_url: str = "http://solidityguard:8000"
    solidityguard_jwt_secret: str = "dockcleaner-local-secret"
    solidity_storage_dir: str = "data/solidity"
    solidity_allowed_extensions: set[str] = {".sol"}
    solidity_max_file_size_mb: int = 5

    # Sandbox + local LLM settings
    sandbox_max_input_chars: int = 4096
    sandbox_rate_limit_window_seconds: int = 60
    sandbox_rate_limit_max_requests: int = 10

    # Local Ollama endpoint. In Docker on Windows, prefer:
    # http://host.docker.internal:11434
    ollama_base_url: str = "http://127.0.0.1:11434"
    sandbox_llm_model: str = "phi3:mini"
    sandbox_llm_timeout_seconds: float = 60.0
    sandbox_llm_temperature: float = 0.0
    sandbox_llm_max_output_chars: int = 8192

    # prefix si on veut faire le override of the setting in some usecases, c pratique d'avoir une imo 
    class Config:
        env_prefix = "DOCKCLEANER_"  # e.g., DOCKCLEANER_MAX_FILE_SIZE_MB=50


# Singleton instance
settings = Settings()
