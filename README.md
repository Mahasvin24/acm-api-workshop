# API Social

The shared API directory for ACM at UCSB’s beginner API workshop. Students run their own API, register with a POST from Postman, and discover what their neighbors built.

## Run the platform

Requires **Python 3.10+**. Run from this folder:

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload --host 0.0.0.0 --port 3000
```

Open **http://localhost:3000**. FastAPI serves both the website and registry API. Routes are in `main.py`, validation models in `models.py`, and dependencies in `requirements.txt`. It listens on `0.0.0.0`; share **http://YOUR_WIFI_IP:3000** with the room. Change `--port` to use another port; `--reload` watches server changes. On Windows PowerShell, activate with `.venv\Scripts\Activate.ps1`.

Entries persist in `data/registry.sqlite` and survive server restarts. The website is a read-only table of registered creators, API names, descriptions, IPs, and ports. It starts empty and refreshes every ten seconds. Students register through Postman.

See **[WORKSHOP.md](WORKSHOP.md)** for the teaching plan, network rehearsal, and day-of checklist. The separate `api-starter` repository is the student project.

## API contract

The website uses the same public API as students. Import **[registry.postman_collection.json](registry.postman_collection.json)** into Postman, or use these routes:

| Method | Route | Result |
| --- | --- | --- |
| GET | `/api/health` | `{"status":"ok"}` |
| GET | `/api/apis` | `{"apis":[...]}`; newest first |
| GET | `/api/apis/:id` | One public registration |
| POST | `/api/apis` | Create a registration; `201` |
| PATCH | `/api/apis/:id` | Update supplied fields; owner token required |
| DELETE | `/api/apis/:id` | Remove a registration; owner token required; `204` |
| OPTIONS | Any route | Cross-origin preflight; `200` (`204` without preflight headers) |

POST body:

```json
{
  "name": "Restaurant Notes",
  "creator": "Your name",
  "description": "Restaurants and what we think of them.",
  "ip": "192.168.1.42",
  "port": 8000
}
```

Successful POST returns those fields plus `id`, `created_at`, `edit_token`, and a message. `Location` points to the new resource. **Save `edit_token` immediately**; only its SHA-256 hash is stored. Public reads never return tokens or hashes.

To update, send `PATCH /api/apis/YOUR_ID` with a body such as `{"description":"Now with a random restaurant endpoint."}`. To remove, send `DELETE /api/apis/YOUR_ID`. Both require:

```http
Authorization: Bearer YOUR_EDIT_TOKEN
```

## Registration rules

- Name: 3–48 characters; unique (SQLite’s default NOCASE comparison is case-insensitive for ASCII).
- Creator: 2–48 characters. Description: 10–160 characters.
- Text is trimmed and must be one line without control characters or HTML angle brackets. Extra fields are rejected, helping students catch typos.
- `ip`: a literal IPv4 address, without scheme or port. Private LAN addresses are allowed. Loopback, unspecified, link-local, and multicast/reserved ranges starting at 224 are rejected.
- `port`: an integer JSON number from 1024 to 65535. No strings or decimals.
- Each IP + port pair must be unique. Two students sharing a laptop can use different ports.
- Bodies must be JSON and no larger than 8 KB. PATCH must contain at least one allowed field.
- Writes are limited to 60 per client IP per fixed minute. Preflight and reads do not count. At most 500 entries are accepted.

Invalid fields return `400` and per-field help, for example:

```json
{
  "error": "Check your registration.",
  "fields": {"port": "Input should be a valid integer"}
}
```

Other responses: `401` invalid/missing edit token; `404` unknown resource; `409` duplicate name/address; `413` oversized body; `415` incorrect content type; `429` rate limit (with `Retry-After`); `503` directory full.

## Network and workshop scope

Run this locally on a network that allows clients to communicate. **An IP address registration does not make someone’s laptop publicly reachable.** The platform never probes or proxies registered addresses, and never claims an API is online. Students copy addresses into Postman instead of the website fetching arbitrary local servers.

CORS is open on both projects: `Access-Control-Allow-Origin: *`, including JSON and `Authorization` request headers. The FastAPI starter permits all methods and headers; the platform permits its supported methods and JSON/bearer-token headers. Registry responses expose `Location` and `Retry-After`. Credentials/cookies are not enabled. Cross-origin browser permission and mixed-content rules still apply independently of CORS.

This is a trusted-room demo, not a public hosting service. Anyone on the network can read the listed names and IPs or register an entry. Edit tokens travel over the workshop’s HTTP network. Use workshop data, and shut the server down afterward. There is no recovery of lost tokens or host moderation UI. To remove a stranded entry, the host can use a SQLite client against their local database.

For a fresh workshop, stop the server, archive the **whole `data/` folder** (including any SQLite WAL files), and restart. Keep that archive private. Do not delete a live database.

## Design and assets

The calm blue palette and chapter identity reference [ACM at UCSB](https://www.ucsbacm.com/). The logo is the chapter’s official website asset, referenced remotely from its source URL. The site falls back to its text wordmark if it cannot load; the rest of the interface needs no external fonts, scripts, or images. For an offline event, download that asset into `public/` and change the image URL before the workshop. No stock imagery is used.

The page only displays registrations, with automatic refresh, an empty message, and a connection error message. On narrow screens the table scrolls horizontally. Registration instructions live in the workshop material and Postman collections.

Implementation and visual-verification notes are in **[DESIGN.md](DESIGN.md)**.
