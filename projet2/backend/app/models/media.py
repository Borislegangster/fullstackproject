"""Media library model."""
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime
from app.database import Base
import uuid


def _uuid():
    return str(uuid.uuid4())


class CMSMedia(Base):
    __tablename__ = "cms_media"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)  # image, video, youtube, document
    url = Column(String, nullable=False)
    storage_key = Column(String, default="")  # S3/R2 object key (empty for local files)
    thumbnail = Column(String, default="")
    alt = Column(String, default="")
    folder = Column(String, default="general")
    size = Column(String, default="")
    mime_type = Column(String, default="")
    youtube_id = Column(String, default="")  # For YouTube videos
    usage_count = Column(Integer, default=0)
    uploaded_by = Column(String, default="")
    uploaded_at = Column(DateTime, default=datetime.utcnow)
