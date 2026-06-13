-- Database Schema for Shared Expenses App
-- Designed for PostgreSQL (Supabase / AWS RDS compatible)

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Groups Table
CREATE TABLE IF NOT EXISTS groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Group Members Table (with historical timeline)
CREATE TABLE IF NOT EXISTS group_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT group_members_timeline_check CHECK (left_at IS NULL OR joined_at <= left_at)
);

-- Index for membership lookups
CREATE INDEX IF NOT EXISTS idx_group_members_group_user ON group_members(group_id, user_id);

-- 4. Expenses Table
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    original_amount NUMERIC(15, 4) NOT NULL,
    original_currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    exchange_rate NUMERIC(15, 6) NOT NULL DEFAULT 1.000000,
    converted_amount_in_inr NUMERIC(15, 4) NOT NULL,
    expense_date TIMESTAMP WITH TIME ZONE NOT NULL,
    paid_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    split_type VARCHAR(50) NOT NULL, -- 'equal', 'exact', 'percentage', 'share'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Expense Splits Table
CREATE TABLE IF NOT EXISTS expense_splits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    split_value NUMERIC(15, 4) NOT NULL, -- share percentage, exact amount, or equal share weighting
    owed_amount_in_inr NUMERIC(15, 4) NOT NULL,
    UNIQUE (expense_id, user_id)
);

-- 6. Settlements Table
CREATE TABLE IF NOT EXISTS settlements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    payer_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    amount NUMERIC(15, 4) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    exchange_rate NUMERIC(15, 6) NOT NULL DEFAULT 1.000000,
    converted_amount_in_inr NUMERIC(15, 4) NOT NULL,
    settlement_date TIMESTAMP WITH TIME ZONE NOT NULL,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Exchange Rates Table
CREATE TABLE IF NOT EXISTS exchange_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_currency VARCHAR(3) NOT NULL,
    to_currency VARCHAR(3) NOT NULL,
    rate NUMERIC(15, 6) NOT NULL,
    effective_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (from_currency, to_currency, effective_date)
);

-- 8. Imports Table
CREATE TABLE IF NOT EXISTS imports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL, -- 'pending', 'approved', 'rejected', 'completed'
    total_rows INTEGER DEFAULT 0,
    imported_rows INTEGER DEFAULT 0,
    valid_rows INTEGER DEFAULT 0,
    invalid_rows INTEGER DEFAULT 0,
    flagged_rows INTEGER DEFAULT 0,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Import Rows Table
CREATE TABLE IF NOT EXISTS import_rows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    import_id UUID NOT NULL REFERENCES imports(id) ON DELETE CASCADE,
    row_number INTEGER NOT NULL,
    raw_data JSONB NOT NULL,
    status VARCHAR(50) NOT NULL -- 'parsed', 'ignored', 'imported'
);

-- 10. Anomalies Table
CREATE TABLE IF NOT EXISTS anomalies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    import_id UUID NOT NULL REFERENCES imports(id) ON DELETE CASCADE,
    row_number INTEGER NOT NULL,
    severity VARCHAR(50) NOT NULL, -- 'low', 'medium', 'high', 'critical'
    type VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    suggested_action TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Pending', -- 'Pending', 'Approved', 'Rejected'
    decision VARCHAR(50) DEFAULT NULL, -- 'keep_both', 'merge', 'ignore_warning', 'fix_manual'
    fixed_data JSONB DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action_type VARCHAR(100) NOT NULL, -- 'CREATE_EXPENSE', 'UPDATE_EXPENSE', 'DELETE_EXPENSE', 'IMPORT_CSV', 'APPROVE_ANOMALY', etc.
    entity_type VARCHAR(50) NOT NULL, -- 'expense', 'import', 'anomaly', 'settlement'
    entity_id UUID NOT NULL,
    performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    old_values JSONB,
    new_values JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12. Refresh Tokens Table
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
