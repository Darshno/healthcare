from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    APP_NAME: str = "Rural Health Access - Analytics Service"
    VERSION: str = "1.0.0"
    DEBUG: bool = False

    DATABASE_URL: str
    REDIS_URL: str = "redis://localhost:6379"

    JWT_SECRET: str
    CORS_ORIGIN: str = "*"

    NESTJS_API_URL: str = "http://localhost:3000"

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache
def get_settings() -> Settings:
    return Settings()
