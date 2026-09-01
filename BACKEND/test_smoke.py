"""Smoke test da API usando SQLite em memória (não precisa de MySQL).

Roda: venv/Scripts/python test_smoke.py
"""

import os

_TEST_DB = "./test_smoke.db"
if os.path.exists(_TEST_DB):
    os.remove(_TEST_DB)
os.environ["DATABASE_URL"] = f"sqlite:///{_TEST_DB}"
os.environ["API_BASE_URL"] = "http://localhost:8000"

from fastapi.testclient import TestClient  # noqa: E402

from app.database import Base, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.seed import seed_conteudo, seed_usuarios  # noqa: E402
from app.database import SessionLocal  # noqa: E402

Base.metadata.create_all(bind=engine)
db = SessionLocal()
seed_conteudo(db)
seed_usuarios(db)
db.close()

client = TestClient(app)
FALHAS = []


def checar(nome, cond, extra=""):
    status = "OK " if cond else "FALHA"
    print(f"  [{status}] {nome} {extra}")
    if not cond:
        FALHAS.append(nome)


print("1) Health")
r = client.get("/health")
checar("health", r.status_code == 200)

print("2) Login (aluno)")
r = client.post("/auth/login", json={"email": "aluno@sacou.com", "senha": "123456"})
checar("login aluno", r.status_code == 200, f"-> {r.status_code}")
token_aluno = r.json()["access_token"]
h_aluno = {"Authorization": f"Bearer {token_aluno}"}
checar("usuario.aluno", r.json()["usuario"]["tipo_perfil"] == "ALUNO")

print("3) Login admin")
r = client.post("/auth/login", json={"email": "admin@sacou.com", "senha": "admin123"})
checar("login admin", r.status_code == 200)
h_admin = {"Authorization": f"Bearer {r.json()['access_token']}"}

print("4) Login errado")
r = client.post("/auth/login", json={"email": "aluno@sacou.com", "senha": "errada"})
checar("login rejeitado", r.status_code == 401)

print("5) /trilhas (conteudo mobile)")
r = client.get("/trilhas", headers=h_aluno)
checar("trilhas 200", r.status_code == 200)
trilhas = r.json()
checar("3 trilhas", len(trilhas) == 3)
checar("12 licoes", sum(len(t["licoes"]) for t in trilhas) == 12)

print("6) /licoes/1 (aula 1)")
r = client.get("/licoes/1", headers=h_aluno)
licao1 = r.json()
checar("licao1 200", r.status_code == 200)
checar("licao1 titulo", licao1["titulo"].startswith("AULA 1"))
checar("licao1 conteudo", len(licao1["conteudo"]) >= 3, f"({len(licao1['conteudo'])} linhas)")
checar("licao1 audio", licao1["audio_url"] is not None and "audioAula1.mp3" in licao1["audio_url"])
checar("licao1 3 perguntas", len(licao1["perguntas"]) == 3)
checar(
    "licao1 alternativa correta existe",
    any(a["eh_correta"] for a in licao1["perguntas"][0]["alternativas"]),
)
checar(
    "licao1 cada pergunta tem 2 opcoes",
    all(len(p["alternativas"]) == 2 for p in licao1["perguntas"]),
)

print("7) GET /licoes sem token")
client.cookies.clear()  # remove o cookie HttpOnly deixado pelo login anterior
r = client.get("/licoes")
checar("sem token 401", r.status_code == 401)

print("8) CRUD desktop: criar pergunta")
r = client.post(
    "/conteudo/perguntas",
    headers=h_admin,
    json={
        "id_licao": 1,
        "enunciado": "Pergunta de teste criada pelo desktop?",
        "alternativas": [
            {"texto": "Errada", "eh_correta": False},
            {"texto": "Certa", "eh_correta": True},
        ],
    },
)
checar("criar pergunta", r.status_code == 201, f"-> {r.status_code} {r.text[:120]}")
id_pergunta = r.json()["id_pergunta"]

print("9) CRUD: editar pergunta")
r = client.put(
    f"/conteudo/perguntas/{id_pergunta}",
    headers=h_admin,
    json={"enunciado": "Enunciado editado?"},
)
checar("editar pergunta", r.status_code == 200)

