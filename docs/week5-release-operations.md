# Week 5 — Release operations

## What this is

The release check for this repo, the protected health report, the separate monitor, and the written steps for getting back to a healthy system. The live site is `https://internal-operations-service-hub.onrender.com`. This document is the record for the commit you call the release.

Nothing here repairs the app by itself. Each failure below says what you see and the step you take.

## 1. Release identity

The candidate is the commit that passed the checks. On your computer that is the commit `git rev-parse HEAD` prints. On GitHub it is the commit that was pushed. 

## 2. The release command

From the repo root:

```bash
npm run verify:release
```

That command runs, in order, against `TEST_DATABASE_URL` only:

1. `db:setup` in `backend`: `prisma db push`, then `prisma db seed`.
2. Backend build (`nest build`).
3. Frontend build (`tsc -b`, then `vite build`).
4. Backend typecheck (`tsc --noEmit`).
5. Backend unit tests (`npm test`).
6. The AI intake evals.
7. `test:db`: the requests integration spec, then the end-to-end tests.

If `TEST_DATABASE_URL` is missing, the command stops. It does not use `DATABASE_URL`.

The command does not call Microsoft. It does not send mail.

Seed creates one admin, Jordan Admin, and only when that user is missing. If the admin is already there, seed prints `Admin already exists. Skipping seed.` and leaves every existing row as it is.

On your computer, set `TEST_DATABASE_URL` to a Postgres you can wipe. The live Neon URL stays in `DATABASE_URL` and this command does not use it.

## 3. Practice database

A new machine needs this setup before the command will run:

1. Node.js and npm.
2. Docker Desktop, running. An existing Postgres install can replace it.
3. `npm install` in `backend` and in `frontend`.
4. `backend/.env`, copied from `backend/.env.example`. Set `JWT_SECRET` to any long random string. `TEST_DATABASE_URL` is already `postgresql://postgres:postgres@localhost:5433/ops_hub_test?sslmode=disable`. Comments in that file must start with `#`.
5. The practice database, started from the repo root:

```bash
docker compose -f backend/docker-compose.test.yml up -d
```

That starts Postgres 16 with user `postgres`, password `postgres`, and database `ops_hub_test` on port `5433`. The first run downloads the image. The data disappears when the container stops. The real Neon password stays in `backend/.env` and this command does not use it.

## 4. Release configuration

Required names, values stay out of git:

| Name                                                                                           | Role                                                                                                                                                                                   |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                                                                 | Neon connection for a real run. The release check does not use it.                                                                                                                     |
| `JWT_SECRET`, `JWT_EXPIRES_IN`                                                                 | Session signing.                                                                                                                                                                       |
| `NODE_ENV`                                                                                     | Not read by the hub. A host may still set `production` because Node does.                                                                                                             |
| `AZURE_AD_CLIENT_ID`, `AZURE_AD_TENANT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_REDIRECT_URI`  | Microsoft sign-in. Email-and-password sign-in works without them.                                                                                                                      |
| `MAILTRAP_HOST`, `MAILTRAP_PORT`, `MAILTRAP_USER`, `MAILTRAP_PASS`, `NOTIFICATIONS_FROM_EMAIL` | Gmail over SMTP. The names stay `MAILTRAP_*` because that is what the mail code reads. Host `smtp.gmail.com`, port `587`. User and from address are the sending Gmail. The password is a Google app password. The request is already saved if a send fails. |
| `GROQ_API_KEY`                                                                                 | Suggestion and the health AI check. `GROQ_MODEL` defaults to `openai/gpt-oss-20b`. The health check calls `https://api.groq.com/openai/v1/models` and does not read a URL from `.env`. |
| `HEALTH_USER`, `HEALTH_PASSWORD`                                                               | Basic auth for `GET /health`. The monitor sends the same pair.                                                                                                                         |
| `FRONTEND_URL`                                                                                 | Allowed browser origin. Default `http://localhost:5173`.                                                                                                                               |
| `PORT`                                                                                         | API port. Default `3000`.                                                                                                                                                              |
| `MONITOR_INTERVAL_MS`                                                                          | Time between monitor checks. Default `2000`.                                                                                                                                           |
| `ESCALATION_CHECK_INTERVAL_MS`                                                                 | Reminder sweep. `0` turns the timer off.                                                                                                                                               |

