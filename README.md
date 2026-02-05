# SouqView Mobile

Refined navigation and deep Stock Dashboard with Demo Trading (paper trading) and XP.

## Tabs

- **Watchlist** – Entry point; list of tracked stocks (market snapshot). Tap a stock to open the Stock Dashboard.
- **Faheem** – Global AI assistant (placeholder).
- **Portfolio** – Demo Trading dashboard: 100,000 AED virtual balance, positions, recent trades, XP and level (+50 XP per trade).
- **Settings** – Profile and localization (placeholder).

## Stock Dashboard

From Watchlist, tap a symbol to open the deep dashboard with:

- **Overview** – Price chart (SVG line), Open/High/Low/Vol.
- **News** – Headlines for the ticker.
- **Financials** – Income Statement, Balance Sheet, Cash Flow.
- **Forecast & Technicals** – Buy/Sell sentiment gauge and technical indicators.
- **Insiders & Community** – Insider transactions and community placeholder.

Segmented tab bar with haptics when switching segments. Floating **Trade** button opens the demo order modal (Buy/Sell, quantity, +50 XP per trade).

## Design

- **OLED** background: `#000000`.
- **Electric Blue** `#4E9EE5` and **Neon Mint** `#31A270` for accents (web parity).

## Setup

1. Install: `npm install`
2. **Environment:** Copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL` to your backend (e.g. `http://localhost:5000/api`). Optional for local dev (defaults to `http://localhost:5000/api`).
3. Run: `npx expo start` then choose iOS/Android/Web or scan QR code with Expo Go.

Backend must be running (e.g. `http://localhost:5000`) and CORS allowed. Stock, news, sentiment, and financials endpoints are used.

- **Login:** The login screen is at `/login` and is registered in the root stack. To require login before using the app, set `REQUIRE_LOGIN = true` in `components/AuthGate.tsx`.
- **Tests:** `npm test`
- **Builds:** EAS Build is configured in `eas.json`. Run `eas build --platform all` (after `eas login`) to create production builds. Set `EXPO_PUBLIC_API_URL` in `eas.json` or EAS secrets for production.

## Run on your phone

1. Install **Expo Go** from App Store (iOS) or Play Store (Android).
2. From project root run: `npm run mobile` or from `mobile` folder: `npx expo start`.
3. Ensure phone and PC are on the same Wi‑Fi, then scan the QR code with Expo Go (Android) or Camera (iOS).