print("10) CRUD: criar licao")
r = client.post(
    "/conteudo/licoes",
    headers=h_admin,
    json={
        "id_trilha": 2,
        "titulo": "AULA TESTE: Criada no desktop",
        "conteudo_video": "Linha 1\nLinha 2",
        "ordem": 99,
    },
)
checar("criar licao", r.status_code == 201, f"-> {r.status_code} {r.text[:120]}")
id_licao = r.json()["id_licao"]

print("11) CRUD: deletar pergunta e licao")
r = client.delete(f"/conteudo/perguntas/{id_pergunta}", headers=h_admin)
checar("deletar pergunta", r.status_code == 204)
r = client.delete(f"/conteudo/licoes/{id_licao}", headers=h_admin)
checar("deletar licao", r.status_code == 204)

print("12) CRUD: aluno bloqueado de editar")
r = client.post(
    "/conteudo/perguntas",
    headers=h_aluno,
    json={"id_licao": 1, "enunciado": "x"},
)
checar("aluno negado (403)", r.status_code == 403)

print("13) Progresso: registrar respostas corretas (aprovado)")
def _respostas_corretas(licao_id):
    """Índices das alternativas corretas de cada pergunta da lição (gabarito real)."""
    r = client.get("/conteudo/perguntas", headers=h_admin)
    saida = []
    for q in r.json():
        if q["id_licao"] == licao_id:
            for idx, alt in enumerate(q["alternativas"]):
                if alt.get("eh_correta"):
                    saida.append(idx)
                    break
    return saida

r = client.post(
    "/progresso/alunos/2/licoes/1",
    headers=h_aluno,
    json={"id_licao": 1, "respostas_selecionadas": _respostas_corretas(1)},
)
checar("progresso 200", r.status_code == 200, f"-> {r.status_code} {r.text[:160]}")
if r.status_code == 200:
    body = r.json()
    checar("aprovado", body["status_aprovacao"] is True)
    checar("moedas concedidas", body["moedas_total"] >= 30, f"({body['moedas_total']})")
    checar("licao concluida", 1 in body["licoes_concluidas"])

print("14) Progresso: registrar de novo (sem dobra de moeda)")
r = client.post(
    "/progresso/alunos/2/licoes/1",
    headers=h_aluno,
    json={"id_licao": 1, "respostas_selecionadas": _respostas_corretas(1)},
)
body = r.json()
checar("nao dobra moedas", body["moedas_total"] == 30, f"({body['moedas_total']})")

print("15) Progresso: reprovado (1 correta, 2 erradas)")
corretas2 = _respostas_corretas(2)
respostas2 = [corretas2[0], 999, 999] if len(corretas2) >= 1 else [999, 999, 999]
r = client.post(
    "/progresso/alunos/2/licoes/2",
    headers=h_aluno,
    json={"id_licao": 2, "respostas_selecionadas": respostas2},
)
body = r.json()
checar("reprovado", body["status_aprovacao"] is False)

print("16) Escolas (web)")
r = client.get("/escolas", headers=h_admin)
checar("listar escolas", r.status_code == 200 and len(r.json()) >= 1)
if r.status_code == 200 and r.json():
    e0 = r.json()[0]
    checar("campos de contagem", "total_coordenadores" in e0 and "total_professores" in e0)
    nomes = [e["nome_instituicao"] for e in r.json()]
    checar("ordem alfabetica", nomes == sorted(nomes, key=str.lower), f"({nomes[:4]})")
r = client.post(
    "/escolas/1/turmas",
    headers=h_admin,
    json={"id_escola": 1, "nome_serie": "2º Ano EM", "ano_letivo": 2026, "nome_turma": "Turma B"},
)
checar("criar turma", r.status_code == 201, f"-> {r.status_code} {r.text[:120]}")

print("17) Escola: obter/atualizar")
r = client.get("/escolas/1", headers=h_admin)
checar("obter escola", r.status_code == 200 and r.json()["nome_instituicao"], f"-> {r.status_code}")
r = client.put(
    "/escolas/1",
    headers=h_admin,
    json={"nome_instituicao": "Colégio Sacou (Web)"},
)
checar("atualizar escola", r.status_code == 200 and "Web" in r.json()["nome_instituicao"])

