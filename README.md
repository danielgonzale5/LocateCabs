# LocateCabs

Real-time GPS tracking for taxis. A phone app sends the vehicle's position over UDP to a Node.js server, which stores every fix in MySQL and pushes it to a live map in the browser. A second page replays the route a taxi took between two dates.

University team project for the *Electronic Design* course at Universidad del Norte (Barranquilla, Colombia), Sep to Oct 2021. The server ran on AWS EC2 with the database on Amazon RDS.

In 2026 I reviewed the 2021 code as a security engineer and fixed what I found. The review, with a CVSS score, CWE and OWASP Top 10 classification, a local reproduction and the fix for each finding, is in [SECURITY_REVIEW.md](SECURITY_REVIEW.md). A one-page version for non-technical readers, with the business risk and the remediation roadmap, is in [EXECUTIVE_SUMMARY.md](EXECUTIVE_SUMMARY.md). The code as we submitted it in 2021 is at commit [`70f4492`](https://github.com/danielgonzale5/LocateCabs/tree/70f4492).

## Architecture

```
 Phone app (branch: android)
   │  UDP datagram "id;lat;lon;timestamp;hmac"  →  port 3020
   ▼
 Node.js server (server.js, src/)
   ├─ UDP receiver: verifies the HMAC, the timestamp window and the values ─► MySQL `gps`
   │                 and pushes each accepted position to the browsers
   ├─ Express, behind the operator login (HTTP Basic, scrypt hash)
   │    /             live position of the taxi         (index.html)
   │    /historicos   route between two dates            (historicos.html)
   │    /routing      route drawn on real streets         (index_routingmachine.html, needs a Mapbox token)
   │    POST /historic, /historicact   date-range queries, answered to the caller only
   │    POST /github  deploy webhook, verified with GitHub's HMAC signature (off unless configured)
   ▼
 Browser: Leaflet map, updated live through Socket.IO (same login)
```

- **Device authentication:** each device has its own 32-byte key. A datagram carries an HMAC-SHA256 over its content, and the server rejects it if the signature is wrong, the timestamp is more than 60 s off, or it is not newer than the last one from that device (replay protection).
- **Live view:** each accepted position is pushed once to every logged-in browser. A browser that connects later gets the latest position.
- **History:** the page sends a start and end timestamp. The server validates both, runs a parameterised query and returns the points in the HTTP response, which the map draws as a polyline.
- **Hardening:** Content-Security-Policy with no inline script, SRI on third-party scripts, 10 KB request limit, no secrets or payloads in the logs, errors that end the request instead of the process, and a database user that can only `SELECT` and `INSERT`.

## Running it locally

Requirements: Node.js 22+ and Docker.

```bash
npm install
npm run init-env
docker compose up -d --build
npm run simulate
```

1. `npm run init-env` writes a `.env` with random secrets and prints the web password once. Only its hash is stored.
2. `docker compose up` starts MySQL, creates the schema and a least-privilege user, and starts the app. Both ports are bound to `127.0.0.1` only.
3. `npm run simulate` plays the part of the phone: it drives `taxi1` around a block in Barranquilla, sending one signed datagram every two seconds.
4. Open `http://localhost:3000` and log in as `operator` with the printed password. The taxi moves on the map. On *Históricos*, pick today's date and turn on *Consultar trayecto* to draw its route.

To run without Docker, create the table with `db/schema.sql` in your own MySQL, fill in `.env` from `.env.example`, and run `npm start`.

## Tests

```bash
npm test
```

39 tests with Node's built-in test runner, no database needed. They cover each finding of the review as a regression test:

- datagram signature, replay and value checks;
- rejection of SQL syntax in dates;
- login and lockout;
- webhook signature and branch checks;
- no broadcast of history results;
- one Socket.IO listener for the life of the process;
- errors that do not stop the server.

GitHub Actions runs them, plus `npm audit`, on every push.

## Deploying

Put the app behind a reverse proxy that terminates TLS (Caddy, Nginx or a cloud load balancer), and set `TRUST_PROXY=1`. HTTP Basic credentials must never travel over plain HTTP.

To auto-deploy on push, set `GITHUB_WEBHOOK_SECRET`, `DEPLOY_DIR` (the checkout to update) and `DEPLOY_BRANCH`, and use the same secret in the repository's webhook settings. The server then runs `git fetch` and `git reset --hard origin/<branch>` without a shell. A process supervisor (systemd, or `node --watch`) restarts the app on the new code.

## Relevant areas

- Infrastructure: the EC2 instance running the Node.js server, the MySQL database on Amazon RDS, and the GitHub webhook that deployed every merge to `master`.
- The history feature end to end: the date-range UI in `historicos.html`, the `/historic` and `/historicact` endpoints, and drawing the returned route on the map.
- Server work: environment-based database configuration, the UDP-to-MySQL path and the Socket.IO updates.
- Integration: branch-per-person workflow with pull requests into `master`.
- 2026 security review and fixes: [SECURITY_REVIEW.md](SECURITY_REVIEW.md), the rewrite of the server into `src/`, the tests, and the Docker setup.

## Known limitations

- The Android app on the `android` branch predates signed datagrams. It needs a per-device key and an HMAC before it can talk to this server.
- Positions still travel over UDP in clear. They are authenticated, but not encrypted (see LC-11 in the review).
- `/routing` needs your own Mapbox token where it says `[INSERT_MAPBOX_TOKEN]` in `js/routing.js`.
