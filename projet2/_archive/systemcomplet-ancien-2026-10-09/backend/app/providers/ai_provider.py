"""AI provider abstraction.

Encapsulates AI services (speech-to-text, OCR, lead qualification, anomaly
detection) behind a stable interface. No AI validates alone - human approval
is always required for critical actions.
"""
from typing import Optional
from app.config import get_settings

settings = get_settings()


class AIProvider:
    async def transcribe_audio(self, audio_bytes: bytes, language: str = "fr") -> dict:
        raise NotImplementedError

    async def ocr_document(self, image_bytes: bytes) -> dict:
        raise NotImplementedError

    async def reformat_report(self, raw_text: str) -> dict:
        raise NotImplementedError

    async def extract_fields(self, text: str, fields: list) -> dict:
        raise NotImplementedError

    async def score_lead(self, lead_data: dict) -> dict:
        raise NotImplementedError

    async def detect_anomaly(self, data: dict, context: str) -> dict:
        raise NotImplementedError

    async def summarize_site(self, reports: list) -> dict:
        raise NotImplementedError


class OpenAIProvider(AIProvider):
    def __init__(self):
        self.api_key = getattr(settings, "OPENAI_API_KEY", "")
        self.base_url = "https://api.openai.com/v1"

    async def _chat(self, system: str, user: str, model: str = "gpt-4o-mini") -> str:
        if not self.api_key:
            return ""
        # pyrefly: ignore [missing-import]
        import httpx
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                    "temperature": 0.3,
                },
                timeout=60.0,
            )
            data = resp.json()
            return data.get("choices", [{}])[0].get("message", {}).get("content", "")

    async def transcribe_audio(self, audio_bytes: bytes, language: str = "fr") -> dict:
        if not self.api_key:
            return {"text": "", "status": "skipped"}
        # pyrefly: ignore [missing-import]
        import httpx
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/audio/transcriptions",
                headers={"Authorization": f"Bearer {self.api_key}"},
                files={"file": ("audio.webm", audio_bytes, "audio/webm")},
                data={"model": "whisper-1", "language": language},
                timeout=120.0,
            )
            data = resp.json()
            return {"text": data.get("text", ""), "status": "ok"}

    async def reformat_report(self, raw_text: str) -> dict:
        result = await self._chat(
            "Tu es un assistant de chantier BTP. Reformule ce rapport vocal en texte professionnel structuré.",
            raw_text,
        )
        return {"formatted": result, "requires_validation": True}

    async def extract_fields(self, text: str, fields: list) -> dict:
        result = await self._chat(
            f"Extrais les champs suivants du texte: {', '.join(fields)}. Retourne en JSON.",
            text,
        )
        return {"extracted": result, "requires_validation": True}

    async def score_lead(self, lead_data: dict) -> dict:
        result = await self._chat(
            "Score ce lead BTP de 0-100 selon: type de projet, budget estimé, urgence, localisation. Retourne JSON avec score et justification.",
            str(lead_data),
        )
        return {"score_data": result, "requires_validation": True}

    async def detect_anomaly(self, data: dict, context: str) -> dict:
        result = await self._chat(
            f"Analyse ces données {context} pour détecter des anomalies (montants, quantités, comportements). Retourne JSON.",
            str(data),
        )
        return {"analysis": result, "requires_validation": True}

    async def summarize_site(self, reports: list) -> dict:
        result = await self._chat(
            "Synthétise ces rapports de chantier en un résumé direction: avancement, risques, dépenses, prochaines étapes.",
            str(reports),
        )
        return {"summary": result, "requires_validation": True}

    async def ocr_document(self, image_bytes: bytes) -> dict:
        return {"text": "", "status": "skipped", "requires_validation": True}


class AnthropicProvider(AIProvider):
    def __init__(self):
        self.api_key = getattr(settings, "ANTHROPIC_API_KEY", "")

    async def _chat(self, system: str, user: str) -> str:
        if not self.api_key:
            return ""
        # pyrefly: ignore [missing-import]
        import httpx
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": self.api_key,
                    "anthropic-version": "2023-06-01",
                },
                json={
                    "model": "claude-sonnet-4-20250514",
                    "max_tokens": 2000,
                    "system": system,
                    "messages": [{"role": "user", "content": user}],
                },
                timeout=60.0,
            )
            data = resp.json()
            return data.get("content", [{}])[0].get("text", "")

    async def reformat_report(self, raw_text: str) -> dict:
        result = await self._chat(
            "Tu es un assistant de chantier BTP. Reformule ce rapport vocal en texte professionnel.",
            raw_text,
        )
        return {"formatted": result, "requires_validation": True}

    async def score_lead(self, lead_data: dict) -> dict:
        result = await self._chat(
            "Score ce lead BTP de 0-100. Retourne JSON: {score, justification}.",
            str(lead_data),
        )
        return {"score_data": result, "requires_validation": True}

    async def transcribe_audio(self, audio_bytes: bytes, language: str = "fr") -> dict:
        return {"text": "", "status": "not_supported_use_openai"}

    async def ocr_document(self, image_bytes: bytes) -> dict:
        return {"text": "", "status": "skipped", "requires_validation": True}

    async def extract_fields(self, text: str, fields: list) -> dict:
        result = await self._chat(
            f"Extrais: {', '.join(fields)}. Retourne JSON.",
            text,
        )
        return {"extracted": result, "requires_validation": True}

    async def detect_anomaly(self, data: dict, context: str) -> dict:
        return {"analysis": "", "requires_validation": True}

    async def summarize_site(self, reports: list) -> dict:
        result = await self._chat(
            "Synthétise ces rapports chantier pour la direction.",
            str(reports),
        )
        return {"summary": result, "requires_validation": True}


def get_ai_provider() -> AIProvider:
    provider = getattr(settings, "AI_PROVIDER", "openai")
    if provider == "anthropic":
        return AnthropicProvider()
    return OpenAIProvider()
