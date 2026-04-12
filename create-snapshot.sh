#!/bin/bash
set -eu

# Dette scriptet avhenger av energi-data mappen lokalt.

scp -C root@fcos-3.nrec.foreningenbs.no:/var/mnt/data/energi-extractor/data.json extractor/data.json
MONTHLY_DETAILS_FILE=../report/monthly-details.json pnpm run --filter ./extractor generate-report

set -x
cp extractor/data.json ../energi-data/data.json
cp report/report.json ../energi-data/report.json
cp report/monthly-details.json ../energi-data/monthly-details.json

cd ../energi-data
git add data.json report.json monthly-details.json
git commit -m "Update data snapshot"
