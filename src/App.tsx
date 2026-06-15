/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Calendar, 
  Trash2, 
  PieChart as PieChartIcon,
  AlertCircle,
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Check,
  ArrowLeft,
  LogOut,
  Key,
  Shield,
  HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { Transaction, TransactionType, CATEGORIES, CATEGORY_COLORS } from './types';
import { cn, formatCurrency, formatDate, parseTransactionMeta, TransactionMetadata } from './lib/utils';
import { supabase } from './supabase';

export default function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Data de início do app (Maio de 2026)
  const APP_START_DATE = useMemo(() => new Date(2026, 4, 1), []);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  const [selectedTransactionDetail, setSelectedTransactionDetail] = useState<Transaction | null>(null);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<TransactionType>('EXPENSE');
  const [category, setCategory] = useState(CATEGORIES.EXPENSE[0]);
  const [transactionDate, setTransactionDate] = useState('');
  const [dateValidationError, setDateValidationError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'DEBIT' | 'CREDIT'>('DEBIT');
  const [installmentsCount, setInstallmentsCount] = useState<number>(1);

  const getInitialTransactionDate = (selDate: Date) => {
    const today = new Date();
    if (today.getMonth() === selDate.getMonth() && today.getFullYear() === selDate.getFullYear()) {
      return format(today, 'yyyy-MM-dd');
    }
    return format(startOfMonth(selDate), 'yyyy-MM-dd');
  };

  // Auth States
  const [user, setUser] = useState<any>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Auth Form States
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot' | 'reset'>('login');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // Guard Confirmation States
  const [isConfirmingAdd, setIsConfirmingAdd] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);

  // Listen to Auth State Changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setUserLoading(false);
    }).catch(err => {
      console.error('Erro de sessão Supabase:', err);
      setUserLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === 'PASSWORD_RECOVERY') {
        setAuthMode('reset');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Sync state to local cache as backup
  useEffect(() => {
    if (transactions.length > 0) {
      localStorage.setItem('fintrack_data', JSON.stringify(transactions));
    }
  }, [transactions]);

  // Load Transactions from Supabase or LocalStorage
  const loadTransactions = async () => {
    if (!user) return;
    try {
      setIsLoading(true);
      setError(null);

      if (isDemoMode) {
        const saved = localStorage.getItem('fintrack_data');
        setTransactions(saved ? JSON.parse(saved) : []);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      if (fetchError) throw fetchError;

      if (data) {
        const restored: Transaction[] = data.map(item => ({
          id: item.id,
          description: item.description,
          amount: Number(item.amount),
          type: item.type as TransactionType,
          category: item.category,
          date: item.date
        }));
        setTransactions(restored);
      }
    } catch (err: any) {
      console.error('Erro ao conectar com o Supabase:', err);
      setError('Aviso: exibindo dados do cache local offline.');
      // Fallback to cache
      const saved = localStorage.getItem('fintrack_data');
      if (saved) setTransactions(JSON.parse(saved));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadTransactions();
    } else {
      setTransactions([]);
    }
  }, [user, isDemoMode]);

  // Password Security Strength Validation Rules checker (Cybersecurity Standard)
  const passwordStrength = useMemo(() => {
    const pass = authPassword;
    return {
      hasMinLen: pass.length >= 8,
      hasUpper: /[A-Z]/.test(pass),
      hasLower: /[a-z]/.test(pass),
      hasNumber: /[0-9]/.test(pass),
      hasSpecial: /[^A-Za-z0-9]/.test(pass)
    };
  }, [authPassword]);

  const isPasswordStrong = useMemo(() => {
    return (
      passwordStrength.hasMinLen &&
      passwordStrength.hasUpper &&
      passwordStrength.hasLower &&
      passwordStrength.hasNumber &&
      passwordStrength.hasSpecial
    );
  }, [passwordStrength]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);
    setAuthSubmitting(true);

    try {
      if (authMode === 'login') {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword
        });
        if (signInError) throw signInError;
        setAuthSuccess('Acesso concedido com sucesso!');
      } else if (authMode === 'register') {
        if (!isPasswordStrong) {
          throw new Error('A sua senha não atende a todos os critérios de resiliência cibernética.');
        }

        const { data, error: signUpError } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
          options: {
            data: {
              name: authName
            }
          }
        });
        if (signUpError) throw signUpError;

        if (data.session) {
          setAuthSuccess('Cadastro efetuado e login concedido com sucesso!');
        } else {
          setAuthSuccess('Cadastro efetuado! Um link de validação cibernética foi enviado ao seu e-mail.');
        }
      } else if (authMode === 'forgot') {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(authEmail, {
          redirectTo: window.location.origin
        });
        if (resetError) throw resetError;
        setAuthSuccess('Instruções de redefinição seguras enviadas para seu e-mail!');
      } else if (authMode === 'reset') {
        if (!isPasswordStrong) {
          throw new Error('A sua nova senha não atende a todos os critérios de resiliência cibernética.');
        }

        const { error: updateError } = await supabase.auth.updateUser({
          password: authPassword
        });
        if (updateError) throw updateError;
        setAuthSuccess('Senha atualizada com sucesso! Redirecionando para login...');
        setTimeout(() => {
          setAuthMode('login');
          setAuthPassword('');
        }, 3000);
      }
    } catch (err: any) {
      console.error(err);
      setAuthError(err.message || 'Ocorreu um erro ao validar credenciais.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const enterDemoMode = () => {
    setIsDemoMode(true);
    setUser({
      id: 'demo-local-user',
      email: 'convidado@fintrack.local',
      user_metadata: { name: 'Convidado Local' }
    });
    // Set typical sample transaction if empty
    const saved = localStorage.getItem('fintrack_data');
    if (!saved || JSON.parse(saved).length === 0) {
      const sample: Transaction[] = [
        {
          id: 'sample-1',
          description: 'Aporte de Boas-vindas',
          amount: 5000,
          type: 'INCOME',
          category: 'Vendas',
          date: new Date().toISOString()
        },
        {
          id: 'sample-2',
          description: 'Serviços em Nuvem',
          amount: 450.90,
          type: 'EXPENSE',
          category: 'Contas',
          date: new Date().toISOString()
        }
      ];
      localStorage.setItem('fintrack_data', JSON.stringify(sample));
      setTransactions(sample);
    } else {
      setTransactions(JSON.parse(saved));
    }
  };

  const handleLogout = async () => {
    if (!isDemoMode) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setIsDemoMode(false);
    setTransactions([]);
  };

  const filteredTransactions = useMemo(() => {
    const start = startOfMonth(selectedDate);
    const end = endOfMonth(selectedDate);

    return transactions.filter(t => {
      const isMatch = t.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = filterType === 'ALL' || t.type === filterType;
      try {
        const inMonth = isWithinInterval(parseISO(t.date), { start, end });
        return isMatch && inMonth && matchesFilter;
      } catch {
        return false;
      }
    });
  }, [transactions, searchTerm, selectedDate, filterType]);

  const stats = useMemo(() => {
    const totalIncome = transactions
      .filter(t => t.type === 'INCOME')
      .reduce((acc, t) => acc + t.amount, 0);
    const totalExpense = transactions
      .filter(t => t.type === 'EXPENSE')
      .reduce((acc, t) => acc + t.amount, 0);

    const start = startOfMonth(selectedDate);
    const end = endOfMonth(selectedDate);
    
    const monthlyIncome = transactions
      .filter(t => t.type === 'INCOME' && isWithinInterval(parseISO(t.date), { start, end }))
      .reduce((acc, t) => acc + t.amount, 0);
    const monthlyExpense = transactions
      .filter(t => t.type === 'EXPENSE' && isWithinInterval(parseISO(t.date), { start, end }))
      .reduce((acc, t) => acc + t.amount, 0);

    return {
      balance: totalIncome - totalExpense,
      monthlyIncome,
      monthlyExpense
    };
  }, [transactions, selectedDate]);

  const currentMonthData = useMemo(() => {
    const start = startOfMonth(selectedDate);
    const end = endOfMonth(selectedDate);

    const monthTransactions = transactions.filter(t => {
      try {
        return isWithinInterval(parseISO(t.date), { start, end });
      } catch {
        return false;
      }
    });

    const categoryTotals: Record<string, number> = {};
    monthTransactions.forEach(t => {
      if (t.type === 'EXPENSE') {
        categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
      }
    });

    const chartData = Object.entries(categoryTotals).map(([name, value]) => ({
      name,
      value
    })).sort((a, b) => b.value - a.value);

    return {
      chartData,
      mostSpent: chartData[0] || null
    };
  }, [transactions, selectedDate]);

  const handlePrevMonth = () => {
    setSelectedDate(prev => subMonths(prev, 1));
  };
  
  const handleNextMonth = () => setSelectedDate(prev => addMonths(prev, 1));

  // Confirming Transaction Step (custom inline double check dialog within modal)
  const handleAddTransactionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!description || isNaN(numAmount) || numAmount <= 0) return;

    // Validate if entered transactionDate is within selectedDate month
    try {
      const enteredDate = parseISO(transactionDate);
      const start = startOfMonth(selectedDate);
      const end = endOfMonth(selectedDate);
      
      if (!isWithinInterval(enteredDate, { start, end })) {
        setDateValidationError(`O dia selecionado precisa ser dentro de ${format(selectedDate, 'MMMM / yyyy', { locale: ptBR })}`);
        return;
      }
    } catch (err) {
      setDateValidationError('Data de operação inválida.');
      return;
    }

    setDateValidationError(null);
    setIsConfirmingAdd(true); // Open recap guard validation
  };

  const handleAddTransactionConfirm = async () => {
    const numAmount = parseFloat(amount);
    const generatedTransactions: Transaction[] = [];
    const baseDate = parseISO(transactionDate);

    if (type === 'EXPENSE' && paymentMethod === 'CREDIT' && installmentsCount > 1) {
      const installmentValue = Number((numAmount / installmentsCount).toFixed(2));
      for (let i = 1; i <= installmentsCount; i++) {
        const tId = Math.random().toString(36).substr(2, 9);
        const installmentDate = addMonths(baseDate, i - 1);
        const dateISO = new Date(format(installmentDate, 'yyyy-MM-dd') + 'T12:00:00').toISOString();
        const suffixedDescription = `${description} [P:${i}/${installmentsCount}:${transactionDate}]`;
        
        generatedTransactions.push({
          id: tId,
          description: suffixedDescription,
          amount: installmentValue,
          type: 'EXPENSE',
          category,
          date: dateISO
        });
      }
    } else {
      const newId = Math.random().toString(36).substr(2, 9);
      let suffixedDescription = description;
      if (type === 'EXPENSE') {
        suffixedDescription = `${description} [M:${paymentMethod}]`;
      }
      
      generatedTransactions.push({
        id: newId,
        description: suffixedDescription,
        amount: numAmount,
        type,
        category,
        date: new Date(transactionDate + 'T12:00:00').toISOString()
      });
    }

    // Optimistically update
    setTransactions(prev => [...generatedTransactions, ...prev]);
    setDescription('');
    setAmount('');
    setPaymentMethod('DEBIT');
    setInstallmentsCount(1);
    setIsConfirmingAdd(false);
    setIsModalOpen(false);

    if (user && !isDemoMode) {
      try {
        const insertPayloads = generatedTransactions.map(t => ({
          id: t.id,
          description: t.description,
          amount: t.amount,
          type: t.type,
          category: t.category,
          date: t.date,
          user_id: user.id
        }));

        const { error: insertError } = await supabase
          .from('transactions')
          .insert(insertPayloads);

        if (insertError) throw insertError;
      } catch (err) {
        console.error('Erro ao adicionar transação:', err);
        setError('Erro ao salvar no banco. Revertendo alteração local...');
        const generatedIds = generatedTransactions.map(t => t.id);
        setTransactions(prev => prev.filter(t => !generatedIds.includes(t.id)));
      }
    }
  };

  const deleteTransaction = async (id: string) => {
    const previousTransactions = [...transactions];
    setTransactions(prev => prev.filter(t => t.id !== id));
    setTransactionToDelete(null);

    if (user && !isDemoMode) {
      try {
        const { error: deleteError } = await supabase
          .from('transactions')
          .delete()
          .eq('id', id);
        if (deleteError) throw deleteError;
      } catch (err) {
        console.error('Erro ao deletar transação no Supabase:', err);
        setError('Erro ao deletar do banco. Restaurando registro...');
        setTransactions(previousTransactions);
      }
    }
  };

  // Render initial loader block
  if (userLoading) {
    return (
      <div className="min-h-screen bg-[#FDFDFD] flex items-center justify-center p-6 font-sans">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Iniciando ambiente seguro...</p>
        </div>
      </div>
    );
  }

  // Render login screen if no user authenticated
  if (!user) {
    return (
      <div className="min-h-screen bg-[#FDFDFD] font-sans text-[#1A1A1A] flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white p-10 rounded-[40px] shadow-2xl border border-black/5"
        >
          <div className="text-center mb-10">
            <div className="w-16 h-16 bg-black text-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl relative overflow-hidden group">
              <Wallet size={32} />
              <div className="absolute inset-0 bg-white/20 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            </div>
            <h1 className="text-4xl font-black tracking-tighter uppercase leading-none mb-1">FinPay</h1>
          </div>

          <AnimatePresence mode="wait">
            {authError && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 p-4 bg-rose-50 border border-rose-100 text-rose-800 rounded-2xl text-xs flex items-start gap-2.5 font-bold"
              >
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <span>{authError}</span>
              </motion.div>
            )}

            {authSuccess && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 p-4 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-2xl text-xs flex items-start gap-2.5 font-bold"
              >
                <Check size={14} className="shrink-0 mt-0.5" />
                <span>{authSuccess}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleAuthSubmit} className="space-y-6">
            {authMode === 'register' && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-2 ml-1">Nome Completo</label>
                <div className="relative">
                  <input 
                    required
                    type="text" 
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    placeholder="Nome completo"
                    className="w-full bg-[#F9F9F9] border border-black/5 rounded-3xl px-6 py-4.5 focus:ring-4 focus:ring-black/5 outline-none transition-all placeholder:text-gray-300 font-extrabold text-sm"
                  />
                </div>
              </motion.div>
            )}

            {authMode !== 'reset' && (
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-2 ml-1 font-sans">Endereço de E-mail</label>
                <div className="relative">
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400"><Mail size={16} /></span>
                  <input 
                    required
                    type="email" 
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="voce@exemplo.com"
                    className="w-full bg-[#F9F9F9] border border-black/5 rounded-3xl pl-14 pr-6 py-4.5 focus:ring-4 focus:ring-black/5 outline-none transition-all placeholder:text-gray-300 font-extrabold text-sm"
                  />
                </div>
              </div>
            )}

            {(authMode === 'login' || authMode === 'register' || authMode === 'reset') && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] ml-1">
                    {authMode === 'reset' ? 'Nova Senha' : 'Senha de Acesso'}
                  </label>
                  {authMode === 'login' && (
                    <button 
                      type="button" 
                      onClick={() => setAuthMode('forgot')}
                      className="text-[10px] font-black uppercase text-amber-600 hover:underline tracking-widest transition-all"
                    >
                      Esqueceu?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400"><Lock size={16} /></span>
                  <input 
                    required
                    type={showPassword ? "text" : "password"} 
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-[#F9F9F9] border border-black/5 rounded-3xl pl-14 pr-14 py-4.5 focus:ring-4 focus:ring-black/5 outline-none transition-all placeholder:text-gray-300 font-extrabold text-sm"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {/* CyberSecurity standard guidelines for Strong Password requirements */}
                {(authMode === 'register' || authMode === 'reset') && authPassword && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 p-4 bg-[#F9F9F9] rounded-2xl border border-black/5 space-y-2.5"
                  >
                    <p className="text-[9px] uppercase font-black text-gray-400 tracking-wider flex items-center gap-1">
                      <Key size={10} className="text-amber-500" /> Diretriz de Segurança Cibernética:
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1.5 text-[10px] font-black">
                      <div className="flex items-center gap-1.5">
                        <span className={cn("w-2 h-2 rounded-full", passwordStrength.hasMinLen ? "bg-emerald-500" : "bg-gray-300")} />
                        <span className={passwordStrength.hasMinLen ? "text-emerald-700" : "text-gray-400"}>Mínimo 8 caracteres</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={cn("w-2 h-2 rounded-full", passwordStrength.hasUpper ? "bg-emerald-500" : "bg-gray-300")} />
                        <span className={passwordStrength.hasUpper ? "text-emerald-700" : "text-gray-400"}>1 Letra maiúscula (A)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={cn("w-2 h-2 rounded-full", passwordStrength.hasLower ? "bg-emerald-500" : "bg-gray-300")} />
                        <span className={passwordStrength.hasLower ? "text-emerald-700" : "text-gray-400"}>1 Letra minúscula (a)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={cn("w-2 h-2 rounded-full", passwordStrength.hasNumber ? "bg-emerald-500" : "bg-gray-300")} />
                        <span className={passwordStrength.hasNumber ? "text-emerald-700" : "text-gray-400"}>1 Número (0-9)</span>
                      </div>
                      <div className="flex items-center gap-1.5 md:col-span-2">
                        <span className={cn("w-2 h-2 rounded-full", passwordStrength.hasSpecial ? "bg-emerald-500" : "bg-gray-300")} />
                        <span className={passwordStrength.hasSpecial ? "text-emerald-700" : "text-gray-400"}>1 Símbolo especial (!@#$%)</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            )}

            <button 
              disabled={authSubmitting || ((authMode === 'register' || authMode === 'reset') && !isPasswordStrong)}
              type="submit"
              className="w-full py-5 rounded-3xl bg-black text-white font-black uppercase tracking-[0.2em] text-[11px] shadow-xl hover:bg-black/90 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {authSubmitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Shield size={12} />
                  {authMode === 'login' && 'Autenticar com Segurança'}
                  {authMode === 'register' && 'Registrar Conta Segura'}
                  {authMode === 'forgot' && 'Enviar Redefinição'}
                  {authMode === 'reset' && 'Atualizar Minha Senha'}
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center text-[10px] font-black space-y-4">
            {authMode === 'login' ? (
              <button 
                onClick={() => { setAuthMode('register'); setAuthError(null); }}
                className="text-gray-400 hover:text-black uppercase tracking-[0.2em] transition-colors cursor-pointer"
              >
                Criar uma Conta FinPay
              </button>
            ) : (
              <button 
                onClick={() => { setAuthMode('login'); setAuthError(null); }}
                className="text-gray-400 hover:text-black uppercase tracking-[0.2em] transition-colors cursor-pointer flex items-center justify-center mx-auto gap-1"
              >
                <ArrowLeft size={10} /> Retornar para login
              </button>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFDFD] font-sans text-[#1A1A1A] pb-40 overflow-x-hidden">
      {/* Header Section - Sticky */}
      <header className="sticky top-0 z-30 bg-[#FDFDFD]/90 backdrop-blur-md border-b border-black/5 py-8 mb-12 shadow-sm transition-all">
        <div className="max-w-6xl mx-auto px-6">
          {/* User Meta Row (Cybersecurity profile state banner) */}
          <div className="flex items-center justify-between border-b border-black/5 pb-4 mb-4 gap-4">
            <div className="flex items-center gap-2">
              <span className={cn(
                "w-2 h-2 rounded-full",
                isDemoMode ? "bg-amber-400" : "bg-emerald-500 animate-pulse"
              )} />
              <p className="text-[9px] uppercase font-black text-gray-400 tracking-wider">
                {isDemoMode ? 'Modo de Demonstração' : 'Conexão Criptografada Ativa'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-[8px] uppercase tracking-widest font-black text-gray-400">Usuário Autenticado</p>
                <p className="text-[10px] font-black text-black truncate max-w-[150px] md:max-w-[200px]">
                  {user?.user_metadata?.name || user?.email}
                </p>
              </div>
              <button 
                onClick={handleLogout}
                className="p-2 ml-1 hover:bg-rose-50 text-rose-500 hover:text-rose-600 rounded-full transition-colors cursor-pointer border border-transparent hover:border-rose-100"
                title="Desconectar do site"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-8">
            <div className="space-y-4 flex-1 min-w-0">
              <div className="flex items-center gap-2 md:gap-4">
                <button 
                  onClick={handlePrevMonth}
                  className="p-2 hover:bg-black/5 rounded-full transition-colors cursor-pointer shrink-0"
                >
                  <ChevronLeft size={24} />
                </button>
                <div className="space-y-2 min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.3em] font-black text-gray-400">Visualizando o período</p>
                  <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight uppercase leading-none break-words flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="text-black">{format(selectedDate, 'MMMM', { locale: ptBR })}</span>
                    <span className="text-gray-300 font-light text-2xl md:text-3xl lg:text-4xl select-none">|</span>
                    <span className="text-black tracking-wide">{format(selectedDate, 'yyyy')}</span>
                  </h1>
                </div>
                <button 
                  onClick={handleNextMonth}
                  className="p-2 hover:bg-black/5 rounded-full transition-colors cursor-pointer shrink-0"
                >
                  <ChevronRight size={24} />
                </button>
              </div>
            </div>
            <div className="md:text-right shrink-0">
              <p className="text-[10px] uppercase tracking-[0.3em] font-black text-gray-400 mb-2">Saldo Geral</p>
              <p className={cn(
                "text-5xl md:text-6xl lg:text-7xl font-black tracking-tighter leading-none transition-colors",
                stats.balance >= 0 ? "text-emerald-600" : "text-rose-600"
              )}>
                {formatCurrency(stats.balance)}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Sync Status Banner */}
      <div className="max-w-6xl mx-auto px-6 mb-8">
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div 
              key="loading"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-2 bg-gray-50 border border-black/5 text-[#1a1a1a] px-5 py-3 rounded-2xl text-[10px] uppercase font-black tracking-widest inline-flex"
            >
              <span className="w-1.5 h-1.5 bg-[#1a1a1a] rounded-full animate-ping shrink-0" />
              Sincronizando com o Supabase...
            </motion.div>
          ) : error ? (
            <motion.div 
              key="error"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center justify-between gap-3 bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E] px-5 py-3 rounded-2xl text-[10px] uppercase font-black tracking-widest cursor-pointer hover:bg-amber-100 transition-colors"
              onClick={loadTransactions}
            >
              <div className="flex items-center gap-2">
                <AlertCircle size={14} className="text-[#B45309] shrink-0" />
                <span>{error}</span>
              </div>
              <button 
                type="button"
                onClick={loadTransactions}
                className="hover:underline transition-all cursor-pointer font-black text-[#B45309] uppercase shrink-0"
              >
                Tentar Sincronizar
              </button>
            </motion.div>
          ) : (
            <motion.div 
              key="synced"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 text-[9px] uppercase font-bold text-gray-400 tracking-widest pl-1"
            >
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full shrink-0" />
              Sincronizado com Supabase
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <main className="max-w-6xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left Column: Transactions */}
        <section className="lg:col-span-7 space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h2 className="text-2xl font-black uppercase tracking-tight flex items-center gap-3">
              Fluxo Mensal
            </h2>
            <span className="text-[10px] font-black text-white bg-black px-3.5 py-1.5 rounded-full uppercase tracking-widest leading-none self-start sm:self-auto shadow-sm">
              {filteredTransactions.length} registros
            </span>
          </div>

          {/* Quick Filters Pill Row */}
          <div className="flex flex-wrap gap-2 p-1.5 bg-gray-50 border border-black/5 rounded-2xl">
            <button
              onClick={() => setFilterType('ALL')}
              className={cn(
                "flex-1 sm:flex-none px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer text-center",
                filterType === 'ALL'
                  ? "bg-black text-white shadow-md animate-duration-100"
                  : "text-gray-400 hover:text-black hover:bg-gray-100"
              )}
            >
              Todos
            </button>
            <button
              onClick={() => setFilterType('INCOME')}
              className={cn(
                "flex-1 sm:flex-none px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer text-center",
                filterType === 'INCOME'
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/10"
                  : "text-gray-400 hover:text-emerald-600 hover:bg-emerald-50"
              )}
            >
              Entradas
            </button>
            <button
              onClick={() => setFilterType('EXPENSE')}
              className={cn(
                "flex-1 sm:flex-none px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer text-center",
                filterType === 'EXPENSE'
                  ? "bg-rose-600 text-white shadow-md shadow-rose-500/10"
                  : "text-gray-400 hover:text-rose-600 hover:bg-rose-50"
              )}
            >
              Saídas
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative group">
            <div className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-black transition-colors">
              <Search size={20} />
            </div>
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="PESQUISAR PELA DESCRIÇÃO..."
              className="w-full bg-white border border-black/5 rounded-2xl pl-16 pr-6 py-5 focus:ring-4 focus:ring-black/5 outline-none transition-all placeholder:text-gray-300 font-black text-xs tracking-widest"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div className="space-y-4">
            {filteredTransactions.length > 0 ? (
              <AnimatePresence mode="popLayout">
                {filteredTransactions.map((t) => {
                  const meta = parseTransactionMeta(t.description);
                  let isPriorInstallment = false;
                  let formattedOriginalMonth = '';
                  if (meta.isInstallment && meta.originalDate) {
                    try {
                      const origDate = parseISO(meta.originalDate);
                      const transDate = parseISO(t.date);
                      if (origDate.getMonth() !== transDate.getMonth() || origDate.getFullYear() !== transDate.getFullYear()) {
                        isPriorInstallment = true;
                      }
                      formattedOriginalMonth = format(origDate, 'MMMM / yyyy', { locale: ptBR });
                    } catch (e) {}
                  }

                  return (
                    <motion.div
                      key={t.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      onClick={() => setSelectedTransactionDetail(t)}
                      className="bg-white p-6 rounded-2xl shadow-[0_4px_20px_-12px_rgba(0,0,0,0.1)] border border-black/5 flex items-center justify-between group hover:border-black/20 transition-all hover:translate-x-1 cursor-pointer select-none active:bg-gray-50"
                    >
                      <div className="flex items-center gap-5 min-w-0">
                        <div className={cn(
                          "w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg shrink-0",
                          t.type === 'INCOME' ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                        )}>
                          {t.type === 'INCOME' ? '+' : '-'}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-black text-xl tracking-tight truncate group-hover:text-black/80 transition-colors">
                              {meta.cleanDescription}
                            </h4>
                            {meta.isInstallment && (
                              <span className={cn(
                                "text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0",
                                isPriorInstallment 
                                  ? "bg-amber-50 text-amber-700 border-amber-200" 
                                  : "bg-purple-50 text-purple-700 border-purple-200"
                              )}>
                                {isPriorInstallment ? `Parcela ${meta.currentInstallment}/${meta.totalInstallments} (Anterior)` : `Parcela ${meta.currentInstallment}/${meta.totalInstallments}`}
                              </span>
                            )}
                            {!meta.isInstallment && t.type === 'EXPENSE' && meta.paymentMethod === 'CREDIT' && (
                              <span className="bg-gray-100 text-gray-700 text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-gray-200 shrink-0">
                                Crédito
                              </span>
                            )}
                            {!meta.isInstallment && t.type === 'EXPENSE' && meta.paymentMethod === 'DEBIT' && (
                              <span className="bg-gray-100 text-gray-600 text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-gray-200 shrink-0">
                                Débito
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex flex-wrap items-center gap-1.5 mt-1 border-none bg-transparent">
                            <span>{t.category}</span>
                            <span className="text-gray-300">•</span>
                            <span>{formatDate(t.date)}</span>
                            {isPriorInstallment && (
                              <>
                                <span className="text-gray-300">•</span>
                                <span className="text-amber-600 font-extrabold normal-case">Compra parcelada em {formattedOriginalMonth}</span>
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0 overflow-visible">
                      <span className={cn(
                        "text-xl font-black tracking-tight",
                        t.type === 'INCOME' ? "text-emerald-600" : "text-rose-600"
                      )}>
                        {t.type === 'INCOME' ? '+' : '-'} {formatCurrency(t.amount)}
                      </span>
                      {/* Trash Bin Icon always visible for clear accessibility */}
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setTransactionToDelete(t);
                        }}
                        className="text-rose-400 hover:text-rose-600 active:scale-90 p-2.5 transition-all rounded-full hover:bg-rose-50 cursor-pointer duration-200"
                        title="Deletar este registro"
                      >
                        <Trash2 size={18} />
                      </button>

                      {/* Interactive Chevron indicating clickability */}
                      <div className="text-gray-300 group-hover:text-black group-hover:translate-x-1.5 transition-all duration-200 shrink-0 hidden sm:block">
                        <ChevronRight size={20} />
                      </div>
                    </div>
                  </motion.div>
                )})}
              </AnimatePresence>
            ) : (
              <div className="py-20 border-2 border-dashed border-gray-200 rounded-3xl flex flex-col items-center justify-center text-gray-300">
                <Calendar size={48} className="mb-4 opacity-20" />
                <p className="font-black uppercase tracking-widest text-sm text-center px-6">Nenhuma transação encontrada</p>
              </div>
            )}
          </div>
        </section>

        {/* Right Column: Analytics & Summary */}
        <section className="lg:col-span-5 space-y-8">
          {/* Summary Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100/50">
              <p className="text-[10px] font-black uppercase text-emerald-700 tracking-[0.2em] mb-2">Entradas em {format(selectedDate, 'MMMM', { locale: ptBR })}</p>
              <p className="text-3xl font-black text-emerald-900 tracking-tighter">{formatCurrency(stats.monthlyIncome)}</p>
            </div>
            <div className="bg-rose-50 p-6 rounded-3xl border border-rose-100/50">
              <p className="text-[10px] font-black uppercase text-rose-700 tracking-[0.2em] mb-2">Saídas em {format(selectedDate, 'MMMM', { locale: ptBR })}</p>
              <p className="text-3xl font-black text-rose-900 tracking-tighter">{formatCurrency(stats.monthlyExpense)}</p>
            </div>
          </div>

          {/* Dark Analytics Card */}
          <div className="bg-black text-white p-10 rounded-[40px] shadow-2xl space-y-10 flex flex-col min-h-[480px]">
            <h3 className="text-xl font-black uppercase tracking-[0.2em] border-b border-white/20 pb-6">Distribuição</h3>
            
            <div className="flex-grow flex items-center justify-center">
              {currentMonthData.chartData.length > 0 ? (
                <div className="h-[240px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={currentMonthData.chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <XAxis 
                        dataKey="name" 
                        stroke="#ffffff" 
                        fontSize={8}
                        tickFormatter={(val) => val.substring(0, 3).toUpperCase()}
                        tickLine={false}
                        axisLine={false}
                        dy={10}
                      />
                      <Tooltip 
                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                        contentStyle={{ backgroundColor: '#1a1a1a', border: 'none', borderRadius: '12px', fontSize: '10px' }}
                        itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                      />
                      <Bar 
                        dataKey="value" 
                        radius={[6, 6, 0, 0]}
                        barSize={32}
                      >
                        {currentMonthData.chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[entry.name] || '#fff'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-center space-y-3 opacity-20">
                  <PieChartIcon size={48} className="mx-auto" />
                  <p className="text-xs uppercase tracking-widest font-black">Sem dados analíticos</p>
                </div>
              )}
            </div>

            {/* Insight Alert */}
            <div className="pt-8 border-t border-white/10">
              <div className="flex items-start gap-5">
                <div className="bg-amber-400 text-black px-3 py-1 text-[10px] font-black uppercase rounded shrink-0">Alerta</div>
                <div className="text-sm leading-snug text-white/70">
                  {currentMonthData.mostSpent ? (
                    <p>
                      Seu maior gasto este mês foi em <span className="text-white font-black">{currentMonthData.mostSpent.name} ({formatCurrency(currentMonthData.mostSpent.value)})</span>. 
                      Isso é um ponto de atenção no seu orçamento atual.
                    </p>
                  ) : (
                    <p>Continue lançando suas despesas para gerar insights automáticos de categorias.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Navigation & Action Bar */}
      <nav className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-xl border border-black/10 px-10 py-5 rounded-full flex items-center gap-10 shadow-[0_20px_50px_rgba(0,0,0,0.15)] z-40">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-black border-b-2 border-black pb-0.5">
          Dashboard
        </span>
        <div 
          onClick={() => {
            setTransactionDate(getInitialTransactionDate(selectedDate));
            setDateValidationError(null);
            setPaymentMethod('DEBIT');
            setInstallmentsCount(1);
            setIsModalOpen(true);
            setIsConfirmingAdd(false);
          }}
          className="w-12 h-12 bg-black text-white rounded-full flex items-center justify-center shadow-xl hover:scale-110 active:scale-90 transition-all cursor-pointer group"
          title="Nova transação"
        >
          <Plus size={24} className="group-hover:rotate-90 transition-transform duration-300" />
        </div>
      </nav>

      {/* Add Transaction Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 p-4"
            />
            <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 40 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 40 }}
                className="w-full max-w-lg bg-white rounded-[32px] md:rounded-[40px] shadow-2xl pointer-events-auto border border-black/5 max-h-[90vh] overflow-y-auto"
              >
                <AnimatePresence mode="wait">
                  {!isConfirmingAdd ? (
                    <motion.div 
                      key="form-step"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="p-6 md:p-10"
                    >
                      <div className="flex items-center justify-between mb-6 md:mb-10">
                        <h2 className="text-2xl md:text-3xl font-black text-black tracking-tighter uppercase leading-none">Novo Registro</h2>
                        <button onClick={() => setIsModalOpen(false)} className="p-3 hover:bg-black/5 rounded-full transition-colors cursor-pointer text-black">
                          <X size={28} />
                        </button>
                      </div>

                      <form onSubmit={handleAddTransactionSubmit} className="space-y-8">
                        {/* Type Selector */}
                        <div className="flex bg-gray-100 p-2 rounded-3xl">
                          <button
                            type="button"
                            onClick={() => {
                              setType('EXPENSE');
                              setCategory(CATEGORIES.EXPENSE[0]);
                            }}
                            className={cn(
                              "flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all cursor-pointer",
                              type === 'EXPENSE' ? "bg-black text-white shadow-lg" : "text-gray-400"
                            )}
                          >
                            Saída
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setType('INCOME');
                              setCategory(CATEGORIES.INCOME[0]);
                            }}
                            className={cn(
                              "flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all cursor-pointer",
                              type === 'INCOME' ? "bg-black text-white shadow-lg" : "text-gray-400"
                            )}
                          >
                            Entrada
                          </button>
                        </div>

                        <div className="space-y-6">
                          <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-3 ml-1">Descrição</label>
                            <input 
                              required
                              type="text" 
                              value={description}
                              onChange={(e) => setDescription(e.target.value)}
                              placeholder="Ex: Aluguel, Salário, Jantar..."
                              className="w-full bg-[#F9F9F9] border-none rounded-3xl px-8 py-5 focus:ring-4 focus:ring-black/5 outline-none transition-all placeholder:text-gray-300 font-extrabold text-lg"
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-3 ml-1 font-sans">Dia da Operação</label>
                              <div className="relative">
                                <span className="absolute left-8 top-1/2 -translate-y-1/2 text-gray-400"><Calendar size={18} /></span>
                                <input 
                                  required
                                  type="date" 
                                  value={transactionDate}
                                  onChange={(e) => {
                                    setTransactionDate(e.target.value);
                                    setDateValidationError(null);
                                  }}
                                  className={cn(
                                    "w-full bg-[#F9F9F9] border rounded-3xl pl-16 pr-8 py-5 focus:ring-4 focus:ring-black/5 outline-none transition-all font-black text-sm text-gray-700 cursor-pointer",
                                    dateValidationError ? "border-rose-500 focus:ring-rose-500/20 bg-rose-50/10" : "border-transparent"
                                  )}
                                />
                              </div>
                              {dateValidationError && (
                                <p className="text-[10px] font-black uppercase tracking-wider text-rose-500 mt-2.5 ml-1 flex items-center gap-1 leading-normal">
                                  <AlertCircle size={10} className="shrink-0" />
                                  {dateValidationError}
                                </p>
                              )}
                            </div>

                            <div>
                              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-3 ml-1 font-sans">Categoria</label>
                              <div className="relative">
                                <select 
                                  value={category}
                                  onChange={(e) => setCategory(e.target.value)}
                                  className="w-full bg-[#F9F9F9] border-none rounded-3xl px-8 py-5 focus:ring-4 focus:ring-black/5 outline-none transition-all font-black text-gray-700 appearance-none cursor-pointer"
                                >
                                  {(type === 'INCOME' ? CATEGORIES.INCOME : CATEGORIES.EXPENSE).map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                  ))}
                                </select>
                                <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none opacity-20">
                                  <TrendingDown size={16} className={type === 'INCOME' ? 'rotate-180 text-emerald-600' : 'text-rose-600'} />
                                </div>
                              </div>
                            </div>

                            <div className="md:col-span-2">
                              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-3 ml-1 font-sans">Valor</label>
                              <div className="relative">
                                <span className="absolute left-8 top-1/2 -translate-y-1/2 text-gray-400 font-black text-lg font-sans">R$</span>
                                <input 
                                  required
                                  type="number" 
                                  step="0.01"
                                  value={amount}
                                  onChange={(e) => setAmount(e.target.value)}
                                  placeholder="0,00"
                                  className="w-full bg-[#F9F9F9] border-none rounded-3xl pl-16 pr-8 py-5 focus:ring-4 focus:ring-black/5 outline-none transition-all font-black text-2xl tracking-tighter"
                                />
                              </div>
                            </div>

                            {type === 'EXPENSE' && (
                              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 border border-black/5 p-6 rounded-3xl">
                                <div>
                                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-3 ml-1 font-sans">Meio de Pagamento</label>
                                  <div className="flex bg-white p-1 rounded-2xl border border-black/5">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setPaymentMethod('DEBIT');
                                        setInstallmentsCount(1);
                                      }}
                                      className={cn(
                                        "flex-1 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer",
                                        paymentMethod === 'DEBIT' ? "bg-black text-white shadow-md" : "text-gray-400 hover:text-black"
                                      )}
                                    >
                                      Débito
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setPaymentMethod('CREDIT')}
                                      className={cn(
                                        "flex-1 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer",
                                        paymentMethod === 'CREDIT' ? "bg-black text-white shadow-md" : "text-gray-400 hover:text-black"
                                      )}
                                    >
                                      Crédito
                                    </button>
                                  </div>
                                </div>

                                {paymentMethod === 'CREDIT' && (
                                  <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-3 ml-1 font-sans">Parcelamento</label>
                                    <div className="relative">
                                      <select
                                        value={installmentsCount}
                                        onChange={(e) => setInstallmentsCount(parseInt(e.target.value, 10))}
                                        className="w-full bg-white border border-black/5 rounded-2xl px-6 py-3.5 focus:ring-4 focus:ring-black/5 outline-none font-black text-gray-700 appearance-none cursor-pointer text-sm"
                                      >
                                        <option value="1">À vista (1x)</option>
                                        <option value="2">2x (Sem juros)</option>
                                        <option value="3">3x (Sem juros)</option>
                                        <option value="4">4x (Sem juros)</option>
                                        <option value="5">5x (Sem juros)</option>
                                        <option value="6">6x (Sem juros)</option>
                                        <option value="7">7x (Sem juros)</option>
                                        <option value="8">8x (Sem juros)</option>
                                        <option value="9">9x (Sem juros)</option>
                                        <option value="10">10x (Sem juros)</option>
                                        <option value="11">11x (Sem juros)</option>
                                        <option value="12">12x (Sem juros)</option>
                                      </select>
                                      <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none opacity-30 text-xs font-black">
                                        ▼
                                      </div>
                                    </div>
                                  </div>
                                )}
                                
                                {paymentMethod === 'CREDIT' && installmentsCount > 1 && amount && !isNaN(parseFloat(amount)) && (
                                  <div className="md:col-span-2 bg-amber-50/50 border border-amber-200/50 p-4.5 rounded-2xl">
                                    <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest leading-relaxed flex items-center gap-2">
                                      <AlertCircle size={12} className="shrink-0 text-amber-600" strokeWidth={3} />
                                      <span>
                                        Sua compra será dividida em <strong>{installmentsCount} parcelas de {formatCurrency(parseFloat(amount) / installmentsCount)}</strong> mensais.
                                      </span>
                                    </p>
                                    <p className="text-[9px] text-gray-400 font-extrabold uppercase mt-1.5 ml-5">
                                      As parcelas serão lançadas automaticamente do mês selecionado até os meses subsequentes.
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <button 
                          type="submit"
                          className={cn(
                            "w-full py-6 rounded-3xl text-white font-black uppercase tracking-[0.2em] text-sm shadow-2xl transition-all active:scale-[0.98] cursor-pointer mt-4 hover:opacity-90",
                            type === 'INCOME' ? "bg-emerald-600 shadow-emerald-100/50" : "bg-rose-600 shadow-rose-100/50"
                          )}
                        >
                          Confirmar Operação
                        </button>
                      </form>
                    </motion.div>
                  ) : (
                    /* Confirm action guard/warning requested by user */
                    <motion.div 
                      key="confirm-step"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="p-6 md:p-10 text-center space-y-6 md:space-y-8"
                    >
                      <div className="w-16 h-16 bg-amber-50 border border-amber-200 text-amber-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                        <AlertCircle size={32} />
                      </div>
                      
                      <div className="space-y-2">
                        <h3 className="text-2xl font-black uppercase tracking-tight text-black">Verifique os Dados</h3>
                        <p className="text-xs text-gray-400 font-extrabold uppercase tracking-widest leading-relaxed">
                          Deseja realmente confirmar esta operação ou prefere revisar antes?
                        </p>
                      </div>

                      {/* Transaction details card preview */}
                      <div className="bg-gray-50 border border-black/5 p-6 rounded-3xl text-left space-y-4">
                        <div className="flex justify-between items-center border-b border-black/5 pb-3">
                          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Tipo de Registro</span>
                          <span className={cn(
                            "text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full",
                            type === 'INCOME' ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                          )}>
                            {type === 'INCOME' ? 'Entrada (Receita)' : 'Saída (Despesa)'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center border-b border-black/5 pb-3">
                          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Descrição</span>
                          <span className="text-sm font-black text-black">{description}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-black/5 pb-3">
                          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Data</span>
                          <span className="text-sm font-black text-black">
                            {(() => {
                              try {
                                return format(parseISO(transactionDate), 'dd/MM/yyyy');
                              } catch {
                                return transactionDate;
                              }
                            })()}
                          </span>
                        </div>
                        <div className="flex justify-between items-center border-b border-black/5 pb-3">
                          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Categoria</span>
                          <span className="text-sm font-black text-black">{category}</span>
                        </div>
                        {type === 'EXPENSE' && (
                          <div className="flex justify-between items-center border-b border-black/5 pb-3">
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Meio de Pagamento</span>
                            <span className="text-xs font-black uppercase tracking-widest bg-gray-100 text-gray-800 px-2.5 py-1 rounded-md">
                              {paymentMethod === 'DEBIT' ? 'Débito' : installmentsCount > 1 ? `Crédito (${installmentsCount}x)` : 'Crédito à Vista'}
                            </span>
                          </div>
                        )}
                        {type === 'EXPENSE' && paymentMethod === 'CREDIT' && installmentsCount > 1 && (
                          <div className="flex justify-between items-center border-b border-black/5 pb-3 bg-amber-50/30 -mx-6 px-6 py-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-amber-700">Valor da Parcela (Mensal)</span>
                            <span className="text-sm font-black text-amber-700">
                              {formatCurrency(parseFloat(amount) / installmentsCount)}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between items-baseline pt-1">
                          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Valor Total</span>
                          <span className={cn(
                            "text-3xl font-black tracking-tighter",
                            type === 'INCOME' ? "text-emerald-600" : "text-rose-600"
                          )}>
                            {formatCurrency(parseFloat(amount))}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-3">
                        <button 
                          onClick={handleAddTransactionConfirm}
                          className={cn(
                            "w-full py-5 rounded-3xl text-white font-black uppercase tracking-[0.2em] text-[11px] shadow-xl transition-all active:scale-[0.98] cursor-pointer hover:brightness-115",
                            type === 'INCOME' ? "bg-emerald-600" : "bg-rose-600"
                          )}
                        >
                          Sim, Confirmar e Salvar
                        </button>
                        <button 
                          onClick={() => setIsConfirmingAdd(false)}
                          className="w-full py-5 rounded-3xl border border-black/10 text-gray-500 hover:text-black hover:border-black font-black uppercase tracking-[0.2em] text-[11px] transition-all cursor-pointer"
                        >
                          Não, Verificar Antes
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Transaction Details Modal */}
      <AnimatePresence>
        {selectedTransactionDetail && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTransactionDetail(null)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 p-4"
            />
            <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 30 }}
                className="w-full max-w-md bg-white rounded-[32px] md:rounded-[40px] shadow-2xl pointer-events-auto border border-black/5 max-h-[90vh] overflow-y-auto"
              >
                {/* Header */}
                <div className="p-8 pb-4 flex items-center justify-between border-b border-black/5">
                  <h3 className="text-xl font-black uppercase tracking-tight text-black">
                    Detalhes do Registro
                  </h3>
                  <button 
                    onClick={() => setSelectedTransactionDetail(null)}
                    className="p-3 hover:bg-black/5 rounded-full transition-colors text-black cursor-pointer"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Body Content */}
                <div className="p-8 space-y-6">
                  {(() => {
                    const detailMeta = parseTransactionMeta(selectedTransactionDetail.description);
                    let isPriorInstallment = false;
                    let origFormatted = '';
                    if (detailMeta.isInstallment && detailMeta.originalDate) {
                      try {
                        const origDate = parseISO(detailMeta.originalDate);
                        const transDate = parseISO(selectedTransactionDetail.date);
                        if (origDate.getMonth() !== transDate.getMonth() || origDate.getFullYear() !== transDate.getFullYear()) {
                          isPriorInstallment = true;
                        }
                        origFormatted = format(origDate, 'MMMM / yyyy', { locale: ptBR });
                      } catch (e) {}
                    }

                    return (
                      <>
                        {/* Category Circle and Big Value */}
                        <div className="flex flex-col items-center justify-center text-center space-y-3 py-2">
                          <div className={cn(
                            "w-16 h-16 rounded-full flex items-center justify-center font-black text-2xl shadow-inner",
                            selectedTransactionDetail.type === 'INCOME' ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                          )}>
                            {selectedTransactionDetail.type === 'INCOME' ? '+' : '-'}
                          </div>
                          <div className="space-y-1">
                            <p className={cn(
                              "text-3xl md:text-3xl font-black tracking-tight",
                              selectedTransactionDetail.type === 'INCOME' ? "text-emerald-600" : "text-rose-600"
                            )}>
                              {selectedTransactionDetail.type === 'INCOME' ? '+' : '-'} {formatCurrency(selectedTransactionDetail.amount)}
                            </p>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 px-3 py-1 rounded-full inline-block border border-black/5">
                              {selectedTransactionDetail.category}
                            </p>
                          </div>
                        </div>

                        {/* Banner for prior installment purchase */}
                        {isPriorInstallment && (
                          <div className="bg-amber-50 border border-amber-200/50 p-5 rounded-3xl text-center space-y-1 my-2">
                            <p className="text-[10px] font-black uppercase text-amber-800 tracking-widest leading-relaxed flex items-center justify-center gap-1.5">
                              <AlertCircle size={13} strokeWidth={3} className="shrink-0" />
                              Compra Parcelada Anterior
                            </p>
                            <p className="text-xs text-amber-700 leading-normal font-medium">
                              Esta transação representa a parcela <strong>{detailMeta.currentInstallment}/{detailMeta.totalInstallments}</strong> de uma compra realizada em <strong>{origFormatted}</strong> (não foi feita neste mês).
                            </p>
                          </div>
                        )}

                        {/* Info table */}
                        <div className="bg-gray-50 border border-black/5 rounded-3xl p-6 space-y-4">
                          <div className="flex justify-between items-baseline border-b border-black/5 pb-3">
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Descrição</span>
                            <span className="text-sm font-black text-black text-right max-w-[200px] break-words">{detailMeta.cleanDescription}</span>
                          </div>
                          <div className="flex justify-between items-center border-b border-black/5 pb-3">
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Data de Lançamento</span>
                            <span className="text-sm font-black text-black">{formatDate(selectedTransactionDetail.date)}</span>
                          </div>
                          <div className="flex justify-between items-center border-b border-black/5 pb-3">
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Tipo de Lançamento</span>
                            <span className={cn(
                              "text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full",
                              selectedTransactionDetail.type === 'INCOME' ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                            )}>
                              {selectedTransactionDetail.type === 'INCOME' ? 'Entrada (Crédito)' : 'Saída (Débito)'}
                            </span>
                          </div>
                          {selectedTransactionDetail.type === 'EXPENSE' && (
                            <div className="flex justify-between items-center border-b border-black/5 pb-3">
                              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Meio de Pagamento</span>
                              <span className="text-sm font-black text-black">
                                {detailMeta.isInstallment 
                                  ? `Crédito (${detailMeta.currentInstallment}x de ${detailMeta.totalInstallments})` 
                                  : detailMeta.paymentMethod === 'CREDIT' 
                                    ? 'Crédito à Vista' 
                                    : 'Débito'
                                }
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">ID Identificador</span>
                            <span className="text-[9px] font-mono text-gray-400 uppercase font-bold">{selectedTransactionDetail.id}</span>
                          </div>
                        </div>
                      </>
                    );
                  })()}

                  {/* Actions inside modal */}
                  <div className="grid grid-cols-1 gap-3 pt-2">
                    <button 
                      onClick={() => {
                        const target = selectedTransactionDetail;
                        setSelectedTransactionDetail(null);
                        setTransactionToDelete(target);
                      }}
                      className="w-full py-4 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-2xl flex items-center justify-center gap-2 text-[10px] uppercase font-black tracking-widest border border-rose-100/50 transition-all cursor-pointer"
                    >
                      <Trash2 size={12} />
                      Excluir esta Transação
                    </button>
                    <button 
                      onClick={() => setSelectedTransactionDetail(null)}
                      className="w-full py-4.5 bg-black hover:bg-black/90 text-white rounded-2xl text-[10px] uppercase font-black tracking-widest shadow-xl transition-all active:scale-[0.98] cursor-pointer"
                    >
                      Fechar Detalhes
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Double Guard Delete Confirmation Overlay Modal */}
      <AnimatePresence>
        {transactionToDelete && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setTransactionToDelete(null)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 p-4"
            />
            <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 30 }}
                className="w-full max-w-md bg-white rounded-[40px] shadow-2xl pointer-events-auto p-10 border border-black/5 text-center space-y-8"
              >
                <div className="w-16 h-16 bg-rose-50 border border-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
                  <Trash2 size={28} />
                </div>

                <div className="space-y-2">
                  <h3 className="text-2xl font-black uppercase tracking-tight text-black">Excluir Registro?</h3>
                  <p className="text-xs text-gray-400 font-extrabold uppercase tracking-widest leading-relaxed">
                    Você tem certeza de que deseja apagar permanentemente esta transação por digitação incorreta?
                  </p>
                </div>

                {/* Micro preview */}
                <div className="p-5 bg-rose-50/50 rounded-2xl border border-rose-100/50 text-left flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase text-rose-800 tracking-wider font-sans">{transactionToDelete.description}</p>
                    <p className="text-[9px] font-mono text-gray-400">{transactionToDelete.category}</p>
                  </div>
                  <span className="text-lg font-black text-rose-700 tracking-tight">
                    {formatCurrency(transactionToDelete.amount)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => deleteTransaction(transactionToDelete.id)}
                    className="py-4.5 rounded-3xl bg-rose-600 text-white font-black uppercase tracking-[0.15em] text-[10px] shadow-xl hover:bg-rose-700 active:scale-[0.98] transition-all cursor-pointer"
                  >
                    Sim, Excluir
                  </button>
                  <button 
                    onClick={() => setTransactionToDelete(null)}
                    className="py-4.5 rounded-3xl border border-black/10 text-gray-400 hover:text-black font-black uppercase tracking-[0.15em] text-[10px] transition-all cursor-pointer hover:border-black"
                  >
                    Cancelar
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
