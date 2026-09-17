from fastapi import FastAPI, APIRouter, HTTPException, Header, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Literal, Any
import uuid
import bcrypt
import httpx
from datetime import datetime, timezone, timedelta


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

EMERGENT_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"
SESSION_DAYS = 7


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def now_iso() -> str:
    return now_utc().isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class SignupIn(BaseModel):
    email: EmailStr
    password: str
    name: Optional[str] = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class SessionIn(BaseModel):
    session_id: str


class PinVerify(BaseModel):
    pin: str


class PinChange(BaseModel):
    current_pin: str
    new_pin: str


class PinReset(BaseModel):
    new_pin: str


class ChildCreate(BaseModel):
    name: str
    avatar_icon: str = "paw"
    color: str = "#FF6B6B"


class ChildUpdate(BaseModel):
    name: Optional[str] = None
    avatar_icon: Optional[str] = None
    color: Optional[str] = None


class NfcAssociate(BaseModel):
    nfc_uid: str


class ProductCreate(BaseModel):
    name: str
    price_cents: int
    icon: str = "pricetag"
    color: str = "#4ECDC4"
    category: str = "Autre"


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    price_cents: Optional[int] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    category: Optional[str] = None


class PurchaseItem(BaseModel):
    product_id: str
    name: str
    price_cents: int
    icon: str = "pricetag"
    color: str = "#4ECDC4"
    qty: int = 1


class MoneyOp(BaseModel):
    child_id: str
    amount_cents: int
    reason: Optional[str] = None


class PurchaseOp(BaseModel):
    child_id: str
    items: List[PurchaseItem]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def clean(doc: dict) -> dict:
    if doc and "_id" in doc:
        doc = {k: v for k, v in doc.items() if k != "_id"}
    return doc


