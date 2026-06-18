from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    openai_api_key: str = ""
    openai_embedding_model: str = "text-embedding-3-small"
    openai_chat_model: str = "gpt-4o-mini"
    chroma_persist_dir: str = "./chroma_data"
    chunk_size: int = 1000
    chunk_overlap: int = 200
    top_k: int = 5
    rag_service_port: int = 8000

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
