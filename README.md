# LocateCabs

Real-time GPS tracking for taxis. An Android app sends the phone's position over UDP to a Node.js server, which stores every fix in MySQL and pushes the latest one to a live map in the browser. A second page replays the route a taxi took between two dates.

University team project for the *Electronic Design* course at Universidad del Norte (Barranquilla, Colombia), Sep to Oct 2021. The server ran on AWS EC2 with the database on Amazon RDS.

## Architecture

```
 Android app (branch: android)
   │  UDP datagram "user;lat;lon;timestamp"  →  port 3020
   ▼
 Node.js server (LocateCabsWeb.js)
   ├─ UDP listener ─────────► MySQL table `gps`  (Amazon RDS)
   ├─ polls the latest fix every 3 s ─► Socket.IO ─► browser
   └─ Express routes
        /             live position of the taxi         (index.html)
        /historicos   route between two dates            (historicos.html)
        /routing      route drawn on real streets         (index_routingmachine.html)
        POST /historic, /historicact   date-range queries for the history page
        POST /github  GitHub webhook: pulls the latest code on the server
   ▼
 Browser: Leaflet map, updated live through Socket.IO
```

- **Transport:** plain UDP from the phone, one datagram per position update, no connection to keep open on a mobile network.
- **Live view:** the server reads the newest row every 3 seconds and emits it to every connected browser.
- **History:** the page sends a start and end timestamp, the server queries that range and returns the list of coordinates, which the map draws as a polyline.
- **Deploy:** a GitHub webhook on `/github` makes the EC2 instance pull the latest commit, so every merge to `master` went live automatically.

## Relevant areas

- Infrastructure: the EC2 instance running the Node.js server, the MySQL database on Amazon RDS, and the GitHub webhook that deployed every merge to `master`.
- The history feature end to end: the date-range UI in `historicos.html`, the `/historic` and `/historicact` endpoints, and drawing the returned route on the map.
- Server work in `LocateCabsWeb.js`: environment-based database configuration (`.env`), the UDP-to-MySQL path and the Socket.IO updates.
- Integration: branch-per-person workflow with pull requests into `master`.

## Running it locally

Requirements: Node.js and a MySQL database.

1. Create the table (reconstructed from the queries in the code):

   ```sql
   CREATE DATABASE locatecabs;
   USE locatecabs;
   CREATE TABLE gps (
     idGPS     INT AUTO_INCREMENT PRIMARY KEY,
     Usuario   VARCHAR(64),
     Latitud   VARCHAR(32),
     Longitud  VARCHAR(32),
     TimeStamp VARCHAR(32)
   );
   ```

2. Copy `.env_sample` to `.env` and fill in `DB_HOST`, `DB_USER` and `DB_PASS`.
3. Install and start:

   ```bash
   npm install
   npm run Start
   ```

4. Open `http://localhost:3000`. To simulate a taxi without the Android app, send a datagram to UDP port 3020, for example from Linux:

   ```bash
   echo -n "taxi1;10.98472;-74.81130;$(date +%s%3N)" | nc -u -w1 localhost 3020
   ```

## Known issues

This is the code as we submitted it in 2021, kept for reference. The only change is that the Mapbox token in `index_routingmachine.html` was replaced with a placeholder: put your own token where it says `[INSERT_MAPBOX_TOKEN]` to use the `/routing` page. Looking back at it as a security engineer, it would not be safe to expose today:

- **SQL injection:** `/historic` and `/historicact` build their queries by concatenating values from the request body.
- **Unauthenticated webhook:** anyone can call `POST /github` and trigger a `git reset --hard && git pull` on the server, because the GitHub signature is never checked.
- **Unauthenticated position updates:** any host can send UDP datagrams to port 3020 and move a taxi on the map.
- **Credentials in logs:** the server prints the parsed `.env`, database password included, at startup.
- **Resource leaks:** a new `io.on('connection')` listener is registered every 3 seconds, and the JSON body limit is 500 MB.
