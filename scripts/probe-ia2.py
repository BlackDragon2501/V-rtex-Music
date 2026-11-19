#!/usr/bin/env python3
"""Prueba qué ruta de red alcanza archive.org desde este entorno.

Combinaciones: acceso directo + 4 proxies públicos de fetch, contra
metadata (objeto conocido) y advancedsearch (búsqueda del álbum del usuario).
"""
import ssl
import urllib.parse
import urllib.request

UA = "VortexMusicProbe/1.0 (verificacion de fuente)"
CTX = ssl.create_default_context()

META = "https://archive.org/metadata/gd1977-05-08.sbd.hicks.4982.sbeok.shnf"
ADV = (
    "https://archive.org/advancedsearch.php?q=%22Herida+Eterna%22"
    "+AND+mediatype%3A%28audio%29&fl%5B%5D=identifier&fl%5B%5D=title"
    "&fl%5B%5D=creator&fl%5B%5D=collection&rows=20&output=json"
)

PROXIES = [
    ("directo", lambda u: u),
    ("allorigins", lambda u: "https://api.allorigins.win/raw?url=" + urllib.parse.quote(u, safe="")),
    ("codetabs", lambda u: "https://api.codetabs.com/v1/proxy?quest=" + urllib.parse.quote(u, safe="")),
    ("corsproxy", lambda u: "https://corsproxy.io/?url=" + urllib.parse.quote(u, safe="")),
    ("jina", lambda u: "https://r.jina.ai/" + u),
]


def get(url: str, timeout: int = 30):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout, context=CTX) as r:
        return r.status, r.read()


for name, mk in PROXIES:
    for label, target in (("meta", META), ("adv", ADV)):
        tag = f"[{name}/{label}]"
        try:
            st, body = get(mk(target), 35)
            text = body[:900].decode("utf-8", "replace")
            print(f"{tag} HTTP {st}: {text[:600]}")
        except Exception as e:  # noqa: BLE001
            print(f"{tag} ERROR: {type(e).__name__}: {e}")
        print("-" * 60)
