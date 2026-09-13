"""KiddyMarket end-to-end backend tests (pytest)."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/") + "/api"


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------- Family / PIN ----------
class TestFamily:
    def test_get_family(self, api):
        r = api.get(f"{BASE_URL}/family")
        assert r.status_code == 200
        d = r.json()
        assert d["id"] == "family-default"
        assert d["currency"] == "EUR"
        assert d["has_pin"] is True

    def test_verify_pin_ok(self, api):
        r = api.post(f"{BASE_URL}/parent/verify-pin", json={"pin": "1234"})
        assert r.status_code == 200
        assert r.json()["ok"] is True

    def test_verify_pin_wrong(self, api):
        r = api.post(f"{BASE_URL}/parent/verify-pin", json={"pin": "0000"})
        assert r.status_code == 200
        assert r.json()["ok"] is False


# ---------- Children ----------
class TestChildren:
    def test_list_seeded(self, api):
        r = api.get(f"{BASE_URL}/children")
        assert r.status_code == 200
        names = [c["name"] for c in r.json()]
        assert "Lucas" in names and "Emma" in names

    def test_create_update_delete(self, api):
        name = f"TEST_{uuid.uuid4().hex[:6]}"
        r = api.post(f"{BASE_URL}/children", json={"name": name, "avatar_icon": "paw", "color": "#123456"})
        assert r.status_code == 200
        child = r.json()
        assert child["name"] == name and child["balance_cents"] == 0
        cid = child["id"]

        r = api.put(f"{BASE_URL}/children/{cid}", json={"name": name + "_upd"})
        assert r.status_code == 200
        assert r.json()["name"] == name + "_upd"

        r = api.delete(f"{BASE_URL}/children/{cid}")
        assert r.status_code == 200
        # Verify not in list
        r = api.get(f"{BASE_URL}/children")
        assert cid not in [c["id"] for c in r.json()]

    def test_nfc_associate_and_lookup_and_duplicate(self, api):
        # create two children
        a = api.post(f"{BASE_URL}/children", json={"name": "TEST_NFC_A"}).json()
        b = api.post(f"{BASE_URL}/children", json={"name": "TEST_NFC_B"}).json()
        uid = f"UID_{uuid.uuid4().hex[:8]}"
        r = api.post(f"{BASE_URL}/children/{a['id']}/nfc", json={"nfc_uid": uid})
        assert r.status_code == 200
        assert r.json()["nfc_uid"] == uid

        r = api.get(f"{BASE_URL}/children/by-nfc/{uid}")
        assert r.status_code == 200
        assert r.json()["id"] == a["id"]

        # duplicate on another child -> 409
        r = api.post(f"{BASE_URL}/children/{b['id']}/nfc", json={"nfc_uid": uid})
        assert r.status_code == 409

        # cleanup
        api.delete(f"{BASE_URL}/children/{a['id']}")
        api.delete(f"{BASE_URL}/children/{b['id']}")


# ---------- Products ----------
class TestProducts:
    def test_list_and_filter(self, api):
        r = api.get(f"{BASE_URL}/products")
        assert r.status_code == 200
        assert len(r.json()) >= 5
        r = api.get(f"{BASE_URL}/products", params={"category": "Jeux"})
        assert r.status_code == 200
        assert all(p["category"] == "Jeux" for p in r.json())
        assert len(r.json()) >= 1

    def test_crud(self, api):
        r = api.post(f"{BASE_URL}/products", json={"name": "TEST_Prod", "price_cents": 199, "category": "Jeux"})
        assert r.status_code == 200
        pid = r.json()["id"]
        r = api.put(f"{BASE_URL}/products/{pid}", json={"price_cents": 250})
        assert r.status_code == 200 and r.json()["price_cents"] == 250
        r = api.delete(f"{BASE_URL}/products/{pid}")
        assert r.status_code == 200
        r = api.get(f"{BASE_URL}/products")
        assert pid not in [p["id"] for p in r.json()]


# ---------- Transactions ----------
class TestTransactions:
    @pytest.fixture(scope="class")
    def child(self, api):
        c = api.post(f"{BASE_URL}/children", json={"name": f"TEST_TX_{uuid.uuid4().hex[:5]}"}).json()
        yield c
        api.delete(f"{BASE_URL}/children/{c['id']}")

    def test_credit_increases_balance(self, api, child):
        r = api.post(f"{BASE_URL}/transactions/credit",
                     json={"child_id": child["id"], "amount_cents": 1000, "reason": "argent de poche"})
        assert r.status_code == 200
        d = r.json()
        assert d["balance_cents"] == 1000
        assert d["transaction"]["type"] == "credit"

    def test_debit_decreases_balance(self, api, child):
        r = api.post(f"{BASE_URL}/transactions/debit",
                     json={"child_id": child["id"], "amount_cents": 300})
        assert r.status_code == 200
        assert r.json()["balance_cents"] == 700

    def test_debit_more_than_balance(self, api, child):
        r = api.post(f"{BASE_URL}/transactions/debit",
                     json={"child_id": child["id"], "amount_cents": 999999})
        assert r.status_code == 400

    def test_purchase_ok(self, api, child):
        items = [{"product_id": "p1", "name": "Item", "price_cents": 200, "icon": "star", "color": "#000", "qty": 2}]
        r = api.post(f"{BASE_URL}/transactions/purchase",
                     json={"child_id": child["id"], "items": items})
        assert r.status_code == 200
        d = r.json()
        assert d["total_cents"] == 400
        assert d["balance_cents"] == 300  # 700 - 400
        assert d["transaction"]["type"] == "achat"
        assert len(d["transaction"]["items"]) == 1

    def test_purchase_insufficient_does_not_change_balance(self, api, child):
        before = api.get(f"{BASE_URL}/children").json()
        bal_before = [c for c in before if c["id"] == child["id"]][0]["balance_cents"]
        items = [{"product_id": "p1", "name": "Item", "price_cents": 10000, "icon": "star", "color": "#000", "qty": 5}]
        r = api.post(f"{BASE_URL}/transactions/purchase",
                     json={"child_id": child["id"], "items": items})
        assert r.status_code == 402
        after = api.get(f"{BASE_URL}/children").json()
        bal_after = [c for c in after if c["id"] == child["id"]][0]["balance_cents"]
        assert bal_before == bal_after

    def test_list_child_transactions_desc(self, api, child):
        r = api.get(f"{BASE_URL}/children/{child['id']}/transactions")
        assert r.status_code == 200
        txs = r.json()
        assert len(txs) >= 3
        # newest first
        dates = [t["created_at"] for t in txs]
        assert dates == sorted(dates, reverse=True)

    def test_list_global_and_filter(self, api, child):
        r = api.get(f"{BASE_URL}/transactions")
        assert r.status_code == 200 and len(r.json()) >= 3
        r = api.get(f"{BASE_URL}/transactions", params={"child_id": child["id"]})
        assert r.status_code == 200
        assert all(t["child_id"] == child["id"] for t in r.json())
