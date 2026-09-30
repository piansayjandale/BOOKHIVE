# TODO - Fix Student App (Backend + QR/Expo Deep Link)

## Step 1 — Understand & map current student app ↔ backend calls
- [x] Inspect student Expo structure and API client.
- [x] Inspect backend student routes & auth middleware.
- [x] Found missing `Student/.../data/books` and `Student/.../data/store` which prevented screens from working.
- [ ] Identify which student screens are currently mocked vs calling API (after build succeeds).


## Step 2 — Fix backend connectivity across ALL student dashboards/screens
- [ ] Wire Home, Search, Books, Book Details, Borrow/Return, History/Reservations, Profile to use `apiClient`.
- [ ] Remove the in-memory adapter once backend-backed adapter is implemented.

- [ ] Ensure every screen is guarded by AuthProvider state and handles 401 -> logout/navigate.
- [ ] Confirm API endpoints match backend paths under `/api/student/*`.

## Step 3 — Implement missing student registration
- [ ] Implement `studentController.register` end-to-end (DB create user + return token).
- [ ] Ensure `student.model` supports user creation.
- [ ] Verify student app register flow works.

## Step 4 — Add QR code + deep link flow (custom scheme)
- [ ] Add backend endpoint to mint/consume QR login tokens.
- [ ] Add student app deep-link handler route(s) that auto-auth using QR token.
- [ ] Add QR screen/component that can render a QR payload (or validate payload from backend).

## Step 5 — Make it work in Snack
- [ ] Update docs and configuration guidance: set `EXPO_PUBLIC_API_URL` for Snack.
- [ ] Verify deep link + API work when running in Expo Go/Snack.

## Step 6 — Testing checklist
- [ ] curl/postman: login + protected endpoints.
- [ ] Expo: verify screens show real data.
- [ ] QR: scan -> app opens -> authenticated.

