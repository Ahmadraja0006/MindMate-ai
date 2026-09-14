# MindMate AI — SIH26003 Full-Stack Prototype

MindMate AI is an elderly-friendly cognitive training and memory-assistance platform. This package keeps the supplied `MindMateAI.jsx` prototype as the UI/game foundation and adds a real Node/Express + PostgreSQL backend, JWT authentication, persistent game sessions, caregiver APIs, and an offline sync queue.

## What is included

- React + Vite frontend
- Original MindMate game UI/logic integrated with real authentication
- Node.js + Express backend
- PostgreSQL database
- bcrypt password hashing
- JWT login/session authentication
- Elderly/Caregiver/Admin roles
- Persistent game sessions
- Adaptive difficulty data saved to backend
- Caregiver/admin user API
- IndexedDB offline game-session queue
- Automatic sync when connectivity returns
- Docker Compose for PostgreSQL
- Demo accounts and database seed

## Requirements

- Node.js 20+
- npm 10+
- Docker Desktop (recommended for PostgreSQL)

## 1. Install dependencies

From this folder:

```bash
npm install
npm run install:all
```

If the root `npm install` is not needed on your machine, you can run the frontend/backend installs directly.

## 2. Configure backend

Copy:

`backend/.env.example` → `backend/.env`

Set a strong `JWT_SECRET` for anything beyond local demo use.

## 3. Configure frontend

Copy:

`frontend/.env.example` → `frontend/.env`

For local development the default is already:

`VITE_API_URL=http://localhost:5000/api`

## 4. Start PostgreSQL

```bash
docker compose up -d db
```

## 5. Create database tables

```bash
npm run db:init --prefix backend
```

Optional demo data:

```bash
npm run db:seed --prefix backend
```

Demo password: `Demo@12345`

Demo accounts:

- Elderly: `ramesh.demo@mindmate.local`
- Caregiver: `caregiver.demo@mindmate.local`
- Admin: `admin.demo@mindmate.local`

## 6. Start the app

Open two terminals:

Terminal 1:

```bash
npm run dev --prefix backend
```

Terminal 2:

```bash
npm run dev --prefix frontend
```

Open the Vite URL shown in the terminal, normally `http://localhost:5173`.

## 7. Test the full flow

1. Log in with the demo elderly account.
2. Start a game.
3. Finish it.
4. The session is sent to PostgreSQL when online.
5. Turn off network access and finish another game.
6. The session is queued locally in IndexedDB.
7. Restore network access; the app attempts automatic sync.
8. Log in as the caregiver and view the linked elderly account through the API-backed dashboard.

## Production/cloud deployment

The code is deployment-ready in structure, but this ZIP does not create a cloud account or deploy infrastructure for you. For a production deployment, host the Express API and PostgreSQL on your chosen cloud provider, set the production `DATABASE_URL`, `JWT_SECRET`, `CLIENT_ORIGIN`, and frontend `VITE_API_URL`, enable HTTPS, and use managed backups/monitoring. The offline queue will continue to sync against the deployed API.

## Important product boundary

MindMate is a cognitive training and memory-assistance tool. It must not be presented as a dementia/Alzheimer's diagnostic or treatment system and should not replace professional medical advice.
