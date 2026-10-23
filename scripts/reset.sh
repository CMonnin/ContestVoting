#!/usr/bin/env bash
# Wipe the test data and start the app for the real contest.
#
# Run on the server, from the repo directory, after editing .env for launch:
# real OPEN_AT and ALLOWED_DOMAINS, PREVIEW_EMAILS empty. This script checks
# those, deletes ./data (database + photos), rotates SESSION_SECRET and
# restarts the container.
#
# It refuses to run once OPEN_AT has passed, so it can't wipe the real contest.
set -euo pipefail
cd "$(dirname "$0")/.."

die() { echo "reset: $*" >&2; exit 1; }
env_get() { grep -E "^$1=" .env | tail -n1 | cut -d= -f2- | tr -d '"' || true; }

[[ -f .env && -f compose.yaml ]] || die "run from the repo directory (no .env or compose.yaml here)"

tz=$(env_get TZ_CONTEST); tz=${tz:-America/Montreal}
open_at=$(env_get OPEN_AT)
now=$(TZ=$tz date +%Y-%m-%dT%H:%M)
domains=$(env_get ALLOWED_DOMAINS)
preview=$(env_get PREVIEW_EMAILS)
transport=$(env_get MAIL_TRANSPORT)

[[ -n $open_at ]] || die "OPEN_AT is not set in .env"
[[ $open_at > $now ]] || die "OPEN_AT ($open_at) has passed (now $now in $tz). Refusing to wipe a live contest."
[[ -n $domains && $domains != *test.invalid* ]] || die "ALLOWED_DOMAINS is still the test value ($domains)"
[[ -z $preview ]] || die "PREVIEW_EMAILS is not empty ($preview)"
[[ $transport != console ]] || die "MAIL_TRANSPORT is console; launch needs smtp"

cat <<EOF
About to launch with:
  OPEN_AT          $open_at ($tz)
  SUBMIT_CLOSE_AT  $(env_get SUBMIT_CLOSE_AT)
  VOTE_CLOSE_AT    $(env_get VOTE_CLOSE_AT)
  SESSION_END_AT   $(env_get SESSION_END_AT)
  ALLOWED_DOMAINS  $domains
  ADMIN_EMAILS     $(env_get ADMIN_EMAILS)

This DELETES ./data (all test entries, photos, votes, sessions) for good.
EOF
read -rp "Type wipe to continue: " answer
[[ $answer == wipe ]] || die "cancelled"

docker compose down
sudo rm -rf ./data
mkdir data
sudo chown 1000:1000 data   # the container runs as uid 1000

sed -i "s/^SESSION_SECRET=.*/SESSION_SECRET=$(openssl rand -hex 32)/" .env
echo "SESSION_SECRET rotated."

docker compose up -d --build
sleep 3
docker compose logs --tail=5 app
echo
echo "Now check: landing page loads, a McGill login is refused until $open_at, admin login works."
