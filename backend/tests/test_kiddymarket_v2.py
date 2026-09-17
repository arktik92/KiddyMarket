"""KiddyMarket V2 backend tests (pytest) — auth + multi-tenant isolation + PIN + regression."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/") + "/api"


def _mk_email() -> str:
    return f"test+{uuid.uuid4().hex[:8]}@test.com"


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------------- AUTH ----------------
class TestAuthSignupLogin:
    def test_signup_seeds_7_products_and_zero_children(self, api):
        email = _mk_email()
        r = api.post(f"{BASE_URL}/auth/signup", json={"email": email, "password": "secret123", "name": "T"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "session_token" in data and isinstance(data["session_token"], str)
        assert data["user"]["email"] == email.lower()
        token = data["session_token"]

        # 7 seeded products, 0 children
        r = api.get(f"{BASE_URL}/products", headers=_auth_headers(token))
        assert r.status_code == 200
        products = r.json()
        assert len(products) == 7, f"expected 7 seeded products, got {len(products)}"

        r = api.get(f"{BASE_URL}/children", headers=_auth_headers(token))
        assert r.status_code == 200
        assert r.json() == []

    def test_signup_duplicate_email_returns_409(self, api):
        email = _mk_email()
        assert api.post(f"{BASE_URL}/auth/signup", json={"email": email, "password": "secret123", "name": "A"}).status_code == 200
        r = api.post(f"{BASE_URL}/auth/signup", json={"email": email, "password": "secret123", "name": "B"})
        assert r.status_code == 409

    def test_signup_short_password_returns_400(self, api):
        r = api.post(f"{BASE_URL}/auth/signup", json={"email": _mk_email(), "password": "abc", "name": "X"})
        assert r.status_code == 400

    def test_login_success_and_wrong_password_and_unknown(self, api):
        email = _mk_email()
        api.post(f"{BASE_URL}/auth/signup", json={"email": email, "password": "secret123", "name": "L"})

        r = api.post(f"{BASE_URL}/auth/login", json={"email": email, "password": "secret123"})
        assert r.status_code == 200
        assert "session_token" in r.json()

        r = api.post(f"{BASE_URL}/auth/login", json={"email": email, "password": "wrongwrong"})
        assert r.status_code == 401

        r = api.post(f"{BASE_URL}/auth/login", json={"email": _mk_email(), "password": "secret123"})
        assert r.status_code == 401

    def test_auth_me_requires_bearer(self, api):
        r = api.get(f"{BASE_URL}/auth/me")
        assert r.status_code == 401

        r = api.get(f"{BASE_URL}/auth/me", headers={"Authorization": "Bearer nope-nope"})
        assert r.status_code == 401

        email = _mk_email()
        tok = api.post(f"{BASE_URL}/auth/signup", json={"email": email, "password": "secret123", "name": "M"}).json()["session_token"]
        r = api.get(f"{BASE_URL}/auth/me", headers=_auth_headers(tok))
        assert r.status_code == 200
        assert r.json()["email"] == email.lower()


# ---------------- AUTH GATE ON DATA ENDPOINTS ----------------
class TestAuthGate:
    endpoints = [
        ("GET", "/children"),
        ("POST", "/children"),
        ("GET", "/products"),
        ("POST", "/products"),
        ("GET", "/transactions"),
        ("POST", "/transactions/credit"),
        ("POST", "/transactions/debit"),
        ("POST", "/transactions/purchase"),
        ("POST", "/parent/verify-pin"),
        ("PUT", "/parent/pin"),
        ("POST", "/parent/reset-pin"),
    ]

    @pytest.mark.parametrize("method,path", endpoints)
    def test_requires_auth(self, api, method, path):
        r = api.request(method, f"{BASE_URL}{path}", json={})
        assert r.status_code == 401, f"{method} {path} expected 401, got {r.status_code}"


# ---------------- ISOLATION ----------------
class TestIsolation:
    @pytest.fixture(scope="class")
    def two_users(self, api):
        ea, eb = _mk_email(), _mk_email()
        ta = api.post(f"{BASE_URL}/auth/signup", json={"email": ea, "password": "secret123", "name": "A"}).json()["session_token"]
        tb = api.post(f"{BASE_URL}/auth/signup", json={"email": eb, "password": "secret123", "name": "B"}).json()["session_token"]
        return {"ta": ta, "tb": tb}

    def test_child_and_product_isolated(self, api, two_users):
        ta, tb = two_users["ta"], two_users["tb"]

        child = api.post(f"{BASE_URL}/children", json={"name": "TEST_A_child"}, headers=_auth_headers(ta)).json()
        product = api.post(f"{BASE_URL}/products", json={"name": "TEST_A_prod", "price_cents": 100}, headers=_auth_headers(ta)).json()

        # B cannot see A's child
        list_b = api.get(f"{BASE_URL}/children", headers=_auth_headers(tb)).json()
        assert child["id"] not in [c["id"] for c in list_b]

        # B still has its own 7 seeded products, none named TEST_A_prod
        list_p = api.get(f"{BASE_URL}/products", headers=_auth_headers(tb)).json()
        assert len(list_p) == 7
        assert product["id"] not in [p["id"] for p in list_p]

    def test_cross_tenant_child_ops_return_404(self, api, two_users):
        ta, tb = two_users["ta"], two_users["tb"]
        child = api.post(f"{BASE_URL}/children", json={"name": "TEST_A_c2"}, headers=_auth_headers(ta)).json()

        # B can't read/update/delete A's child
        assert api.put(f"{BASE_URL}/children/{child['id']}", json={"name": "hacked"}, headers=_auth_headers(tb)).status_code == 404
        assert api.delete(f"{BASE_URL}/children/{child['id']}", headers=_auth_headers(tb)).status_code == 404
        # It's still there for A
        assert child["id"] in [c["id"] for c in api.get(f"{BASE_URL}/children", headers=_auth_headers(ta)).json()]


# ---------------- PIN ----------------
class TestPin:
    @pytest.fixture(scope="class")
    def token(self, api):
        return api.post(f"{BASE_URL}/auth/signup",
                        json={"email": _mk_email(), "password": "secret123", "name": "P"}).json()["session_token"]

    def test_verify_default_pin(self, api, token):
        r = api.post(f"{BASE_URL}/parent/verify-pin", json={"pin": "1234"}, headers=_auth_headers(token))
        assert r.status_code == 200 and r.json()["ok"] is True
        r = api.post(f"{BASE_URL}/parent/verify-pin", json={"pin": "0000"}, headers=_auth_headers(token))
        assert r.status_code == 200 and r.json()["ok"] is False

    def test_change_pin_wrong_current_forbidden(self, api, token):
        r = api.put(f"{BASE_URL}/parent/pin",
                    json={"current_pin": "9999", "new_pin": "5678"}, headers=_auth_headers(token))
        assert r.status_code == 403

    def test_change_pin_ok(self, api, token):
        r = api.put(f"{BASE_URL}/parent/pin",
                    json={"current_pin": "1234", "new_pin": "5678"}, headers=_auth_headers(token))
        assert r.status_code == 200
        assert api.post(f"{BASE_URL}/parent/verify-pin", json={"pin": "5678"}, headers=_auth_headers(token)).json()["ok"] is True

    def test_reset_pin(self, api, token):
        r = api.post(f"{BASE_URL}/parent/reset-pin", json={"new_pin": "4321"}, headers=_auth_headers(token))
        assert r.status_code == 200
        assert api.post(f"{BASE_URL}/parent/verify-pin", json={"pin": "4321"}, headers=_auth_headers(token)).json()["ok"] is True

    def test_reset_pin_invalid_format(self, api, token):
        r = api.post(f"{BASE_URL}/parent/reset-pin", json={"new_pin": "12"}, headers=_auth_headers(token))
        assert r.status_code == 400


# ---------------- REGRESSION: CRUD + money ----------------
class TestRegression:
    @pytest.fixture(scope="class")
    def ctx(self, api):
        email = _mk_email()
        tok = api.post(f"{BASE_URL}/auth/signup", json={"email": email, "password": "secret123", "name": "R"}).json()["session_token"]
        return {"tok": tok}

    def test_child_crud(self, api, ctx):
        tok = ctx["tok"]
        c = api.post(f"{BASE_URL}/children", json={"name": "TEST_R_c"}, headers=_auth_headers(tok)).json()
        assert c["balance_cents"] == 0
        r = api.put(f"{BASE_URL}/children/{c['id']}", json={"name": "TEST_R_c2"}, headers=_auth_headers(tok))
        assert r.status_code == 200 and r.json()["name"] == "TEST_R_c2"
        ctx["child_id"] = c["id"]

    def test_product_crud(self, api, ctx):
        tok = ctx["tok"]
        p = api.post(f"{BASE_URL}/products", json={"name": "TEST_R_p", "price_cents": 200, "category": "Jeux"},
                     headers=_auth_headers(tok)).json()
        assert p["price_cents"] == 200
        r = api.put(f"{BASE_URL}/products/{p['id']}", json={"price_cents": 250}, headers=_auth_headers(tok))
        assert r.status_code == 200 and r.json()["price_cents"] == 250
        assert api.delete(f"{BASE_URL}/products/{p['id']}", headers=_auth_headers(tok)).status_code == 200

    def test_credit_debit_purchase(self, api, ctx):
        tok = ctx["tok"]
        cid = ctx["child_id"]
        r = api.post(f"{BASE_URL}/transactions/credit",
                     json={"child_id": cid, "amount_cents": 1000, "reason": "test"}, headers=_auth_headers(tok))
        assert r.status_code == 200 and r.json()["balance_cents"] == 1000

        r = api.post(f"{BASE_URL}/transactions/debit",
                     json={"child_id": cid, "amount_cents": 200}, headers=_auth_headers(tok))
        assert r.status_code == 200 and r.json()["balance_cents"] == 800

        items = [{"product_id": "x", "name": "Item", "price_cents": 300, "icon": "star", "color": "#000", "qty": 2}]
        r = api.post(f"{BASE_URL}/transactions/purchase",
                     json={"child_id": cid, "items": items}, headers=_auth_headers(tok))
        assert r.status_code == 200
        d = r.json()
        assert d["total_cents"] == 600 and d["balance_cents"] == 200

        # insufficient
        big = [{"product_id": "x", "name": "Item", "price_cents": 999999, "icon": "star", "color": "#000", "qty": 1}]
        r = api.post(f"{BASE_URL}/transactions/purchase",
                     json={"child_id": cid, "items": big}, headers=_auth_headers(tok))
        assert r.status_code == 402

    def test_transactions_list(self, api, ctx):
        tok = ctx["tok"]
        r = api.get(f"{BASE_URL}/transactions", headers=_auth_headers(tok))
        assert r.status_code == 200 and len(r.json()) >= 3
        r = api.get(f"{BASE_URL}/transactions", params={"child_id": ctx["child_id"]}, headers=_auth_headers(tok))
        assert r.status_code == 200
        assert all(t["child_id"] == ctx["child_id"] for t in r.json())
