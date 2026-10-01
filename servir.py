#!/usr/bin/env python3
"""Servidor local para desenvolver.

Igual ao `python3 -m http.server`, com uma diferença que economiza tempo:
manda `Cache-Control: no-store`. Sem isso o navegador guarda os módulos ES e
continua rodando o código antigo depois de uma edição — e a pessoa fica
olhando para uma tela que não mudou, achando que o código está errado.

    python3 servir.py [porta]
"""
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class SemCache(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, formato, *args):
        if "404" in (formato % args):
            super().log_message(formato, *args)


if __name__ == "__main__":
    porta = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    print(f"chatflow em http://localhost:{porta}  ·  editor: /editor/index.html?cliente=osher")
    print("sem cache: editou, recarregou, mudou.  Ctrl+C para parar.")
    ThreadingHTTPServer(("", porta), partial(SemCache, directory=".")).serve_forever()
