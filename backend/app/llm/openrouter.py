"""OpenRouter LLM client (Python standard library only).

Single provider for every LLM need in the platform (extraction, the AI assistant,
validation cross-checks). Configure with env vars:

    OPENROUTER_API_KEY   your OpenRouter key (required to actually call the model)
    OPENROUTER_MODEL     model id, default 'openai/gpt-4o-mini' (fast + cheap + good).
                         Swap for any OpenRouter model, e.g. 'google/gemini-2.0-flash-001',
                         'anthropic/claude-3.5-haiku', 'meta-llama/llama-3.3-70b-instruct'.

If no key is set, `available` is False and callers fall back to deterministic logic,
so the whole app still runs offline (and all tests pass without network).
"""
from __future__ import annotations
import json
import os
import re
import urllib.error
import urllib.request

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_MODEL = os.environ.get("OPENROUTER_MODEL", "openai/gpt-4o-mini")


class OpenRouterError(Exception):
    pass


class OpenRouterClient:
    def __init__(self, api_key: str | None = None, model: str | None = None, timeout: float = 40.0):
        self.api_key = api_key if api_key is not None else os.environ.get("OPENROUTER_API_KEY", "")
        self.model = model or DEFAULT_MODEL
        self.timeout = timeout

    @property
    def available(self) -> bool:
        return bool(self.api_key)

    def chat(self, messages: list[dict], *, json_mode: bool = False,
             temperature: float = 0.2, max_tokens: int = 700, model: str | None = None) -> str:
        """Return the assistant message text. Raises OpenRouterError on any failure."""
        if not self.api_key:
            raise OpenRouterError("OPENROUTER_API_KEY not set")
        payload: dict = {
            "model": model or self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}
        req = urllib.request.Request(
            OPENROUTER_URL,
            data=json.dumps(payload).encode("utf-8"),
            method="POST",
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                # OpenRouter attribution headers (optional but recommended)
                "HTTP-Referer": os.environ.get("OPENROUTER_REFERER", "https://exampath.app"),
                "X-Title": "ExamPath",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                body = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", "replace")[:300]
            raise OpenRouterError(f"OpenRouter HTTP {e.code}: {detail}")
        except Exception as e:  # noqa: BLE001 - surface any transport error uniformly
            raise OpenRouterError(str(e))
        try:
            return body["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError):
            raise OpenRouterError(f"unexpected response shape: {str(body)[:200]}")

    def chat_json(self, messages: list[dict], **kwargs) -> dict:
        """Chat expecting a JSON object back; tolerant of models that wrap it in prose."""
        text = self.chat(messages, json_mode=True, **kwargs)
        try:
            return json.loads(text)
        except Exception:
            m = re.search(r"\{.*\}", text, re.S)
            if m:
                try:
                    return json.loads(m.group(0))
                except Exception:
                    pass
            raise OpenRouterError("model did not return valid JSON")
