from app.security import DUMMY_HASH, hash_password, hash_token, new_token, verify_password


def test_password_hash_round_trip():
    stored = hash_password("correct horse")
    assert stored.startswith("scrypt$")
    assert "correct horse" not in stored
    assert verify_password("correct horse", stored)
    assert not verify_password("Correct horse", stored)


def test_password_hashes_are_salted():
    assert hash_password("same") != hash_password("same")


def test_malformed_hashes_never_verify():
    for stored in ["", "plain", "bcrypt$1$2$3$aa$bb", "scrypt$x$8$1$aa$bb", "scrypt$16384$8$1$zz$bb"]:
        assert not verify_password("anything", stored)


def test_dummy_hash_matches_no_password():
    assert not verify_password("", DUMMY_HASH)
    assert not verify_password("correct horse", DUMMY_HASH)


def test_tokens_are_random_and_stored_hashed():
    tokens = {new_token() for _ in range(100)}
    assert len(tokens) == 100
    token = tokens.pop()
    assert hash_token(token) == hash_token(token)
    assert token not in hash_token(token)
