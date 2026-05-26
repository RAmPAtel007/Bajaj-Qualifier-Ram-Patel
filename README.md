# DeskFlow

A small support-ticket triage board. Customers file tickets, agents move them across a four-column board, and the system tracks how long each ticket has been waiting and whether it has breached the response-time SLA tied to its priority.

Stack: **MongoDB · Express · React · Node** (MERN).

## Layout

```
backend/    Express API + Mongoose model + transition rules
frontend/   Vite + React board UI
```

## Backend

### Setup

```bash
cd backend
cp .env.example .env     # fill in MONGODB_URI
npm install
npm run dev
```

`.env` keys:

| key | purpose |
| --- | --- |
| `PORT` | HTTP port (default 4000) |
| `MONGODB_URI` | MongoDB connection string (Atlas works) |
| `CORS_ORIGIN` | allowed origin for browser requests (`*` for dev) |

### Endpoints

| method | path | notes |
| --- | --- | --- |
| `POST` | `/tickets` | Create. `status` is rejected — always starts at `open`. |
| `GET` | `/tickets` | List. Filters: `?status=`, `?priority=`, `?breached=true` (combinable). |
| `GET` | `/tickets/stats` | Counts by status & priority + number of breached open tickets. |
| `PATCH` | `/tickets/:id` | Update fields. Status changes are validated against the transition pipeline. |
| `DELETE` | `/tickets/:id` | Delete. `204` on success, `404` if already gone. |

### Transition pipeline

```
open → in_progress → resolved → closed
```

Forward moves are allowed one step at a time. Backward moves are allowed one step at a time (e.g. `resolved → in_progress`). Skipping (`open → resolved`) is rejected with a 400. Leaving `resolved` clears `resolvedAt`; entering `resolved` stamps it.

### Derived fields

Both fields are recomputed on every read — they are never persisted to the DB.

- `ageMinutes` — minutes between `createdAt` and "now", except for resolved/closed tickets where the upper bound is `resolvedAt` (so age stops growing once resolved).
- `slaBreached` — `true` if the relevant elapsed time exceeded the priority's target.

Targets per the spec:

| priority | target |
| --- | --- |
| urgent | 1 hour |
| high | 4 hours |
| medium | 24 hours |
| low | 72 hours |

### Dry-run tests

A self-contained integration script lives at `backend/test/dryrun.js`. It wipes the `tickets` collection, then exercises validation, transitions, SLA logic, filter combinations, and CRUD against a running server.

```bash
node test/dryrun.js
```

## Frontend

```bash
cd frontend
cp .env.example .env     # set VITE_API_URL to backend origin
npm install
npm run dev
```

The board has four columns (Open / In Progress / Resolved / Closed). Each card shows subject, priority badge, age, and a breach indicator when applicable. Cards expose only the transitions that are currently legal — an open card has no "Resolve" button. Filters above the board narrow the view by priority and SLA-breach status. A modal handles ticket creation with inline error messages.

The page refetches every 30 seconds so age and breach flags stay current without a manual reload.
