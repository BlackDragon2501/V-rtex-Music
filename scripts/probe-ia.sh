#!/bin/bash
# Diagnóstico de conectividad con archive.org desde este entorno.
# Prueba los 3 endpoints que usa la app, con pausas para no agravar el 429.
UA='VortexMusicApp/1.0 (reproductor web; contacto: vortexmusic.soporte.app@gmail.com)'

echo "Esperando 45s para dejar enfriar el rate-limit..."
sleep 45

echo "--- 1) advancedsearch (búsqueda) ---"
code=$(curl -s -o /tmp/adv.json -w "%{http_code}" --max-time 25 -A "$UA" \
  'https://archive.org/advancedsearch.php?q=%22Herida+Eterna%22+AND+mediatype%3A%28audio%29&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=creator&fl%5B%5D=collection&rows=15&output=json')
echo "HTTP $code"
head -c 1500 /tmp/adv.json; echo

sleep 8
echo "--- 2) metadata (archivos de un objeto conocido) ---"
code=$(curl -s -o /tmp/meta.json -w "%{http_code}" --max-time 25 -A "$UA" \
  'https://archive.org/metadata/gd1977-05-08.sbd.hicks.4982.sbeok.shnf')
echo "HTTP $code"
head -c 400 /tmp/meta.json; echo

sleep 8
echo "--- 3) scrape v1 (API alternativa de búsqueda) ---"
code=$(curl -s -o /tmp/scrape.json -w "%{http_code}" --max-time 25 -A "$UA" \
  'https://archive.org/services/search/v1/scrape?q=mediatype%3A%28audio%29+AND+%22Herida+Eterna%22&fields=identifier,title,creator&count=100')
echo "HTTP $code"
head -c 1500 /tmp/scrape.json; echo