print("18) Dashboard da escola")
r = client.get("/escolas/1/dashboard", headers=h_admin)
checar("dashboard 200", r.status_code == 200, f"-> {r.status_code} {r.text[:140]}")
if r.status_code == 200:
    d = r.json()
    checar("qtd_turmas >= 1", d["qtd_turmas"] >= 1, f"({d['qtd_turmas']})")
    checar("ranking tem nickname/moedas", all(k in it for it in d["ranking"] for k in ("nickname", "moedas_total")) or len(d["ranking"]) == 0)
    checar("dashboard tem desempenho/trilhas", "desempenho_acertos" in d and "trilhas" in d and "financeiro" in d)

print("18b) Dashboard com filtro de turma")
r = client.get("/escolas/1/dashboard?turma_id=1", headers=h_admin)
checar("dashboard turma 200", r.status_code == 200, f"-> {r.status_code}")
r = client.get("/escolas/1/dashboard?turma_id=99999", headers=h_admin)
checar("turma inexistente 404", r.status_code == 404, f"-> {r.status_code}")
r = client.get("/escolas/1/dashboard?data_inicio=2024-01-01&data_fim=2026-12-31", headers=h_admin)
checar("dashboard periodo 200", r.status_code == 200, f"-> {r.status_code}")

print("19) Listar usuários da escola")
r = client.get("/escolas/1/usuarios", headers=h_admin)
checar("usuarios 200", r.status_code == 200, f"-> {r.status_code} {r.text[:140]}")
if r.status_code == 200:
    u = r.json()
    checar("coordenador presente", any(x["tipo_perfil"] == "COORDENADOR" for x in u))
    checar("aluno presente com turma", any(x["tipo_perfil"] == "ALUNO" and x["nome_turma"] for x in u))

print("20) Criar aluno via web")
r = client.post(
    "/escolas/1/usuarios",
    headers=h_admin,
    json={
        "nome_completo": "Aluno Web Teste",
        "email": "web.teste@sacou.com",
        "senha": "123456",
        "tipo_perfil": "ALUNO",
        "id_escola": 1,
        "id_turma": 1,
        "nickname": "web_teste",
    },
)
checar("criar aluno web", r.status_code == 201, f"-> {r.status_code} {r.text[:120]}")
id_web = r.json()["id_usuario"] if r.status_code == 201 else None

print("21) Alternar status do usuário")
if id_web:
    r = client.put(f"/escolas/1/usuarios/{id_web}", headers=h_admin)
    checar("alternar status", r.status_code == 200 and r.json()["status_ativo"] is False)

print("22) Financeiro: criar contrato da escola 1")
r = client.post(
    "/financeiro/contratos",
    headers=h_admin,
    json={"escola_id": 1, "valor_setup": 600, "valor_por_aluno": 15, "ativo": True},
)
checar("criar contrato", r.status_code == 200, f"-> {r.status_code} {r.text[:120]}")
if r.status_code == 200:
    checar("contrato valores", float(r.json()["valor_setup"]) == 600 and float(r.json()["valor_por_aluno"]) == 15)

print("23) Financeiro: obter contrato da escola")
r = client.get("/financeiro/contratos/1", headers=h_admin)
checar("obter contrato", r.status_code == 200 and float(r.json()["valor_setup"]) == 600, f"-> {r.status_code}")

print("24) Financeiro: PUT atualizar contrato (Setup 700 / Aluno 20)")
r = client.put(
    "/financeiro/contratos/1",
    headers=h_admin,
    json={"valor_setup": 700, "valor_por_aluno": 20, "ativo": True},
)
checar("PUT contrato", r.status_code == 200, f"-> {r.status_code} {r.text[:120]}")
if r.status_code == 200:
    checar("PUT valores", float(r.json()["valor_setup"]) == 700 and float(r.json()["valor_por_aluno"]) == 20)

print("25) Financeiro: preview 1ª fatura (inclui Setup)")
r = client.get("/financeiro/faturas/preview?escola_id=1&mes_referencia=2026-01", headers=h_admin)
checar("preview 1a fatura", r.status_code == 200, f"-> {r.status_code} {r.text[:120]}")
preview1 = r.json() if r.status_code == 200 else {}
if r.status_code == 200:
    checar("preview inclui setup", preview1["inclui_setup"] is True)
    checar("preview valor correto", preview1["valor_total"] == 700 + preview1["qtd_alunos"] * 20,
           f"(setup 700 + {preview1['qtd_alunos']}x20 = {preview1['valor_total']})")

