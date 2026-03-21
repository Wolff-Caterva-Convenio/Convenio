from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file="../.env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # -------------------------
    # CORE
    # -------------------------
    DATABASE_URL: str = "postgresql+psycopg2://convenio:convenio@localhost:5432/convenio"
    JWT_SECRET: str = "CHANGE_ME_SUPER_SECRET"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # -------------------------
    # EMAIL (ADD THESE)
    # -------------------------
    RESEND_API_KEY: str
    EMAIL_FROM: str = "noreply-convenio@wolff-caterva.com"


settings = Settings()