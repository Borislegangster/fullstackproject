# syntax=docker/dockerfile:1.7
# Image du service de transcription GLOBUS (Whisper auto-hébergé, CPU). Contexte de construction : racine systemcomplet/.
#   docker build -f infra/docker/stt.Dockerfile -t globus/stt:4.0.0 .
# Le modèle est téléchargé à la construction (Hugging Face, conversion CTranslate2 de Whisper) puis embarqué : le
# service tourne sur le réseau interne, sans aucun accès Internet.

FROM python:3.12-slim-bookworm
ARG WHISPER_MODEL=small
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    HF_HUB_DISABLE_TELEMETRY=1 \
    TZ=Africa/Douala
RUN groupadd --system --gid 10001 globus \
 && useradd --system --uid 10001 --gid globus --home-dir /srv --shell /usr/sbin/nologin globus
WORKDIR /srv
COPY services/stt/requirements.txt ./
RUN pip install -r requirements.txt
RUN python -c "from faster_whisper.utils import download_model; download_model('${WHISPER_MODEL}', output_dir='/models/${WHISPER_MODEL}')" \
 && rm -rf /root/.cache
ENV WHISPER_MODEL_PATH=/models/${WHISPER_MODEL} \
    HF_HUB_OFFLINE=1
COPY services/stt/app.py ./
USER globus
EXPOSE 9000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:9000/health', timeout=4).status == 200 else 1)"
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "9000", "--workers", "1", "--no-server-header"]