print("26) Financeiro: gerar 1ª fatura (2026-01)")
r = client.post(
    "/financeiro/faturas/gerar",
    headers=h_admin,
    json={"escola_id": 1, "mes_referencia": "2026-01"},
)
checar("gerar fatura 2026-01", r.status_code == 201, f"-> {r.status_code} {r.text[:120]}")
id_fatura1 = r.json()["id_fatura"] if r.status_code == 201 else None

print("27) Financeiro: preview 2ª fatura (sem Setup)")
r = client.get("/financeiro/faturas/preview?escola_id=1&mes_referencia=2026-02", headers=h_admin)
checar("preview 2a fatura", r.status_code == 200, f"-> {r.status_code}")
preview2 = r.json() if r.status_code == 200 else {}
if r.status_code == 200:
    checar("preview sem setup", preview2["inclui_setup"] is False)
    checar("preview 2a valor", preview2["valor_total"] == preview2["qtd_alunos"] * 20,
           f"(sem setup, {preview2['qtd_alunos']}x20 = {preview2['valor_total']})")

print("28) Financeiro: gerar 2ª fatura (2026-02)")
r = client.post(
    "/financeiro/faturas/gerar",
    headers=h_admin,
    json={"escola_id": 1, "mes_referencia": "2026-02"},
)
checar("gerar fatura 2026-02", r.status_code == 201, f"-> {r.status_code} {r.text[:120]}")
id_fatura2 = r.json()["id_fatura"] if r.status_code == 201 else None

print("29) Financeiro: listar faturas da escola (decrescente)")
r = client.get("/financeiro/faturas?escola_id=1", headers=h_admin)
checar("listar faturas", r.status_code == 200 and len(r.json()) == 2, f"-> {r.status_code} {r.text[:120]}")
if r.status_code == 200 and len(r.json()) == 2:
    meses = [f["mes_referencia"] for f in r.json()]
    checar("faturas decrescente", meses == sorted(meses, reverse=True), f"({meses})")

print("30) Financeiro: marcar fatura como PAGO")
if id_fatura1:
    r = client.patch(f"/financeiro/faturas/{id_fatura1}", headers=h_admin, json={"status": "PAGO"})
    checar("marcar pago", r.status_code == 200 and r.json()["status"] == "PAGO", f"-> {r.status_code} {r.text[:120]}")

print("31) Financeiro: upload de arquivo de contrato (PDF)")
from io import BytesIO  # noqa: E402
_pdf = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n"
r = client.post(
    "/financeiro/contratos/1/upload",
    headers=h_admin,
    files={"arquivo": ("contrato_cotil.pdf", BytesIO(_pdf), "application/pdf")},
)
checar("upload pdf", r.status_code == 201, f"-> {r.status_code} {r.text[:160]}")
id_arq = r.json().get("id_arquivo") if r.status_code == 201 else None
if r.status_code == 201:
    checar("upload caminho salvo", "uploads" in r.json()["caminho_arquivo"])

print("32) Financeiro: rejeita upload de extensao invalida")
r = client.post(
    "/financeiro/contratos/1/upload",
    headers=h_admin,
    files={"arquivo": ("arquivo.txt", BytesIO(b"texto"), "text/plain")},
)
checar("upload .txt rejeitado", r.status_code == 400)

print("33) Financeiro: listar arquivos de contrato")
r = client.get("/financeiro/contratos/1/arquivos", headers=h_admin)
checar("listar arquivos", r.status_code == 200 and len(r.json()) >= 1, f"-> {r.status_code}")

print("34) Financeiro: baixar arquivo de contrato")
if id_arq:
    r = client.get(f"/financeiro/contratos/arquivos/{id_arq}/download", headers=h_admin)
    checar("download", r.status_code == 200 and r.content == _pdf, f"-> {r.status_code}")

