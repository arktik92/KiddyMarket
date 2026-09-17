# KiddyMarket — PRD

## Problème / Vision
Application familiale (FR) qui apprend aux enfants (5–12 ans) à gérer de l'argent et une « Carte Bleue » via une épicerie simulée tenue par les parents. Les enfants consultent leur solde et paient des achats en scannant leur carte NFC.

## Architecture
- **Frontend** : Expo / React Native (expo-router), react-query, reanimated, keyboard-controller, @react-native-vector-icons/ionicons. Thème « Tactile / Playful » (theme.ts). Polices Fredoka + Nunito.
- **Backend** : FastAPI + MongoDB (motor). Montants en centimes. Multi-comptes (V2). Soft-delete partout.
- **Auth (V2)** : Email+mot de passe (bcrypt, token session en base) ET Google (Emergent-managed). Token bearer stocké via expo-secure-store. Isolation totale par `user_id`.
- **NFC** : react-native-nfc-manager (lecture UID réelle sur build natif uniquement). Aucune simulation.

## Rôles
- **Parent** : s'authentifie (compte). Accès à l'espace de gestion protégé par code PIN (défaut 1234, modifiable + récupérable). CRUD produits, CRUD enfants, crédit/débit, caisse, historique. Ne voit QUE ses propres enfants/produits/transactions.
- **Enfant** : profil sélectionnable sur l'appareil du parent connecté ; voit son solde (Carte Bleue) + historique. Paie via scan NFC réel.

## Modèle de données
- users: user_id, email, name, password_hash?, auth_provider(email|google|both), pin, created_at
- user_sessions: session_token, user_id, created_at, expires_at (7j)
- children: id, user_id, name, avatar_icon, color, nfc_uid, balance_cents, deleted_at
- products: id, user_id, name, price_cents, icon, color, category, deleted_at
- transactions: id, user_id, child_id, type(credit|debit_manuel|achat), amount_cents, reason, items[], balance_after_cents, created_at

## Endpoints (/api)
- Auth: POST /auth/signup, /auth/login, /auth/session (Google), GET /auth/me, POST /auth/logout
- PIN: POST /parent/verify-pin, PUT /parent/pin, POST /parent/reset-pin
- Children: GET/POST /children, PUT/DELETE /children/{id}, POST /children/{id}/nfc, GET /children/by-nfc/{uid}, GET /children/{id}/transactions
- Products: GET/POST /products, PUT/DELETE /products/{id}
- Money: POST /transactions/credit, /transactions/debit, /transactions/purchase, GET /transactions
- Tous les endpoints de données exigent un Bearer token et filtrent par user_id.

## Implémenté
- V1 (2026-06) : sélection profil, dashboard enfant (Carte Bleue + historique), PIN parent, onglets parent (Caisse, Boutique, Enfants, Historique), caisse + paiement NFC, CRUD produits/enfants, crédit/débit, historique. Données de démo.
- Maj : animations pop-up adoucies (sans rebond). Suppression complète de la simulation NFC.
- V2 (2026-06) : authentification parent (email+mot de passe + Google Emergent), isolation multi-comptes par user_id, écran de connexion/inscription, garde de navigation, écran Réglages (modifier PIN, déconnexion), récupération du code PIN oublié (reset une fois connecté), seed de 7 produits d'exemple par compte, aucun enfant par défaut.
- Tests : backend 27/27, tous les flux frontend V2 validés.

## Backlog
- P1 : Objectifs d'épargne / tirelire par enfant.
- P1 : Vérification d'email à l'inscription + rate-limiting login.
- P2 : Reçu partageable après achat ; argent de poche automatique récurrent.
- P2 : Sessions révocables / rafraîchissement de token.