After `verify:release` has built the backend, start that built copy with `npm --prefix backend run start:prod`. `--prefix backend` means “run this script inside the backend folder.” The script is `node dist/main`: Node runs the compiled API. `npm run start:dev` is the other one, for editing, and it restarts when you save a file.

## 5. Health and the monitor

`GET /health` requires HTTP Basic auth. A missing or wrong password returns `401` and no health body.

A accepted call returns:

```json
{
  "status": "ok",
  "checks": { "database": "ok", "ai": "ok" }
}
```

`status` is `ok` only when both checks are `ok`. Otherwise `status` is `not-ok` and the HTTP status is `503`. The body does not include the error text. The API log line says why: database or Groq could not be reached, with passwords and bearer tokens stripped.

Microsoft and mail are not health checks. Microsoft being down still leaves email-and-password sign-in. A failed email still leaves the request saved.

The monitor is a second process, not part of the API. From the repo root:

```bash
npm run monitor
```

It reads `HEALTH_URL`, or `http://127.0.0.1:<PORT>/health` when that is unset. It checks about every 2 seconds. One or two failures print `degraded`. The third in a row prints `ALERT Ops Hub has not been ok for 3 checks in a row (degraded)` once. Further failures do not print that line again. The first `ok` after an alert prints `RESOLVED`.

If the API process is down, the API cannot write a log. The monitor prints that the API could not be reached. On a host, set `HEALTH_URL` to that host's public `/health` address. The host does not start the monitor unless you run `npm run monitor` as its own program.

## 6. Go or hold

| Evidence             | Go                                                                                                            | Hold                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Release identity     | the commit that passed the checks is the one you mean to ship                                                 | you cannot name that commit                            |
| Automated confidence | `verify:release` passes, including the long tests                                                     | a check failed                                          |
| Configuration        | every required name in section 4 is set for that environment, and real secrets are only in `.env` or the host | a required name is missing, or a real secret is in git |
| Health               | `GET /health` is `ok`, with database and AI both `ok`                                                         | `not-ok`, or `401`                                     |
| Critical smoke       | the long tests inside `verify:release` passed: create, claim, message, silence, escalation, admin, rate limit | that suite failed or was not run                       |
| Recovery             | the API-down row in section 7 has been performed, with the monitor output kept                                | the steps are only written, or the journey was not opened again |

The long tests sign in with `POST /auth/password`, the same door as the website. Mail in those tests is a stand-in, so they do not send a real message. A Microsoft browser login is not part of this suite.

## 7. Failures and recovery

Writing the row is not the recovery. The API-process row is performed by hand on the live site. Section 8 is that drill. No program in this repo restarts the server.

| What failed           | What you see                                                                                    | Recovery                                                                                                                                                                         |
| --------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Database              | Health says `database: not-ok`. The log says the database could not be reached. New saves fail. | Check `DATABASE_URL`. Wake Neon if it has paused. Restart the API. Call `/health` again and wait until `database` is `ok`.                                                       |
| Groq                  | Health says `ai: not-ok`. The suggestion call fails. The request form still saves.              | Check `GROQ_API_KEY` and the Groq limits page. A free-plan cap clears when its window passes. Restart the API so it reads `.env` again.                                          |
| API process           | The monitor says the API could not be reached. The API writes no log of its own.                | Start the API again (`start:prod` for a built release). The monitor keeps running only if it is a separate process.                                                              |
| Wrong health password | `401`, and no health body.                                                                      | Set `HEALTH_USER` and `HEALTH_PASSWORD` to the pair the monitor sends. Restart both processes.                                                                                   |
| Microsoft sign-in     | The Microsoft button fails. Email-and-password sign-in still works.                             | Confirm the four `AZURE_AD_*` values. The app secret `local-dev` expires in 2028; after that date, create a new secret, put it in `AZURE_AD_CLIENT_SECRET`, and restart the API. |
| Mail                  | The request, message, or reminder is saved. The log says the send failed.                       | Set `MAILTRAP_HOST` to `smtp.gmail.com`, port `587`, `MAILTRAP_USER` and `NOTIFICATIONS_FROM_EMAIL` to the sending Gmail, and `MAILTRAP_PASS` to that account’s app password with the spaces removed. Restart the API. Gmail’s daily send cap clears on its own. |
| Release check         | `verify:release` stops on a red step.                                                            | That commit is not the release. Fix the failure and run the command again.                                                                                                       |
| Escalation sweep      | A reminder is late. Nothing already saved is lost.                                              | The next sweep tries again. `ESCALATION_CHECK_INTERVAL_MS=0` turns the timer off.                                                                                                |

