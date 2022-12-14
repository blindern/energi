# Uthenting av data

## Bruk

Opprett `.env` og definer det som er påkrevet i `config.ts`.

Installer avhengigheter:

```bash
npm ci
```

Trekk ut data:

```bash
npx ts-node src/cli/temperatur.ts >/tmp/temperatur.csv
npx ts-node src/cli/stroem.ts 2022-09-01 2022-09-25 >/tmp/stroem.csv
npx ts-node src/cli/fjernvarme.ts 2022-01-01 2022-09-26 >/tmp/fjernvarme.csv
npx ts-node src/cli/nordpool.ts 2022-09-26 >/tmp/nordpool.csv
```

## Tilgjengelige data

- **Fjernvarme:** Fra Hafslund Oslo Celsio kan vi hente ut data frem til og med
  forrige time. Data er tilgjengelig anslagsvis 15-30 minutter etter timen
  er avsluttet.

- **Strøm:** Fra Fortum kan vi hente ut data frem til gårsdagen. Det er ikke timedata
  tilgjengelig for inneværende dag.

  Merk at Fortum ikke ser ut til å ha noe egnet API, og de nye sidene deres
  bruker et mer komplisert Websocket-oppsett kontra de gamle sidene som er
  rent HTTP-basert (men session styrt). Derfor "scraper" vi data fra de gamle
  sidene deres da dette var enklere å få fort opp og gå.
