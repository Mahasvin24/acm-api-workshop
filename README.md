# API Social

The shared API directory for ACM at UCSB’s beginner API workshop. Students register their API through Postman, then browse what their neighbors built.

## Run

Requires Python 3.10+. Run from this folder:

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
fastapi dev main.py --host 0.0.0.0 --port 3000
```

On Windows PowerShell, activate with `.venv\Scripts\Activate.ps1`.

- Website: http://localhost:3000
- Interactive API docs: http://localhost:3000/docs
- Share with the room: `http://YOUR_WIFI_IP:3000`

`main.py` has the routes. `models.py` defines the registration fields. Registrations live in a Python list and reset when the server restarts, including automatic reloads after code changes. The website refreshes every ten seconds.

## API

There are two endpoints:

| Method | Route | Result |
| --- | --- | --- |
| GET | `/api/apis` | All registrations as `{"apis": [...]}` |
| POST | `/api/apis` | Add a registration; returns it with status `201` |

Send this JSON to `http://HOST_WIFI_IP:3000/api/apis` in Postman:

```json
{
  "name": "Restaurant Notes",
  "creator": "Your name",
  "description": "Restaurants and what we think of them.",
  "ip": "192.168.1.42",
  "port": 8000
}
```

All fields are required. Text fields must be nonempty, and the port must be an integer from 1024 to 65535. Invalid requests return FastAPI’s standard `422` validation response. Use your Wi-Fi IP without `http://` or a port. Duplicate registrations are allowed.

You can also import [registry.postman_collection.json](registry.postman_collection.json) into Postman.

## Workshop

Use a shared network that allows laptops to reach each other. Registering an IP does not make a laptop reachable; students must keep their API running and share their Wi-Fi address. CORS is enabled for browser requests.

This is a local workshop demo. Everyone on the network can read and add registrations. Stop the server afterward; restarting clears the board.

See [WORKSHOP.md](WORKSHOP.md) for the teaching plan. The separate `api-starter` folder is the student project.
