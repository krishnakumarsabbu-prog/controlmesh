from pydantic import BaseModel


class Application(BaseModel):
    id: str
    name: str
