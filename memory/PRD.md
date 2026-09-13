# KiddyMarket — PRD

## Problème / Vision
Application familiale (FR) qui apprend aux enfants (5–12 ans) à gérer de l'argent et une « Carte Bleue » via une épicerie simulée tenue par les parents. Les enfants consultent leur solde et paient des achats en scannant leur carte NFC (mode simulation en attendant un build natif).

## Architecture
- **Frontend** : Expo / React Native (expo-router), react-query, reanimated, keyboard-controller, @react-native-vector-icons/ionicons. Thème « Tactile / Playful » (theme.ts). Polices Fredoka + Nunito.
- **Backend** : FastAPI + MongoDB (motor). Montants en centimes. Famille unique MVP (`family-default`). Soft-delete partout.
- **NFC** : react-native-nfc-manager (lecture UID réelle sur build natif) + mode simulation dans le préview/Expo Go.

## Rôles
- **Parent** : accès protégé par code PIN (défaut 1234). CRUD produits, CRUD enfants, crédit/débit, caisse (encaissement), historique global.
- **Enfant** : sélectionne son profil, voit son solde (Carte Bleue) + historique. Paie via scan NFC (ou simulation).

## Modèle de données
- Family: id, name, currency, pin
- Child: id, family_id, name, avatar_icon, color, nfc_uid, balance_cents, deleted_at
- Product: id, family_id, name, price_cents, icon, color, category, deleted_at
- Transaction: id, family_id, child_id, type(credit|debit_manuel|achat), amount_cents, reason, items[], balance_after_cents, created_at

## Endpoints (/api)
- GET /family, POST /parent/verify-pin, PUT /parent/pin
- GET/POST /children, PUT/DELETE /children/{id}, POST /children/{id}/nfc, GET /children/by-nfc/{uid}, GET /children/{id}/transactions
- GET/POST /products, PUT/DELETE /products/{id}
- POST /transactions/credit, /transactions/debit, /transactions/purchase, GET /transactions

## Implémenté (2026-06)
- MVP complet : sélection profil, dashboard enfant (Carte Bleue + historique), PIN parent, onglets parent (Caisse, Boutique, Enfants, Historique).
- Caisse : panier + total + paiement NFC (simulation) avec vérif solde, messages ludiques, animation succès.
- CRUD produits (icône/couleur/catégorie/prix), CRUD enfants (avatar/couleur), crédit/débit avec motif, association carte NFC (réelle + simulée).
- Historique global filtrable par enfant. Données de démo semées.
- Tests : backend 15/15, frontend flows critiques validés.

## Backlog
- P1 : Objectifs d'épargne / tirelire par enfant ; cadeau visuel de récompense.
- P1 : Changement du code PIN depuis l'app (endpoint déjà prêt).
- P2 : Multi-familles + authentification parent.
- P2 : Reçu partageable après un achat.
