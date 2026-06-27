from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuração da aplicação, carregada de variáveis de ambiente (.env).

    Nunca commitar segredos reais — usar `.env` local (git-ignorado) e
    secrets manager em produção (ex: AWS Secrets Manager / Azure Key Vault).
    """

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    app_name: str = "Gym Execution API"
    environment: str = "development"

    database_url: str = "postgresql+psycopg2://gym:gym@localhost:5432/gym_execution"
    redis_url: str = "redis://localhost:6379/0"

    jwt_secret_key: str = "change-me-in-env"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 30
    """Access token de curta duração (30 min) — renovado via POST /auth/refresh
    com o refresh token de longa duração armazenado no cliente."""

    refresh_token_expire_days: int = 30
    """Refresh token válido por 30 dias; rotacionado a cada uso (ver
    app/services/auth_service.py). Revogar via POST /auth/logout."""

    media_storage_url: str = "https://storage.example.com"

    rate_limit_enabled: bool = True
    """Desligado nos testes (ver tests/conftest.py) — evita que a suíte
    inteira esbarre no limite de /auth ao rodar dezenas de registros/logins
    em sequência. Em produção fica sempre ligado (valor padrão)."""

    admin_api_key: str = "change-me-in-env"
    """Chave usada por processos internos (ex.: pipeline de ingestão de
    referências, ver backend/pipeline/publish_reference.py) para chamar
    endpoints administrativos — não é uma conta de usuário comum."""

    cors_allowed_origins: list[str] = ["http://localhost:8081", "http://localhost:19006"]
    """Origens autorizadas a chamar a API a partir do navegador. Em produção,
    sobrescrever via env com o(s) domínio(s) reais — nunca usar "*" junto
    de credentials (Authorization: Bearer)."""

    @model_validator(mode="after")
    def _validate_production_secrets(self) -> "Settings":
        """Falha no boot em vez de rodar com segredos padrão conhecidos
        publicamente — evita forjar tokens JWT/chave administrativa por
        falta de configuração do `.env` em produção."""
        if self.environment == "production":
            for field_name in ("jwt_secret_key", "admin_api_key"):
                if getattr(self, field_name) == "change-me-in-env":
                    raise ValueError(
                        f"{field_name} não configurado: defina via variável de ambiente "
                        "antes de subir em produção."
                    )
        return self


settings = Settings()
