# ReStyle Frontend

This directory contains the React single-page application for ReStyle. For the complete project description, architecture, API overview, environment variables, and full setup instructions, see the [root README](../README.md).

## Frontend stack

- React 19
- Vite
- React Router
- Context API for authentication
- Redux Toolkit for marketplace favorites
- Axios
- Socket.IO Client
- Oxlint

## Local setup

```bash
npm install
cp .env.example .env
npm run dev
```

For local development, configure:

```env
VITE_API_URL=http://localhost:3001/api
VITE_GOOGLE_CLIENT_ID=your_web_client_id.apps.googleusercontent.com
```

Do not put backend secrets, private API keys, email credentials, or PayPal secrets in the frontend environment file. Variables prefixed with `VITE_` are included in the browser bundle.

## Commands

```bash
npm run dev      # Start the Vite development server
npm run lint     # Run Oxlint
npm test         # Run frontend unit tests
npm run build    # Create a production build
npm run preview  # Preview the production build locally
```

## Source structure

```text
src/
├── components/  Reusable UI and route protection
├── context/     Authentication state and token refresh flow
├── hooks/       Shared React hooks
├── pages/       Lazy-loaded application screens
├── store/       Redux store and slices
├── config/      API URL configuration
├── App.jsx      Router and application layout
└── main.jsx     React, Redux, auth, and error-boundary providers
```

Static page styles and images are served from `public/`. Application pages are implemented in React; there are no standalone legacy HTML pages.