def hash_password(password: str) -> str:
    raw = password.encode("utf-8")
    if len(raw) > 72:
        raise HTTPException(400, "Mot de passe trop long")
    return bcrypt.hashpw(raw, bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_password(password: str, stored: str) -> bool:
    raw = password.encode("utf-8")
    return len(raw) <= 72 and bcrypt.checkpw(raw, stored.encode("utf-8"))


def public_user(user: dict) -> dict:
    return {"id": user["user_id"], "email": user.get("email"), "name": user.get("name")}


async def mint_session(user_id: str, token: Optional[str] = None) -> str:
    token = token or new_id() + new_id().replace("-", "")
    await db.user_sessions.insert_one({
        "session_token": token,
        "user_id": user_id,
        "created_at": now_iso(),
        "expires_at": (now_utc() + timedelta(days=SESSION_DAYS)).isoformat(),
    })
    return token


DEFAULT_PRODUCTS = [
    {"name": "Pomme", "price_cents": 50, "icon": "nutrition", "color": "#4ECDC4", "category": "Alimentation"},
    {"name": "Chocolat", "price_cents": 150, "icon": "ice-cream", "color": "#FF6B6B", "category": "Alimentation"},
    {"name": "Jus d'orange", "price_cents": 120, "icon": "wine", "color": "#FFE66D", "category": "Alimentation"},
    {"name": "Petite voiture", "price_cents": 300, "icon": "car-sport", "color": "#4D96FF", "category": "Jeux"},
    {"name": "Jeu de cartes", "price_cents": 250, "icon": "game-controller", "color": "#FF6B6B", "category": "Jeux"},
    {"name": "Livre d'images", "price_cents": 400, "icon": "book", "color": "#4ECDC4", "category": "Livres"},
    {"name": "Autocollants", "price_cents": 80, "icon": "star", "color": "#FFE66D", "category": "Autre"},
]


async def seed_products_for(user_id: str):
    if await db.products.count_documents({"user_id": user_id}) == 0:
        for p in DEFAULT_PRODUCTS:
            await db.products.insert_one({
                "id": new_id(), "user_id": user_id, "deleted_at": None,
                "created_at": now_iso(), **p,
            })


async def create_user(email: str, name: Optional[str], password_hash: Optional[str], provider: str) -> dict:
    user = {
        "user_id": f"user_{uuid.uuid4().hex[:12]}",
        "email": email.lower(),
        "name": name,
        "password_hash": password_hash,
        "auth_provider": provider,
        "pin": "1234",
        "created_at": now_iso(),
    }
    await db.users.insert_one(user)
    await seed_products_for(user["user_id"])
    return user


# ---------------------------------------------------------------------------
# Auth dependency
# ---------------------------------------------------------------------------
async def current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Non authentifié")
    token = authorization.split(" ", 1)[1].strip()
    session = await db.user_sessions.find_one({"session_token": token})
    if not session:
        raise HTTPException(401, "Session invalide")
    try:
        expires = datetime.fromisoformat(session["expires_at"])
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
    except Exception:
        raise HTTPException(401, "Session invalide")
    if expires < now_utc():
        raise HTTPException(401, "Session expirée")
    user = await db.users.find_one({"user_id": session["user_id"]})
    if not user:
        raise HTTPException(401, "Utilisateur introuvable")
    return user


CurrentUser = Depends(current_user)


async def get_child_or_404(child_id: str, user: dict) -> dict:
    doc = await db.children.find_one({"id": child_id, "user_id": user["user_id"], "deleted_at": None})
    if not doc:
        raise HTTPException(404, "Enfant introuvable")
    return clean(doc)


# ---------------------------------------------------------------------------
# Auth endpoints
# ---------------------------------------------------------------------------
@api_router.post("/auth/signup")
async def signup(body: SignupIn):
    if len(body.password) < 6:
        raise HTTPException(400, "Le mot de passe doit contenir au moins 6 caractères")
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(409, "Cet email est déjà utilisé")
    user = await create_user(email, body.name, hash_password(body.password), "email")
    token = await mint_session(user["user_id"])
    return {"session_token": token, "user": public_user(user)}


@api_router.post("/auth/login")
async def login(body: LoginIn):
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not user.get("password_hash") or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, "Email ou mot de passe incorrect")
    token = await mint_session(user["user_id"])
    return {"session_token": token, "user": public_user(user)}


@api_router.post("/auth/session")
async def auth_session(body: SessionIn):
    async with httpx.AsyncClient(timeout=15) as http:
        resp = await http.get(EMERGENT_SESSION_URL, headers={"X-Session-ID": body.session_id})
    if resp.status_code != 200:
        raise HTTPException(401, "Connexion Google échouée")
    data = resp.json()
    email = (data.get("email") or "").lower()
    if not email:
        raise HTTPException(401, "Connexion Google échouée")
    session_token = data.get("session_token") or new_id()
    user = await db.users.find_one({"email": email})
    if not user:
        user = await create_user(email, data.get("name"), None, "google")
    else:
        if user.get("auth_provider") == "email":
            await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"auth_provider": "both"}})
    await mint_session(user["user_id"], token=session_token)
    return {"session_token": session_token, "user": public_user(user)}


@api_router.get("/auth/me")
async def auth_me(user: dict = CurrentUser):
    return public_user(user)


@api_router.post("/auth/logout")
async def auth_logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1].strip()
        await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}


# ---------------------------------------------------------------------------
# PIN
# ---------------------------------------------------------------------------
@api_router.post("/parent/verify-pin")
async def verify_pin(body: PinVerify, user: dict = CurrentUser):
    return {"ok": user.get("pin") == body.pin}


@api_router.put("/parent/pin")
async def change_pin(body: PinChange, user: dict = CurrentUser):
    if user.get("pin") != body.current_pin:
        raise HTTPException(403, "Code PIN actuel incorrect")
    if not (body.new_pin.isdigit() and len(body.new_pin) == 4):
        raise HTTPException(400, "Le code doit contenir 4 chiffres")
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"pin": body.new_pin}})
    return {"ok": True}


