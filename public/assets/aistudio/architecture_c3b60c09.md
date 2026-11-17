# Architecture Specification: ExpenseTracker Pro

- **Build Mode**: Default mode
- **Bundle Hash**: `76af338b5807`
- **Prompt Directive**: Core Product Goal & Primary User Workflow  
- Provide users a fast, intuitive web dashboard to record, view, and analyze personal expenses.  
- Users can add new transactions, edit or delete existing ones, and instantly see spending trends via interactive dark‑mode charts.  
- All data is stored client‑side in browser LocalStorage, enabling offline use without authentication.

Screens / Views / API Endpoints  
1. **Landing / Dashboard View** ("/")  
   - Summary cards (total spend, monthly budget, net balance).  
   - Dark‑mode toggle (persisted in LocalStorage).  
   - Line chart showing expense over time (monthly aggregation).  
   - Pie chart breaking down spend by category.  
   - Transaction list with pagination, sortable columns, and inline edit/delete icons.  
   - “Add Transaction” floating action button (FAB).  

2. **Add / Edit Transaction Modal** (triggered from FAB or edit icon)  
   - Form fields: Date, Description, Category (dropdown), Amount, Currency, Notes (optional).  
   - Validation feedback and “Save” / “Cancel” actions.  

3. **Empty / No‑Data State**  
   - Friendly illustration with call‑to‑action “Add your first expense”.  

4. **Export View** ("/export")  
   - Button to download all transactions as CSV.  

5. **Settings Panel** ("/settings")  
   - Dark‑mode toggle, data reset button, and option to clear LocalStorage.  

Backend (Node Express) – Minimal API for future extensibility (no auth)  
- `GET /api/transactions` → Return all stored transactions (read from JSON file if later migrated).  
- `POST /api/transactions` → Validate payload, assign UUID, return created record.  
- `PUT /api/transactions/:id` → Validate, update record, return updated record.  
- `DELETE /api/transactions/:id` → Remove record, return success status.  
- `GET /api/export` → Stream CSV of all transactions.  

Data Entities & Validation  
- **Transaction**  
  - `id: string` (UUID v4) – required, immutable.  
  - `date: string` (ISO 8601) – required, must be a valid date not in the future.  
  - `description: string` – required, max 200 characters.  
  - `category: enum` – required, one of ["Food","Transport","Housing","Utilities","Entertainment","Health","Other"].  
  - `amount: number` – required, > 0, two‑decimal precision.  
  - `currency: string` – required, ISO 4217 (default “USD”).  
  - `notes: string` – optional, max 500 characters.  

Persistence Behavior  
- All CRUD operations first hit the Express endpoints, which then mirror changes to browser LocalStorage via a thin client SDK.  
- On app load, client reads LocalStorage “transactions” array; if missing, initializes empty array.  
- Dark‑mode preference stored under “uiTheme”.  

Design Aesthetic & Interaction Details  
- Dark theme based on Material‑UI (MUI) with primary accent #ff9800.  
- Responsive layout: 1‑column on mobile, 2‑column (sidebar + main) on tablets, full‑width grid on desktop ≥ 1280 px.  
- Keyboard shortcuts: `Ctrl+N` opens Add Transaction modal, `Esc` closes modal, `Enter` submits when form valid.  
- Search bar above transaction list for description text.  
- Filter chips for category and date range.  
- Inline edit via double‑click on row; delete with confirmation Snackbar.  
- Loading spinners for async actions, optimistic UI updates for CRUD.  

Security, Error Handling & Production Readiness  
- Input validation both client‑side (React Hook Form + Yup) and server‑side (express‑validator).  
- Sanitize all string inputs to prevent XSS when rendering descriptions/notes.  
- Global error middleware in Express returns standardized JSON `{ error: string, code: number }`.  
- Client shows user‑friendly toast messages on success/failure.  
- Service worker registration for offline capability and cache‑first strategy for static assets.  
- Linting with ESLint + Prettier, TypeScript strict mode enabled, unit tests with Vitest for core utilities, integration tests with Playwright for UI flows.  
- CI/CD pipeline (GitHub Actions) builds Vite bundle, runs tests, and deploys to “raone_live” Cloud Run service.  
- Monitoring hooks: expose `/healthz` endpoint, log request latency and error rates via Cloud Logging.  

RaOne AI by RavanaTec — Think. Create. Act.

## Modules & File Map
- `index.html`: Structural DOM layout & Tailwind design tokens
- `styles.css`: Custom animations, scrollbars, and theme variables
- `app.js`: Reactive state store, event handlers, and persistence
- `schema.json`: Data model & storage schema
