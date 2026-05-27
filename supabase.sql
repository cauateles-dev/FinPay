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

-- Adicionar coluna 'user_id' para isolar dados do usuário autenticado no Supabase
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Habilitar Row Level Security (RLS) para permitir controle de segurança por usuário
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- 1. Política para permitir que usuários autenticados leiam APENAS suas próprias transações
DROP POLICY IF EXISTS "Permitir leitura ao proprietário" ON transactions;
DROP POLICY IF EXISTS "Permitir leitura pública" ON transactions;
CREATE POLICY "Permitir leitura ao proprietário" 
ON transactions FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

-- 2. Política para permitir que usuários autenticados insiram suas próprias transações
DROP POLICY IF EXISTS "Permitir inserção ao proprietário" ON transactions;
DROP POLICY IF EXISTS "Permitir inserção pública" ON transactions;
CREATE POLICY "Permitir inserção ao proprietário" 
ON transactions FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- 3. Política para permitir que usuários autenticados excluam suas próprias transações
DROP POLICY IF EXISTS "Permitir exclusão ao proprietário" ON transactions;
DROP POLICY IF EXISTS "Permitir exclusão pública" ON transactions;
CREATE POLICY "Permitir exclusão ao proprietário" 
ON transactions FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);
