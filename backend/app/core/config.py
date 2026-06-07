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
    jwt_expire_minutes: int = 60 * 24

    media_storage_url: str = "https://storage.example.com"

    rate_limit_enabled: bool = True
    """Desligado nos testes (ver tests/conftest.py) — evita que a suíte
    inteira esbarre no limite de /auth ao rodar dezenas de registros/logins
    em sequência. Em produção fica sempre ligado (valor padrão)."""

    admin_api_key: str = "change-me-in-env"
    """Chave usada por processos internos (ex.: pipeline de ingestão de
    referências, ver backend/pipeline/publish_reference.py) para chamar
    endpoints administrativos — não é uma conta de usuário comum."""


settings = Settings()
