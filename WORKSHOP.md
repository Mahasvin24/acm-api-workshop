# Hosting the API workshop

The outcome: each student understands a request/response, changes a tiny API, shares it, and tries someone else’s project. The registry is the last API exercise, so posting your work reinforces the same concepts.

## Before the event

The host needs Node.js **22.13+** for the platform. Students need Python **3.10+**, the Postman **desktop app**, and `api-starter`. Have students follow its README to create a virtual environment and install `requirements.txt` before arriving. The host runs `npm ci` in `platform`. Browser-only Postman may need a desktop agent for local networking.

Rehearse with **two actual laptops on the venue network**. One laptop reaching itself does not prove the room can connect. A shared SSID does not guarantee device-to-device traffic. Use an approved workshop network or hotspot that permits peers if campus Wi-Fi blocks them. Test the hotspot too; some isolate clients. You do not need router port forwarding or public Internet exposure.

On the host:

```sh
cd platform
npm start
```

On a different laptop, open `http://HOST_WIFI_IP:3000` and GET `http://HOST_WIFI_IP:3000/api/health`. Start the student API and ask the host to GET `http://STUDENT_WIFI_IP:8000/spots`. Resolve OS firewall prompts for the intended workshop network. Keep these URLs on a slide or whiteboard; do not give students the host’s `localhost` URL.

If device-to-device networking remains blocked, students can finish CRUD locally using Postman or FastAPI’s `/docs`. Registration alone cannot make unreachable laptops accessible. Rehearse early enough to secure a usable network for the sharing exercise.

## A 60-minute session

| Time | Teach and do |
| --- | --- |
| 0–8 min | Run the starter. GET `/spots` in a browser. Point out URL, method, JSON response, and `200`. |
| 8–18 min | POST a favorite place in Postman. Explain headers, JSON strings versus numbers, and `201`. Send an invalid body and read FastAPI’s `422` validation response together. GET again to see the change. |
| 18–25 min | PATCH the returned ID’s tip, then DELETE it. Explain route parameters, `404`, and `204`. Briefly compare PATCH with PUT. |
| 25–40 min | Make it yours. Students change the dataset or add one endpoint. Show a random recommendation endpoint as a short live example if they need a starting point. |
| 40–50 min | Find Wi-Fi IPs. A neighbor GETs each student’s API. POST the registration to the shared platform and save the returned ID/token. |
| 50–60 min | Browse the board. Try two classmates’ APIs in Postman. Volunteers describe their method, route, and response. Optional: PATCH your directory tagline. |

Keep the teaching screen on `api-starter/main.py`. The platform’s validation and persistence are host infrastructure, not required reading for beginners.

## Explain this networking picture

```text
Student laptop :8000  ← GET /spots ───  Neighbor’s Postman
        │
        └── POST /api/apis ──→ Host laptop :3000
                                      │
                                  SQLite entries
                                      │
                         GET /api/apis → Directory website
```

Every laptop can use port 8000 because it has a different IP. One laptop running two servers needs different ports. `0.0.0.0` is the server’s bind address, `localhost` means this device, and your Wi-Fi IPv4 address is what a neighbor uses.

## Registration exercise

Import the starter’s Postman collection or make a POST request manually. The website only displays registrations. Set `registry_url` to `http://HOST_WIFI_IP:3000`, and customize `student_ip`, `student_port`, `api_name`, and `creator`.

Show three examples together:

- Valid registration → `201`: the API appears within 10 seconds.
- A quoted port, `"8000"` → `400`: read the field error and fix it.
- A duplicate name or IP + port → `409`: pick a unique name or PATCH your existing entry.

Explain that the edit token is a small introduction to authorization: anyone can read the directory, but you need your entry’s token to change it. The Postman collection saves tokens locally in collection variables; do not publish an exported collection containing live tokens.

## Troubleshooting during the session

| Symptom | Check |
| --- | --- |
| Connection refused | Is the target terminal still running? Is the port right? |
| Request times out | Same usable network? Correct Wi-Fi IP? Firewall? Peer isolation? |
| You can reach yours, but a neighbor can’t | They must use your Wi-Fi IP, not localhost. Check network isolation. |
| EADDRINUSE | Stop the other server or choose another port and update the registration. |
| JSON error | Body → raw → JSON; double quotes; no trailing commas. |
| 401 when editing | Authorization → Bearer Token; paste the saved edit token. |
| Entry visible, API unreachable | Registration is metadata, not a health check. Check the creator’s laptop and routes. |
| Browser fetch blocked despite CORS | Use Postman desktop; check HTTPS-to-HTTP and local-network browser rules. |

At the end, stop both servers with Ctrl+C. Remind students that the starter’s list resets, while their code stays. Archive the host’s `data/` folder if you want to preserve the directory privately.