@api_router.post("/parent/reset-pin")
async def reset_pin(body: PinReset, user: dict = CurrentUser):
    if not (body.new_pin.isdigit() and len(body.new_pin) == 4):
        raise HTTPException(400, "Le code doit contenir 4 chiffres")
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"pin": body.new_pin}})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Children
# ---------------------------------------------------------------------------
@api_router.get("/children")
async def list_children(user: dict = CurrentUser):
    docs = await db.children.find({"user_id": user["user_id"], "deleted_at": None}).sort("created_at", 1).to_list(200)
    return [clean(d) for d in docs]


@api_router.post("/children")
async def create_child(body: ChildCreate, user: dict = CurrentUser):
    child = {
        "id": new_id(), "user_id": user["user_id"], "name": body.name,
        "avatar_icon": body.avatar_icon, "color": body.color, "nfc_uid": None,
        "balance_cents": 0, "deleted_at": None, "created_at": now_iso(),
    }
    await db.children.insert_one(child)
    return clean(child)


@api_router.put("/children/{child_id}")
async def update_child(child_id: str, body: ChildUpdate, user: dict = CurrentUser):
    await get_child_or_404(child_id, user)
    update = {k: v for k, v in body.dict().items() if v is not None}
    if update:
        await db.children.update_one({"id": child_id, "user_id": user["user_id"]}, {"$set": update})
    return await get_child_or_404(child_id, user)


@api_router.delete("/children/{child_id}")
async def delete_child(child_id: str, user: dict = CurrentUser):
    await get_child_or_404(child_id, user)
    await db.children.update_one({"id": child_id, "user_id": user["user_id"]}, {"$set": {"deleted_at": now_iso()}})
    return {"ok": True}


@api_router.post("/children/{child_id}/nfc")
async def associate_nfc(child_id: str, body: NfcAssociate, user: dict = CurrentUser):
    await get_child_or_404(child_id, user)
    existing = await db.children.find_one({
        "user_id": user["user_id"], "nfc_uid": body.nfc_uid, "deleted_at": None, "id": {"$ne": child_id},
    })
    if existing:
        raise HTTPException(409, "Cette carte est déjà associée à un autre enfant")
    await db.children.update_one({"id": child_id, "user_id": user["user_id"]}, {"$set": {"nfc_uid": body.nfc_uid}})
    return await get_child_or_404(child_id, user)


@api_router.get("/children/by-nfc/{uid}")
async def child_by_nfc(uid: str, user: dict = CurrentUser):
    doc = await db.children.find_one({"user_id": user["user_id"], "nfc_uid": uid, "deleted_at": None})
    if not doc:
        raise HTTPException(404, "Carte non reconnue")
    return clean(doc)


@api_router.get("/children/{child_id}/transactions")
async def child_transactions(child_id: str, user: dict = CurrentUser):
    await get_child_or_404(child_id, user)
    docs = await db.transactions.find({"child_id": child_id, "user_id": user["user_id"]}).sort("created_at", -1).to_list(500)
    return [clean(d) for d in docs]


# ---------------------------------------------------------------------------
# Products
# ---------------------------------------------------------------------------
@api_router.get("/products")
async def list_products(category: Optional[str] = None, user: dict = CurrentUser):
    query: dict[str, Any] = {"user_id": user["user_id"], "deleted_at": None}
    if category and category != "Tout":
        query["category"] = category
    docs = await db.products.find(query).sort("created_at", 1).to_list(500)
    return [clean(d) for d in docs]


@api_router.post("/products")
async def create_product(body: ProductCreate, user: dict = CurrentUser):
    product = {
        "id": new_id(), "user_id": user["user_id"], "deleted_at": None, "created_at": now_iso(),
        **body.dict(),
    }
    await db.products.insert_one(product)
    return clean(product)


