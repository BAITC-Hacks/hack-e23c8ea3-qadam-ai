import asyncio
import json
import logging
from unittest.mock import patch

import h11
from uvicorn.protocols.http.h11_impl import RequestResponseCycle

from app.main import app


class Transport:
    def __init__(self):
        self.output = []

    def is_closing(self):
        return False

    def write(self, data):
        self.output.append(data)

    def close(self):
        pass


class Flow:
    write_paused = False

    def resume_reading(self):
        pass


class Recorder(logging.Handler):
    def __init__(self):
        super().__init__()
        self.output = []

    def emit(self, record):
        self.output.append(self.format(record))


async def main():
    scope = {
        "type": "http",
        "asgi": {"version": "3.0", "spec_version": "2.3"},
        "http_version": "1.1",
        "method": "POST",
        "scheme": "http",
        "path": "/api/constructor/analyze",
        "raw_path": b"/api/constructor/analyze",
        "root_path": "",
        "query_string": b"",
        "headers": [(b"content-type", b"application/json")],
        "client": ("127.0.0.1", 12345),
        "server": ("127.0.0.1", 8000),
    }
    logger = logging.getLogger("qadam.audit.uvicorn")
    logger.propagate = False
    logger.setLevel(logging.ERROR)
    recorder = Recorder()
    logger.addHandler(recorder)
    conn = h11.Connection(h11.SERVER)
    conn.receive_data(
        b"POST /api/constructor/analyze HTTP/1.1\r\nHost: localhost\r\nContent-Length: 2\r\n\r\n{}"
    )
    while not isinstance(conn.next_event(), h11.EndOfMessage):
        pass
    event = asyncio.Event()
    event.set()
    transport = Transport()
    cycle = RequestResponseCycle(
        scope=scope,
        conn=conn,
        transport=transport,
        flow=Flow(),
        logger=logger,
        access_logger=logger,
        access_log=False,
        default_headers=[],
        message_event=event,
        on_response=lambda: None,
    )
    cycle.body = json.dumps({"draft": "Нужен отчет по продажам"}).encode()
    cycle.more_body = False
    marker = "SYNTHETIC_AUDIT_PRIVATE_TEXT"
    with patch("app.services.constructor.analyze", side_effect=RuntimeError(marker)):
        await asyncio.wait_for(cycle.run_asgi(app), timeout=5)
    log = "\n".join(recorder.output)
    response = b"".join(transport.output)
    result = {
        "probe": "uvicorn_unexpected_exception_logging",
        "response_status": response.split(b"\r\n", 1)[0].decode(),
        "synthetic_sensitive_marker_in_uvicorn_log": marker in log,
        "contains_traceback": "Traceback" in log,
        "marker_in_http_response": marker.encode() in response,
    }
    print(json.dumps(result))


asyncio.run(main())
