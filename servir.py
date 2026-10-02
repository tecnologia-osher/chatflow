#!/usr/bin/env python3
"""Servidor local para desenvolver.

Igual ao `python3 -m http.server`, com duas diferenças:

1. Manda `Cache-Control: no-store`. Sem isso o navegador guarda os módulos ES
   e continua rodando o código antigo depois de uma edição — e a pessoa fica
   olhando para uma tela que não mudou, achando que o código está errado.

2. Aceita `PUT` para gravar o fluxo que o editor manda. É isso que faz o
   botão "Salvar" existir enquanto não há servidor de verdade (sub-projeto 3):
   o editor escreve no arquivo do cliente, nesta máquina. Publicar continua
   sendo commit e push.

Só grava em `clientes/<nome>/fluxo.json` e `exemplos/<nome>.json`, com o nome
sem barra nem ponto-ponto, e só se o corpo for JSON válido. É servidor de
bancada, mas um PUT que aceita qualquer caminho é um buraco grande demais para
deixar aberto, mesmo em casa.

    python3 servir.py [porta]
"""
import json
import re
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

GRAVAVEIS = (
    re.compile(r"^/clientes/[a-z0-9_-]+/fluxo\.json$"),
    re.compile(r"^/exemplos/[a-z0-9_-]+\.json$"),
)
LIMITE = 2 * 1024 * 1024


class SemCache(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, formato, *args):
        if "404" in (formato % args):
            super().log_message(formato, *args)

    def responder(self, codigo, recado):
        corpo = json.dumps({"recado": recado}, ensure_ascii=False).encode()
        self.send_response(codigo)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(corpo)))
        self.end_headers()
        self.wfile.write(corpo)

    def do_PUT(self):
        caminho = self.path.split("?")[0]
        if not any(regra.match(caminho) for regra in GRAVAVEIS):
            return self.responder(403, f"Não gravo em {caminho}.")

        tamanho = int(self.headers.get("Content-Length") or 0)
        if tamanho <= 0 or tamanho > LIMITE:
            return self.responder(413, "Corpo vazio ou grande demais.")

        bruto = self.rfile.read(tamanho)
        try:
            dados = json.loads(bruto)
        except ValueError as falha:
            return self.responder(400, f"Isso não é JSON: {falha}")

        destino = Path(".") / caminho.lstrip("/")
        if not destino.parent.is_dir():
            return self.responder(404, f"A pasta de {caminho} não existe.")

        # Escreve formatado, do mesmo jeito que o arquivo está no git: assim o
        # diff mostra o que mudou no fluxo, não a linha inteira reescrita.
        destino.write_text(json.dumps(dados, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        self.responder(200, f"Gravei {caminho}.")


if __name__ == "__main__":
    porta = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    print(f"chatflow em http://localhost:{porta}  ·  editor: /editor/index.html?cliente=osher")
    print("sem cache: editou, recarregou, mudou.  Ctrl+C para parar.")
    ThreadingHTTPServer(("", porta), partial(SemCache, directory=".")).serve_forever()
