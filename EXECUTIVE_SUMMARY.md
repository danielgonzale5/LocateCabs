# LocateCabs security review: executive summary

*A one-page version of [SECURITY_REVIEW.md](SECURITY_REVIEW.md) for readers who decide rather than build. Reviewed and fixed in September 2026.*

## Bottom line

| | Overall risk | Fit to run with real drivers? |
| --- | --- | --- |
| **2021 version** | **Critical** | No. Anyone on the internet could read every driver's location history, plant fake positions, or take the service down with a single message. |
| **Today** | **Low** | Yes for a pilot, once it runs behind HTTPS (one deployment step, below). |

The review found **11 issues**: 1 critical, 4 high, 5 medium and 1 informational. **10 are fixed and retested**. The last one needs a change in the phone app and has a plan.

## What was at stake

- **Driver privacy.** The map and the full movement history of every taxi were public. A location history shows where a driver lives and their daily routine. This is personal data the business is accountable for.
- **Trust in the map.** Anyone could send fake positions: a taxi could appear somewhere it is not, or a "taxi" could be invented. Dispatch decisions based on the map would be wrong.
- **Availability.** One malformed message or request stopped the whole service, and nothing brought it back.
- **Control of the server.** The automatic deployment could be triggered by anyone, and the database password was printed in the logs.

## What was done

| Priority | Risk addressed | Action | Status |
| --- | --- | --- | --- |
| P1, immediate | Data theft and outage through the history search | Rewrote every database query so user input can never change it; the database account can no longer delete or alter data | Done |
| P1, immediate | Fake positions | Each phone signs its messages with its own key; unsigned, altered or replayed messages are dropped | Done (phone app pending) |
| P1, immediate | Public location data | Login required for the map, the history and the live feed, with lockout after repeated failures | Done |
| P1, immediate | Single-message outage | Errors now end one request, not the service; memory leak removed; automatic restart | Done |
| P2, this sprint | Known flaws in third-party code | 18 vulnerable packages removed or upgraded to 0 | Done |
| P2, this sprint | Hijackable deployment, password in logs, malicious content in the page | Signed deployments only, logs without secrets, browser-side protections against injected script | Done |
| P3, next | Data readable on the network | Serve over HTTPS; move the phones to an encrypted channel | Planned |

## Remediation roadmap

1. **Week 1 (done):** close the four P1 risks above, then retest each one with the exact steps that proved it.
2. **Week 2 (done):**
   - fix the P2 items;
   - add 39 automated tests that fail if any issue returns;
   - run them on every change.
3. **Before go-live (owner):**
   - put the service behind HTTPS;
   - update the phone app to sign its messages;
   - have the teammate who owns the old map key revoke it.
4. **Ongoing:** the automated dependency check flags new third-party flaws on every change; review it monthly.

## Decisions needed from the owner

- **Approve the phone app update.** Until the app signs its messages, the fixed server rejects them, which is the safe default.
- **Choose where HTTPS terminates** (a reverse proxy on the server, or a cloud load balancer). Both work. It is a one-time setup.

## How we know it worked

Every issue was first reproduced on an isolated lab copy, using harmless inputs. After the fix, the same steps were run again and each one was blocked. The 39 automated tests and the dependency check run on every change. The detail for each issue is in [SECURITY_REVIEW.md](SECURITY_REVIEW.md).
