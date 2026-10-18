"""AI chat that drafts the documents in templates/: the LLM call and the turn it takes.

The server keeps no conversation state. Each request carries the chat history, the document
being drafted (if one is chosen) and its current form, and the model answers with a reply, the
document it settled on and the fields it learned (null for "unchanged"). Field names are the
keys in templates/documents.json, which the frontend uses too.
"""

from collections.abc import Callable
from datetime import date
from typing import Literal

from litellm import completion
from pydantic import BaseModel, Field, ValidationError, field_validator

from .documents import Registry
from .prompt import build_system_prompt
from .sanitize import carry_over, merge_updates, sanitize_updates

MODEL = "openrouter/openai/gpt-oss-120b"
EXTRA_BODY = {"provider": {"order": ["cerebras"]}}
TIMEOUT_SECONDS = 30
# "low" sometimes skips recording fields the user gave (e.g. the parties named while choosing a
# document); "medium" doesn't, and on Cerebras adds well under a second.
REASONING_EFFORT = "medium"
# Caps the cost of one call; a full turn (reasoning plus JSON) is well under 1,000 tokens.
MAX_OUTPUT_TOKENS = 2000

# The frontend sends at most the latest MAX_MESSAGES messages (frontend/lib/chat/client.ts).
MAX_MESSAGES = 40
MAX_MESSAGE_LENGTH = 2000
# The reply comes back in the next request's history, so it must pass the same checks.
EMPTY_REPLY = "Sorry, I lost my train of thought. Could you say that again?"


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=MAX_MESSAGE_LENGTH)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=MAX_MESSAGES)
    # A catalog id, or None before the user has chosen a document.
    documentType: str | None = None
    # The document's fields plus party1 and party2; checked against the document in run_chat.
    form: dict = {}
    today: date

    @field_validator("messages")
    @classmethod
    def ends_with_user(cls, messages: list[ChatMessage]) -> list[ChatMessage]:
        if messages[-1].role != "user":
            raise ValueError("the last message must be from the user")
        return messages


class ChatResponse(BaseModel):
    reply: str
    # Set only when the document changed this turn; the frontend then starts that document afresh.
    documentType: str | None = None
    # Only the fields that changed (after a switch, also those carried over), with party
    # fields nested under party1/party2.
    updates: dict


# Takes the messages and the Structured Outputs model to answer in.
ChatModel = Callable[[list[dict], type[BaseModel]], BaseModel]


class ChatFailed(Exception):
    """The LLM call failed or returned something unusable."""


class InvalidRequest(Exception):
    """The request names an unknown document or its form doesn't fit the document."""


def litellm_chat_model(api_key: str) -> ChatModel:
    def call(messages: list[dict], schema: type[BaseModel]) -> BaseModel:
        try:
            response = completion(
                model=MODEL,
                messages=messages,
                response_format=schema,
                reasoning_effort=REASONING_EFFORT,
                extra_body=EXTRA_BODY,
                api_key=api_key,
                max_tokens=MAX_OUTPUT_TOKENS,
                timeout=TIMEOUT_SECONDS,
            )
            return schema.model_validate_json(response.choices[0].message.content)
        except Exception as exc:  # litellm raises many provider-specific types
            raise ChatFailed(str(exc)) from exc

    return call


def _reply(turn: BaseModel) -> str:
    return turn.reply.strip()[:MAX_MESSAGE_LENGTH].strip() or EMPTY_REPLY


def _history(request: ChatRequest) -> list[dict]:
    return [m.model_dump() for m in request.messages]


def run_chat(request: ChatRequest, model: ChatModel, registry: Registry) -> ChatResponse:
    doc = registry.get(request.documentType)
    if request.documentType and not doc:
        raise InvalidRequest(f"unknown documentType: {request.documentType}")
    try:
        form = registry.form_model(doc).model_validate(request.form) if doc else None
    except ValidationError as exc:
        raise InvalidRequest(str(exc)) from exc

    system = build_system_prompt(registry, request.today, doc, form)
    turn = model([{"role": "system", "content": system}, *_history(request)], registry.turn_model(doc))
    new_doc = registry.get(turn.documentType)
    if not new_doc or new_doc is doc:
        updates = sanitize_updates(doc, turn.updates) if doc else {}
        return ChatResponse(reply=_reply(turn), updates=updates)

    # The user chose or switched documents. The model answered in the old document's schema, so
    # ask again with the new document's fields and the values carried over to it.
    carried = carry_over(doc, new_doc, form) if doc else {}
    new_form = registry.form_model(new_doc).model_validate(carried)
    system = build_system_prompt(registry, request.today, new_doc, new_form, chosen=True, switched_from=doc)
    turn = model([{"role": "system", "content": system}, *_history(request)], registry.turn_model(new_doc))
    updates = merge_updates(carried, sanitize_updates(new_doc, turn.updates))
    return ChatResponse(reply=_reply(turn), documentType=new_doc.id, updates=updates)
