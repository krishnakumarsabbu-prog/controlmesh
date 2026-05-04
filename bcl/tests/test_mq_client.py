"""
Tests for MQRestClient using httpx mock transport.
Run: pytest bcl/tests/test_mq_client.py -v
"""
import json
import pytest
import httpx

from bcl.mq.client import MQRestClient


class MockTransport(httpx.AsyncBaseTransport):
    def __init__(self, responses: dict):
        self._responses = responses  # method:url -> (status, body)

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        key = f"{request.method}:{request.url}"
        for pattern, (status, body) in self._responses.items():
            method, url_fragment = pattern.split(":", 1)
            if request.method == method and url_fragment in str(request.url):
                return httpx.Response(
                    status,
                    content=json.dumps(body).encode() if body else b"",
                    headers={"Content-Type": "application/json"},
                )
        return httpx.Response(404, content=b'{"error": "not found"}')


@pytest.mark.asyncio
async def test_get_qmgr_status():
    mock_body = {"qmgr": [{"name": "QMSRCA", "state": {"value": "running"}}]}
    transport = MockTransport({
        "GET:ibmmq/rest/v2/admin/qmgr": (200, mock_body)
    })
    client = MQRestClient("https://localhost:9443", "admin", "pass")
    client._client = httpx.AsyncClient(transport=transport, verify=False)

    result = await client.get_qmgr_status()
    assert "qmgr" in result
    assert result["qmgr"][0]["name"] == "QMSRCA"


@pytest.mark.asyncio
async def test_list_queues():
    mock_body = {"queue": [{"name": "Q.PAY.IN.LOCAL"}, {"name": "Q.PAY.DEAD.DLQ"}]}
    transport = MockTransport({
        "GET:ibmmq/rest/v2/admin/qmgr/QMSRCA/queue": (200, mock_body)
    })
    client = MQRestClient("https://localhost:9443", "admin", "pass")
    client._client = httpx.AsyncClient(transport=transport, verify=False)

    result = await client.list_queues("QMSRCA")
    assert len(result["queue"]) == 2


@pytest.mark.asyncio
async def test_create_queue_success():
    transport = MockTransport({
        "POST:ibmmq/rest/v2/admin/qmgr/QMSRCA/queue": (201, {"name": "Q.NEW.QUEUE.LOCAL"})
    })
    client = MQRestClient("https://localhost:9443", "admin", "pass")
    client._client = httpx.AsyncClient(transport=transport, verify=False)

    result = await client.create_queue("QMSRCA", "Q.NEW.QUEUE.LOCAL", {"type": "local"})
    assert result["name"] == "Q.NEW.QUEUE.LOCAL"


@pytest.mark.asyncio
async def test_create_queue_mq_error():
    transport = MockTransport({
        "POST:ibmmq/rest/v2/admin/qmgr/QMSRCA/queue": (400, {"error": [{"message": "bad request"}]})
    })
    client = MQRestClient("https://localhost:9443", "admin", "pass")
    client._client = httpx.AsyncClient(transport=transport, verify=False)

    with pytest.raises(httpx.HTTPStatusError):
        await client.create_queue("QMSRCA", "bad_name", {})
