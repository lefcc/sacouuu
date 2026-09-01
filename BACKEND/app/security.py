from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext

from .config import JWT_ALGORITHM, JWT_SECRET, TOKEN_EXPIRA_MINUTOS

# Hashing de senhas: bcrypt com salt automático (gerado pelo próprio algoritmo).
# pbkdf2_sha256 permanece apenas para validar hashes legados já gravados no banco.
pwd_context = CryptContext(schemes=["bcrypt", "pbkdf2_sha256"], deprecated="auto")


def hash_senha(senha: str) -> str:
    return pwd_context.hash(senha)


def verificar_senha(senha_plana: str, hash_senha_armazenado: str) -> bool:
    return pwd_context.verify(senha_plana, hash_senha_armazenado)


def criar_token(sub: str) -> str:
    expira = datetime.now(timezone.utc) + timedelta(minutes=TOKEN_EXPIRA_MINUTOS)
    payload = {"sub": sub, "exp": expira}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decodificar_token(token: str) -> str | None:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload.get("sub")
    except JWTError:
        return None
