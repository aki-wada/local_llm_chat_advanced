#!/usr/bin/env python3
"""
Qwen3-TTS FastAPI Server (Self-contained)

Provides REST API for TTS generation. No external app.py dependency.
All core TTS functions are inlined.

Usage:
    python tts_api_server.py
    # or
    uvicorn tts_api_server:app --host 0.0.0.0 --port 8520
"""

__version__ = "1.1.0"

import io
import os
import re
import time
from contextlib import asynccontextmanager

import numpy as np
import soundfile as sf
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field

# ============================================================
# Constants (inlined from qwen3_tts_app/app.py)
# ============================================================

SPEAKERS = {
    "Ono_Anna": {
        "label": "Ono_Anna (日本語女性)",
        "description": "明るく軽やかな日本語女性の声。遊び心があり、機敏な印象。",
        "native_lang": "Japanese",
    },
    "Sohee": {
        "label": "Sohee (韓国語女性)",
        "description": "温かみのある韓国語女性の声。豊かな感情表現。",
        "native_lang": "Korean",
    },
    "Vivian": {
        "label": "Vivian (中国語女性)",
        "description": "明るく、やや鋭い若い女性の声。",
        "native_lang": "Chinese",
    },
    "Serena": {
        "label": "Serena (中国語女性)",
        "description": "温かく優しい若い女性の声。",
        "native_lang": "Chinese",
    },
    "Ryan": {
        "label": "Ryan (英語男性)",
        "description": "ダイナミックな男性の声。リズム感が強い。",
        "native_lang": "English",
    },
    "Aiden": {
        "label": "Aiden (英語男性)",
        "description": "明るいアメリカ英語の男性の声。クリアな中音域。",
        "native_lang": "English",
    },
    "Dylan": {
        "label": "Dylan (中国語・北京方言男性)",
        "description": "若々しい北京方言の男性の声。クリアで自然な音色。",
        "native_lang": "Chinese (Beijing)",
    },
    "Eric": {
        "label": "Eric (中国語・四川方言男性)",
        "description": "活発な成都方言の男性の声。やや掠れた明るさ。",
        "native_lang": "Chinese (Sichuan)",
    },
    "Uncle_Fu": {
        "label": "Uncle_Fu (中国語男性)",
        "description": "経験豊富な男性の声。低く、まろやかな音色。",
        "native_lang": "Chinese",
    },
}

DEFAULT_SPEAKERS = list(SPEAKERS.keys())

DEFAULT_TEMPERATURE = 1.0
DEFAULT_TOP_P = 0.9
DEFAULT_TOP_K = 50
DEFAULT_MAX_NEW_TOKENS = 2048
DEFAULT_SPEED = 1.0

STABILIZE_PREFIX = "\u2026\u3001"  # …、
DEFAULT_TRIM_MS = 300
AUTO_SPLIT_THRESHOLD = 200


# ============================================================
# Core TTS Helper Functions (inlined from qwen3_tts_app/app.py)
# ============================================================


def split_long_text(text, max_chars=AUTO_SPLIT_THRESHOLD):
    """句読点でテキストを分割する。各チャンクが max_chars 以下になるよう結合。"""
    if len(text) <= max_chars:
        return [text]

    segments = re.split(r"(?<=[。！？!?])", text)
    segments = [s for s in segments if s.strip()]

    if len(segments) <= 1:
        return [text]

    chunks = []
    current = ""
    for seg in segments:
        if current and len(current) + len(seg) > max_chars:
            chunks.append(current)
            current = seg
        else:
            current += seg
    if current:
        chunks.append(current)

    return chunks


def write_audio_buffer(audio, sr, fmt="WAV"):
    """音声を指定フォーマットで BytesIO に書き込む。"""
    buf = io.BytesIO()
    sf.write(buf, audio, sr, format=fmt)
    buf.seek(0)
    return buf


