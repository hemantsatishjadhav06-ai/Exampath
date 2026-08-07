"""Typed schema for the dataset (used for API typing / optional validation)."""
from __future__ import annotations
from typing import List, Optional

from pydantic import BaseModel


class Body(BaseModel):
    slug: str
    name: str
    short: str
    level: str
    color: str = "#1d4ed8"
    official_url: Optional[str] = None


class Stage(BaseModel):
    name: str
    date: Optional[str] = None
    done: bool = False


class KeyDate(BaseModel):
    label: str
    date: str
    is_deadline: bool = False


class VacancyYear(BaseModel):
    year: int
    seats: int


class Cutoff(BaseModel):
    category: str
    marks: float


class Link(BaseModel):
    label: str
    url: str
    kind: str = "Website"


class Update(BaseModel):
    text: str
    kind: str = "info"
    when: str = ""


class Cycle(BaseModel):
    id: str
    body: str
    exam: str
    title: str
    qualification: str
    qualification_code: str
    status: str
    vacancy: int
    age_min: int
    age_max: int
    summary: str = ""
    posts: str = ""
    stages: List[Stage] = []
    dates: List[KeyDate] = []
    selection: List[str] = []
    vacancy_history: List[VacancyYear] = []
    cutoffs: List[Cutoff] = []
    links: List[Link] = []
    updates: List[Update] = []
    related: List[str] = []


class Dataset(BaseModel):
    generated_at: str
    source: str = "exampath-pipeline"
    bodies: List[Body]
    cycles: List[Cycle]
