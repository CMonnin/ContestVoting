# DRC Halloween 2026 — costume contest voting

Voting site for the Douglas Research Centre Halloween costume contest, at
<https://halloween2026.douglasneuroinformatics.ca>. Brought to you by the
[DNP](https://douglasneuroinformatics.ca).
Ideally it will be generalizable for other such events.

Design: [SPEC.md](SPEC.md). Progress: [TASKS.md](TASKS.md).

## Stack

Node 24 runs the TypeScript directly (type stripping, no build step). Hono for
HTTP, server-rendered HTML, built-in `node:sqlite`, nodemailer over SMTP
(Scaleway Transactional Email). Login is a 6-digit code sent to an
institutional email address.

## Develop

```sh
npm install
cp .env.example .env    # set MAIL_TRANSPORT=console, BASE_URL=http://localhost:3000,
                        # DATA_DIR=./data, SESSION_SECRET=$(openssl rand -base64 48)
npm run dev             # codes are printed to the terminal
npm test
npm run typecheck
```

To try the open phase before the contest, set `OPEN_AT` to a past time in `.env`.

## Deploy (DNP server)

```sh
cp .env.example .env    # fill SMTP_*, ADMIN_EMAILS, SESSION_SECRET
mkdir -p data && sudo chown 1000:1000 data   # container runs as uid 1000
docker compose up -d --build
```

Add `deploy/Caddyfile` to the server's Caddy config and reload Caddy. The app
listens on `127.0.0.1:3000` only; Caddy terminates TLS.

### Test round, then launch

Run a test round on the real server first. In `.env`:

```sh
OPEN_AT=2026-10-23T08:00              # in the past: everything unlocked
ALLOWED_DOMAINS=test.invalid          # nobody else can log in
PREVIEW_EMAILS=tester1@mcgill.ca,...  # the testers (admins can log in too)
```

Anyone can see the gallery meanwhile (the poster QR is out), so name test
entries clearly, e.g. "TEST – Dracula". To try later phases, move
`SUBMIT_CLOSE_AT` / `VOTE_CLOSE_AT` earlier and `docker compose up -d`.

To launch (by 10-29, not the morning of), set the real `OPEN_AT` and
`ALLOWED_DOMAINS` and empty `PREVIEW_EMAILS` in `.env`, then:

```sh
scripts/reset.sh
```

It checks `.env`, asks you to type `wipe`, deletes `./data` (test entries,
photos, votes, sessions), rotates `SESSION_SECRET` and restarts the
container. It refuses to run once `OPEN_AT` has passed. Afterwards check that
the landing page loads, a McGill login is refused until opening, and admin
login works.

## Landing page

The landing page is the organizers' `index.html` (with `landing.js`,
`images/` and `fonts/`), served at `/`. The app turns its two buttons on as
the contest moves along. Edit it like any static page, then rebuild the
container.

## Deliverability test

Before the contest, check that the login emails reach institutional inboxes:

```sh
docker compose run --rm app node scripts/send-test.ts alice@mcgill.ca bob@ssss.gouv.qc.ca
```

Each recipient reports arrival time and whether the email landed in Junk.

Before the DNS records exist, `--verify` checks the SMTP port and
credentials without sending anything:

```sh
node --env-file=.env scripts/send-test.ts --verify
```

To log in before the contest opens, put the address in `ADMIN_EMAILS` or
`PREVIEW_EMAILS`.

## License

MIT
