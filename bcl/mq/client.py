import httpx
import structlog
from typing import Optional
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

log = structlog.get_logger()


class MQError(Exception):
    def __init__(self, operation: str, status_code: int, detail: str):
        self.operation = operation
        self.status_code = status_code
        self.detail = detail
        super().__init__(f"MQ {operation} failed ({status_code}): {detail}")


class MQRestClient:
    def __init__(self, base_url: str, username: str, password: str):
        self.base_url = base_url.rstrip("/")
        self.auth = (username, password)
        self._client: Optional[httpx.AsyncClient] = None

    @property
    def client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                verify=False,
                timeout=httpx.Timeout(connect=5.0, read=30.0, write=10.0, pool=5.0),
                limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
            )
        return self._client

    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    def _csrf_headers(self, content_type: str = "application/json") -> dict:
        return {
            "ibm-mq-rest-csrf-token": "blank",
            "Content-Type": content_type,
        }

    def _map_mq_error(self, r: httpx.Response, operation: str) -> MQError:
        try:
            body = r.json()
            detail = body.get("error", [{}])[0].get("message", r.text)
        except Exception:
            detail = r.text
        return MQError(operation, r.status_code, detail)

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        retry=retry_if_exception_type(httpx.TransportError),
    )
    async def get_qmgr_status(self) -> dict:
        r = await self.client.get(
            f"{self.base_url}/ibmmq/rest/v2/admin/qmgr",
            auth=self.auth,
        )
        if not r.is_success:
            raise self._map_mq_error(r, "GET_QMGR_STATUS")
        return r.json()

    async def list_queues(self, qmgr: str, name_pattern: str = "*") -> list:
        r = await self.client.get(
            f"{self.base_url}/ibmmq/rest/v2/admin/qmgr/{qmgr}/queue",
            auth=self.auth,
            params={"name": name_pattern},
        )
        if not r.is_success:
            raise self._map_mq_error(r, "LIST_QUEUES")
        return r.json().get("queue", [])

    async def create_queue(self, qmgr: str, name: str, props: dict) -> dict:
        r = await self.client.post(
            f"{self.base_url}/ibmmq/rest/v2/admin/qmgr/{qmgr}/queue",
            json={"name": name, **props},
            auth=self.auth,
            headers=self._csrf_headers(),
        )
        if not r.is_success:
            raise self._map_mq_error(r, "CREATE_QUEUE")
        log.info("mq_create_queue", qmgr=qmgr, name=name)
        return r.json() if r.content else {"name": name, "status": "created"}

    async def get_queue(self, qmgr: str, name: str,
                        include_status: bool = False) -> Optional[dict]:
        params = {"status": "status"} if include_status else {}
        r = await self.client.get(
            f"{self.base_url}/ibmmq/rest/v2/admin/qmgr/{qmgr}/queue/{name}",
            auth=self.auth,
            params=params,
        )
        if r.status_code == 404:
            return None
        if not r.is_success:
            raise self._map_mq_error(r, "GET_QUEUE")
        queues = r.json().get("queue", [])
        return queues[0] if queues else None

    async def delete_queue(self, qmgr: str, name: str) -> None:
        r = await self.client.delete(
            f"{self.base_url}/ibmmq/rest/v2/admin/qmgr/{qmgr}/queue/{name}",
            auth=self.auth,
            headers=self._csrf_headers(),
        )
        if r.status_code == 404:
            return
        if not r.is_success:
            raise self._map_mq_error(r, "DELETE_QUEUE")
        log.info("mq_delete_queue", qmgr=qmgr, name=name)

    async def create_channel(self, qmgr: str, name: str, props: dict) -> dict:
        r = await self.client.post(
            f"{self.base_url}/ibmmq/rest/v2/admin/qmgr/{qmgr}/channel",
            json={"name": name, **props},
            auth=self.auth,
            headers=self._csrf_headers(),
        )
        if not r.is_success:
            raise self._map_mq_error(r, "CREATE_CHANNEL")
        log.info("mq_create_channel", qmgr=qmgr, name=name)
        return r.json() if r.content else {"name": name, "status": "created"}

    async def list_channels(self, qmgr: str) -> list:
        r = await self.client.get(
            f"{self.base_url}/ibmmq/rest/v2/admin/qmgr/{qmgr}/channel",
            auth=self.auth,
        )
        if not r.is_success:
            raise self._map_mq_error(r, "LIST_CHANNELS")
        return r.json().get("channel", [])

    async def delete_channel(self, qmgr: str, name: str) -> None:
        r = await self.client.delete(
            f"{self.base_url}/ibmmq/rest/v2/admin/qmgr/{qmgr}/channel/{name}",
            auth=self.auth,
            headers=self._csrf_headers(),
        )
        if r.status_code == 404:
            return
        if not r.is_success:
            raise self._map_mq_error(r, "DELETE_CHANNEL")
        log.info("mq_delete_channel", qmgr=qmgr, name=name)

    async def get_channel_status(self, qmgr: str, channel: str) -> str:
        r = await self.client.get(
            f"{self.base_url}/ibmmq/rest/v2/admin/qmgr/{qmgr}/channel/{channel}",
            auth=self.auth,
            params={"status": "status"},
        )
        if r.status_code == 404:
            return "NOT_FOUND"
        if not r.is_success:
            return "ERROR"
        channels = r.json().get("channel", [])
        if not channels:
            return "NOT_FOUND"
        return channels[0].get("status", {}).get("status", "UNKNOWN")

    async def put_message(
        self,
        qmgr: str,
        queue: str,
        body: str,
        correlation_id: Optional[str] = None,
    ) -> str:
        headers = self._csrf_headers("text/plain")
        if correlation_id:
            headers["ibm-mq-md-correlId"] = correlation_id
        r = await self.client.post(
            f"{self.base_url}/ibmmq/rest/v1/messaging/qmgr/{qmgr}/queue/{queue}/message",
            content=body.encode("utf-8"),
            auth=self.auth,
            headers=headers,
        )
        if not r.is_success:
            raise self._map_mq_error(r, "PUT_MESSAGE")
        return r.headers.get("ibm-mq-md-msgId", "")

    async def get_message(
        self,
        qmgr: str,
        queue: str,
        correlation_id: Optional[str] = None,
        wait_interval_ms: int = 500,
    ) -> Optional[str]:
        headers = self._csrf_headers()
        headers["ibm-mq-rest-msgId"] = "any"
        if correlation_id:
            headers["ibm-mq-md-correlId"] = correlation_id
        r = await self.client.delete(
            f"{self.base_url}/ibmmq/rest/v1/messaging/qmgr/{qmgr}/queue/{queue}/message",
            auth=self.auth,
            headers=headers,
            params={"wait": wait_interval_ms},
        )
        if r.status_code == 204:
            return None
        if not r.is_success:
            raise self._map_mq_error(r, "GET_MESSAGE")
        return r.text

    async def get_queue_depth(self, qmgr: str, queue: str) -> int:
        q = await self.get_queue(qmgr, queue, include_status=True)
        if q is None:
            return -1
        return q.get("status", {}).get("currentDepth", 0)
