import httpx
import structlog
from typing import Optional

log = structlog.get_logger()


class MQRestClient:
    def __init__(self, base_url: str, username: str, password: str):
        self.base_url = base_url.rstrip("/")
        self.auth = (username, password)
        self._client: Optional[httpx.AsyncClient] = None

    def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(verify=False, timeout=30.0)
        return self._client

    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    async def get_qmgr_status(self) -> dict:
        r = await self._get_client().get(
            f"{self.base_url}/ibmmq/rest/v2/admin/qmgr",
            auth=self.auth,
        )
        r.raise_for_status()
        return r.json()

    async def list_queues(self, qmgr: str) -> dict:
        r = await self._get_client().get(
            f"{self.base_url}/ibmmq/rest/v2/admin/qmgr/{qmgr}/queue",
            auth=self.auth,
        )
        r.raise_for_status()
        return r.json()

    async def list_channels(self, qmgr: str) -> dict:
        r = await self._get_client().get(
            f"{self.base_url}/ibmmq/rest/v2/admin/qmgr/{qmgr}/channel",
            auth=self.auth,
        )
        r.raise_for_status()
        return r.json()

    async def create_queue(self, qmgr: str, name: str, props: dict) -> dict:
        payload = {"name": name, **props}
        r = await self._get_client().post(
            f"{self.base_url}/ibmmq/rest/v2/admin/qmgr/{qmgr}/queue",
            json=payload,
            auth=self.auth,
            headers={
                "Content-Type": "application/json",
                "ibm-mq-rest-csrf-token": "blank",
            },
        )
        r.raise_for_status()
        log.info("mq_create_queue", qmgr=qmgr, name=name, status=r.status_code)
        return r.json() if r.content else {"name": name, "qmgr": qmgr}

    async def create_channel(self, qmgr: str, name: str, props: dict) -> dict:
        payload = {"name": name, **props}
        r = await self._get_client().post(
            f"{self.base_url}/ibmmq/rest/v2/admin/qmgr/{qmgr}/channel",
            json=payload,
            auth=self.auth,
            headers={"ibm-mq-rest-csrf-token": "blank"},
        )
        r.raise_for_status()
        log.info("mq_create_channel", qmgr=qmgr, name=name, status=r.status_code)
        return r.json() if r.content else {"name": name, "qmgr": qmgr}

    async def delete_queue(self, qmgr: str, name: str) -> None:
        r = await self._get_client().delete(
            f"{self.base_url}/ibmmq/rest/v2/admin/qmgr/{qmgr}/queue/{name}",
            auth=self.auth,
            headers={"ibm-mq-rest-csrf-token": "blank"},
        )
        r.raise_for_status()
        log.info("mq_delete_queue", qmgr=qmgr, name=name)

    async def delete_channel(self, qmgr: str, name: str) -> None:
        r = await self._get_client().delete(
            f"{self.base_url}/ibmmq/rest/v2/admin/qmgr/{qmgr}/channel/{name}",
            auth=self.auth,
            headers={"ibm-mq-rest-csrf-token": "blank"},
        )
        r.raise_for_status()
        log.info("mq_delete_channel", qmgr=qmgr, name=name)

    async def put_message(
        self,
        qmgr: str,
        queue: str,
        body: str,
        correlation_id: Optional[str] = None,
    ) -> str:
        headers = {
            "Content-Type": "text/plain",
            "ibm-mq-rest-csrf-token": "blank",
        }
        if correlation_id:
            headers["ibm-mq-md-correlId"] = correlation_id
        r = await self._get_client().post(
            f"{self.base_url}/ibmmq/rest/v1/messaging/qmgr/{qmgr}/queue/{queue}/message",
            content=body.encode(),
            auth=self.auth,
            headers=headers,
        )
        r.raise_for_status()
        return r.headers.get("ibm-mq-md-msgId", "")

    async def get_message(
        self,
        qmgr: str,
        queue: str,
        correlation_id: Optional[str] = None,
    ) -> Optional[str]:
        headers = {"ibm-mq-rest-csrf-token": "blank"}
        if correlation_id:
            headers["ibm-mq-md-correlId"] = correlation_id
        r = await self._get_client().delete(
            f"{self.base_url}/ibmmq/rest/v1/messaging/qmgr/{qmgr}/queue/{queue}/message",
            auth=self.auth,
            headers=headers,
        )
        if r.status_code == 204:
            return None
        r.raise_for_status()
        return r.text
