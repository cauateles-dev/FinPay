import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export const formatDate = (dateString: string) => {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(dateString));
};

export interface TransactionMetadata {
  cleanDescription: string;
  paymentMethod: 'DEBIT' | 'CREDIT';
  isInstallment: boolean;
  currentInstallment: number;
  totalInstallments: number;
  originalDate?: string;
}

export function parseTransactionMeta(desc: string): TransactionMetadata {
  const result: TransactionMetadata = {
    cleanDescription: desc || '',
    paymentMethod: 'DEBIT',
    isInstallment: false,
    currentInstallment: 1,
    totalInstallments: 1
  };

  if (!desc) return result;

  // Check for installment pattern [P:current/total:originalDate]
  const installmentRegex = /\[P:(\d+)\/(\d+):([^\]]+)\]/;
  const installmentMatch = desc.match(installmentRegex);
  if (installmentMatch) {
    result.cleanDescription = desc.replace(installmentRegex, '').trim();
    result.paymentMethod = 'CREDIT';
    result.isInstallment = true;
    result.currentInstallment = parseInt(installmentMatch[1], 10);
    result.totalInstallments = parseInt(installmentMatch[2], 10);
    result.originalDate = installmentMatch[3];
    return result;
  }

  // Check for payment method pattern [M:DEBIT] or [M:CREDIT]
  const methodRegex = /\[M:(DEBIT|CREDIT)\]/;
  const methodMatch = desc.match(methodRegex);
  if (methodMatch) {
    result.cleanDescription = desc.replace(methodRegex, '').trim();
    result.paymentMethod = methodMatch[1] as 'DEBIT' | 'CREDIT';
    return result;
  }

  return result;
}