print("35) Financeiro: deletar arquivo de contrato")
if id_arq:
    r = client.delete(f"/financeiro/contratos/arquivos/{id_arq}", headers=h_admin)
    checar("delete arquivo", r.status_code == 204, f"-> {r.status_code}")
    r2 = client.get("/financeiro/contratos/1/arquivos", headers=h_admin)
    checar("arquivo sumiu da lista", all(a["id_arquivo"] != id_arq for a in r2.json()))

print("36) Personalizacao: listar avatares (vazio de inicio)")
r = client.get("/personalizacao/avatares", headers=h_admin)
checar("listar avatares", r.status_code == 200 and isinstance(r.json(), list), f"-> {r.status_code}")

print("37) Personalizacao: criar avatar")
r = client.post(
    "/personalizacao/avatares", headers=h_admin,
    json={"nome": "Elefante", "imagem_path": "/uploads/personalizacao/elefante.png", "ordem": 0, "ativo": True},
)
checar("criar avatar", r.status_code == 201, f"-> {r.status_code} {r.text[:140]}")
id_av = r.json().get("id") if r.status_code == 201 else None
if r.status_code == 201:
    checar("avatar campos", r.json()["nome"] == "Elefante" and r.json()["imagem_path"].startswith("/uploads"))

print("38) Personalizacao: editar avatar")
if id_av:
    r = client.put(
        f"/personalizacao/avatares/{id_av}", headers=h_admin,
        json={"nome": "Elefante Editado", "imagem_path": "/uploads/personalizacao/elefante.png", "ordem": 0, "ativo": True},
    )
    checar("editar avatar", r.status_code == 200 and r.json()["nome"] == "Elefante Editado", f"-> {r.status_code}")

print("39) Personalizacao: itens-loja e upload")
r = client.get("/personalizacao/itens-loja", headers=h_admin)
checar("listar itens", r.status_code == 200 and isinstance(r.json(), list))
r = client.post(
    "/personalizacao/upload", headers=h_admin,
    files={"arquivo": ("teste.png", BytesIO(b"\x89PNG\r\n\x1a\nfakedata"), "image/png")},
)
checar("upload imagem", r.status_code == 200 and r.json()["imagem_path"].startswith("/uploads/personalizacao"), f"-> {r.status_code}")

print("40) Personalizacao: excluir avatar (hard delete)")
if id_av:
    r = client.delete(f"/personalizacao/avatares/{id_av}", headers=h_admin)
    checar("excluir avatar", r.status_code == 204, f"-> {r.status_code}")
    r2 = client.get("/personalizacao/avatares", headers=h_admin)
    checar("avatar sumiu do banco", all(a["id"] != id_av for a in r2.json()))

print("41) Escolas: criar escola SEM coordenador (obrigatorio)")
r = client.post(
    "/escolas", headers=h_admin,
    json={"nome_escola": "Escola Sem Coord", "cnpj": "99.888.777/0001-11"},
)
checar("escola sem coordenador 400", r.status_code == 400 and "coordenador" in r.json()["detail"].lower(), f"-> {r.status_code}")

print("42) Usuarios: criar professor via POST /usuarios")
r = client.post(
    "/usuarios", headers=h_admin,
    json={"nome_completo": "Professor Smoke", "email": "prof.smoke@sacou.com",
          "senha": "123456", "perfil": "VISUALIZADOR_ESCOLA", "escola_id": 1},
)
checar("criar professor", r.status_code == 201, f"-> {r.status_code} {r.text[:140]}")
id_prof = r.json().get("id_usuario") if r.status_code == 201 else None

print("43) Escolas: filtrar usuarios por perfil")
if id_prof:
    r = client.get("/escolas/1/usuarios?perfil=VISUALIZADOR_ESCOLA", headers=h_admin)
    checar("filtrar professores", r.status_code == 200 and any(u["id_usuario"] == id_prof for u in r.json()), f"-> {r.status_code}")
    r = client.get("/escolas/1/usuarios?perfil=ADMIN_ESCOLA", headers=h_admin)
    checar("filtrar coordenadores", r.status_code == 200 and all(u["perfil"] == "ADMIN_ESCOLA" for u in r.json()))

