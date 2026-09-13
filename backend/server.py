from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Literal, Any
import uuid
from datetime import datetime, timezone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

FAMILY_ID = "family-default"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class Child(BaseModel):
    id: str = Field(default_factory=new_id)
    family_id: str = FAMILY_ID
    name: str
    avatar_icon: str = "paw"
    color: str = "#FF6B6B"
    nfc_uid: Optional[str] = None
    balance_cents: int = 0
    deleted_at: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)


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


class Product(BaseModel):
    id: str = Field(default_factory=new_id)
    family_id: str = FAMILY_ID
    name: str
    price_cents: int
    icon: str = "pricetag"
    color: str = "#4ECDC4"
    category: str = "Autre"
    deleted_at: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)


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


class Transaction(BaseModel):
    id: str = Field(default_factory=new_id)
    family_id: str = FAMILY_ID
    child_id: str
    type: Literal["credit", "debit_manuel", "achat"]
    amount_cents: int
    reason: Optional[str] = None
    items: List[PurchaseItem] = []
    balance_after_cents: int = 0
    created_at: str = Field(default_factory=now_iso)


class MoneyOp(BaseModel):
    child_id: str
    amount_cents: int
    reason: Optional[str] = None


class PurchaseOp(BaseModel):
    child_id: str
    items: List[PurchaseItem]


class PinVerify(BaseModel):
    pin: str


class PinChange(BaseModel):
    current_pin: str
    new_pin: str


def clean(doc: dict) -> dict:
    if doc and "_id" in doc:
        doc = {k: v for k, v in doc.items() if k != "_id"}
    return doc


async def get_child_or_404(child_id: str) -> dict:
    doc = await db.children.find_one({"id": child_id, "deleted_at": None})
    if not doc:
        raise HTTPException(status_code=404, detail="Enfant introuvable")
    return clean(doc)


# ---------------------------------------------------------------------------
# Family / PIN
# ---------------------------------------------------------------------------
@api_router.get("/family")
async def get_family():
    fam = await db.families.find_one({"id": FAMILY_ID})
    if not fam:
        raise HTTPException(status_code=404, detail="Famille introuvable")
    fam = clean(fam)
    return {
        "id": fam["id"],
        "name": fam.get("name", "Ma famille"),
        "currency": fam.get("currency", "EUR"),
        "has_pin": bool(fam.get("pin")),
    }


@api_router.post("/parent/verify-pin")
async def verify_pin(body: PinVerify):
    fam = await db.families.find_one({"id": FAMILY_ID})
    ok = bool(fam) and fam.get("pin") == body.pin
    return {"ok": ok}


@api_router.put("/parent/pin")
async def change_pin(body: PinChange):
    fam = await db.families.find_one({"id": FAMILY_ID})
    if not fam or fam.get("pin") != body.current_pin:
        raise HTTPException(status_code=403, detail="Code PIN actuel incorrect")
    if not (body.new_pin.isdigit() and len(body.new_pin) == 4):
        raise HTTPException(status_code=400, detail="Le code doit contenir 4 chiffres")
    await db.families.update_one({"id": FAMILY_ID}, {"$set": {"pin": body.new_pin}})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Children
# ---------------------------------------------------------------------------
@api_router.get("/children")
async def list_children():
    docs = await db.children.find({"family_id": FAMILY_ID, "deleted_at": None}).sort("created_at", 1).to_list(200)
    return [clean(d) for d in docs]


@api_router.post("/children")
async def create_child(body: ChildCreate):
    child = Child(**body.dict())
    await db.children.insert_one(child.dict())
    return child.dict()


@api_router.put("/children/{child_id}")
async def update_child(child_id: str, body: ChildUpdate):
    await get_child_or_404(child_id)
    update = {k: v for k, v in body.dict().items() if v is not None}
    if update:
        await db.children.update_one({"id": child_id}, {"$set": update})
    return await get_child_or_404(child_id)


@api_router.delete("/children/{child_id}")
async def delete_child(child_id: str):
    await get_child_or_404(child_id)
    await db.children.update_one({"id": child_id}, {"$set": {"deleted_at": now_iso()}})
    return {"ok": True}


@api_router.post("/children/{child_id}/nfc")
async def associate_nfc(child_id: str, body: NfcAssociate):
    await get_child_or_404(child_id)
    existing = await db.children.find_one({
        "family_id": FAMILY_ID,
        "nfc_uid": body.nfc_uid,
        "deleted_at": None,
        "id": {"$ne": child_id},
    })
    if existing:
        raise HTTPException(status_code=409, detail="Cette carte est déjà associée à un autre enfant")
    await db.children.update_one({"id": child_id}, {"$set": {"nfc_uid": body.nfc_uid}})
    return await get_child_or_404(child_id)


@api_router.get("/children/by-nfc/{uid}")
async def child_by_nfc(uid: str):
    doc = await db.children.find_one({"family_id": FAMILY_ID, "nfc_uid": uid, "deleted_at": None})
    if not doc:
        raise HTTPException(status_code=404, detail="Carte non reconnue")
    return clean(doc)


@api_router.get("/children/{child_id}/transactions")
async def child_transactions(child_id: str):
    await get_child_or_404(child_id)
    docs = await db.transactions.find({"child_id": child_id}).sort("created_at", -1).to_list(500)
    return [clean(d) for d in docs]


# ---------------------------------------------------------------------------
# Products
# ---------------------------------------------------------------------------
@api_router.get("/products")
async def list_products(category: Optional[str] = None):
    query: dict[str, Any] = {"family_id": FAMILY_ID, "deleted_at": None}
    if category and category != "Tout":
        query["category"] = category
    docs = await db.products.find(query).sort("created_at", 1).to_list(500)
    return [clean(d) for d in docs]


