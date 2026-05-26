-- Script SQL para criar a estrutura no Supabase
-- Execute este script no SQL Editor do seu painel do Supabase:

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  type TEXT CHECK (type IN ('INCOME', 'EXPENSE')) NOT NULL,
  category TEXT NOT NULL,
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar Row Level Security (RLS) para permitir controle de segurança
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- 1. Política para permitir leitura pública de todos os registros
DROP POLICY IF EXISTS "Permitir leitura pública" ON transactions;
CREATE POLICY "Permitir leitura pública" 
ON transactions FOR SELECT 
TO public 
USING (true);

-- 2. Política para permitir inserção pública de registros
DROP POLICY IF EXISTS "Permitir inserção pública" ON transactions;
CREATE POLICY "Permitir inserção pública" 
ON transactions FOR INSERT 
TO public 
WITH CHECK (true);

-- 3. Política para permitir exclusão pública de registros por ID
DROP POLICY IF EXISTS "Permitir exclusão pública" ON transactions;
CREATE POLICY "Permitir exclusão pública" 
ON transactions FOR DELETE 
TO public 
USING (true);
