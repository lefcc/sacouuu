import os

from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv(
    "DATABASE_URL", "mysql+pymysql://root:root@localhost:3306/db_sacou"
)
JWT_SECRET = os.getenv("JWT_SECRET", "sacou-segredo-de-teste-mude-em-producao")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
TOKEN_EXPIRA_MINUTOS = int(os.getenv("TOKEN_EXPIRA_MINUTOS", "480"))

# Cookie de sessão HttpOnly (sacou_token): secure SOMENTE em HTTPS (produção).
# Em dev (HTTP local) deve ficar False para o cookie ser aceito pelo navegador.
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() in ("1", "true", "yes")

API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", "8000"))
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000").rstrip("/")

# Origens liberadas no CORS (separadas por vírgula no .env).
# O padrão cobre os dev servers web (React/Vite :5173) e desktop (:3000).
# Se o frontend for acessado por IP de rede (demo em outro dispositivo/celular),
# adicione a origem aqui, ex.: CORS_ORIGINS=http://192.168.0.10:5173
CORS_ORIGINS = [
    o.strip()
    for o in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000",
    ).split(",")
    if o.strip()
]

# ── SMTP (recuperação de senha) ──────────────────────────────────────────────
EMAIL_HOST = os.getenv("EMAIL_HOST", "smtp.gmail.com")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587"))
EMAIL_USER = os.getenv("EMAIL_USER", "sacoueducacao@gmail.com")
EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD", "")
EMAIL_USE_TLS = os.getenv("EMAIL_USE_TLS", "true").lower() in ("1", "true", "yes")
# Destinatário da recuperação no ambiente de demonstração (inbox da própria conta).
# Em produção, aponte para o e-mail do usuário.
EMAIL_RECIPIENT = os.getenv("EMAIL_RECIPIENT", "sacoueducacao@gmail.com")
# URL base do frontend web (usada no link do e-mail).
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