@api_router.post("/products")
async def create_product(body: ProductCreate):
    product = Product(**body.dict())
    await db.products.insert_one(product.dict())
    return product.dict()


@api_router.put("/products/{product_id}")
async def update_product(product_id: str, body: ProductUpdate):
    doc = await db.products.find_one({"id": product_id, "deleted_at": None})
    if not doc:
        raise HTTPException(status_code=404, detail="Produit introuvable")
    update = {k: v for k, v in body.dict().items() if v is not None}
    if update:
        await db.products.update_one({"id": product_id}, {"$set": update})
    doc = await db.products.find_one({"id": product_id})
    return clean(doc)


@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str):
    doc = await db.products.find_one({"id": product_id, "deleted_at": None})
    if not doc:
        raise HTTPException(status_code=404, detail="Produit introuvable")
    await db.products.update_one({"id": product_id}, {"$set": {"deleted_at": now_iso()}})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Money operations
# ---------------------------------------------------------------------------
async def record_transaction(child: dict, t_type: str, amount_cents: int,
                              reason: Optional[str], items: List[PurchaseItem],
                              new_balance: int) -> dict:
    tx = Transaction(
        child_id=child["id"],
        type=t_type,
        amount_cents=amount_cents,
        reason=reason,
        items=items,
        balance_after_cents=new_balance,
    )
    await db.transactions.insert_one(tx.dict())
    await db.children.update_one({"id": child["id"]}, {"$set": {"balance_cents": new_balance}})
    return tx.dict()


@api_router.post("/transactions/credit")
async def credit(body: MoneyOp):
    child = await get_child_or_404(body.child_id)
    if body.amount_cents <= 0:
        raise HTTPException(status_code=400, detail="Le montant doit être positif")
    new_balance = child["balance_cents"] + body.amount_cents
    tx = await record_transaction(child, "credit", body.amount_cents, body.reason, [], new_balance)
    return {"transaction": tx, "balance_cents": new_balance}


@api_router.post("/transactions/debit")
async def debit(body: MoneyOp):
    child = await get_child_or_404(body.child_id)
    if body.amount_cents <= 0:
        raise HTTPException(status_code=400, detail="Le montant doit être positif")
    if body.amount_cents > child["balance_cents"]:
        raise HTTPException(status_code=400, detail="Solde insuffisant pour ce débit")
    new_balance = child["balance_cents"] - body.amount_cents
    tx = await record_transaction(child, "debit_manuel", body.amount_cents, body.reason, [], new_balance)
    return {"transaction": tx, "balance_cents": new_balance}


@api_router.post("/transactions/purchase")
async def purchase(body: PurchaseOp):
    child = await get_child_or_404(body.child_id)
    if not body.items:
        raise HTTPException(status_code=400, detail="Le panier est vide")
    total = sum(i.price_cents * i.qty for i in body.items)
    if total > child["balance_cents"]:
        raise HTTPException(status_code=402, detail="Solde insuffisant")
    new_balance = child["balance_cents"] - total
    tx = await record_transaction(child, "achat", total, None, body.items, new_balance)
    return {"transaction": tx, "balance_cents": new_balance, "total_cents": total}


@api_router.get("/transactions")
async def list_transactions(child_id: Optional[str] = None):
    query: dict[str, Any] = {"family_id": FAMILY_ID}
    if child_id:
        query["child_id"] = child_id
    docs = await db.transactions.find(query).sort("created_at", -1).to_list(1000)
    return [clean(d) for d in docs]


# ---------------------------------------------------------------------------
# Seed
# ---------------------------------------------------------------------------
async def seed():
    fam = await db.families.find_one({"id": FAMILY_ID})
    if not fam:
        await db.families.insert_one({
            "id": FAMILY_ID,
            "name": "Ma famille",
            "currency": "EUR",
            "pin": "1234",
            "created_at": now_iso(),
        })
        logger.info("Seeded family with default PIN 1234")

    if await db.children.count_documents({"family_id": FAMILY_ID}) == 0:
        samples = [
            {"name": "Lucas", "avatar_icon": "paw", "color": "#FF6B6B", "balance_cents": 1200},
            {"name": "Emma", "avatar_icon": "fish", "color": "#4ECDC4", "balance_cents": 500},
        ]
        for s in samples:
            c = Child(**s)
            await db.children.insert_one(c.dict())
        logger.info("Seeded sample children")

    if await db.products.count_documents({"family_id": FAMILY_ID}) == 0:
        prods = [
            {"name": "Pomme", "price_cents": 50, "icon": "nutrition", "color": "#4ECDC4", "category": "Alimentation"},
            {"name": "Chocolat", "price_cents": 150, "icon": "ice-cream", "color": "#FF6B6B", "category": "Alimentation"},
            {"name": "Jus d'orange", "price_cents": 120, "icon": "wine", "color": "#FFE66D", "category": "Alimentation"},
            {"name": "Petite voiture", "price_cents": 300, "icon": "car-sport", "color": "#4D96FF", "category": "Jeux"},
            {"name": "Jeu de cartes", "price_cents": 250, "icon": "game-controller", "color": "#FF6B6B", "category": "Jeux"},
            {"name": "Livre d'images", "price_cents": 400, "icon": "book", "color": "#4ECDC4", "category": "Livres"},
            {"name": "Autocollants", "price_cents": 80, "icon": "star", "color": "#FFE66D", "category": "Autre"},
        ]
        for p in prods:
            prod = Product(**p)
            await db.products.insert_one(prod.dict())
        logger.info("Seeded sample products")


@app.on_event("startup")
async def on_startup():
    await seed()


@api_router.get("/")
async def root():
    return {"message": "KiddyMarket API"}


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
