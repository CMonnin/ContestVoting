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

### Test entries

Drop image files into `images/test-entries/` to pre-populate the gallery:

```
images/test-entries/
  individual/     ← one image per entry (category: individual)
  team/           ← one image per entry (category: group)
```

On startup the app scans these folders, processes each image through the
normal photo pipeline (resize, WebP, strip metadata), and inserts it as a
pre-approved entry. The entry name comes from the filename (e.g. `tom.png`
→ "Tom"). Each entry gets a synthetic owner (`test-<file>@test.invalid`),
so seeding is idempotent — restarting won't duplicate entries.

The `images/test-entries/` directory is gitignored. To use it:

```sh
mkdir -p images/test-entries/individual images/test-entries/team
cp ~/photos/alice.png images/test-entries/individual/
cp ~/photos/team-photo.jpg images/test-entries/team/
npm run dev
```

In Docker, mount or copy the images into the container's
`images/test-entries/` before starting. They are only read at startup.

## Deploy (DNP server)

Step by step for the sysadmin, including the test round, launch
(`scripts/reset.sh`) and teardown: [DEPLOY.md](DEPLOY.md).

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
