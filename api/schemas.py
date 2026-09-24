"""Modeles de reponse Pydantic -- contrat JSON camelCase pour le frontend
mobile, traduit depuis les dicts internes (cles francaises, voir `rows.py`)
par les routers. Les modeles documentent/valident la forme ; la traduction
elle-meme vit dans chaque router, au plus pres des donnees qu'il assemble."""
from pydantic import BaseModel, Field


class SiteOut(BaseModel):
    name: str
    lat: float
    lon: float
    elevationM: float
    tz: str


class ViewWindowOut(BaseModel):
    startHour: float
    endHour: float


class SettingsOut(BaseModel):
    site: SiteOut
    windowMode: str
    viewWindow: ViewWindowOut
    alerts: dict[str, bool]


class SiteUpdate(BaseModel):
    name: str
    lat: float
    lon: float


class ViewWindowUpdate(BaseModel):
    startHour: float = Field(ge=0, le=24)
    endHour: float = Field(ge=0, le=24)


class SettingsUpdate(BaseModel):
    site: SiteUpdate | None = None
    windowMode: str | None = None
    viewWindow: ViewWindowUpdate | None = None
    alerts: dict[str, bool] | None = None


class GeocodeRequest(BaseModel):
    address: str


class ReverseGeocodeRequest(BaseModel):
    lat: float
    lon: float


class ReverseGeocodeResult(BaseModel):
    name: str


class GeocodeResult(BaseModel):
    lat: float
    lon: float
    displayName: str


class HorizonUpdate(BaseModel):
    sector: str
    open: bool


class MessierCaptureUpdate(BaseModel):
    captured: bool


class ExposureEntryOut(BaseModel):
    id: str
    minutes: int
    at: str


class AddExposure(BaseModel):
    minutes: int = Field(gt=0)


class StateOut(BaseModel):
    site: SiteOut
    horizon: dict[str, bool]
    windowMode: str
    viewWindow: ViewWindowOut
    messierCaptured: list[str]


class HourlyPoint(BaseModel):
    time: str
    score: float
    cloudCoverPct: float | None
    windGustsKmh: float | None
    temperatureC: float | None
    dewPointC: float | None
    # 1 (excellent) a 8 (mauvais), None quand 7Timer est indisponible. Exposes
    # pour que le journal puisse conserver, avec chaque note, ce que la
    # prevision annoncait a cette heure-la (voir l'en-tete de sessions.py).
    seeing: float | None = None
    transparency: float | None = None


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
    tempNowC: float | None
    tempMinC: float | None
    tempMaxC: float | None
    windGustsKmh: float | None
    windQuality: float
    cloudTrend: CloudTrendOut | None
    hourly: list[HourlyPoint]


class NightBriefOut(BaseModel):
    """Une nuit du bandeau « prochaines nuits ». `scorePct` est None quand la
    prevision ne couvre pas assez la nuit pour la noter : on le dit plutot
    que d'afficher un score calcule sur des trous."""
    date: str
    scorePct: int | None
    scoreLabel: str | None
    goHours: int | None
    bestWindow: str | None
    moonIllum: float
    astroDusk: str
    astroDawn: str


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


class TargetSuggestionOut(BaseModel):
    designation: str
    isMessier: bool
    messierId: str | None
    commonName: str
    type: str


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
    exposureLog: list[ExposureEntryOut]
    # Temps saisi ici meme (journal d'expo libre) et temps saisi par sortie
    # dans le journal de session : deux sources, un seul total.
    exposureFreeMin: int
    exposureSessionMin: int
    exposureTotalMin: int


class NoteContext(BaseModel):
    """Conditions annoncees a l'heure d'ecriture d'une note. Releve par le
    client dans la prevision de la nuit deja chargee -- donc disponible hors
    ligne -- et conserve tel quel : ce n'est pas une mesure, c'est ce que
    l'appli affichait a ce moment-la (voir l'en-tete de sessions.py)."""
    temperatureC: float | None = None
    cloudCoverPct: float | None = None
    seeing: float | None = None
    transparency: float | None = None
    score: float | None = None
    moonIllum: float | None = None


class NoteOut(BaseModel):
    id: str
    text: str
    at: str
    context: NoteContext | None = None


class TimelineEntryOut(BaseModel):
    id: str
    at: str
    text: str
    target: str | None
    context: NoteContext | None = None


