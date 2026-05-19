/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface User {
  id: string;
  name: string;
  email: string;
}

export type TransactionType = 'INCOME' | 'EXPENSE';

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: TransactionType;
  category: string;
  date: string; // ISO format
}

export const CATEGORIES = {
  INCOME: [
    'Salário',
    'Investimentos',
    'Presente',
    'Vendas',
    'Outros'
  ],
  EXPENSE: [
    'Alimentação',
    'Transporte',
    'Moradia',
    'Saúde',
    'Educação',
    'Lazer',
    'Compras',
    'Contas',
    'Outros'
  ]
};

export const CATEGORY_COLORS: Record<string, string> = {
  'Alimentação': '#ef4444', // Red
  'Transporte': '#f97316', // Orange
  'Moradia': '#06b6d4', // Cyan
  'Saúde': '#8b5cf6', // Violet
  'Educação': '#ec4899', // Pink
  'Lazer': '#eab308', // Yellow
  'Compras': '#6366f1', // Indigo
  'Contas': '#64748b', // Slate
  'Outros': '#94a3b8', // Slate
  'Salário': '#22c55e', // Green
  'Investimentos': '#10b981', // Emerald
  'Presente': '#84cc16', // Lime
  'Vendas': '#06b6d4', // Cyan
};
