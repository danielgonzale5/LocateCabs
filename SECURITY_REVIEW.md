# LocateCabs security review

| | |
| --- | --- |
| **Target** | `master` at commit [`70f4492`](https://github.com/danielgonzale5/LocateCabs/tree/70f4492): the Node.js server `LocateCabsWeb.js` and the three browser pages |
| **Reviewer** | Daniel González |
| **Date** | 2026-09-29 |
| **Method** | Manual code review, `npm audit`, and local reproduction of every finding |
| **Scoring** | CVSS v3.1 base score |

## Context

I wrote this server with my team in 2021 for a university course. It ran on AWS EC2 and received live GPS positions from a phone app. That deployment no longer exists. This review reads the code the way I would read a customer's code today: what an attacker could do, how bad it is, and how to fix it.

Every finding was reproduced on a local lab and nowhere else. The lab ran the 2021 code unchanged against MySQL 8.0 in a Docker container bound to `127.0.0.1`, and used only benign inputs: a single quote, an HTML `<b>` tag, and a request with no signature.

## Summary

| ID | Finding | Severity | CVSS | Status |
| --- | --- | --- | --- | --- |
| [LC-01](#lc-01-sql-injection-in-the-history-endpoints) | SQL injection in the history endpoints | Critical | 9.1 | Fixed |
| [LC-02](#lc-02-unauthenticated-gps-updates-over-udp) | Unauthenticated GPS updates over UDP | High | 8.2 | Fixed |
| [LC-03](#lc-03-no-access-control-on-location-data) | No access control on location data | High | 7.5 | Fixed |
| [LC-04](#lc-04-denial-of-service-crash-on-any-database-error-and-a-growing-listener-leak) | Denial of service: crash on any database error, and a growing listener leak | High | 7.5 | Fixed |
| [LC-05](#lc-05-vulnerable-and-unused-dependencies) | Vulnerable and unused dependencies | High | per advisory | Fixed |
| [LC-06](#lc-06-unauthenticated-deploy-webhook) | Unauthenticated deploy webhook | Medium | 6.5 | Fixed |
| [LC-07](#lc-07-stored-xss-through-the-taxi-identifier) | Stored XSS through the taxi identifier | Medium | 6.1 | Fixed |
| [LC-08](#lc-08-database-credentials-written-to-the-logs) | Database credentials written to the logs | Medium | 5.5 | Fixed |
| [LC-09](#lc-09-history-results-broadcast-to-every-browser) | History results broadcast to every browser | Medium | 5.3 | Fixed |
| [LC-10](#lc-10-third-party-script-loaded-from-latest-without-integrity-check) | Third-party script loaded from `@latest` without integrity check | Medium | 4.7 | Fixed |
| [LC-11](#lc-11-cleartext-transport) | Cleartext transport | Informational | n/a | Documented |

LC-01 to LC-10 are fixed in the 2026 rewrite of the server (`server.js` and `src/`), and each has a regression test in `test/`. LC-11 needs a client change and is documented. Each finding below lists the change it needs, and [Verification after the fix](#verification-after-the-fix) shows the same reproduction steps run against the fixed version.

---

## LC-01: SQL injection in the history endpoints

**Critical, 9.1** `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:H`

**Where:** [`LocateCabsWeb.js:151`](https://github.com/danielgonzale5/LocateCabs/blob/70f4492/LocateCabsWeb.js#L151) (`/historic`) and [`LocateCabsWeb.js:191`](https://github.com/danielgonzale5/LocateCabs/blob/70f4492/LocateCabsWeb.js#L191) (`/historicact`)

**What is wrong:** both endpoints build the SQL string by concatenating `datainicio`, `datafin` and `dataactual` from the JSON body. Nothing checks that they are timestamps.

**Impact:** anyone who can reach the server controls part of the `WHERE` clause. That exposes every table the database user can read, not only `gps`. The `mysql` driver does not allow stacked statements by default, so writes are unlikely. Availability is hit hard, though: a malformed query throws inside the callback and kills the process (LC-04).

**Reproduction:** one `POST /historic` with a single quote in `datainicio`. MySQL answered with a syntax error at the injected position, and the Node process exited:

```
ER_PARSE_ERROR: You have an error in your SQL syntax; ... near '1')' at line 1
server process exited, exit code: 1
```

**Fix:**
- Use placeholders (`BETWEEN ? AND ?`) so values never become SQL.
- Validate that both values are integers in milliseconds and that the range is ordered and bounded (for example, at most 31 days).
- Reject anything else with `400`.
- Connect as a database user that only has `SELECT` and `INSERT` on `gps`.

## LC-02: Unauthenticated GPS updates over UDP

**High, 8.2** `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:L`

**Where:** [`LocateCabsWeb.js:84-104`](https://github.com/danielgonzale5/LocateCabs/blob/70f4492/LocateCabsWeb.js#L84-L104)

**What is wrong:** the UDP listener on port 3020 accepts any datagram of the form `user;lat;lon;timestamp` from any source address and inserts it. There is no signature or shared key, and no check of the values. The listener also echoes each datagram to `localhost` on the sender's port, which serves no purpose.

**Impact:**
- Anyone on the internet can move any taxi on the map, invent taxis, or fill the history with fake routes.
- A flood of datagrams grows the table without limit.
- Because UDP source addresses are trivial to spoof, even an IP allowlist would not help.

**Reproduction:** a single unsigned datagram from the lab host was stored and pushed to every connected browser within one polling cycle:

```
{"DataUsu":"<b>lab-taxi</b>","DataLat":"10.984720","DataLong":"-74.811300","DataTime":1790732810387}
```

**Fix:**
- Each device signs its datagram with HMAC-SHA256 using a per-device key. The server:
  - verifies the signature with a constant-time comparison;
  - rejects timestamps outside a small window (±60 s) or not newer than the last one accepted for that device, which stops replays;
  - validates the identifier (`[A-Za-z0-9_-]{1,32}`) and the latitude and longitude ranges before inserting.
- Remove the echo.
- The Android client on the `android` branch needs the same signing change.

## LC-03: No access control on location data

**High, 7.5** `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N`

**Where:** every route in [`LocateCabsWeb.js`](https://github.com/danielgonzale5/LocateCabs/blob/70f4492/LocateCabsWeb.js#L16-L36) and the Socket.IO server

**What is wrong:** there is no login of any kind. The pages, the history endpoints and the Socket.IO stream are open to anyone who knows the address.

**Impact:** the live position and the full movement history of every driver are public. A driver's location history is personal data: it reveals home addresses and daily routines.

**Reproduction:** every request in this review was made with no credentials, and all of them were served.

**Fix:**
- Require authentication on the HTTP routes and on the Socket.IO handshake. The operator's credentials live in `.env`, and the password is stored as a scrypt hash, never in plain text.
- Serve the app only over TLS (LC-11) so the credentials are not sent in clear.

## LC-04: Denial of service: crash on any database error, and a growing listener leak

**High, 7.5** `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H`

**Where:**
- `if (err) throw err` inside query callbacks: [`L75`](https://github.com/danielgonzale5/LocateCabs/blob/70f4492/LocateCabsWeb.js#L75), [`L101`](https://github.com/danielgonzale5/LocateCabs/blob/70f4492/LocateCabsWeb.js#L101), [`L118`](https://github.com/danielgonzale5/LocateCabs/blob/70f4492/LocateCabsWeb.js#L118), [`L152`](https://github.com/danielgonzale5/LocateCabs/blob/70f4492/LocateCabsWeb.js#L152), [`L192`](https://github.com/danielgonzale5/LocateCabs/blob/70f4492/LocateCabsWeb.js#L192)
- `io.on('connection')` registered inside a loop or request handler: [`L131`](https://github.com/danielgonzale5/LocateCabs/blob/70f4492/LocateCabsWeb.js#L131), [`L171`](https://github.com/danielgonzale5/LocateCabs/blob/70f4492/LocateCabsWeb.js#L171), [`L213`](https://github.com/danielgonzale5/LocateCabs/blob/70f4492/LocateCabsWeb.js#L213)
- the request body limit: [`L142`](https://github.com/danielgonzale5/LocateCabs/blob/70f4492/LocateCabsWeb.js#L142)

**What is wrong:**
1. **Crash on errors.** An error thrown inside an asynchronous callback is uncaught, so any failed query ends the process. Nothing restarts it: `nodemon` only restarts on file changes. A single unauthenticated UDP datagram is enough, because an identifier longer than the 64-character column makes MySQL reject the insert. A dropped database connection has the same effect.
2. **Listener leak.** A new `connection` listener is added every 3 seconds, and one more on every history request. None is ever removed, so memory grows for as long as the server runs, and every new browser is sent one stale position per listener.
3. **Body limit.** The JSON body limit is 500 MB.

**Impact:**
- One HTTP request (LC-01) or one UDP datagram stops the service for everyone.
- Even without an attacker, the leak slowly degrades the server.
- The body limit lets a single client make the server buffer very large requests.

**Reproduction:**

```
after 33 s of uptime, one new browser received 11 'change' events in 1 s
(node) MaxListenersExceededWarning: Possible EventEmitter memory leak detected
server process exited, exit code: 1        <- after the request in LC-01
Error: ER_DATA_TOO_LONG: Data too long for column 'Usuario' at row 1
exit=1                                     <- after one UDP datagram with an 80-character identifier
```

**Fix:**
- Handle query errors by logging them and returning `500`, never by throwing.
- Use a connection pool that reconnects.
- Register a single `connection` handler that sends the latest known position.
- Set the body limit to 10 KB.
- Run the service under a supervisor (Docker `restart: unless-stopped` or systemd) as a safety net.

## LC-05: Vulnerable and unused dependencies

**High (per advisory; `npm audit` reports 2 critical and 12 high)**

**Where:** [`package.json`](https://github.com/danielgonzale5/LocateCabs/blob/70f4492/package.json) and `package-lock.json`

**What is wrong:** `npm audit --omit=dev` reports 18 vulnerable packages:

| Package | Why it matters here |
| --- | --- |
| `socket.io-parser` 4.0.x (critical), `socket.io`, `engine.io`, `ws` | Reachable: the server exposes Socket.IO to anyone, and these advisories cover crashes and memory exhaustion from crafted packets. |
| `express`, `body-parser`, `qs`, `path-to-regexp`, `send`, `serve-static`, `cookie` | Reachable: every HTTP request goes through them. |
| `ejs` (critical), `no-ip`, `express-myconnection` | **Not used anywhere in the code**, but installed and shipped. |

**Impact:** known denial-of-service bugs are reachable without authentication. Unused packages add attack surface and audit noise for no benefit.

**Fix:**
- Remove `ejs`, `no-ip` and `express-myconnection`.
- Upgrade `express` and `socket.io` to current releases and regenerate the lockfile.
- Run `npm audit` in CI.
- Replace `mysql` with `mysql2`, which is maintained and supports MySQL 8 authentication.

## LC-06: Unauthenticated deploy webhook

**Medium, 6.5** `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:L/A:L`

**Where:** [`LocateCabsWeb.js:12-15`](https://github.com/danielgonzale5/LocateCabs/blob/70f4492/LocateCabsWeb.js#L12-L15)

**What is wrong:** `POST /github` runs `git reset --hard && git pull` in a shell for any request. It never checks GitHub's `X-Hub-Signature-256` header or the event type, and it never answers the request.

**Impact:** anyone can make the server discard local changes and redeploy at will, as often as they want. Each call spawns a shell and a `git` process, and each request stays open until the client gives up. The command is fixed, so there is no command injection. The risk is to integrity and availability.

**Reproduction:** a request with no signature reached the handler. The server logged the deploy trigger and the request never received a response:

```
POST /github, no signature -> no response (TimeoutError)
server logged the deploy trigger: true
```

**Fix:**
- Verify `X-Hub-Signature-256` as HMAC-SHA256 of the raw body with a secret from `.env`, using `crypto.timingSafeEqual`.
- Act only on `push` events to `refs/heads/master`.
- Answer `202` straight away.
- Run `git` with `execFile` and an argument list, with no shell.
- Disable the route when no secret is configured.

## LC-07: Stored XSS through the taxi identifier

**Medium, 6.1** `CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N`

**Where:**
- sinks: [`index.html:545`](https://github.com/danielgonzale5/LocateCabs/blob/70f4492/index.html#L545) (`innerHTML`), [`index.html:495`](https://github.com/danielgonzale5/LocateCabs/blob/70f4492/index.html#L495) (`bindPopup`), and the same pattern in [`index_routingmachine.html:275`](https://github.com/danielgonzale5/LocateCabs/blob/70f4492/index_routingmachine.html#L275) and [`index_routingmachine.html:193`](https://github.com/danielgonzale5/LocateCabs/blob/70f4492/index_routingmachine.html#L193)
- source: the UDP listener (LC-02)

**What is wrong:** the taxi identifier comes from an unauthenticated datagram. It is stored as is and written into the page with `innerHTML` and Leaflet's `bindPopup`, and both interpret strings as HTML.

**Impact:** whoever can send one datagram (LC-02) can run script in the browser of every operator who opens the map. Once LC-03 is fixed, that script would run inside an authenticated session.

**Reproduction:** a datagram whose identifier was `<b>lab-taxi</b>` was stored and delivered to the browser unchanged, straight into both sinks:

```
taxi id reaches innerHTML/bindPopup unescaped: <b>lab-taxi</b>
```

**Fix:**
- Validate the identifier on the way in (LC-02).
- Write text with `textContent`, and give Leaflet a text node instead of an HTML string.
- Add a Content-Security-Policy that blocks inline script as a second layer.

## LC-08: Database credentials written to the logs

**Medium, 5.5** `CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N`

**Where:** [`LocateCabsWeb.js:52`](https://github.com/danielgonzale5/LocateCabs/blob/70f4492/LocateCabsWeb.js#L52), plus request bodies and full query results logged at [`L146`](https://github.com/danielgonzale5/LocateCabs/blob/70f4492/LocateCabsWeb.js#L146), [`L158`](https://github.com/danielgonzale5/LocateCabs/blob/70f4492/LocateCabsWeb.js#L158) and [`L194`](https://github.com/danielgonzale5/LocateCabs/blob/70f4492/LocateCabsWeb.js#L194)

**What is wrong:** at startup the server prints the whole parsed `.env` object, database password included. Every history request also prints its body and every returned row. There is also a bug next to it: [`L50`](https://github.com/danielgonzale5/LocateCabs/blob/70f4492/LocateCabsWeb.js#L50) throws `result.error`, but `result` is undefined, so a missing `.env` fails with the wrong error.

**Impact:** anyone who can read the process output (log files, `journalctl`, a log shipper, a screenshot in a support ticket) gets the database password and drivers' location history.

**Reproduction:** the first lines of output at startup (the value is redacted here, not in the real output):

```
{ DB_HOST: '127.0.0.1', DB_USER: 'root', DB_PASS: '[REDACTED]' }
```

**Fix:**
- Read configuration from `process.env` and never print it. Fail with a clear message naming the missing variable.
- Log events such as "history query, 42 rows", not payloads.

## LC-09: History results broadcast to every browser

**Medium, 5.3** `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N`

**Where:** [`LocateCabsWeb.js:168-175`](https://github.com/danielgonzale5/LocateCabs/blob/70f4492/LocateCabsWeb.js#L168-L175) and [`L210-217`](https://github.com/danielgonzale5/LocateCabs/blob/70f4492/LocateCabsWeb.js#L210-L217)

**What is wrong:** the result of a history query is not returned to the browser that asked for it. It is sent to every connected browser with `io.emit`, and a new `connection` listener replays it to every browser that connects later.

**Impact:**
- One user's query leaks to every other user, including users who connect hours later.
- Concurrent users overwrite each other's results.
- Once LC-03 adds per-user access, this would still leak across users.

**Reproduction:**

```
browser B received A's result: {"DataTimeStamp":[["10.98472","-74.81130"],["10.98472","-74.81130"]]}
browser C, connecting later, also gets it on connect: true
```

**Fix:** return the rows in the HTTP response (`res.json`) and have the page draw them from that response. Socket.IO then carries only the live position.

## LC-10: Third-party script loaded from `@latest` without integrity check

**Medium, 4.7** `CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:C/C:L/I:L/A:N`

**Where:** [`index_routingmachine.html:120`](https://github.com/danielgonzale5/LocateCabs/blob/70f4492/index_routingmachine.html#L120)

**What is wrong:** `leaflet-routing-machine@latest` is loaded from unpkg with no version pin and no `integrity` attribute. Leaflet itself, on the other pages, is pinned and has SRI.

**Impact:** whatever unpkg serves as "latest" runs in the page with full access to it. That could be a new major version or a compromised publish.

**Fix:**
- Pin an exact version and add its `integrity` hash and `crossorigin`, as the Leaflet tags already do.
- Or serve the file from the app itself.

## LC-11: Cleartext transport

**Informational**

The web UI is served over plain HTTP on port 3000, and GPS positions travel as plain UDP. The HMAC from LC-02 protects integrity and authenticity, not confidentiality: positions remain readable on the network path.

For the web UI, terminate TLS in front of the app (a reverse proxy such as Caddy or Nginx, or a cloud load balancer) and redirect HTTP to HTTPS. For the device channel, if confidentiality of positions in transit matters, move from UDP to HTTPS or MQTT over TLS, or wrap UDP in DTLS. That is a client change, so it is out of scope for the server fix.

## Verification after the fix

The fixed version was started with `docker compose` from a fresh `.env`, and the same benign inputs were sent to it:

```
[LC-08] DB password or password hash in the app logs: false
[LC-03] GET / without login -> 401 | with login -> 200
[LC-03] Socket.IO without login: refused
[LC-02/07] sent 1 unsigned datagram, 2 with an invalid id (markup, 80 characters), 1 signed, 1 replay of the signed one
           rows stored: 1 (the signed datagram only)
[LC-01] /historic with a quote -> 400
[LC-04] server still answering afterwards -> 200
[LC-04] 20 KB body -> 413
[LC-06] POST /github -> 401 (without a secret the route does not exist, and the login is checked first)
[LC-04] app container after all of the above: Up
[LC-01] app DB user trying DELETE: ERROR 1142 (42000): DELETE command denied to user 'locatecabs'
[LC-05] npm audit --omit=dev: found 0 vulnerabilities
```

The live map and the route history were then checked in a browser with the login: positions arrive live, the route draws from the HTTP response, and the console shows no CSP violations.

## Out of scope and notes

- **Android client** (`android` branch): not reviewed beyond how it sends datagrams (`MessageSender.java`). It still sends the unsigned 2021 format, so it must be updated to sign datagrams before it can talk to the fixed server.
- **Mapbox token in git history:** a teammate's Mapbox token remains in the history of `index_routingmachine.html` before commit `70f4492`. Its owner should revoke it. Rewriting public history was not done.
- **Lab only:** no production system was touched. The EC2 and RDS resources from 2021 no longer exist.
