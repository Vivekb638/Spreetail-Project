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

---

### Example 4: CSS Specificity Overriding Tailwind Utility Paddings
- **What the AI Suggested**: Setting absolute-positioned icons inside inputs and expecting utility padding classes (like `pl-11`) to push the text cursor rightwards when using a custom `.glass-input` class.
- **Why it was Wrong**: The custom `.glass-input` class defined explicit padding `px-4` in `index.css`. In the built asset hierarchy, the component class rules had higher specificity or were evaluated after Tailwind utilities, causing the left-padding to collapse back to `16px`. This resulted in the user's input text visually overwriting the background icons.
- **How it was Discovered**: Visual inspection of the signup/login pages during manual registration workflows.
- **Final Correction**: Refined `index.css` to include a dedicated `.glass-input-icon` class. This class explicitly sets `pl-12` and `pr-4` inside the sheet, securing proper spacing.

---

### Example 5: Undefined `DATABASE_URL` Causing Startup Crash on Vercel Node Serverless Function
- **What the AI Suggested**: Initializing the PG Pool directly and checking `process.env.DATABASE_URL.includes('supabase')` on file import in `db.js`.
- **Why it was Wrong**: During serverless build and warm-up phases on Vercel, the environment variables might be unconfigured or loading. Accessing `.includes()` on an undefined `DATABASE_URL` threw a `TypeError` and crashed the serverless function instantly, causing `FUNCTION_INVOCATION_FAILED` (500) errors.
- **How it was Discovered**: Visiting the backend `/health` endpoint and observing the 500 error page with `FUNCTION_INVOCATION_FAILED`.
- **Final Correction**: Added safety checks in `backend/src/config/db.js` to handle missing environment variables gracefully on load, allowing the server process to start and handle connection requests or return descriptive health statuses.

---

### Example 6: Tracked `node_modules` Causing Linux Binary Mismatch in Vercel
- **What the AI Suggested**: Directly deploying the backend directory to Vercel with existing file structures.
- **Why it was Wrong**: The `backend/node_modules` directory was previously tracked and committed in Git. Vercel used these Windows-compiled dependencies instead of building them cleanly, leading to ABI/native module loading failures on Vercel's Linux runtime environment.
- **How it was Discovered**: Observing that backend `/health` still threw 500 crashes after environment variables were saved, and running `git ls-files` to confirm that `node_modules` was tracked in git.
- **Final Correction**: Untracked `backend/node_modules` from Git using `git rm -r --cached backend/node_modules`, committed, and pushed. This forced Vercel to install fresh Linux-compatible dependencies on redeployment.



