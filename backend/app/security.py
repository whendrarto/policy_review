"""Password hashing and session tokens, with the standard library only."""

import hashlib
import hmac
import secrets

# scrypt costs about 16 MB of memory per hash, within hashlib's default limit.
SCRYPT_N, SCRYPT_R, SCRYPT_P = 2**14, 8, 1
SALT_BYTES = 16


def hash_password(password: str) -> str:
    """'scrypt$n$r$p$salt$hash', with the salt and hash in hex."""
    salt = secrets.token_bytes(SALT_BYTES)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=SCRYPT_N, r=SCRYPT_R, p=SCRYPT_P)
    return f"scrypt${SCRYPT_N}${SCRYPT_R}${SCRYPT_P}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, n, r, p, salt, digest = stored.split("$")
        if scheme != "scrypt":
            return False
        actual = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=int(n), r=int(r), p=int(p))
    except ValueError:
        return False
    return hmac.compare_digest(actual, bytes.fromhex(digest))


# Checked against when the email is unknown, so a failed sign-in takes as long either way and
# doesn't reveal which emails have accounts.
DUMMY_HASH = hash_password(secrets.token_urlsafe())


def new_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
