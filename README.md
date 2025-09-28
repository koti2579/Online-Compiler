Online Compiler

Overview
- Full-stack web app to write, save, and run code online.
- Frontend built with React + TypeScript; Backend with Node.js + Express + MongoDB.
- Authenticated users can create, edit, and persist code files; execution results are displayed in the UI.

Tech Stack
- Frontend: `React`, `TypeScript`, `Axios`, `Create React App`
- Backend: `Node.js`, `Express`, `Mongoose`, `JWT`
- Database: `MongoDB`

Project Structure
```
Online-Compiler/
├── README.md
├── backend/
│   ├── .env                     # Environment variables (not committed)
│   ├── index.js                 # Entry/bootstrap (legacy or helper)
│   ├── middleware/
│   │   └── auth.js              # JWT auth middleware
│   ├── models/
│   │   ├── CodeFile.js          # Code file schema
│   │   └── User.js              # User schema
│   ├── package-lock.json
│   ├── package.json
│   ├── routes/
│   │   ├── auth.js              # Login/Register routes
│   │   ├── code.js              # Code execution routes
│   │   └── files.js             # File CRUD routes
│   ├── server.js                # Express server setup
│   ├── services/
│   │   └── codeExecutor.js      # Executes code in supported languages
│   ├── temp/                    # Temp workspace for code execution
│   └── uploads/                 # File uploads if any
├── frontend/
│   ├── .gitignore
│   ├── README.md
│   ├── package.json
│   ├── package-lock.json
│   ├── public/
│   │   ├── favicon.ico
│   │   ├── index.html
│   │   ├── logo192.png
│   │   ├── logo512.png
│   │   ├── manifest.json
│   │   └── robots.txt
│   ├── src/
│   │   ├── App.css
│   │   ├── App.test.tsx
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── Auth.css
│   │   │   ├── CodeEditor.css
│   │   │   ├── CodeEditor.tsx
│   │   │   ├── FileManager.css
│   │   │   ├── FileManager.tsx
│   │   │   ├── LanguageSelector.css
│   │   │   ├── LanguageSelector.tsx
│   │   │   ├── Login.tsx
│   │   │   ├── OutputDisplay.css
│   │   │   ├── OutputDisplay.tsx
│   │   │   └── Register.tsx
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx
│   │   ├── index.css
│   │   ├── index.tsx
│   │   ├── logo.svg
│   │   ├── react-app-env.d.ts
│   │   ├── reportWebVitals.ts
│   │   └── setupTests.ts
│   └── tsconfig.json
└── package.json                  # Root optional scripts
```

Prerequisites
- `Node.js` 16+ and `npm`
- `MongoDB` running locally or a connection string (Atlas, etc.)

Backend Setup
1. Go to backend: `cd backend`
2. Install deps: `npm install`
3. Create `.env` with at least:
   ```
   PORT=5000
   MONGO_URI=mongodb://localhost:27017/online-compiler
   JWT_SECRET=replace_with_a_strong_secret
   ```
4. Start dev server: `npm run dev` (or `npm start` if dev isn’t configured)

Frontend Setup
1. Go to frontend: `cd frontend`
2. Install deps: `npm install`
3. Optionally set API URL in `frontend/.env`:
   ```
   REACT_APP_API_URL=http://localhost:5000/api
   ```
   If not set, the app defaults to `http://localhost:5000/api`.
4. Start dev server: `npm start`

Development
- Run backend and frontend in separate terminals.
- Login/registration sets a JWT used by the frontend `AuthContext` to authorize file operations and code execution.

Environment Details
- Backend `.env` is ignored by Git. Do not commit secrets.
- Frontend reads `REACT_APP_API_URL` via `AuthContext.tsx` and Axios `baseURL`.

Build
- Frontend: `npm run build` creates production assets in `frontend/build`.
- Backend can serve the API and, optionally, static files if configured.

Troubleshooting
- Save errors: ensure you’re logged in, token is valid, and `filename`, `code`, `language` are provided.
- Auth issues: check `Authorization: Bearer <token>` header and token expiry.
- MongoDB connection: verify `MONGO_URI` and that MongoDB is running.

License
- Proprietary or add your license of choice.