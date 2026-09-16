from __future__ import annotations

import asyncio
import json
import os
import signal
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from typing import Any

import websockets


CLOUD_WS = os.getenv("ATLAS_CLOUD_GATEWAY_WS", "").rstrip("/")
AGENT_TOKEN = os.getenv("ATLAS_CLOUD_AGENT_TOKEN", "").strip()
AGENT_ID = os.getenv("ATLAS_CLOUD_AGENT_ID", "atlas-lab-01").strip()

LOCAL_HTTP = os.getenv(
    "ATLAS_LOCAL_HTTP",
    "http://127.0.0.1:8000"
).rstrip("/")

LOCAL_WS = os.getenv(
    "ATLAS_LOCAL_WS",
    "ws://127.0.0.1:8000"
).rstrip("/")

RECONNECT_SECONDS = float(
    os.getenv("ATLAS_CLOUD_RECONNECT_SECONDS", "5")
)

MAX_BODY_BYTES = int(
    os.getenv(
        "ATLAS_CLOUD_MAX_BODY_BYTES",
        "2097152"
    )
)


@dataclass
class Runtime:
    cloud: Any | None = None
    send_lock: asyncio.Lock = field(
        default_factory=asyncio.Lock
    )
    stop: asyncio.Event = field(
        default_factory=asyncio.Event
    )


runtime = Runtime()


async def cloud_send(payload: dict[str, Any]) -> None:
    if runtime.cloud is None:
        return

    async with runtime.send_lock:
        await runtime.cloud.send(
            json.dumps(
                payload,
                separators=(",", ":")
            )
        )


def local_http_request(message: dict[str, Any]) -> dict[str, Any]:
    method = str(
        message.get("method", "GET")
    ).upper()

    path = str(
        message.get("path", "/")
    )

    query = str(
        message.get("query", "")
    )

    url = (
        LOCAL_HTTP +
        path +
        (f"?{query}" if query else "")
    )

    body = None

    if message.get("body"):
        body = str(
            message["body"]
        ).encode("utf-8")


    request = urllib.request.Request(
        url=url,
        data=body,
        method=method
    )


    try:
        with urllib.request.urlopen(
            request,
            timeout=15
        ) as response:

            data = response.read(
                MAX_BODY_BYTES
            )

            return {
                "status": response.status,
                "headers": {
                    "content-type":
                    response.headers.get(
                        "content-type",
                        "application/json"
                    )
                },
                "body": data.decode(
                    "utf-8",
                    errors="replace"
                )
            }


    except urllib.error.HTTPError as exc:

        return {
            "status": exc.code,
            "headers": {
                "content-type":
                "application/json"
            },
            "body": exc.read().decode(
                "utf-8",
                errors="replace"
            )
        }


    except Exception as exc:

        return {
            "status": 502,
            "headers": {
                "content-type":
                "application/json"
            },
            "body": json.dumps(
                {
                    "detail":
                    f"ATLAS local error: {type(exc).__name__}"
                }
            )
        }



async def handle_rpc(
    message: dict[str, Any]
):

    result = await asyncio.to_thread(
        local_http_request,
        message
    )

    await cloud_send(
        {
            "type": "rpc_response",
            "request_id":
                message.get("request_id"),
            **result
        }
    )



async def connect_cloud():

    if not CLOUD_WS or not AGENT_TOKEN:
        raise RuntimeError(
            "ATLAS_CLOUD_GATEWAY_WS and "
            "ATLAS_CLOUD_AGENT_TOKEN required"
        )


    headers = {
        "X-ATLAS-Agent-Token":
            AGENT_TOKEN,

        "X-ATLAS-Agent-Id":
            AGENT_ID
    }


    async with websockets.connect(
        CLOUD_WS + "/cloud/agent",
        additional_headers=headers,
        ping_interval=20,
        ping_timeout=20
    ) as ws:

        runtime.cloud = ws

        print(
            "ATLAS CLOUD AGENT CONNECTED"
        )


        async for raw in ws:

            message = json.loads(raw)

            kind = message.get(
                "type"
            )


            if kind == "hello":
                print(message)
                continue


            if kind == "rpc_request":

                asyncio.create_task(
                    handle_rpc(message)
                )



async def main():

    while not runtime.stop.is_set():

        try:

            await connect_cloud()


        except Exception as exc:

            runtime.cloud = None

            print(
                "RECONNECT:",
                exc
            )


            await asyncio.sleep(
                RECONNECT_SECONDS
            )



if __name__ == "__main__":

    asyncio.run(
        main()
    )