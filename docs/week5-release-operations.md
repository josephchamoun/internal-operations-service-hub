# Week 5 — Release operations

## What this is

The release check for this repo, the protected health report, the separate monitor, and the written steps for getting back to a healthy system. The live app is not on a host yet. This document is the record for the commit you are about to call the release.

Nothing here repairs the app by itself. Each failure below says what you see and the step you take.

## 1. Release identity

The candidate is the commit that passed the checks. On your computer that is the commit `git rev-parse HEAD` prints. On GitHub it is the commit that was pushed. 

## 2. The release command

From the repo root:

```bash
npm run verify:release
```

That command runs, in order:

1. `db:setup` in `backend`: `prisma db push`, then `prisma db seed`, using `DATABASE_URL`.
2. Backend build (`nest build`).
3. Frontend build (`tsc -b`, then `vite build`).
4. Backend typecheck (`tsc --noEmit`).
5. Backend unit tests (`npm test`).
6. The AI intake evals.

`npm test` skips `requests.repository.integration.spec.ts`. That spec, and the end-to-end tests, write and wipe rows. On your computer this command uses the live Neon database, so those tests are not part of it. GitHub runs them afterward, on a database it creates for the run and then deletes. See section 3.

The command does not call Microsoft. It does not send mail.

Seed creates one admin, Jordan Admin, and only when that user is missing. If the admin is already there, seed prints `Admin already exists. Skipping seed.` and leaves every existing row as it is.

On your computer, `DATABASE_URL` is the live Neon database, so this command updates that database's schema and then runs the seed above. On GitHub, the workflow points `DATABASE_URL` at a temporary database first, so the same command there does not touch Neon.

## 3. GitHub

`.github/workflows/tests.yml` is named `verify release`. GitHub runs it on every push and every pull request. It does not run on the live site.

The workflow starts Postgres 16 for that run only, with user `postgres`, password `postgres`, and database `ops_hub_test`. It sets `JWT_SECRET` to `ci-test-secret`. Those values exist only inside that run. The real Neon password, Microsoft secret, Groq key, and mail password stay in `backend/.env` and are not in this file.

Node is 22. The workflow installs dependencies, generates the Prisma client, runs `npm run verify:release`, then runs `npm --prefix backend run test:db`.

`test:db` is the long suite: the requests integration spec, then the end-to-end tests (create and edit a request, claim, messages and files, silence, escalation, admin changes, and the 5-per-minute limit). GitHub deletes the temporary database when the run ends.

Removing the workflow folder does not stop the app. It stops GitHub from running these checks. The command still works when you type it.

## 4. Release configuration

Required names, values stay out of git:

| Name                                                                                           | Role                                                                                                                                                                                   |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                                                                 | Neon connection for a real run. GitHub replaces it with the temporary database.                                                                                                        |
| `JWT_SECRET`, `JWT_EXPIRES_IN`                                                                 | Session signing.                                                                                                                                                                       |
| `NODE_ENV`                                                                                     | `production` turns off the manual reminder button, `POST /escalations/run`.                                                                                                           |
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
| Automated confidence | `verify:release` passes, and the GitHub run passes, including `test:db`                                       | a check failed, or the GitHub run did not happen       |
| Configuration        | every required name in section 4 is set for that environment, and real secrets are only in `.env` or the host | a required name is missing, or a real secret is in git |
| Health               | `GET /health` is `ok`, with database and AI both `ok`                                                         | `not-ok`, or `401`                                     |
| Critical smoke       | the GitHub long tests passed: create, claim, message, silence, escalation, admin, rate limit                  | that suite failed or was not run                       |
| Recovery             | the matching row in section 7 is the step you would take                                                      | a failure with no written step                         |

The long tests sign in with `POST /auth/password`, the same door as the website. Mail in those tests is a stand-in, so they do not send a real message. A Microsoft browser login is not part of this suite.

## 7. Failures and recovery

| What failed           | What you see                                                                                    | Recovery                                                                                                                                                                         |
| --------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Database              | Health says `database: not-ok`. The log says the database could not be reached. New saves fail. | Check `DATABASE_URL`. Wake Neon if it has paused. Restart the API. Call `/health` again and wait until `database` is `ok`.                                                       |
| Groq                  | Health says `ai: not-ok`. The suggestion call fails. The request form still saves.              | Check `GROQ_API_KEY` and the Groq limits page. A free-plan cap clears when its window passes. Restart the API so it reads `.env` again.                                          |
| API process           | The monitor says the API could not be reached. The API writes no log of its own.                | Start the API again (`start:prod` for a built release). The monitor keeps running only if it is a separate process.                                                              |
| Wrong health password | `401`, and no health body.                                                                      | Set `HEALTH_USER` and `HEALTH_PASSWORD` to the pair the monitor sends. Restart both processes.                                                                                   |
| Microsoft sign-in     | The Microsoft button fails. Email-and-password sign-in still works.                             | Confirm the four `AZURE_AD_*` values. The app secret `local-dev` expires in 2028; after that date, create a new secret, put it in `AZURE_AD_CLIENT_SECRET`, and restart the API. |
| Mail                  | The request, message, or reminder is saved. The log says the send failed.                       | Set `MAILTRAP_HOST` to `smtp.gmail.com`, port `587`, `MAILTRAP_USER` and `NOTIFICATIONS_FROM_EMAIL` to the sending Gmail, and `MAILTRAP_PASS` to that account’s app password with the spaces removed. Restart the API. Gmail’s daily send cap clears on its own. |
| Release check         | `verify:release` or the GitHub run stops on a red step.                                         | That commit is not the release. Fix the failure and run the command again.                                                                                                       |
| Escalation sweep      | A reminder is late. Nothing already saved is lost.                                              | The next sweep tries again. `ESCALATION_CHECK_INTERVAL_MS=0` turns the timer off.                                                                                                |

Saved requests, messages, and files stay in the same Neon database through these failures. Recovery starts that same database and the same API again. It does not copy the data to a second database, and it does not replay a mail that was already dropped.
