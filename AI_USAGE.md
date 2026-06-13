# AI Usage Documentation (AI_USAGE.md)

## 1. AI Tools & Models Used
- **Primary Assistant**: Gemini 3.5 Flash (Medium)

---

## 2. Key Prompts
- *"Create a normalized PostgreSQL schema and setup script for tracking user expenses, historical memberships, and import validation anomalies."*
- *"Implement a greedy transaction minimization algorithm in Node.js matching debtors and creditors."*
- *"Write an Express controller to parse uploaded CSV text, invoke an anomaly detection engine checking for duplicates/near duplicates, and store pending reports."*

---

## 3. Core Examples of AI Inaccuracies & Corrections

### Example 1: React 19 Peer Dependency Conflict in Vite scaffolding
- **What the AI Suggested**: The AI scaffolded a React 19 Vite app and added `lucide-react@0.363.0` directly to dependencies.
- **Why it was Wrong**: `lucide-react` had strict peer dependencies restricting its use to React v16, v17, or v18. Attempting `npm install` threw an `ERESOLVE` dependency tree error and crashed.
- **How it was Discovered**: The console log output during `npm install` caught the ERESOLVE crash.
- **Final Correction**: Downgraded React, React DOM, and their type declarations to stable version `^18.2.0` in `package.json` to align with the library peer guidelines.

---

### Example 2: Command separator `;` execution failure in Windows command line
- **What the AI Suggested**: Suggested running chained setup commands in Windows command line using standard bash separators, e.g. `git config ...; git add ...; git commit ...`.
- **Why it was Wrong**: Windows PowerShell parses semicolons as command separators, but if executing inside `cmd.exe /c`, semicolons throw syntax errors. Additionally, executing raw strings containing braces like `feat(db)` caused PowerShell parsing rejections.
- **How it was Discovered**: Terminal execution failed with `exit code 1` and threw `The term 'db' is not recognized` error.
- **Final Correction**: Escaped double quotes, switched chained separators to PowerShell native syntax, and handled process bypass permissions separately.

---

### Example 3: Duplicate transaction rollback scoping inside Setup Script
- **What the AI Suggested**: Suggesting executing schema seeds by running client queries individually without explicit transaction control blocks.
- **Why it was Wrong**: If seeding users succeeded but seeding the default group failed (e.g. duplicate constraints), the database was left in a partially seeded, inconsistent state. This caused subsequent setup attempts to fail due to foreign key violations.
- **How it was Discovered**: Manual review of the error catching blocks identified that nested inserts lacked rolled-back transaction pools.
- **Final Correction**: Wrapped database seeds in explicit SQL `BEGIN`, `COMMIT`, and `ROLLBACK` transaction blocks, and added `ON CONFLICT` constraints to safely allow re-running initialization scripts.
