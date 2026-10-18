"""Service de transcription : contrat compatible OpenAI, limites, jeton, erreurs (modèle Whisper simulé)."""

from __future__ import annotations

import importlib
import sys
import types
from pathlib import Path
from typing import ClassVar

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


class _Segment:
    def __init__(self, text: str) -> None:
        self.text = text


class _Info:
    language = "fr"
    duration = 12.345


class _WhisperModel:
    calls: ClassVar[list[dict]] = []

    def __init__(self, path: str, **kwargs) -> None:
        self.path = path

    def transcribe(self, audio, **kwargs):
        if audio.getvalue() == b"corrompu":
            raise ValueError("Invalid data found when processing input")
        _WhisperModel.calls.append(kwargs)
        return iter(
            [
                _Segment(" Dalle du 2e étage coulée. "),
                _Segment("Il manque 20 sacs de ciment."),
            ]
        ), _Info()


@pytest.fixture
def make_client(monkeypatch):
    fake = types.ModuleType("faster_whisper")
    fake.WhisperModel = _WhisperModel
    monkeypatch.setitem(sys.modules, "faster_whisper", fake)

    def build(**env: str) -> TestClient:
        for key, value in env.items():
            monkeypatch.setenv(key, value)
        module = importlib.reload(importlib.import_module("app"))
        return TestClient(module.app)

    return build


def test_transcription_openai_contract(make_client):
    client = make_client()
    resp = client.post(
        "/v1/audio/transcriptions",
        files={"file": ("rapport.m4a", b"audio-m4a", "audio/mp4")},
        data={"model": "whisper-1", "language": "fr", "response_format": "json"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json() == {
        "text": "Dalle du 2e étage coulée. Il manque 20 sacs de ciment.",
        "language": "fr",
        "duration": 12.35,
    }
    options = _WhisperModel.calls[-1]
    assert options["language"] == "fr" and options["vad_filter"] is True
    assert "chantier" in options["initial_prompt"]
    assert client.get("/health").json()["loaded"] is True


def test_limits_token_and_unreadable_audio(make_client):
    client = make_client(STT_TOKEN="jeton-interne-de-test", STT_MAX_MB="1")
    files = {"file": ("rapport.webm", b"audio", "audio/webm")}
    assert client.post("/v1/audio/transcriptions", files=files).status_code == 401
    headers = {"Authorization": "Bearer jeton-interne-de-test"}
    assert client.post("/v1/audio/transcriptions", files=files, headers=headers).status_code == 200
    big = {"file": ("long.webm", b"0" * (1024 * 1024 + 1), "audio/webm")}
    assert client.post("/v1/audio/transcriptions", files=big, headers=headers).status_code == 413
    empty = {"file": ("vide.webm", b"", "audio/webm")}
    assert client.post("/v1/audio/transcriptions", files=empty, headers=headers).status_code == 400
    bad = {"file": ("x.webm", b"corrompu", "audio/webm")}
    resp = client.post("/v1/audio/transcriptions", files=bad, headers=headers)
    assert resp.status_code == 422 and "illisible" in resp.json()["detail"]