class SessionItemOut(BaseModel):
    designation: str
    addedAt: str
    done: bool
    notes: list[NoteOut]
    exposureMin: int | None = None
    rating: int | None = None


class NightConditions(BaseModel):
    """Ce que la prevision annoncait sur la duree de la sortie, releve par le
    client a la cloture (voir l'en-tete de sessions.py). Resume, quand le
    `context` des notes donne le detail heure par heure."""
    tempMinC: float | None = None
    tempMaxC: float | None = None
    cloudAvgPct: float | None = None
    seeingAvg: float | None = None
    transparencyAvg: float | None = None
    dewSpreadC: float | None = None
    moonIllum: float | None = None


class OutingSite(BaseModel):
    """Lieu d'ou la sortie a ete faite, fige a son ouverture (voir l'en-tete
    de sessions.py). Absent des sorties anterieures a sa conservation."""
    name: str
    lat: float
    lon: float
    elevationM: float
    tz: str


class FeelingOut(BaseModel):
    rating: int | None = None
    skyQuality: int | None = None
    highlight: str = ""
    nextTime: str = ""


class CurrentSessionOut(BaseModel):
    openedAt: str | None
    scoreAtOpen: int | None
    siteAtOpen: OutingSite | None = None
    # Presentes seulement sur une sortie rouverte pour correction : ce sont
    # les siennes, et elles priment a la recloture (voir close_session).
    conditions: NightConditions | None = None
    items: list[SessionItemOut]
    freeNotes: list[NoteOut]
    timeline: list[TimelineEntryOut]
    feeling: FeelingOut


class PastSessionOut(BaseModel):
    date: str
    score: int | None
    site: OutingSite | None = None
    targets: list[str]
    note: str
    closedAt: str
    # Cibles de la sortie, dans leur detail (coches, temps de pose, note de
    # satisfaction, notes horodatees) : `targets` n'en donne que les noms, ce
    # qui ne suffit pas pour relire une nuit ni pour retrouver l'historique
    # d'une cible. Vide sur les sorties anterieures a leur conservation.
    items: list[SessionItemOut] = []
    timeline: list[TimelineEntryOut]
    feeling: FeelingOut
    conditions: NightConditions | None = None


class SessionsOut(BaseModel):
    current: CurrentSessionOut
    past: list[PastSessionOut]


class AddSessionItem(BaseModel):
    designation: str
    # Heure de saisie cote client. Une saisie faite hors ligne part quand le
    # reseau revient : sans elle, l'entree porterait l'heure de la
    # synchronisation, pas celle du geste (voir les routes de sessions).
    at: str | None = None


class UpdateSessionItem(BaseModel):
    done: bool | None = None
    exposureMin: int | None = None
    rating: int | None = Field(default=None, ge=1, le=5)


class UpdateFeeling(BaseModel):
    """Champs fournis seulement : un champ absent n'est pas modifie, un champ
    a null est efface."""
    rating: int | None = Field(default=None, ge=1, le=5)
    skyQuality: int | None = Field(default=None, ge=1, le=5)
    highlight: str | None = None
    nextTime: str | None = None


class AddNote(BaseModel):
    text: str
    at: str | None = None
    context: NoteContext | None = None


class CloseSession(BaseModel):
    at: str | None = None
    conditions: NightConditions | None = None


class UpdatePastSession(BaseModel):
    """Retouche d'une sortie cloturee. Seuls les champs presents sont
    modifies : `note` pour le resume, les champs de ressenti un par un (voir
    sessions.set_past_feeling), `site` pour corriger le lieu."""
    note: str | None = None
    site: OutingSite | None = None
    rating: int | None = Field(default=None, ge=1, le=5)
    skyQuality: int | None = Field(default=None, ge=1, le=5)
    highlight: str | None = None
    nextTime: str | None = None


class MonthCountOut(BaseModel):
    month: str
    count: int


class TargetExposureOut(BaseModel):
    designation: str
    totalMin: int


class SiteCountOut(BaseModel):
    name: str
    count: int
    lastDate: str


class StatsOut(BaseModel):
    totalOutings: int
    avgRating: float | None = None
    ratedOutings: int = 0
    outingsBySite: list[SiteCountOut] = []
    outingsByMonth: list[MonthCountOut]
    capturesByMonth: list[MonthCountOut]
    successfulOutings: int
    avgScoreSuccessful: float | None
    exposureByTarget: list[TargetExposureOut]
    totalExposureMin: int
