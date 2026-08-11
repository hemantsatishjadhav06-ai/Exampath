"""Tests for the stdlib auth module (users + sessions in SQLite).

Network-free; each test class gets its own temp DB so backend/exampath.db is
never touched.  Runs with:  python -m unittest tests.test_auth  (from backend/)
"""
import sqlite3
import tempfile
import unittest
from datetime import timedelta
from pathlib import Path

from app.auth.service import AuthService, hash_password, _iso, _now

EMAIL = "asha@example.com"
PASSWORD = "correct horse battery"
NAME = "Asha"


class AuthTestCase(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.db_path = Path(tmp.name) / "auth-test.db"
        self.auth = AuthService(self.db_path)


class TestRegister(AuthTestCase):
    def test_happy_path(self):
        res = self.auth.register(EMAIL, PASSWORD, NAME)
        self.assertTrue(res["ok"])
        self.assertEqual(res["user"]["email"], EMAIL)
        self.assertEqual(res["user"]["name"], NAME)
        self.assertIn("id", res["user"])
        self.assertIn("created_at", res["user"])
        self.assertNotIn("password_hash", res["user"])  # never exposed
        self.assertNotIn("salt", res["user"])

    def test_email_normalized_lowercase(self):
        self.assertTrue(self.auth.register("  Asha@Example.COM ", PASSWORD, NAME)["ok"])
        self.assertTrue(self.auth.login(EMAIL, PASSWORD)["ok"])

    def test_duplicate_email_rejected(self):
        self.assertTrue(self.auth.register(EMAIL, PASSWORD, NAME)["ok"])
        dup = self.auth.register(EMAIL, "another-pass-99", "Other")
        self.assertFalse(dup["ok"])
        self.assertIn("already registered", dup["error"])

    def test_weak_password_rejected(self):
        res = self.auth.register(EMAIL, "short7!", NAME)
        self.assertFalse(res["ok"])
        self.assertIn("8 characters", res["error"])

    def test_bad_email_rejected(self):
        for bad in ("not-an-email", "a@b", "@example.com", "user@", "", "a b@example.com"):
            res = self.auth.register(bad, PASSWORD, NAME)
            self.assertFalse(res["ok"], f"accepted bad email: {bad!r}")
            self.assertIn("invalid email", res["error"])

    def test_missing_name_rejected(self):
        self.assertFalse(self.auth.register(EMAIL, PASSWORD, "   ")["ok"])


class TestLogin(AuthTestCase):
    def setUp(self):
        super().setUp()
        self.auth.register(EMAIL, PASSWORD, NAME)

    def test_login_ok(self):
        res = self.auth.login(EMAIL, PASSWORD)
        self.assertTrue(res["ok"])
        self.assertGreaterEqual(len(res["token"]), 32)
        self.assertEqual(res["user"]["email"], EMAIL)

    def test_wrong_password_generic_error(self):
        res = self.auth.login(EMAIL, "wrong-password-1")
        self.assertFalse(res["ok"])
        self.assertEqual(res["error"], "invalid credentials")

    def test_unknown_email_same_generic_error(self):
        # Must not reveal whether the account exists.
        wrong_pw = self.auth.login(EMAIL, "wrong-password-1")
        no_user = self.auth.login("ghost@example.com", PASSWORD)
        self.assertFalse(no_user["ok"])
        self.assertEqual(no_user["error"], wrong_pw["error"])

    def test_each_login_gets_fresh_token(self):
        t1 = self.auth.login(EMAIL, PASSWORD)["token"]
        t2 = self.auth.login(EMAIL, PASSWORD)["token"]
        self.assertNotEqual(t1, t2)


class TestSessions(AuthTestCase):
    def setUp(self):
        super().setUp()
        self.auth.register(EMAIL, PASSWORD, NAME)
        self.token = self.auth.login(EMAIL, PASSWORD)["token"]

    def test_me_with_valid_token(self):
        user = self.auth.get_user(self.token)
        self.assertIsNotNone(user)
        self.assertEqual(user["email"], EMAIL)
        self.assertEqual(user["name"], NAME)

    def test_me_with_invalid_token(self):
        self.assertIsNone(self.auth.get_user("bogus-token"))
        self.assertIsNone(self.auth.get_user(""))
        self.assertIsNone(self.auth.get_user(None))

    def test_me_with_expired_token_rejected_and_pruned(self):
        past = _iso(_now() - timedelta(minutes=1))
        con = sqlite3.connect(self.db_path)
        con.execute("update sessions set expires_at = ? where token = ?", (past, self.token))
        con.commit()
        con.close()

        self.assertIsNone(self.auth.get_user(self.token))
        con = sqlite3.connect(self.db_path)
        remaining = con.execute("select count(*) from sessions where token = ?",
                                (self.token,)).fetchone()[0]
        con.close()
        self.assertEqual(remaining, 0)  # lazily pruned

    def test_logout_invalidates(self):
        self.assertTrue(self.auth.logout(self.token))
        self.assertIsNone(self.auth.get_user(self.token))
        self.assertFalse(self.auth.logout(self.token))  # already gone


class TestPasswordStorage(AuthTestCase):
    def test_hash_never_equals_plaintext(self):
        self.auth.register(EMAIL, PASSWORD, NAME)
        con = sqlite3.connect(self.db_path)
        pw_hash, salt = con.execute(
            "select password_hash, salt from users where email = ?", (EMAIL,)).fetchone()
        con.close()
        self.assertIsInstance(pw_hash, bytes)
        self.assertNotEqual(pw_hash, PASSWORD.encode("utf-8"))
        self.assertNotIn(PASSWORD.encode("utf-8"), pw_hash)
        self.assertEqual(len(salt), 16)
        # hash is reproducible from salt+password, i.e. real PBKDF2 output
        self.assertEqual(pw_hash, hash_password(PASSWORD, salt))

    def test_same_password_different_users_different_hashes(self):
        self.auth.register("a@example.com", PASSWORD, "A")
        self.auth.register("b@example.com", PASSWORD, "B")
        con = sqlite3.connect(self.db_path)
        rows = con.execute("select password_hash, salt from users order by id").fetchall()
        con.close()
        (h1, s1), (h2, s2) = rows
        self.assertNotEqual(s1, s2)  # per-user random salt
        self.assertNotEqual(h1, h2)  # so hashes differ too


if __name__ == "__main__":
    unittest.main(verbosity=2)
