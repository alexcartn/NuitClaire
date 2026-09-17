"""Modeles de reponse Pydantic -- contrat JSON camelCase pour le frontend
mobile, traduit depuis les dicts internes (cles francaises, voir `rows.py`)
par les routers. Les modeles documentent/valident la forme ; la traduction
elle-meme vit dans chaque router, au plus pres des donnees qu'il assemble."""
from pydantic import BaseModel


class SiteOut(BaseModel):
    name: str
    lat: float
    lon: float
    elevationM: float
    tz: str


class SettingsOut(BaseModel):
    site: SiteOut
    windowMode: str
    alerts: dict[str, bool]


class SiteUpdate(BaseModel):
    name: str
    lat: float
    lon: float


class SettingsUpdate(BaseModel):
    site: SiteUpdate | None = None
    windowMode: str | None = None
    alerts: dict[str, bool] | None = None


class GeocodeRequest(BaseModel):
    address: str


class GeocodeResult(BaseModel):
    lat: float
    lon: float
    displayName: str


class HorizonUpdate(BaseModel):
    sector: str
    open: bool


class MessierCaptureUpdate(BaseModel):
    captured: bool


class StateOut(BaseModel):
    site: SiteOut
    horizon: dict[str, bool]
    windowMode: str
    messierCaptured: list[str]


class HourlyPoint(BaseModel):
    time: str
    score: float
    cloudCoverPct: float | None
    windGustsKmh: float | None
    temperatureC: float | None
    dewPointC: float | None


class CloudTrendOut(BaseModel):
    direction: str
    label: str
    nowPct: float
    futurePct: float
    delta: float


class NightOut(BaseModel):
    date: str
    civilDusk: str
    civilDawn: str
    nauticalDusk: str
    nauticalDawn: str
    astroDusk: str
    astroDawn: str
    score: float
    scorePct: int
    scoreLabel: str
    goHours: int
    bestWindow: str | None
    moonIllum: float
    moonWaxing: bool
    moonSizeArcmin: float
    dewSpread: float | None
    dewRisk: str
    dewAdvice: str
    windGustsKmh: float | None
    windQuality: float
    cloudTrend: CloudTrendOut | None
    hourly: list[HourlyPoint]


class TargetRowOut(BaseModel):
    designation: str
    isMessier: bool
    messierId: str | None
    commonName: str
    ngc: str | None
    type: str
    typeCode: str
    filter: str
    start: str | None
    end: str | None
    hours: float
    altMaxDeg: float
    moonSepDeg: float
    cadrage: str
    imageUrl: str
    ra: float
    dec: float
    mag: float | None
    sizeW: float | None
    sizeH: float | None
    reasons: list[str]
    feasibleTonight: bool | None = None


class AltitudePoint(BaseModel):
    time: str
    alt: float
    az: float
    sector: str
    moonSep: float


class TargetDetailOut(TargetRowOut):
    altitudeSeries: list[AltitudePoint]
    peakSector: str
    peakAz: float
    peakTime: str
    exposureLowMin: int
    exposureHighMin: int
    wiki: dict | None


class SessionItemOut(BaseModel):
    designation: str
    addedAt: str
    done: bool
    note: str


class CurrentSessionOut(BaseModel):
    openedAt: str | None
    scoreAtOpen: int | None
    items: list[SessionItemOut]


class PastSessionOut(BaseModel):
    date: str
    score: int | None
    targets: list[str]
    note: str
    closedAt: str


class SessionsOut(BaseModel):
    current: CurrentSessionOut
    past: list[PastSessionOut]


class AddSessionItem(BaseModel):
    designation: str


class UpdateSessionItem(BaseModel):
    done: bool | None = None
    note: str | None = None


class UpdatePastSession(BaseModel):
    note: str
