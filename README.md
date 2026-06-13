# Shared Expenses Application (Splitwise Pro)

A production-ready Shared Expenses Application designed for tracking expenses, managing historical flatmate memberships, detecting anomalies from spreadsheet exports, and performing traceable debt calculations with Splitwise-style transaction minimization.

## Tech Stack
- **Frontend**: React.js (Vite), React Router v6, Tailwind CSS, Axios, Lucide Icons
- **Backend**: Node.js, Express.js, JWT, Bcrypt, Helmet, Express-Rate-Limit, PDFKit
- **Database**: PostgreSQL (designed for portability between Supabase and AWS RDS)

---

## Features
1. **User Authentication**: Secure signup and login with a password visibility toggle (eye icon), rotating JWT session validation, and secure logout.
2. **Groups & Memberships**: Historical timeline tracking (`joined_at`, `left_at`) to ensure expenses are split only during active periods.
3. **Expense split types**: Equal, exact unequal amounts, percentage splits, and share ratios.
4. **Settlements Engine**: Record peer-to-peer settlements separate from expenses.
5. **Multi-Currency Support**: Record USD/INR transactions with automated historical rate locking.
6. **Balance Engine**: Calculates total paid, total owed, net balance, and provides Aisha's simplified repayments (greedy minimizer).
7. **Traceable Explanations**: Granular ledger showing Rohan's detailed expense explanations.
8. **Interactive CSV Importer**: High-fidelity anomaly scanner checking for 15 spreadsheet anomalies with interactive correction review. Includes progress tracking, interactive tabs (All, Pending, Resolved), and decision toggle-deselect checks.
9. **Global Navigation**: Header link pointing to group imports dynamically, with group selection selectors for non-group pages.
10. **Export Formats**: PDF and JSON exports of CSV import validation reports.
11. **Audit Trail**: Tracking logs on database events, viewable in the Admin History panel.

---

## Environment Variables

Configure these inside `backend/.env`:

```env
PORT=5000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/shared_expenses
JWT_SECRET=super_secret_access_token_key_123!@#
JWT_REFRESH_SECRET=super_secret_refresh_token_key_456!@#
CORS_ORIGIN=http://localhost:5173
NODE_ENV=development
```

Configure these inside `frontend/.env` (optional, defaults to port 5000):

```env
VITE_API_URL=http://localhost:5000
```

---

## Setup & Running Instructions

### Prerequisites
- Node.js (v18+)
- PostgreSQL Database

### 1. Database Setup
Ensure PostgreSQL is running, then execute the setup script to initialize the schema and seed default flatmates (Aisha, Rohan, Priya, Meera, Sam, Dev) with their correct historical timelines:

```bash
cd database
npm install
node setup.js
```

### 2. Run Backend API
```bash
cd backend
npm install
npm run dev
```

### 3. Run Frontend
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## API Documentation

### Auth
- `POST /auth/register` - Create user.
- `POST /auth/login` - Authenticate user, returns access & refresh tokens.
- `POST /auth/logout` - Revoke refresh token.
- `POST /auth/refresh` - Generate new access token using valid refresh token.

### Groups & Members
- `GET /groups` - Fetch groups user is a member of.
- `POST /groups` - Create a new group.
- `PUT /groups/:id` - Edit group details.
- `DELETE /groups/:id` - Delete group.
- `GET /groups/:id/members` - Fetch group member list and timelines.
- `POST /groups/:id/members` - Add member to group.
- `PUT /groups/:id/members/:memberId` - Update member joined/left dates.
- `DELETE /groups/:id/members/:memberId` - Remove member (sets `left_at` time).

### Expenses
- `GET /expenses?group_id=:id` - List all expenses in a group.
- `POST /expenses` - Create expense (equal, unequal, percentage, share splits).
- `GET /expenses/:id` - Get expense split breakdown.
- `PUT /expenses/:id` - Edit expense details and re-split.
- `DELETE /expenses/:id` - Delete expense.

### Settlements
- `POST /settlements` - Record a peer-to-peer settlement payment.
- `GET /settlements?group_id=:id` - Fetch settlements history.

### Balances & Engine
- `GET /groups/:id/balance` - Detailed group balance breakdown.
- `GET /users/:id/balance?group_id=:gid` - Detailed user explainable ledger.
- `GET /groups/:id/simplified-settlements` - Simplified Splitwise-style transactions.

### Imports
- `POST /imports/csv` - Upload raw CSV data text for scanning.
- `GET /imports/:id/anomalies` - Fetch anomalies found in import.
- `POST /imports/:id/approve` - Approve import and apply mapping corrections.
- `POST /imports/:id/reject` - Discard import dataset.
- `GET /imports/:id/report` - Get import report.
- `GET /imports/:id/report/export?format=pdf|json` - Export PDF/JSON reports.

---

## Testing Instructions

Run the Jest test suite:

```bash
cd backend
npm test
```
This tests the Anomaly engine and the Balance engine calculations.
