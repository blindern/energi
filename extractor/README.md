# Uthenting av data

## Bruk

Opprett `.env` og definer det som er påkrevet i `config.ts`.

Installer avhengigheter:

```bash
corepack enable
pnpm install
```

Trekk ut data:

```bash
pnpm tsx src/cli/temperatur.ts >/tmp/temperatur.csv
pnpm tsx src/cli/stroem.ts 2022-09-01 2022-09-25 >/tmp/stroem.csv
pnpm tsx src/cli/fjernvarme.ts 2022-01-01 2022-09-26 >/tmp/fjernvarme.csv
pnpm tsx src/cli/nordpool.ts 2025-12-01 >/tmp/nordpool.csv
```

## Tilgjengelige data

- **Fjernvarme:** Fra Hafslund Oslo Celsio kan vi hente ut data frem til og med
  forrige time. Data er tilgjengelig anslagsvis 15-30 minutter etter timen
  er avsluttet.

- **Strøm:** Fra Elvia kan vi hente ut data frem til og med forrige time. Noe sporadisk
  forsinkelse på dataene.

  Merk at Elvia sitt API ikke kan brukes av oss som bedrift (kun støttet
  for privatpersoner), så derfor henter vi data tilsvarende som web-klienten.
