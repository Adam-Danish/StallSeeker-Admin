# AGENTS.md

## Project overview
- This is a Vite + React + TypeScript admin dashboard for StallSeeker.
- Core app code lives in `src/app` and the root entry is `src/main.tsx`.
- Firestore configuration is centralized in `src/firebase.ts`.
- Use the existing UI primitives under `src/app/components/ui` instead of introducing custom styling patterns unless the task specifically requires it.

## Commands
- Install dependencies: `npm install`
- Start dev server: `npm run dev`
- Build for production: `npm run build`

## Important conventions
- Prefer edits in the existing component structure and follow the current TypeScript/React patterns already used in `src/app`.
- Firebase data flows are driven by Firestore listeners in `src/app/App.tsx`; changes to vendor/user/menu state should respect those real-time patterns.
- This project is mainly a UI dashboard prototype, so keep changes minimal and consistent with the current look-and-feel.
- If a task touches data access or Firestore operations, verify the collection names and field names match the current app usage in `src/app/App.tsx` and `src/firebase.ts`.
- Do not add new framework layers or routing systems unless explicitly requested.

## Key files
- `README.md` — setup notes and local run instructions
- `src/main.tsx` — app bootstrap
- `src/firebase.ts` — Firebase initialization
- `src/app/App.tsx` — dashboard state, Firestore listeners, and screen navigation
- `src/app/components/*` — feature-specific UI and dashboard components

## Verification
- Validate code changes with: `npm run build`
- If a bug fix is needed, prefer the smallest targeted change that matches the existing data flow and UI patterns.
