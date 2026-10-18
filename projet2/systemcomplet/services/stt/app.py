"""Service de transcription GLOBUS : Whisper auto-hébergé (faster-whisper, CPU), réseau interne uniquement.

API compatible OpenAI, appelée par l'API GLOBUS (STT_PROVIDER=http) :
    POST /v1/audio/transcriptions   multipart : file, model (ignoré), language, response_format
    → {"text": "...", "language": "fr", "duration": 12.3}

Les enregistrements ne quittent jamais le serveur ; le modèle est embarqué dans l'image (aucun accès Internet).
Une seule transcription à la fois (processeur partagé avec le site) ; les suivantes attendent leur tour.
"""

from __future__ import annotations

import hmac
import io
import os
import threading
from pathlib import Path
from typing import Annotated, Any

from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile

MODEL_PATH = os.environ.get("WHISPER_MODEL_PATH", "/models/small")
COMPUTE_TYPE = os.environ.get("WHISPER_COMPUTE_TYPE", "int8")
CPU_THREADS = int(os.environ.get("WHISPER_THREADS", "2"))
BEAM_SIZE = int(os.environ.get("WHISPER_BEAM_SIZE", "5"))
MAX_BYTES = int(os.environ.get("STT_MAX_MB", "100")) * 1024 * 1024
TOKEN = os.environ.get("STT_TOKEN") or None
# Vocabulaire du bâtiment : oriente la reconnaissance des termes techniques des rapports de chantier.
INITIAL_PROMPT = os.environ.get(
    "WHISPER_INITIAL_PROMPT",
    "Rapport de chantier BTP : coulage de la dalle, béton, coffrage, ferraillage, fondations, maçonnerie, "
    "étage, ciment, parpaings, livraison, retard, incident, sécurité.",
)

app = FastAPI(title="GLOBUS — transcription", docs_url=None, redoc_url=None, openapi_url=None)
_model: Any = None
_load_lock = threading.Lock()
_run_lock = threading.Lock()


def get_model() -> Any:
    global _model
    with _load_lock:
        if _model is None:
            from faster_whisper import WhisperModel

            _model = WhisperModel(
                MODEL_PATH,
                device="cpu",
                compute_type=COMPUTE_TYPE,
                cpu_threads=CPU_THREADS,
            )
    return _model


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "model": Path(MODEL_PATH).name,
        "loaded": _model is not None,
    }


@app.post("/v1/audio/transcriptions")
def transcriptions(
    file: Annotated[UploadFile, File()],
    model: Annotated[str, Form()] = "whisper-1",
    language: Annotated[str | None, Form()] = None,
    response_format: Annotated[str, Form()] = "json",
    authorization: Annotated[str | None, Header()] = None,
) -> dict[str, Any]:
    del model  # un seul modèle, choisi au déploiement
    if TOKEN and not hmac.compare_digest(authorization or "", f"Bearer {TOKEN}"):
        raise HTTPException(status_code=401, detail="Jeton invalide")
    if response_format not in ("json", "verbose_json", "text"):
        raise HTTPException(status_code=400, detail="response_format non pris en charge")
    data = file.file.read(MAX_BYTES + 1)
    if not data:
        raise HTTPException(status_code=400, detail="Fichier audio vide")
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="Fichier audio trop volumineux")
    try:
        with _run_lock:
            # PyAV décode tout format courant (m4a, webm/opus, ogg, mp3, wav) directement depuis la mémoire.
            segments, info = get_model().transcribe(
                io.BytesIO(data),
                language=(language or None),
                beam_size=BEAM_SIZE,
                vad_filter=True,
                initial_prompt=INITIAL_PROMPT or None,
            )
            text = " ".join(segment.text.strip() for segment in segments).strip()
    except Exception as exc:  # décodage PyAV / modèle : format audio non lisible
        raise HTTPException(status_code=422, detail=f"Audio illisible : {type(exc).__name__}") from exc
    return {
        "text": text,
        "language": info.language,
        "duration": round(float(info.duration), 2),
    }
