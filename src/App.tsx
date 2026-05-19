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
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { Transaction, TransactionType, CATEGORIES, CATEGORY_COLORS } from './types';
import { cn, formatCurrency, formatDate } from './lib/utils';

export default function App() {
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      const saved = localStorage.getItem('fintrack_data');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Data de início do app (Maio de 2026)
  const APP_START_DATE = useMemo(() => new Date(2026, 4, 1), []);

  const [searchTerm, setSearchTerm] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<TransactionType>('EXPENSE');
  const [category, setCategory] = useState(CATEGORIES.EXPENSE[0]);

  useEffect(() => {
    localStorage.setItem('fintrack_data', JSON.stringify(transactions));
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    const start = startOfMonth(selectedDate);
    const end = endOfMonth(selectedDate);

    return transactions.filter(t => {
      const isMatch = t.description.toLowerCase().includes(searchTerm.toLowerCase());
      try {
        const inMonth = isWithinInterval(parseISO(t.date), { start, end });
        return isMatch && inMonth;
      } catch {
        return false;
      }
    });
  }, [transactions, searchTerm, selectedDate]);

  const stats = useMemo(() => {
    // Overall Balance
    const totalIncome = transactions
      .filter(t => t.type === 'INCOME')
      .reduce((acc, t) => acc + t.amount, 0);
    const totalExpense = transactions
      .filter(t => t.type === 'EXPENSE')
      .reduce((acc, t) => acc + t.amount, 0);

    // Monthly Stats
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
    setSelectedDate(prev => {
      const next = subMonths(prev, 1);
      if (next < startOfMonth(APP_START_DATE)) return prev;
      return next;
    });
  };
  
  const handleNextMonth = () => setSelectedDate(prev => addMonths(prev, 1));

  const handleAddTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!description || isNaN(numAmount) || numAmount <= 0) return;

    const newTransaction: Transaction = {
      id: Math.random().toString(36).substr(2, 9),
      description,
      amount: numAmount,
      type,
      category,
      date: new Date().toISOString()
    };

    setTransactions([newTransaction, ...transactions]);
    setDescription('');
    setAmount('');
    setIsModalOpen(false);
  };

  const deleteTransaction = (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
  };

  return (
    <div className="min-h-screen bg-[#FDFDFD] font-sans text-[#1A1A1A] pb-40 overflow-x-hidden">
      {/* Header Section - Sticky */}
      <header className="sticky top-0 z-30 bg-[#FDFDFD]/90 backdrop-blur-md border-b border-black/5 py-8 mb-12 shadow-sm transition-all">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row md:justify-between md:items-end gap-8">
          <div className="space-y-4 flex-1 min-w-0">
            <div className="flex items-center gap-2 md:gap-4">
              <button 
                onClick={handlePrevMonth}
                disabled={startOfMonth(selectedDate) <= startOfMonth(APP_START_DATE)}
                className="p-2 hover:bg-black/5 rounded-full transition-colors cursor-pointer shrink-0 disabled:opacity-20 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={24} />
              </button>
              <div className="space-y-1 min-w-0">
                <p className="text-[10px] uppercase tracking-[0.3em] font-black text-gray-400">Visualizando o período</p>
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tighter uppercase leading-none break-words">
                  {format(selectedDate, 'MMMM.yyyy', { locale: ptBR })}
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
      </header>

      <main className="max-w-6xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left Column: Transactions */}
        <section className="lg:col-span-7 space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black uppercase tracking-tight flex items-center gap-3">
              Fluxo Mensal
            </h2>
            <span className="text-[10px] font-black text-white bg-black px-3 py-1 rounded-full uppercase tracking-widest leading-none">
              {filteredTransactions.length} registros
            </span>
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
                {filteredTransactions.map((t) => (
                  <motion.div
                    key={t.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="bg-white p-6 rounded-2xl shadow-[0_4px_20px_-12px_rgba(0,0,0,0.1)] border border-black/5 flex items-center justify-between group hover:border-black/20 transition-all hover:translate-x-1"
                  >
                    <div className="flex items-center gap-5 min-w-0">
                      <div className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg shrink-0",
                        t.type === 'INCOME' ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                      )}>
                        {t.type === 'INCOME' ? '+' : '-'}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-black text-xl tracking-tight truncate">{t.description}</h4>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                          {t.category} • {formatDate(t.date)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0 ml-4">
                      <span className={cn(
                        "text-xl font-black tracking-tight",
                        t.type === 'INCOME' ? "text-emerald-600" : "text-rose-600"
                      )}>
                        {t.type === 'INCOME' ? '+' : '-'} {formatCurrency(t.amount)}
                      </span>
                      <button 
                        onClick={() => deleteTransaction(t.id)}
                        className="text-gray-200 hover:text-black p-2 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            ) : (
              <div className="py-20 border-2 border-dashed border-gray-200 rounded-3xl flex flex-col items-center justify-center text-gray-300">
                <Calendar size={48} className="mb-4 opacity-20" />
                <p className="font-black uppercase tracking-widest text-sm">Nenhuma transação encontrada</p>
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
          onClick={() => setIsModalOpen(true)}
          className="w-12 h-12 bg-black text-white rounded-full flex items-center justify-center shadow-xl hover:scale-110 active:scale-90 transition-all cursor-pointer group"
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
                className="w-full max-w-lg bg-white rounded-[40px] shadow-2xl pointer-events-auto overflow-hidden border border-black/5"
              >
                <div className="p-10">
                  <div className="flex items-center justify-between mb-10">
                    <h2 className="text-3xl font-black text-black tracking-tighter uppercase leading-none">Novo Registro</h2>
                    <button onClick={() => setIsModalOpen(false)} className="p-3 hover:bg-black/5 rounded-full transition-colors cursor-pointer text-black">
                      <X size={28} />
                    </button>
                  </div>

                  <form onSubmit={handleAddTransaction} className="space-y-8">
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
                          className="w-full bg-[#F9F9F9] border-none rounded-3xl px-8 py-5 focus:ring-4 focus:ring-black/5 outline-none transition-all placeholder:text-gray-300 font-black text-lg"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-3 ml-1">Valor</label>
                          <div className="relative">
                            <span className="absolute left-8 top-1/2 -translate-y-1/2 text-gray-400 font-black text-lg">R$</span>
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
                        <div>
                          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-3 ml-1">Categoria</label>
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
                      </div>
                    </div>

                    <button 
                      type="submit"
                      className={cn(
                        "w-full py-6 rounded-3xl text-white font-black uppercase tracking-[0.2em] text-sm shadow-2xl transition-all active:scale-[0.98] cursor-pointer mt-4",
                        type === 'INCOME' ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100/50" : "bg-rose-600 hover:bg-rose-700 shadow-rose-100/50"
                      )}
                    >
                      Confirmar Operação
                    </button>
                  </form>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
