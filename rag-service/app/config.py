from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    openai_api_key: str = ""
    openai_embedding_model: str = "text-embedding-3-small"
    openai_chat_model: str = "gpt-4o-mini"
    chroma_persist_dir: str = "./chroma_data"
    chunk_size: int = 600
    chunk_overlap: int = 150
    top_k: int = 6
    rag_service_port: int = 8000
    openai_vision_model: str = "gpt-4o-mini"
    describe_pdf_images: bool = True
    min_image_size: int = 80  # px, skips tiny icons/bullets from triggering vision calls

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