def generate_speech_custom_voice(
    model,
    text,
    language,
    speaker,
    instruct="",
    temperature=DEFAULT_TEMPERATURE,
    top_p=DEFAULT_TOP_P,
    top_k=DEFAULT_TOP_K,
    max_new_tokens=DEFAULT_MAX_NEW_TOKENS,
    speed=DEFAULT_SPEED,
):
    """Generate speech using CustomVoice model. Supports single or batch."""
    kwargs = {
        "text": text,
        "language": language,
        "speaker": speaker,
        "instruct": instruct,
        "temperature": temperature,
        "top_p": top_p,
        "top_k": top_k,
        "max_new_tokens": max_new_tokens,
    }
    if speed != 1.0:
        kwargs["speed"] = speed
    wavs, sr = model.generate_custom_voice(**kwargs)
    return wavs, sr


def add_stabilize_prefix(text):
    """テキストの先頭にウォームアップ用プリフィックスを追加する。"""
    if isinstance(text, list):
        return [STABILIZE_PREFIX + t for t in text]
    return STABILIZE_PREFIX + text


def trim_audio_start(audio, sr, trim_ms):
    """音声の冒頭を指定ミリ秒分トリミングする。"""
    trim_samples = int(sr * trim_ms / 1000)
    if isinstance(audio, list):
        return [a[trim_samples:] if len(a) > trim_samples else a for a in audio]
    if len(audio) > trim_samples:
        return audio[trim_samples:]
    return audio


def concatenate_audio(audio_list, sr):
    """Concatenate multiple audio arrays with short silence between."""
    silence = np.zeros(int(sr * 0.3), dtype=np.float32)
    result = []
    for i, audio in enumerate(audio_list):
        result.append(audio)
        if i < len(audio_list) - 1:
            result.append(silence)
    return np.concatenate(result)


# ============================================================
# Model Cache
# ============================================================

DEFAULT_MODEL_ID = os.environ.get(
    "QWEN_TTS_MODEL", "Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice"
)

_model_cache = {
    "model": None,
    "speakers": None,
    "device": None,
    "model_id": None,
    "loaded_at": None,
}


def load_model_for_api(model_id: str):
    """Load model with simple dict-based caching."""
    if _model_cache["model_id"] == model_id and _model_cache["model"] is not None:
        return _model_cache["model"], _model_cache["speakers"], _model_cache["device"]

    import torch
    from qwen_tts import Qwen3TTSModel

    if torch.cuda.is_available():
        device = "cuda:0"
        dtype = torch.bfloat16
    elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        device = "mps"
        dtype = torch.float32
    else:
        device = "cpu"
        dtype = torch.float32

    print(f"[tts_api_server] Loading model {model_id} on {device} ({dtype})...")
    model = Qwen3TTSModel.from_pretrained(model_id, device_map=device, dtype=dtype)

    speakers = DEFAULT_SPEAKERS
    if hasattr(model, "get_supported_speakers"):
        speakers = model.get_supported_speakers()
    elif hasattr(model, "speakers"):
        speakers = list(model.speakers)

    _model_cache.update(
        {
            "model": model,
            "speakers": speakers,
            "device": device,
            "model_id": model_id,
            "loaded_at": time.time(),
        }
    )

    print(f"[tts_api_server] Model loaded successfully. Speakers: {speakers}")
    return model, speakers, device


