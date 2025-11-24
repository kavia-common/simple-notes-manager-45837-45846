# Simple Notes — Ocean Professional (Frontend)

A single-page Vite app to create, edit, filter, and delete simple text notes.

Features:
- Sidebar with search/filter and note list (sorted by last updated)
- Main editor with title and content
- Toolbar with New, Save, Delete and confirmation prompt on delete
- LocalStorage persistence (no backend required)
- Lightweight hash-based state for routing-friendly behavior
- Ocean Professional theme (blue primary, amber accent), subtle shadows, rounded corners, smooth transitions
- Responsive layout and helpful empty states
- Toast notifications for actions

Environment variables:
- The app currently runs fully client-side. If a backend is added, configure it using VITE_* variables (e.g., VITE_API_BASE, VITE_BACKEND_URL).
- Do not hardcode secrets; use .env and Vite env conventions.

Scripts:
- npm run dev — start dev server
- npm run build — production build
- npm run preview — preview the production build

Notes:
- Data is stored in localStorage under key: simple_notes__v1
- Clearing browser storage will reset notes.
