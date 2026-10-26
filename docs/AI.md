# AI in ARYV — what runs, and where to connect more

## The rule everything here follows

**Never present a computed guess as a measurement.** Every service below either
answers from real data or returns `null`, and every screen renders nothing when
it gets `null`.

That rule exists because the app previously broke it in the most expensive way
available: a client-side pricing model derived a "final price" from a demand
score, a congestion score, a weather condition and a toll-road flag — each
partly or wholly `Math.random()` — and showed it to passengers as the price.
Two people opening the same ride at the same moment could be quoted figures
differing by half again. The server meanwhile charged the driver's actual fare,
so the number displayed was never the number billed.

A blank panel costs a little polish. A fabricated one costs trust, and in the
pricing case it cost correctness.

## What is live now

All of it is deterministic and reads from PostGIS. None of it needs a model
server.

| Feature | Endpoint | Source of truth |
|---|---|---|
| Price suggestion | `GET /api/rides/price-suggestion` | Median seat price of completed rides on the same route, same tier, last 180 days |
| Demand | `GET /api/rides/demand` | Seats booked vs seats offered on upcoming rides nearby, plus bookings by hour over 60 days |
| Recommendations | `GET /api/rides/recommendations` | The user's own completed bookings, grouped into repeated routes |
| Matching | `GET /api/ride-requests/:id/matches` | Real rides, ranked by PostGIS distance from the request's endpoints |
| Surge | `GET /api/rides/surge` | The dated `surge_periods` calendar |
| Traffic | included in `/api/rides/demand` | Google Distance Matrix, `duration_in_traffic` vs `duration` |

### Price suggestion is advice, not a fare

It goes to the **driver** while they are setting a price, and returns `null`
when fewer than four comparable rides exist. It never changes what a passenger
is charged. ARYV is carpooling: the driver names the fare and the server charges
exactly that, which is what keeps the displayed and billed price identical.

### Surge is a calendar, not an inference

`surge_periods` holds dated, named windows — "Christmas 2026", 1.5× — seeded
with Botswana public holidays through 2027. A multiplier is auditable before it
applies rather than after a complaint, and it is always shown with its name so
a driver can explain it.

It raises the **suggested** price and is labelled where a passenger can see it.
It does not silently alter the charge.

```sql
-- Add a period
INSERT INTO surge_periods (name, starts_at, ends_at, multiplier)
VALUES ('Maun festival 2027', '2027-04-15 12:00+02', '2027-04-18 23:59+02', 1.4);

-- Confine it to one area
UPDATE surge_periods
   SET centre = ST_SetSRID(ST_MakePoint(23.42, -19.99), 4326),
       radius_metres = 50000
 WHERE name = 'Maun festival 2027';

-- Switch one off without deleting the record
UPDATE surge_periods SET is_active = FALSE WHERE name = 'Maun festival 2027';
```

Overlapping periods take the **highest**, not the product. A single period is
capped at 3.0 by the database and the combined effect at 2.0 in code.

## Connecting more

### 1. Traffic — configured, needs no code

Already implemented in `TrafficService`. It needs only a key with the
**Distance Matrix API** enabled:

```bash
railway variables --service aryv-platform --set 'GOOGLE_MAPS_API_KEY=<key>'
```

Without it, `traffic` comes back `null` and the panel is hidden. With it, the
congestion level is the ratio of `duration_in_traffic` to free-flow `duration` —
the real signal, not a model of one.

> Restrict the key by API and by referrer/package in the Google console. An
> unrestricted Maps key is billed per call by whoever finds it.

### 2. Weather — v2, contract already fixed

`WeatherService` returns `null` by design and documents the shape v2 should
fill. To implement:

1. Pick a provider with Botswana coverage. **Open-Meteo** needs no key and has
   no free-tier cap, which suits an advisory panel.
2. Set `WEATHER_API_URL` (and `WEATHER_API_KEY` if required).
3. Implement `forLocation` and map onto `WeatherConditions`.
4. Cache per location per hour — otherwise every ride search hits a third party.
5. Keep the null-on-failure behaviour.

Weather must **not** feed pricing. It is information for the people travelling.

### 3. A real ML service — only when there is data to learn from

`PredictiveAIService` used to proxy to a Python model at `AI_SERVICE_URL`
(`localhost:5001`), which was never deployed; its fallback returned the constant
`10` at confidence `0.3`, and the router exposing it was never mounted. It has
been removed rather than left dangling.

Before rebuilding anything like it, be honest about the prerequisite: a model
needs history. With a few thousand completed rides the SQL above will outperform
a model trained on the same data, and it is explainable to a driver who asks why.

When the volume is there, the useful targets in rough order:

1. **Demand forecasting** — predict seats wanted per corridor per hour, from
   `bookings` joined to `rides`. Better than the current snapshot because it
   anticipates rather than reports.
2. **Cancellation risk** — flag bookings likely to fall through, so a driver can
   hold a seat back. `bookings.status` history is already the label.
3. **Dynamic surge** — replace the hand-maintained calendar once forecasting is
   trustworthy. Keep it advisory and keep the reason string; an unexplained
   multiplier is the thing to avoid, not an automatic one.

Wire a service in as its own module behind an interface that can return `null`,
exactly as `WeatherService` does, and mount its router in `src/index.ts`. The
previous attempt failed on that last step — the routes existed and were never
mounted, so nothing could reach them.

### 4. An LLM, if you want one

Nothing in the app calls one today. The places where one would genuinely help:

- **Support triage** — classify and draft replies to disputes in
  `delivery_disputes`, for a human to send.
- **Free-text search** — turn "Gabs to Francistown Friday morning" into search
  parameters.
- **Document checks** — a first pass over driver documents before a human
  reviews. Never the final decision on someone's livelihood.

Use the Anthropic API with `claude-sonnet-5` for throughput or `claude-opus-5`
where judgement matters. Keep the key server-side — the mobile app must never
hold one — and treat output as a draft for a person to approve, not as an action.

## Where the code is

```
backend/src/services/
  PriceSuggestionService.ts   fare advice from comparable completed rides
  SurgeService.ts             dated multipliers from surge_periods
  DemandService.ts            seats wanted vs offered, hourly pattern
  RideRecommendationService.ts  repeated routes from real bookings
  TrafficService.ts           Google Distance Matrix
  WeatherService.ts           v2 placeholder, returns null

mobile-app/src/services/
  PriceSuggestionService.ts   client for the endpoint above
  DemandService.ts            client
  RideRecommendationService.ts  client
  AIMatchingService.ts        compatibility scoring over real search results
```

Tests worth reading before changing any of it, because they encode the
reasoning: `PriceSuggestionService.test.ts` and `SurgeService.test.ts`.
