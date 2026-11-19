#!/usr/bin/env python3
"""Segunda ronda: más proxies, reintentos y dominios alternativos de IA."""
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request

UA = "VortexMusicProbe/1.0"
CTX = ssl.create_default_context()

META = "https://archive.org/metadata/gd1977-05-08.sbd.hicks.4982.sbeok.shnf"

TARGETS = [
    ("allorigins", "https://api.allorigins.win/raw?url=" + urllib.parse.quote(META, safe="")),
    ("codetabs", "https://api.codetabs.com/v1/proxy?quest=" + urllib.parse.quote(META, safe="")),
    ("corsfix", "https://proxy.corsfix.com/?" + META),
    ("cors-lol", "https://api.cors.lol/?url=" + urllib.parse.quote(META, safe="")),
    ("whateverorigin", "https://www.whateverorigin.org/get?url=" + urllib.parse.quote(META, safe="")),
    ("web.archive.org directo", "https://web.archive.org/web/2025id_/" + META),
    ("dweb", "https://dweb.archive.org/metadata/gd1977-05-08.sbd.hicks.4982.sbeok.shnf"),
]


def get(url: str, timeout: int = 25):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout, context=CTX) as r:
        return r.status, r.read()


for name, url in TARGETS:
    for intento in range(2):
        tag = f"[{name} try{intento + 1}]"
        try:
            st, body = get(url)
            print(f"{tag} HTTP {st}: {body[:400].decode('utf-8', 'replace')}")
            break
        except urllib.error.HTTPError as e:
            print(f"{tag} HTTP {e.code} {e.reason}")
            if intento == 0:
                time.sleep(4)
        except Exception as e:  # noqa: BLE001
            print(f"{tag} ERROR {type(e).__name__}: {e}")
            break
    print("-" * 60)
