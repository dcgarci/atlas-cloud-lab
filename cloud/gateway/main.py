from __future__ import annotations

import asyncio
import json
import os
import secrets
import time
import uuid
from dataclasses import dataclass, field
from typing import Any

from fastapi import FastAPI, HTTPException, Request, Response, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import hashlib

APP_VERSION = "2.12.21-cloud-lab-r1"
AGENT_TOKEN = os.getenv("ATLAS_CLOUD_AGENT_TOKEN", "").strip()
AGENT_ID = os.getenv("ATLAS_CLOUD_AGENT_ID", "atlas-lab-01").strip()
RPC_TIMEOUT = float(os.getenv("ATLAS_CLOUD_RPC_TIMEOUT", "15"))
ALLOWED_ORIGINS = [
    x.strip() for x in os.getenv("ATLAS_CLOUD_ALLOWED_ORIGINS", "*").split(",") if x.strip()
]

app = FastAPI(
    title="ATLAS Cloud Gateway",
    version=APP_VERSION,
    description="Fail-closed relay between ATLAS Web and the Windows Local Agent.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-ATLAS-Device"],
    allow_credentials=False,
)


@dataclass
class AgentSession:
    websocket: WebSocket
    connected_at: float = field(default_factory=time.time)
    last_seen: float = field(default_factory=time.time)
    pending: dict[str, asyncio.Future] = field(default_factory=dict)
    browser_streams: dict[str, WebSocket] = field(default_factory=dict)
    send_lock: asyncio.Lock = field(default_factory=asyncio.Lock)

    async def send(self, payload: dict[str, Any]) -> None:
        async with self.send_lock:
            await self.websocket.send_text(json.dumps(payload, separators=(",", ":")))


_agent: AgentSession | None = None
_agent_lock = asyncio.Lock()

class AuthBody(BaseModel):
    name: str | None = None
    email: str
    password: str


_users: dict[str, dict[str, Any]] = {}
_tokens: dict[str, str] = {}


def _hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


@app.post("/api/auth/register")
async def auth_register(body: AuthBody):
    email = body.email.lower().strip()

    if email in _users:
        raise HTTPException(status_code=409, detail="Usuário já cadastrado.")

    user = {
        "name": body.name or email.split("@")[0],
        "email": email,
        "password": _hash_password(body.password),
    }

    _users[email] = user

    token = uuid.uuid4().hex
    _tokens[token] = email

    return {
        "token": token,
        "user": {
            "name": user["name"],
            "email": user["email"],
        },
    }


@app.post("/api/auth/login")
async def auth_login(body: AuthBody):
    email = body.email.lower().strip()

    user = _users.get(email)

    if not user:
        raise HTTPException(status_code=401, detail="Usuário não encontrado.")

    if user["password"] != _hash_password(body.password):
        raise HTTPException(status_code=401, detail="Senha inválida.")

    token = uuid.uuid4().hex
    _tokens[token] = email

    return {
        "token": token,
        "user": {
            "name": user["name"],
            "email": user["email"],
        },
    }




def _token_ok(value: str | None) -> bool:
    if not AGENT_TOKEN:
        return False
    return bool(value) and secrets.compare_digest(value, AGENT_TOKEN)


def _agent_snapshot() -> dict[str, Any]:
    if _agent is None:
        return {"connected": False, "agent_id": AGENT_ID, "last_seen_age_s": None}
    return {
        "connected": True,
        "agent_id": AGENT_ID,
        "connected_at": _agent.connected_at,
        "last_seen_age_s": round(max(0.0, time.time() - _agent.last_seen), 3),
        "pending_rpc": len(_agent.pending),
        "browser_streams": len(_agent.browser_streams),
    }


async def _require_agent() -> AgentSession:
    session = _agent
    if session is None:
        raise HTTPException(status_code=503, detail="ATLAS Local Agent offline.")
    return session


@app.get("/health")
async def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "version": APP_VERSION,
        "product": "ATLAS Cloud Lab Gateway",
        "agent": _agent_snapshot(),
        "live_execution": "disabled",
    }


@app.get("/api/cloud/status")
async def cloud_status() -> dict[str, Any]:
    return {
        "version": APP_VERSION,
        "mode": "CLOUD_LAB",
        "agent": _agent_snapshot(),
        "command_policy": "fail_closed",
    }


