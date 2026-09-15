# Seestar Planner — "Noctar-style" features design

Date: 2026-09-15
Status: Approved, moving to implementation planning

## Context

The Seestar Planner is a Streamlit dashboard for planning Seestar S50 astrophotography
sessions from a fixed site. It currently:
- Pulls hourly weather (Open-Meteo / AROME) and seeing/transparency (7Timer)
- Computes ephemerides (sun/moon/target alt-az) via PyEphem
- Scores each hour go/no-go with a weighted formula (clouds, moon, wind, dew, seeing/transparency)
- Lists which of 18 hardcoded targets are feasible for a selected night, with FOV/mosaic hints

The user (an astrophotography hobbyist observing from home) wants the app redesigned around
a quick "is it worth going out" score, direction/horizon-aware target picking, a Messier
completion tracker, and a cleaner, minimalist French UI — inspired by (but not copying) a
third-party app called Noctar shown as a reference screenshot.

## Goals

1. Single glanceable **astro score** (0–100, French label) for "right now" and the best
   upcoming window tonight.
2. **24h time format** and **full French UI** throughout.
3. Default viewing window of **20:00–22:30**, toggleable to full night, with twilight times
   (civil/nautical/astronomical) surfaced clearly.
4. **Location** configurable via address text input, auto-geocoded (Nominatim), defaulting to
   the user's home (7 rue Saint Jean, 51240 Marson, France).
5. **Horizon/direction** configuration: 8 compass sectors, open/blocked, factored into target
   feasibility alongside altitude.
6. **Broader target catalog** (OpenNGC-derived, filtered for Seestar S50 feasibility) driving
   the main "best targets tonight" list — not limited to Messier objects.
7. **Messier completion tracker** as a separate tab: all 110 Messier objects, tonight's
   feasibility, checkbox to mark captured, persisted locally, with a completion counter.
8. **Cloud cover trend graph** with a one-line French summary.
9. **Dew point / spread** with an explicit anti-dew-heater recommendation.
10. General UI cleanup: card-based sections via custom CSS in Streamlit (not a framework switch).

## Non-goals (explicitly out of scope for this pass)

- Aerosols, jet stream speed, Antoniadi/Pickering seeing scales, aurora/KP index — rejected as
  visual noise; current seeing/transparency (7Timer) is enough.
- Multi-site comparison ("which of your spots wins tonight") — not requested.
- Moving off Streamlit to a custom web frontend — deferred; Streamlit + CSS is enough for a
  proof of concept.
- Precise per-degree horizon profiling — 8-sector open/blocked is enough precision.
- User accounts / cloud sync for Messier progress — local file only.

## Architecture

### Config & persistence
- `config.py`: keep `SITE` (now geocoded for Marson) and `SEESTAR` as defaults. Add `HORIZON`
  (dict of the 8 compass sectors → bool open/blocked) and `VIEW_WINDOW` (default 20:00–22:30).
- New `progress.py`: reads/writes a local `data/progress.json` holding:
  - `horizon` overrides (if the user changes sectors in the sidebar, persist them)
  - `messier_captured`: list of captured Messier IDs
  - Session-only location override (address/lat/lon) is **not** persisted unless the user
    explicitly saves it as the new default — avoids silently overwriting home coordinates from
    a one-off lookup.
- New `geocode.py`: thin wrapper around Nominatim's free geocoding endpoint (address → lat/lon),
  with a timeout and a clear error message in French if the lookup fails (falls back to the
  last known-good location).

### Astro score
- `scoring.py` keeps the existing weighted formula. Add a `score_label_fr(score)` helper
  mapping the 0–1 score to a 0–100 display value and a French bucket label
  (≥0.70 "Bonnes conditions", 0.40–0.69 "Conditions moyennes", <0.40 "Mauvaises conditions").
- `night_summary` gains the best-window text (contiguous run of hours ≥0.6, formatted as
  "HH:MM–HH:MM" in 24h).

### Twilight & viewing window
- `astro.py` already computes sun altitude; add a `twilight_times(date)` returning civil,
  nautical, and astronomical dusk/dawn as datetimes (threshold crossings at -6°/-12°/-18°).
- `app.py` sidebar gets a toggle: "Fenêtre habituelle (20:00–22:30)" vs "Nuit complète" — this
  slices the dataframe used for score display and target feasibility, not the underlying data
  fetch (we still fetch/compute the whole night so toggling is instant).

### Horizon/direction-aware targets
- `astro.py` `target_altaz` already returns azimuth; `scoring.py` `target_windows` gains an
  azimuth→compass-sector lookup (8 sectors of 45°) and filters out hours whose sector is
  blocked in `HORIZON` (merged with any `progress.json` override).

### Catalog
- New `data/ngc_seestar.csv`: a trimmed OpenNGC export (name, common name, type, RA, Dec,
  major/minor axis arcmin, magnitude) filtered at build time to objects plausibly imageable
  with a Seestar S50 (magnitude and size cutoffs to be tuned during implementation).
- New `data/messier.csv`: all 110 Messier objects with the same columns, always included
  regardless of the magnitude/size cutoff (completion tracking shouldn't silently drop targets).
- `catalog.py` becomes a loader (`load_targets()`, `load_messier()`) reading these CSVs instead
  of the hardcoded Python list.

### UI (`app.py`)
- Two tabs: **"Ce soir"** (current dashboard: score, clouds, dew, moon, cloud trend, target
  table using the broad catalog) and **"Catalogue Messier"** (110-row table: feasible tonight
  y/n, captured checkbox, progress counter "x/110").
- Custom CSS block injected once via `st.markdown(..., unsafe_allow_html=True)` for card-style
  sections replacing raw `st.metric`/`st.dataframe` blocks for score/clouds/dew/moon.
- All labels/copy in French; all times formatted 24h (`%H:%M`).
- Sidebar: address input (geocoded on change), horizon sector toggles, viewing-window toggle.

## Data flow (unchanged shape, extended fields)

```
weather.fetch_all() ──┐
astro.sky_frame() ────┼──> join on hourly index ──> scoring.score_frame() ──> df with score
astro.twilight_times()┘                                                        + az/alt cols
                                                                                     │
catalog.load_targets()/load_messier() ──> scoring.target_windows(df, target, horizon) ──> feasible windows
```

## Error handling

- Geocoding failure: show a French warning, keep using the last valid location (session state),
  don't crash the page.
- 7Timer failure: already handled (falls back to neutral seeing/transparency) — unchanged.
- Empty feasible-target list (bad weather / all directions blocked / no Messier objects up):
  show an explicit French message per tab, not a blank table.

## Testing approach

- Unit tests for pure functions: `score_label_fr`, azimuth→sector mapping, horizon filtering,
  twilight threshold crossing, CSV loaders (schema/row-count sanity).
- Manual verification in the running Streamlit app for the visual/UX pieces (cards, tabs,
  French copy, 24h formatting) — no automated UI testing for this proof of concept.

## Open items to resolve during implementation planning

- Exact magnitude/size cutoffs for the OpenNGC filter (needs a first pass + eyeballing against
  the current 18-target list to sanity check).
- Where to source the trimmed OpenNGC CSV (OpenNGC GitHub export) and how to regenerate it.
