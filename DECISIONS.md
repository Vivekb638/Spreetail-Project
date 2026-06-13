# Architectural Decisions Document (DECISIONS.md)

## 1. Supabase vs. Self-hosted PostgreSQL
- **Problem**: Deciding the hosting and API layer for our database.
- **Options Considered**:
  1. Relying heavily on Supabase client and Row Level Security (RLS) configurations.
  2. Utilizing Supabase only as a managed PostgreSQL database, writing clean, standard SQL via standard connection pooling (`pg` module).
- **Pros/Cons**:
  - *Option 1*: Fast setup, built-in REST endpoints. However, it creates strong vendor lock-in, makes offline testing harder, and complicates future migration to standard AWS RDS PostgreSQL.
  - *Option 2*: Maximum portability, query optimization is fully explainable, local testing is trivial, and migration to AWS RDS requires zero code changes.
- **Final Choice**: **Option 2**. We use raw SQL queries and connection pools. This guarantees 100% compatibility with AWS RDS PostgreSQL for future migrations.

---

## 2. JWT Access/Refresh Rotation vs. State Session Cookies
- **Problem**: User authentication mechanism.
- **Options Considered**:
  1. Standard cookie-based sessions (Express-session + Redis).
  2. JWT (JSON Web Tokens) Access and Refresh Token Rotation stored securely.
- **Pros/Cons**:
  - *Option 1*: Simple, session state is easily revoked. However, it requires a stateful session store (like Redis), causing scalability constraints on serverless deployments (AWS Lambda).
  - *Option 2*: Stateless verification makes backend easily scaleable across multiple AWS EC2/Lambda instances. By implementing refresh tokens in the database, we keep the ability to revoke sessions instantly.
- **Final Choice**: **Option 2**. We use a 1-hour access token and a 7-day database-backed refresh token. This provides the best mix of stateless performance and secure revocation.

---

## 3. Duplicate Handling Strategy (Automatic vs. Interactive Review)
- **Problem**: Handling duplicate and near duplicate spreadsheet entries.
- **Options Considered**:
  1. Silently discard duplicates during parsing.
  2. Interactive review pipeline: flag anomalies, record decisions in database, and allow manual resolutions.
- **Pros/Cons**:
  - *Option 1*: Fast execution, but can lead to silent data loss if near duplicates were actually separate valid expenses (e.g. dinner on consecutive days).
  - *Option 2*: Gives full control to the user. Complies with Meera's requirement that "no change should silently modify data and everything requires approval".
- **Final Choice**: **Option 2**. Anomalies are saved as pending records. The user must explicitly approve resolutions (Merge, Keep Both, or Ignore) before database commits are made.

---

## 4. Exchange Rate Storage Strategy
- **Problem**: Handling USD/INR conversions dynamically.
- **Options Considered**:
  1. Fetch live rates on every balance calculation request.
  2. Lock the exchange rate at the transaction date / import time and store it inside the expense/settlement record.
- **Pros/Cons**:
  - *Option 1*: Up-to-date conversion rates, but historical balances will fluctuate constantly, violating accounting integrity.
  - *Option 2*: Guarantees historical consistency. Fulfills the rule "Never recalculate historical expenses and always display the rate used".
- **Final Choice**: **Option 2**. We store `original_amount`, `original_currency`, `exchange_rate`, and `converted_amount_in_inr` directly in the `expenses` and `settlements` tables.

---

## 5. Debt Simplification Algorithm
- **Problem**: Minimizing peer-to-peer settlement transactions.
- **Options Considered**:
  1. Standard pairwise settlements (if A owes B and B owes C, record two separate transactions).
  2. Greedy Net Balance Simplification (calculate net balance of all users, match the largest debtor with the largest creditor, and settle greedily).
- **Pros/Cons**:
  - *Option 1*: Direct tracking of who spent where, but creates a high volume of redundant transactions.
  - *Option 2*: Reduces transaction counts to the absolute minimum ($O(N)$ transactions where $N$ is the number of members), making settling up exceptionally simple.
- **Final Choice**: **Option 2**. We implement greedy net balance minimization, displaying Aisha's final settlements prominently in a hero banner.

---

## 6. File Upload Architecture
- **Problem**: Handling CSV uploads to the server without file system bloat.
- **Options Considered**:
  1. Standard multipart form-data upload using libraries like `multer` saving files locally.
  2. Browser-side FileReader parsing to string, posting data in a JSON payload.
- **Pros/Cons**:
  - *Option 1*: Standard file upload, but introduces server disk-write overheads, multipart boundary parsing, and is not serverless-friendly.
  - *Option 2*: Extremely clean, avoids server write access requirements, runs perfectly on AWS Lambda (read-only filesystem), and is completely immune to disk capacity leaks.
- **Final Choice**: **Option 2**. React reads the CSV text client-side and posts it inside a JSON request, keeping the backend completely stateless and diskless.