@app.websocket("/cloud/agent")
async def cloud_agent(websocket: WebSocket) -> None:
    global _agent
    supplied_token = websocket.headers.get("x-atlas-agent-token")
    supplied_id = websocket.headers.get("x-atlas-agent-id", "")
    if not _token_ok(supplied_token) or supplied_id != AGENT_ID:
        await websocket.close(code=4401, reason="unauthorized")
        return

    await websocket.accept()
    session = AgentSession(websocket=websocket)

    async with _agent_lock:
        previous = _agent
        _agent = session
        if previous is not None:
            try:
                await previous.websocket.close(code=4001, reason="replaced")
            except Exception:
                pass

    try:
        await session.send({"type": "hello", "version": APP_VERSION, "agent_id": AGENT_ID})
        while True:
            raw = await websocket.receive_text()
            session.last_seen = time.time()
            message = json.loads(raw)
            kind = message.get("type")

            if kind == "pong":
                continue

            if kind == "rpc_response":
                request_id = str(message.get("request_id", ""))
                fut = session.pending.pop(request_id, None)
                if fut is not None and not fut.done():
                    fut.set_result(message)
                continue

            if kind == "stream_event":
                stream_id = str(message.get("stream_id", ""))
                browser = session.browser_streams.get(stream_id)
                if browser is not None:
                    try:
                        await browser.send_text(str(message.get("data", "")))
                    except Exception:
                        session.browser_streams.pop(stream_id, None)
                continue
    except (WebSocketDisconnect, json.JSONDecodeError):
        pass
    finally:
        async with _agent_lock:
            if _agent is session:
                _agent = None
        for fut in list(session.pending.values()):
            if not fut.done():
                fut.set_exception(RuntimeError("agent disconnected"))
        for browser in list(session.browser_streams.values()):
            try:
                await browser.close(code=1011, reason="Local Agent disconnected")
            except Exception:
                pass


@app.api_route(
    "/api/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
)
async def proxy_api(path: str, request: Request) -> Response:
    session = await _require_agent()
    request_id = uuid.uuid4().hex
    body = await request.body()
    query = request.url.query
    headers = {}
    for key in ("authorization", "content-type", "x-atlas-device"):
        value = request.headers.get(key)
        if value:
            headers[key] = value

    loop = asyncio.get_running_loop()
    fut = loop.create_future()
    session.pending[request_id] = fut
    await session.send(
        {
            "type": "rpc_request",
            "request_id": request_id,
            "method": request.method,
            "path": f"/api/{path}",
            "query": query,
            "headers": headers,
            "body": body.decode("utf-8", errors="replace"),
        }
    )

    try:
        message = await asyncio.wait_for(fut, timeout=RPC_TIMEOUT)
    except asyncio.TimeoutError:
        session.pending.pop(request_id, None)
        raise HTTPException(status_code=504, detail="ATLAS Local Agent timeout.")
    except RuntimeError:
        raise HTTPException(status_code=503, detail="ATLAS Local Agent disconnected.")

    response_headers = {}
    content_type = (message.get("headers") or {}).get("content-type")
    if content_type:
        response_headers["content-type"] = content_type
    return Response(
        content=str(message.get("body", "")),
        status_code=int(message.get("status", 502)),
        headers=response_headers,
    )


async def _browser_stream(websocket: WebSocket, local_path: str) -> None:
    await websocket.accept()
    session = _agent
    if session is None:
        await websocket.close(code=1013, reason="ATLAS Local Agent offline")
        return

    stream_id = uuid.uuid4().hex
    session.browser_streams[stream_id] = websocket
    await session.send({"type": "stream_open", "stream_id": stream_id, "path": local_path})

    try:
        while True:
            data = await websocket.receive_text()
            await session.send({"type": "stream_input", "stream_id": stream_id, "data": data})
    except WebSocketDisconnect:
        pass
    finally:
        session.browser_streams.pop(stream_id, None)
        try:
            await session.send({"type": "stream_close", "stream_id": stream_id})
        except Exception:
            pass


@app.websocket("/ws/feed")
async def ws_feed(websocket: WebSocket) -> None:
    await _browser_stream(websocket, "/ws/feed")


@app.websocket("/ws/live")
async def ws_live(websocket: WebSocket) -> None:
    await _browser_stream(websocket, "/ws/live")


@app.websocket("/ws/trade")
async def ws_trade(websocket: WebSocket) -> None:
    await _browser_stream(websocket, "/ws/trade")
