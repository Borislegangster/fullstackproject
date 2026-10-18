"""Stockage objet S3 : la clé secrète vient du coffre chiffré (saisie ERP / set-secret.sh), pas seulement de l'env."""

from __future__ import annotations

from typing import Any

from app.core import secrets as secrets_module
from app.core.config import settings


def test_s3_storage_reads_secret_from_vault(monkeypatch):
    import boto3

    from app.core.storage import S3Storage

    captured: dict[str, Any] = {}
    monkeypatch.setattr(boto3, "client", lambda service, **kwargs: captured.update(service=service, **kwargs))
    monkeypatch.setattr(settings, "S3_BUCKET", "globus-test-bucket")
    monkeypatch.setattr(settings, "S3_REGION", "eu-west-3")
    monkeypatch.setattr(settings, "S3_ACCESS_KEY_ID", "cle-acces-de-test")
    monkeypatch.setattr(settings, "S3_SECRET_ACCESS_KEY", None)
    monkeypatch.setattr(
        secrets_module, "_from_db", lambda name: "valeur-du-coffre-s3" if name == "S3_SECRET_ACCESS_KEY" else None
    )
    secrets_module.invalidate()

    storage = S3Storage()

    assert storage.bucket == "globus-test-bucket"
    assert captured["service"] == "s3"
    assert captured["region_name"] == "eu-west-3"
    assert captured["aws_access_key_id"] == "cle-acces-de-test"
    assert captured["aws_secret_access_key"] == "valeur-du-coffre-s3"
    secrets_module.invalidate()
