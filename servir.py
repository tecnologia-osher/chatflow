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

3. Aceita `POST /api/projetos` para criar um projeto: abre a pasta
   `clientes/<id>/`, escreve o `fluxo.json` e põe o id no `clientes/index.json`,
   que é a lista que a primeira página lê.

Só grava em `clientes/<nome>/fluxo.json`, `clientes/<nome>/tema.json` e
`exemplos/<nome>.json`, com o nome sem barra nem ponto-ponto, e só se o corpo
for JSON válido. É servidor de
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
    re.compile(r"^/clientes/[a-z0-9_-]+/(fluxo|tema)\.json$"),
    re.compile(r"^/exemplos/[a-z0-9_-]+\.json$"),
)
LIMITE = 2 * 1024 * 1024
# A pasta de um projeto novo. O id vem da página já limpo, mas quem confere é
# quem escreve: este padrão é o que separa um nome de pasta de um caminho.
ID_DE_PROJETO = re.compile(r"^[a-z0-9][a-z0-9_-]{0,39}$")
INDICE = Path("clientes/index.json")


class SemCache(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, formato, *args):
        if "404" in (formato % args):
            super().log_message(formato, *args)

    def responder(self, codigo, recado, **extra):
        corpo = json.dumps({"recado": recado, **extra}, ensure_ascii=False).encode()
        self.send_response(codigo)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(corpo)))
        self.end_headers()
        self.wfile.write(corpo)

    def do_POST(self):
        caminho = self.path.split("?")[0]
        if caminho != "/api/projetos":
            return self.responder(404, f"Não atendo {caminho}.")

        tamanho = int(self.headers.get("Content-Length") or 0)
        if tamanho <= 0 or tamanho > LIMITE:
            return self.responder(413, "Corpo vazio ou grande demais.")
        try:
            pedido = json.loads(self.rfile.read(tamanho))
        except ValueError as falha:
            return self.responder(400, f"Isso não é JSON: {falha}")

        fluxo = pedido.get("fluxo")
        if not isinstance(fluxo, dict) or not isinstance(fluxo.get("grupos"), list):
            return self.responder(400, "Isso não parece um fluxo do chatflow.")

        indice = ler_indice()
        tomados = {p.get("id") for p in indice["projetos"]} | {
            caminho.name for caminho in Path("clientes").iterdir() if caminho.is_dir()
        }
        identificador = id_livre(pedido.get("nome") or fluxo.get("nome") or "projeto", tomados)
        if not ID_DE_PROJETO.match(identificador):
            return self.responder(400, f"Id inválido: {identificador}.")

        pasta = Path("clientes") / identificador
        pasta.mkdir(parents=True, exist_ok=False)
        gravar(pasta / "fluxo.json", fluxo)

        indice["projetos"].append({"id": identificador})
        gravar(INDICE, indice)
        self.responder(200, f"Criei clientes/{identificador}.", id=identificador)

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


def gravar(destino, dados):
    """Escreve formatado, do mesmo jeito que o arquivo está no git: assim o
    diff mostra o que mudou, não a linha inteira reescrita."""
    destino.write_text(json.dumps(dados, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def ler_indice():
    try:
        dados = json.loads(INDICE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        dados = {}
    if not isinstance(dados.get("projetos"), list):
        dados = {"projetos": []}
    return dados


def id_livre(nome, tomados):
    """Mesma limpeza que a página faz, repetida aqui porque quem escreve no
    disco não confia no que vem pela rede."""
    import unicodedata

    sem_acento = unicodedata.normalize("NFD", str(nome))
    sem_acento = "".join(c for c in sem_acento if unicodedata.category(c) != "Mn")
    base = re.sub(r"[^a-z0-9]+", "-", sem_acento.lower()).strip("-")[:40] or "projeto"
    if base not in tomados:
        return base
    numero = 2
    while f"{base}-{numero}" in tomados:
        numero += 1
    return f"{base}-{numero}"


if __name__ == "__main__":
    porta = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    print(f"chatflow em http://localhost:{porta}  ·  editor: /editor/index.html?cliente=osher")
    print("sem cache: editou, recarregou, mudou.  Ctrl+C para parar.")
    ThreadingHTTPServer(("", porta), partial(SemCache, directory=".")).serve_forever()