# ============================================================
# FastAPI Lifespan
# ============================================================


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Pre-load the default model on server startup."""
    preload = os.environ.get("QWEN_TTS_PRELOAD", "1")
    if preload == "1":
        print(f"[tts_api_server] Pre-loading model: {DEFAULT_MODEL_ID}")
        try:
            load_model_for_api(DEFAULT_MODEL_ID)
        except Exception as e:
            print(f"[tts_api_server] WARNING: Failed to pre-load model: {e}")
    else:
        print("[tts_api_server] Skipping model pre-load (QWEN_TTS_PRELOAD=0)")
    yield


# ============================================================
# FastAPI App
# ============================================================

app = FastAPI(
    title="Qwen3-TTS API",
    version=__version__,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# Request / Response Models
# ============================================================


class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)
    speaker: str = Field(default="ono_anna")
    language: str = Field(default="Japanese")
    instruct: str = Field(default="")
    temperature: float = Field(default=DEFAULT_TEMPERATURE, ge=0.5, le=2.0)
    top_p: float = Field(default=DEFAULT_TOP_P, ge=0.1, le=1.0)
    top_k: int = Field(default=DEFAULT_TOP_K, ge=1, le=100)
    max_new_tokens: int = Field(default=DEFAULT_MAX_NEW_TOKENS, ge=256, le=4096)
    speed: float = Field(default=DEFAULT_SPEED, ge=0.5, le=2.0)
    format: str = Field(default="wav", pattern="^(wav|ogg)$")
    stabilize: bool = Field(default=True)
    trim_ms: int = Field(default=DEFAULT_TRIM_MS, ge=0, le=800)


class SpeakerInfo(BaseModel):
    id: str
    label: str
    description: str
    native_lang: str


class ServerStatus(BaseModel):
    status: str
    model_loaded: bool
    model_id: str | None
    device: str | None
    speakers: list[str]
    loaded_at: float | None


# ============================================================
# Endpoints
# ============================================================


@app.get("/api/v1/status", response_model=ServerStatus)
async def get_status():
    """Health check and model status."""
    return ServerStatus(
        status="ok",
        model_loaded=_model_cache["model"] is not None,
        model_id=_model_cache["model_id"],
        device=_model_cache["device"],
        speakers=_model_cache["speakers"] or DEFAULT_SPEAKERS,
        loaded_at=_model_cache["loaded_at"],
    )


@app.get("/api/v1/speakers", response_model=list[SpeakerInfo])
async def get_speakers():
    """List available speakers with metadata."""
    return [
        SpeakerInfo(
            id=k,
            label=v["label"],
            description=v["description"],
            native_lang=v["native_lang"],
        )
        for k, v in SPEAKERS.items()
    ]


@app.post("/api/v1/tts")
async def synthesize(req: TTSRequest):
    """Generate speech from text. Returns audio as binary response."""
    try:
        model, speakers, device = load_model_for_api(DEFAULT_MODEL_ID)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Model not available: {e}")

    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    # Match speaker case-insensitively (model returns lowercase IDs)
    speaker_lower = req.speaker.lower()
    matched_speaker = None
    for s in speakers:
        if s.lower() == speaker_lower:
            matched_speaker = s
            break
    if matched_speaker is None:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown speaker: {req.speaker}. Available: {speakers}",
        )

    language = req.language if req.language != "Auto" else "Japanese"

    try:
        chunks = split_long_text(req.text)
        gen_texts = add_stabilize_prefix(chunks) if req.stabilize else chunks

        if len(gen_texts) == 1:
            gen_texts = gen_texts[0]
            lang_param = language
            speaker_param = matched_speaker
            instruct_param = req.instruct
        else:
            lang_param = [language] * len(gen_texts)
            speaker_param = [matched_speaker] * len(gen_texts)
            instruct_param = [req.instruct] * len(gen_texts)

        wavs, sr = generate_speech_custom_voice(
            model,
            gen_texts,
            lang_param,
            speaker_param,
            instruct_param,
            temperature=req.temperature,
            top_p=req.top_p,
            top_k=req.top_k,
            max_new_tokens=req.max_new_tokens,
            speed=req.speed,
        )

        if req.stabilize and req.trim_ms > 0:
            wavs = trim_audio_start(wavs, sr, req.trim_ms)

        if isinstance(wavs, list) and len(wavs) > 1:
            audio = concatenate_audio(wavs, sr)
        elif isinstance(wavs, list):
            audio = wavs[0]
        else:
            audio = wavs

        fmt_map = {"wav": "WAV", "ogg": "OGG"}
        mime_map = {"wav": "audio/wav", "ogg": "audio/ogg"}

        buf = write_audio_buffer(audio, sr, fmt_map[req.format])

        return Response(
            content=buf.getvalue(),
            media_type=mime_map[req.format],
            headers={
                "X-Audio-Duration": f"{len(audio) / sr:.2f}",
                "X-Sample-Rate": str(sr),
            },
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS generation failed: {e}")


# ============================================================
# Entry Point
# ============================================================

if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("QWEN_TTS_API_PORT", "8520"))
    print(f"[tts_api_server] Starting on http://0.0.0.0:{port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