print("44) Usuarios: editar e arquivar professor")
if id_prof:
    r = client.put(f"/usuarios/{id_prof}", headers=h_admin, json={"nome_completo": "Professor Smoke Editado"})
    checar("editar usuario", r.status_code == 200 and r.json()["nome_completo"] == "Professor Smoke Editado", f"-> {r.status_code}")
    r = client.patch(f"/usuarios/{id_prof}", headers=h_admin, json={"arquivado": True})
    checar("arquivar usuario", r.status_code == 200 and r.json()["arquivado"] is True, f"-> {r.status_code}")
    r = client.get("/escolas/1/usuarios?perfil=VISUALIZADOR_ESCOLA", headers=h_admin)
    prof_arq = next((u for u in r.json() if u["id_usuario"] == id_prof), None)
    checar("professor arquivado na lista", prof_arq is not None and prof_arq["arquivado"] is True)

print("45) Turmas: cadastro simplificado (serie + ano_letivo)")
r = client.post("/turmas", headers=h_admin, json={"serie": "3º Ano - 2024", "ano_letivo": 2024, "escola_id": 1})
checar("criar turma simplificada", r.status_code == 201, f"-> {r.status_code} {r.text[:140]}")
id_turma2 = r.json().get("id_turma") if r.status_code == 201 else None
if id_turma2:
    checar("identificador = serie", r.json()["identificador"] == "3º Ano - 2024")

print("46) Turmas: editar email de contato (PUT)")
if id_turma2:
    r = client.put(f"/turmas/{id_turma2}", headers=h_admin, json={"email_contato": "contato3@escola.com"})
    checar("editar email", r.status_code == 200 and r.json()["email_contato"] == "contato3@escola.com", f"-> {r.status_code}")

print("47) Turmas: adicionar e remover alunos")
if id_turma2:
    r = client.post(f"/turmas/{id_turma2}/alunos", headers=h_admin, json={"aluno_ids": [2]})
    checar("adicionar aluno", r.status_code == 200 and any(a["id_usuario"] == 2 for a in r.json()), f"-> {r.status_code}")
    r = client.request("DELETE", f"/turmas/{id_turma2}/alunos", headers=h_admin, json={"aluno_ids": [2]})
    checar("remover aluno", r.status_code == 200 and all(a["id_usuario"] != 2 for a in r.json()), f"-> {r.status_code}")

print("48) Turmas: arquivar")
if id_turma2:
    r = client.patch(f"/turmas/{id_turma2}", headers=h_admin, json={"arquivado": True})
    checar("arquivar turma", r.status_code == 200 and r.json()["arquivado"] is True, f"-> {r.status_code}")
    r = client.get("/turmas?arquivado=false", headers=h_admin)
    checar("turma sumiu das ativas", all(t["id_turma"] != id_turma2 for t in r.json()))

print("49) RBAC: professor nao arquiva coordenador/professor (403)")
r = client.post("/auth/login", json={"email": "professor@sacou.com", "senha": "professor123"})
h_prof = {"Authorization": f"Bearer {r.json()['access_token']}"}
checar("login professor", r.status_code == 200, f"-> {r.status_code}")
coords = client.get("/escolas/1/usuarios?perfil=ADMIN_ESCOLA", headers=h_admin).json()
id_coord = coords[0]["id_usuario"] if coords else None
if id_coord:
    r = client.patch(f"/usuarios/{id_coord}", headers=h_prof, json={"arquivado": True})
    checar("professor arquiva coordenador 403", r.status_code == 403, f"-> {r.status_code}")
profs = client.get("/escolas/1/usuarios?perfil=VISUALIZADOR_ESCOLA", headers=h_admin).json()
if profs:
    r = client.patch(f"/usuarios/{profs[0]['id_usuario']}", headers=h_prof, json={"arquivado": True})
    checar("professor arquiva professor 403", r.status_code == 403, f"-> {r.status_code}")

print("50) RBAC: professor arquiva aluno (200)")
r = client.patch("/usuarios/2", headers=h_prof, json={"arquivado": True})
checar("professor arquiva aluno", r.status_code == 200 and r.json()["arquivado"] is True, f"-> {r.status_code}")
client.patch("/usuarios/2", headers=h_prof, json={"arquivado": False})  # desarquiva para limpar

print()
if FALHAS:
    print(f"{len(FALHAS)} FALHA(S): {FALHAS}")
    raise SystemExit(1)
print("TODOS OS TESTES PASSARAM [OK]")
