import { test } from "node:test";
import assert from "node:assert/strict";
import { agendaWeeks, firstBusyDay } from "./agendaView.ts";
import type { SkyEvent } from "./types";

const ev = (date: string, title: string) =>
  ({ date, title, kind: "planete", detail: "", visible: true, objects: [] }) as SkyEvent;

test("des semaines du lundi, les evenements au jour du lieu", () => {
  // Lundi 28 septembre 2026.
  const weeks = agendaWeeks(
    [ev("2026-10-04T00:00:00+02:00", "Opposition de Saturne"), ev("2026-10-05T07:00:00+02:00", "Lune et Mars"),
     ev("2026-09-27T20:00:00+02:00", "Hier")],
    new Date(2026, 8, 30, 21, 0),
  );
  assert.equal(weeks.length, 5);
  assert.equal(weeks[0][0].date, "2026-09-28");
  assert.equal(weeks[0][0].past, true);
  assert.equal(weeks[0][2].today, true);
  assert.deepEqual(weeks[0][6].events.map((e) => e.title), ["Opposition de Saturne"]);
  assert.equal(weeks[1][0].date, "2026-10-05");
  assert.equal(firstBusyDay(weeks), "2026-10-04");
});