Saved requests, messages, and files stay in the same Neon database through these failures. Recovery starts that same database and the same API again. It does not copy the data to a second database, and it does not replay a mail that was already dropped.

## 8. API-down drill

This is the recovery that was carried out. The live site is `https://internal-operations-service-hub.onrender.com`. The Render service is `internal-operations-service-hub`. Neon stays running for the whole drill. Only the API process is stopped, then started again.

There is no restart code. Resume on Render is the recovery. It runs `npm run start:prod` again. The request row is still in Neon, so the same page loads after the process is back.

### Known good state

Signed in on the live site as Jordan Admin (`admin-1@chamounjoseph2022outlook.onmicrosoft.com`, password in `backend/prisma/seed.ts`). Created one request and left its page open. The browser address is the request that must still open after recovery.

In a second terminal, from the repo root, with `HEALTH_USER` and `HEALTH_PASSWORD` already in `backend/.env`.

Command Prompt:

```bat
set HEALTH_URL=https://internal-operations-service-hub.onrender.com/health
npm run monitor
```

PowerShell:

```powershell
$env:HEALTH_URL="https://internal-operations-service-hub.onrender.com/health"
npm run monitor
```

The monitor is a separate process. It stays open for the whole drill. The first lines print `ok` and `database=ok ai=ok`. That is health before the failure.

### Controlled failure

On Render, open the service `internal-operations-service-hub` and choose Suspend. Do not delete the service. Do not change `DATABASE_URL`. Do not pause Neon.

The site stops loading. Render's edge still answers, with an HTML page instead of the health JSON. The monitor's fetch therefore succeeds, and reading that page as JSON fails. The printed detail is `Unexpected token '<', "<!DOCTYPE "... is not valid JSON`. A stopped process on your own machine, with nothing answering the port, prints `the API could not be reached` instead. Both mean `/health` did not return its JSON report. The third failure prints `ALERT`. The API writes no log of its own, because the process is not running. The request row is still in Neon. That is the capability that broke: the API process. The database did not break.

### Recovery

On the same Render service, choose Resume. Leave the monitor running. The first checks can still say `degraded` while the process is starting. The recovery is done when the monitor prints `RESOLVED` and the line includes `database=ok ai=ok`.

### Critical journey again

Sign in again with the same admin account. Open the same request address from the known good state. The request is still there. That proves the user journey, not only `/health`.

### Monitor transcript

Run on 28 Sep 2026 against `https://internal-operations-service-hub.onrender.com/health`. The same `degraded` line repeated from `13:14:13Z` until Resume. The health password is not in this output.

```text
2026-09-28T13:13:59.606Z ok HTTP 200 database=ok ai=ok
2026-09-28T13:14:01.973Z ok HTTP 200 database=ok ai=ok
2026-09-28T13:14:04.279Z ok HTTP 200 database=ok ai=ok
2026-09-28T13:14:06.608Z degraded Unexpected token '<', "<!DOCTYPE "... is not valid JSON
2026-09-28T13:14:08.853Z degraded Unexpected token '<', "<!DOCTYPE "... is not valid JSON
2026-09-28T13:14:11.141Z ALERT Ops Hub has not been ok for 3 checks in a row (degraded)
2026-09-28T13:14:13.428Z degraded Unexpected token '<', "<!DOCTYPE "... is not valid JSON
2026-09-28T13:15:21.200Z degraded Unexpected token '<', "<!DOCTYPE "... is not valid JSON
2026-09-28T13:15:45.541Z RESOLVED HTTP 200 database=ok ai=ok
2026-09-28T13:15:47.827Z ok HTTP 200 database=ok ai=ok
```

Request opened again after `RESOLVED`:

```text
https://internal-operations-service-hub.onrender.com/requests/dcc13fea-bc24-4a7f-86b0-7867c6fe4c02/full
```