@api_router.put("/products/{product_id}")
async def update_product(product_id: str, body: ProductUpdate, user: dict = CurrentUser):
    doc = await db.products.find_one({"id": product_id, "user_id": user["user_id"], "deleted_at": None})
    if not doc:
        raise HTTPException(404, "Produit introuvable")
    update = {k: v for k, v in body.dict().items() if v is not None}
    if update:
        await db.products.update_one({"id": product_id, "user_id": user["user_id"]}, {"$set": update})
    doc = await db.products.find_one({"id": product_id, "user_id": user["user_id"]})
    return clean(doc)


@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str, user: dict = CurrentUser):
    doc = await db.products.find_one({"id": product_id, "user_id": user["user_id"], "deleted_at": None})
    if not doc:
        raise HTTPException(404, "Produit introuvable")
    await db.products.update_one({"id": product_id, "user_id": user["user_id"]}, {"$set": {"deleted_at": now_iso()}})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Money operations
# ---------------------------------------------------------------------------
async def record_transaction(user_id: str, child_id: str, t_type: str, amount_cents: int,
                             reason: Optional[str], items: List[dict], new_balance: int) -> dict:
    tx = {
        "id": new_id(), "user_id": user_id, "child_id": child_id, "type": t_type,
        "amount_cents": amount_cents, "reason": reason, "items": items,
        "balance_after_cents": new_balance, "created_at": now_iso(),
    }
    await db.transactions.insert_one(tx)
    await db.children.update_one({"id": child_id, "user_id": user_id}, {"$set": {"balance_cents": new_balance}})
    return clean(tx)


@api_router.post("/transactions/credit")
async def credit(body: MoneyOp, user: dict = CurrentUser):
    child = await get_child_or_404(body.child_id, user)
    if body.amount_cents <= 0:
        raise HTTPException(400, "Le montant doit être positif")
    new_balance = child["balance_cents"] + body.amount_cents
    tx = await record_transaction(user["user_id"], child["id"], "credit", body.amount_cents, body.reason, [], new_balance)
    return {"transaction": tx, "balance_cents": new_balance}


@api_router.post("/transactions/debit")
async def debit(body: MoneyOp, user: dict = CurrentUser):
    child = await get_child_or_404(body.child_id, user)
    if body.amount_cents <= 0:
        raise HTTPException(400, "Le montant doit être positif")
    if body.amount_cents > child["balance_cents"]:
        raise HTTPException(400, "Solde insuffisant pour ce débit")
    new_balance = child["balance_cents"] - body.amount_cents
    tx = await record_transaction(user["user_id"], child["id"], "debit_manuel", body.amount_cents, body.reason, [], new_balance)
    return {"transaction": tx, "balance_cents": new_balance}


@api_router.post("/transactions/purchase")
async def purchase(body: PurchaseOp, user: dict = CurrentUser):
    child = await get_child_or_404(body.child_id, user)
    if not body.items:
        raise HTTPException(400, "Le panier est vide")
    total = sum(i.price_cents * i.qty for i in body.items)
    if total > child["balance_cents"]:
        raise HTTPException(402, "Solde insuffisant")
    new_balance = child["balance_cents"] - total
    items = [i.dict() for i in body.items]
    tx = await record_transaction(user["user_id"], child["id"], "achat", total, None, items, new_balance)
    return {"transaction": tx, "balance_cents": new_balance, "total_cents": total}


@api_router.get("/transactions")
async def list_transactions(child_id: Optional[str] = None, user: dict = CurrentUser):
    query: dict[str, Any] = {"user_id": user["user_id"]}
    if child_id:
        query["child_id"] = child_id
    docs = await db.transactions.find(query).sort("created_at", -1).to_list(1000)
    return [clean(d) for d in docs]


# ---------------------------------------------------------------------------
@api_router.get("/")
async def root():
    return {"message": "KiddyMarket API v2"}


@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
