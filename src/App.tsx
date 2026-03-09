import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Receipt, 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  Trash2, 
  Calculator,
  Pencil,
  ChevronRight,
  Check,
  X,
  PieChart as PieChartIcon
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { cn } from './lib/utils';
import { Invoice, Expense, Summary, Prepayment } from './types';

const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#3b82f6'];

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  
  const [activeTab, setActiveTab] = useState<'dashboard' | 'invoices' | 'expenses'>('dashboard');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [prepayments, setPrepayments] = useState<Prepayment[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [logoUrl, setLogoUrl] = useState('https://picsum.photos/seed/accounting-logo/200/200');
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  // Project names for dropdown
  const [projectNames, setProjectNames] = useState<string[]>([]);

  // Form states
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalTab, setModalTab] = useState<'invoice' | 'expense' | 'prepayment'>('invoice');
  const [modalContext, setModalContext] = useState<'general' | 'row'>('general');
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [editingPrepayment, setEditingPrepayment] = useState<Prepayment | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [expandedInvoices, setExpandedInvoices] = useState<Set<number>>(new Set());
  const [formData, setFormData] = useState({
    title: '', // This will be project name for expenses
    amount: '',
    kdv_rate: '20',
    withholding_rate: '0',
    date: format(new Date(), 'yyyy-MM-dd'),
    due_days: '0',
    due_date: format(new Date(), 'yyyy-MM-dd'),
    category: '',
    description: ''
  });

  // Multiple items for expenses
  const [expenseItems, setExpenseItems] = useState<{ title: string, amount: string, kdv_rate: string }[]>([
    { title: '', amount: '', kdv_rate: '20' }
  ]);

  // Auto calculate due date
  useEffect(() => {
    if (activeTab === 'invoices') {
      try {
        const baseDate = new Date(formData.date);
        const days = parseInt(formData.due_days) || 0;
        const newDueDate = new Date(baseDate);
        newDueDate.setDate(baseDate.getDate() + days);
        const formatted = format(newDueDate, 'yyyy-MM-dd');
        if (formatted !== formData.due_date) {
          setFormData(prev => ({ ...prev, due_date: formatted }));
        }
      } catch {
        // ignore invalid dates
      }
    }
  }, [formData.date, formData.due_days, activeTab]);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/check-auth');
      const data = await res.json();
      setIsAuthenticated(data.authenticated);
      if (data.authenticated) {
        fetchData();
      }
    } catch (err) {
      console.error('Auth check error:', err);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData)
      });
      if (res.ok) {
        setIsAuthenticated(true);
        fetchData();
      } else {
        const data = await res.json();
        setLoginError(data.message || 'Giriş başarısız');
      }
    } catch (err) {
      console.error('Login error:', err);
      setLoginError('Bir hata oluştu');
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
      setIsAuthenticated(false);
    } catch (err) {
      console.error('Logout error:', err);
      setIsAuthenticated(false);
    }
  };

  const fetchData = async () => {
    try {
      const [invRes, expRes, sumRes, preRes, settingsRes] = await Promise.all([
        fetch('/api/invoices'),
        fetch('/api/expenses'),
        fetch('/api/summary'),
        fetch('/api/prepayments'),
        fetch('/api/settings')
      ]);
      if (invRes.status === 401) {
        setIsAuthenticated(false);
        return;
      }
      const invData = await invRes.json();
      const expData = await expRes.json();
      const sumData = await sumRes.json();
      const preData = await preRes.json();
      const settingsData = await settingsRes.json();
      
      setInvoices(invData);
      setExpenses(expData);
      setSummary(sumData);
      setPrepayments(preData);
      if (settingsData.logo_url) {
        setLogoUrl(settingsData.logo_url);
      }
      
      // Extract unique project names
      const names = Array.from(new Set(invData.map((inv: Invoice) => inv.title))) as string[];
      setProjectNames(names);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const endpoint = modalTab === 'invoice' 
      ? '/api/invoices' 
      : modalTab === 'expense' 
        ? '/api/expenses' 
        : '/api/prepayments';
    
    try {
      if (modalTab === 'invoice') {
        const method = editingInvoice ? 'PUT' : 'POST';
        const url = editingInvoice ? `${endpoint}/${editingInvoice.id}` : endpoint;
        
        await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
            amount: parseFloat(formData.amount)
          })
        });
      } else if (modalTab === 'expense') {
        // Multiple expenses
        for (const item of expenseItems) {
          if (!item.title || !item.amount) continue;
          await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: formData.title, // Project Name
              amount: parseFloat(item.amount),
              kdv_rate: parseFloat(item.kdv_rate),
              date: formData.date,
              category: item.title, // Item title as category
              description: formData.description
            })
          });
        }
      } else if (modalTab === 'prepayment') {
        const method = editingPrepayment ? 'PUT' : 'POST';
        const url = editingPrepayment ? `${endpoint}/${editingPrepayment.id}` : endpoint;
        await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: formData.title, // Project Name
            amount: parseFloat(formData.amount),
            date: formData.date,
            description: formData.description
          })
        });
      }
      
      setShowAddModal(false);
      setEditingInvoice(null);
      setEditingPrepayment(null);
      setFormData({
        title: '',
        amount: '',
        kdv_rate: '20',
        withholding_rate: '0',
        date: format(new Date(), 'yyyy-MM-dd'),
        due_days: '0',
        due_date: format(new Date(), 'yyyy-MM-dd'),
        category: '',
        description: ''
      });
      setExpenseItems([{ title: '', amount: '', kdv_rate: '20' }]);
      fetchData();
    } catch (error) {
      console.error('Error adding item:', error);
    }
  };

  const togglePaymentStatus = async (id: number, currentStatus: number) => {
    try {
      await fetch(`/api/invoices/${id}/payment`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_paid: currentStatus === 0 ? 1 : 0 })
      });
      fetchData();
    } catch (error) {
      console.error('Error toggling payment status:', error);
    }
  };

  const handleDelete = async (id: number, type: 'invoices' | 'expenses' | 'prepayments') => {
    console.log(`Attempting to delete ${type} with id: ${id}`);
    
    if (!window.confirm('Bu kaydı silmek istediğinize emin misiniz?')) {
      return;
    }

    try {
      const response = await fetch(`/api/${type}/${id}`, { 
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`Delete response for ${type}/${id}:`, response.status);
      
      if (response.ok) {
        await fetchData();
        console.log('Data refetched after deletion');
      } else {
        const errorData = await response.json();
        console.error('Delete failed on server:', errorData);
        alert('Silme işlemi başarısız oldu: ' + (errorData.message || 'Bilinmeyen hata'));
      }
    } catch (error) {
      console.error('Error deleting item:', error);
      alert('Silme işlemi sırasında bir hata oluştu.');
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('logo', file);

    setIsUploadingLogo(true);
    try {
      const res = await fetch('/api/upload-logo', {
        method: 'POST',
        body: formData,
      });
      
      const contentType = res.headers.get("content-type");
      if (res.ok && contentType && contentType.includes("application/json")) {
        const data = await res.json();
        setLogoUrl(data.logoUrl);
      } else {
        const errorText = await res.text();
        console.error('Logo upload failed:', res.status, errorText);
        if (res.status === 401) {
          alert('Logo yüklemek için giriş yapmalısınız.');
        } else {
          alert(`Logo yüklenemedi (Hata: ${res.status})`);
        }
      }
    } catch (error) {
      console.error('Error uploading logo:', error);
      alert('Logo yüklenirken bir ağ hatası oluştu. Lütfen tekrar deneyin.');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleEdit = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setFormData({
      title: invoice.title,
      amount: invoice.amount.toString(),
      kdv_rate: invoice.kdv_rate.toString(),
      withholding_rate: invoice.withholding_rate.toString(),
      date: invoice.date,
      due_days: invoice.due_days.toString(),
      due_date: invoice.due_date,
      category: '',
      description: invoice.description || ''
    });
    setShowAddModal(true);
  };

  const toggleProject = (projectName: string) => {
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(projectName)) {
      newExpanded.delete(projectName);
    } else {
      newExpanded.add(projectName);
    }
    setExpandedProjects(newExpanded);
  };

  const toggleInvoice = (id: number) => {
    const newExpanded = new Set(expandedInvoices);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedInvoices(newExpanded);
  };

  const groupedExpenses = expenses.reduce((acc, exp) => {
    const projectName = exp.title;
    if (!acc[projectName]) {
      acc[projectName] = [];
    }
    acc[projectName].push(exp);
    return acc;
  }, {} as Record<string, Expense[]>);

  const chartData = [
    { name: 'Gelir', value: summary?.totalIncome || 0 },
    { name: 'Gider', value: summary?.totalExpense || 0 },
  ];

  const taxPieData = [
    { name: 'Gelir Vergisi', value: summary?.estimatedIncomeTax || 0 },
    { name: 'Ödenecek KDV', value: summary?.payableKdv || 0 },
  ];

  if (loading || isAuthenticated === null) return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-stone-900"></div>
    </div>
  );

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden p-10 border border-[#141414]/10">
          <div className="text-center mb-10">
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 bg-[#141414] rounded-2xl flex items-center justify-center shadow-xl rotate-3 hover:rotate-0 transition-transform duration-500">
                <img 
                  src={logoUrl} 
                  alt="Logo" 
                  className="w-16 h-16 object-contain rounded-xl"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
            <h1 className="text-4xl font-serif italic mb-2">Muhasebe.</h1>
            <p className="text-sm opacity-50">Lütfen devam etmek için giriş yapın</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-widest opacity-50 font-bold">Kullanıcı Adı</label>
              <input 
                required
                type="text" 
                value={loginData.username}
                onChange={e => setLoginData({...loginData, username: e.target.value})}
                className="w-full bg-[#141414]/5 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-[#141414] transition-all"
                placeholder="Kullanıcı adınız"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-widest opacity-50 font-bold">Şifre</label>
              <input 
                required
                type="password" 
                value={loginData.password}
                onChange={e => setLoginData({...loginData, password: e.target.value})}
                className="w-full bg-[#141414]/5 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-[#141414] transition-all"
                placeholder="••••••••"
              />
            </div>

            {loginError && (
              <p className="text-rose-600 text-sm text-center font-medium">{loginError}</p>
            )}

            <button 
              type="submit"
              className="w-full bg-[#141414] text-white py-5 rounded-2xl font-bold text-lg hover:shadow-xl hover:-translate-y-1 transition-all active:translate-y-0"
            >
              Giriş Yap
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#141414] font-sans selection:bg-[#141414] selection:text-[#F5F5F0]">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-[#141414]/10 z-20">
        <div className="p-8">
          <div className="flex items-center gap-3 mb-8 group relative">
            <div className="w-10 h-10 bg-[#141414] rounded-xl flex items-center justify-center shrink-0 relative overflow-hidden">
              <img 
                src={logoUrl} 
                alt="Logo" 
                className={cn("w-8 h-8 object-contain rounded-lg transition-opacity", isUploadingLogo && "opacity-50")}
                referrerPolicy="no-referrer"
              />
              <label className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                <Plus size={16} className="text-white" />
                <input 
                  type="file" 
                  className="hidden" 
                  accept="image/*"
                  onChange={handleLogoUpload}
                  disabled={isUploadingLogo}
                />
              </label>
            </div>
            <h1 className="text-2xl font-serif italic tracking-tight">Muhasebe.</h1>
          </div>
          <nav className="space-y-2">
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                activeTab === 'dashboard' ? "bg-[#141414] text-white" : "hover:bg-[#141414]/5"
              )}
            >
              <LayoutDashboard size={20} />
              <span className="font-medium">Panel</span>
            </button>
            <button 
              onClick={() => setActiveTab('invoices')}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                activeTab === 'invoices' ? "bg-[#141414] text-white" : "hover:bg-[#141414]/5"
              )}
            >
              <Receipt size={20} />
              <span className="font-medium">Faturalar</span>
            </button>
            <button 
              onClick={() => setActiveTab('expenses')}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                activeTab === 'expenses' ? "bg-[#141414] text-white" : "hover:bg-[#141414]/5"
              )}
            >
              <Wallet size={20} />
              <span className="font-medium">Masraflar</span>
            </button>
            
            <button 
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 hover:bg-rose-50 text-rose-600 mt-8"
            >
              <Plus size={20} className="rotate-45" />
              <span className="font-medium">Çıkış Yap</span>
            </button>
          </nav>
        </div>
        
        <div className="absolute bottom-8 left-8 right-8 space-y-2">
          <div className="p-4 bg-[#141414]/5 rounded-2xl border border-[#141414]/10">
            <p className="text-xs uppercase tracking-widest opacity-50 mb-1">Net Kar</p>
            <p className="text-lg font-mono font-bold">
              {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(summary?.netIncome || 0)}
            </p>
          </div>
          <div className="p-4 bg-[#141414]/5 rounded-2xl border border-[#141414]/10">
            <p className="text-xs uppercase tracking-widest opacity-50 mb-1">Net Kar (Vergi Sonrası)</p>
            <p className="text-xl font-mono font-bold">
              {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(summary?.netProfitAfterTax || 0)}
            </p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="pl-64 min-h-screen">
        <header className="p-8 flex justify-between items-center border-b border-[#141414]/10 bg-white/50 backdrop-blur-md sticky top-0 z-10">
          <div>
            <h2 className="text-3xl font-serif italic">
              {activeTab === 'dashboard' && 'Genel Bakış'}
              {activeTab === 'invoices' && 'Fatura Takibi'}
              {activeTab === 'expenses' && 'Masraf Takibi'}
            </h2>
            <p className="text-sm opacity-50 mt-1">
              {format(new Date(), 'd MMMM yyyy, EEEE', { locale: tr })}
            </p>
          </div>
          
          {activeTab !== 'dashboard' && (
            <button 
              onClick={() => {
                setFormData({
                  title: '',
                  amount: '',
                  kdv_rate: '20',
                  withholding_rate: '0',
                  date: format(new Date(), 'yyyy-MM-dd'),
                  due_days: '0',
                  due_date: format(new Date(), 'yyyy-MM-dd'),
                  category: '',
                  description: ''
                });
                setModalTab(activeTab === 'expenses' ? 'expense' : 'invoice');
                setModalContext('general');
                setShowAddModal(true);
              }}
              className="flex items-center gap-2 bg-[#141414] text-white px-6 py-3 rounded-full hover:scale-105 transition-transform active:scale-95"
            >
              <Plus size={20} />
              <span className="font-medium">Yeni Ekle</span>
            </button>
          )}
        </header>

        <div className="p-8 max-w-7xl mx-auto">
          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-[#141414]/10 shadow-sm">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
                      <TrendingUp size={24} />
                    </div>
                  </div>
                  <p className="text-xs uppercase tracking-widest opacity-50">Toplam Gelir</p>
                  <p className="text-2xl font-mono font-bold mt-1">
                    {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(summary?.totalIncome || 0)}
                  </p>
                </div>
                
                <div className="bg-white p-6 rounded-3xl border border-[#141414]/10 shadow-sm">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-2 bg-rose-100 text-rose-600 rounded-xl">
                      <TrendingDown size={24} />
                    </div>
                  </div>
                  <p className="text-xs uppercase tracking-widest opacity-50">Toplam Gider</p>
                  <p className="text-2xl font-mono font-bold mt-1">
                    {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(summary?.totalExpense || 0)}
                  </p>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-[#141414]/10 shadow-sm">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
                      <Calculator size={24} />
                    </div>
                  </div>
                  <p className="text-xs uppercase tracking-widest opacity-50">Kalan Alacak</p>
                  <p className="text-2xl font-mono font-bold mt-1 text-indigo-600">
                    {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(summary?.remainingReceivable || 0)}
                  </p>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-[#141414]/10 shadow-sm">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-2 bg-amber-100 text-amber-600 rounded-xl">
                      <Calculator size={24} />
                    </div>
                  </div>
                  <p className="text-xs uppercase tracking-widest opacity-50">Tahmini Vergi</p>
                  <p className="text-2xl font-mono font-bold mt-1 text-amber-600">
                    {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(summary?.totalTax || 0)}
                  </p>
                </div>

                <div className="bg-[#141414] text-white p-6 rounded-3xl shadow-xl">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-2 bg-white/10 rounded-xl">
                      <TrendingUp size={24} />
                    </div>
                  </div>
                  <p className="text-xs uppercase tracking-widest opacity-50">Net Kar (Vergi Sonrası)</p>
                  <p className="text-2xl font-mono font-bold mt-1">
                    {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(summary?.netProfitAfterTax || 0)}
                  </p>
                </div>
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-[2rem] border border-[#141414]/10 shadow-sm">
                  <h3 className="text-xl font-serif italic mb-6">Gelir vs Gider</h3>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#14141410" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} />
                        <YAxis axisLine={false} tickLine={false} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        />
                        <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : '#ef4444'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white p-8 rounded-[2rem] border border-[#141414]/10 shadow-sm">
                  <h3 className="text-xl font-serif italic mb-6">Vergi Dağılımı</h3>
                  <div className="h-[300px] w-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={taxPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {taxPieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index + 2 % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex justify-center gap-8 mt-4">
                    {taxPieData.map((item, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i + 2] }}></div>
                        <span className="text-xs font-medium opacity-70">{item.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-white rounded-[2rem] border border-[#141414]/10 overflow-hidden shadow-sm">
                <div className="p-8 border-b border-[#141414]/10 flex justify-between items-center">
                  <h3 className="text-xl font-serif italic">Son Hareketler</h3>
                  <button onClick={() => setActiveTab('invoices')} className="text-sm font-medium hover:underline flex items-center gap-1">
                    Tümünü Gör <ChevronRight size={16} />
                  </button>
                </div>
                <div className="divide-y divide-[#141414]/10">
                  {[...invoices, ...expenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5).map((item, i) => {
                    const isInvoice = 'id' in item && invoices.some(inv => inv.id === item.id && inv.title === item.title);
                    return (
                      <div key={i} className="p-6 flex items-center justify-between hover:bg-[#141414]/5 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "p-3 rounded-2xl",
                            isInvoice ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
                          )}>
                            {isInvoice ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                          </div>
                          <div>
                            <p className="font-bold">{item.title}</p>
                            <p className="text-xs opacity-50">{format(new Date(item.date), 'd MMMM yyyy', { locale: tr })}</p>
                          </div>
                        </div>
                        <p className={cn(
                          "font-mono font-bold text-lg",
                          isInvoice ? "text-emerald-600" : "text-rose-600"
                        )}>
                          {isInvoice ? '+' : '-'} {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(item.amount)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'invoices' && (
            <div className="bg-white rounded-[2rem] border border-[#141414]/10 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-[#141414]/5 text-xs uppercase tracking-widest opacity-50">
                      <th className="px-8 py-4 font-medium">Proje İsmi</th>
                      <th className="px-8 py-4 font-medium">Fatura Tarihi</th>
                      <th className="px-8 py-4 font-medium">Vade Tarihi</th>
                      <th className="px-8 py-4 font-medium">KDV / Tevkifat</th>
                      <th className="px-8 py-4 font-medium">Tutar</th>
                      <th className="px-8 py-4 font-medium">Ödeme</th>
                      <th className="px-8 py-4 font-medium text-right">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#141414]/10">
                    {invoices.map((item) => (
                      <React.Fragment key={item.id}>
                        <tr className={cn(
                          "hover:bg-[#141414]/5 transition-colors group",
                          item.is_paid ? "text-emerald-600/80" : "text-rose-600/80"
                        )}>
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-3 cursor-pointer group/title" onClick={() => toggleInvoice(item.id)}>
                              <div className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center shadow-sm transition-all",
                                item.is_paid ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600",
                                expandedInvoices.has(item.id) ? "scale-110 ring-2 ring-offset-2 ring-indigo-500" : ""
                              )}>
                                <PieChartIcon size={20} />
                              </div>
                              <div className="flex flex-col">
                                <span className="font-bold text-lg flex items-center gap-2 text-stone-900">
                                  {item.title}
                                  {prepayments.filter(p => p.title === item.title).length > 0 && (
                                    <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[10px] font-mono">
                                      {prepayments.filter(p => p.title === item.title).length} Ön Ödeme
                                    </span>
                                  )}
                                </span>
                                <span className="text-[10px] opacity-40 uppercase tracking-widest font-bold group-hover/title:text-indigo-500 transition-colors">
                                  {expandedInvoices.has(item.id) ? "Detayları Gizle" : "Detayları Gör"}
                                </span>
                              </div>
                            </div>
                            {item.description && <p className="text-xs opacity-50 mt-1 ml-13 text-stone-600">{item.description}</p>}
                          </td>
                          <td className="px-8 py-6 text-sm">
                            {format(new Date(item.date), 'd MMM yyyy', { locale: tr })}
                          </td>
                          <td className="px-8 py-6 text-sm font-medium">
                            {item.due_date ? format(new Date(item.due_date), 'd MMM yyyy', { locale: tr }) : '-'}
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex flex-col gap-1">
                              <span className={cn(
                                "px-2 py-1 rounded-lg text-[10px] font-mono w-fit",
                                item.is_paid ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                              )}>KDV: %{item.kdv_rate}</span>
                              {item.withholding_rate > 0 && (
                                <span className={cn(
                                  "px-2 py-1 rounded-lg text-[10px] font-mono w-fit",
                                  item.is_paid ? "bg-emerald-100 text-emerald-800" : "bg-amber-50 text-amber-800"
                                )}>Tevkifat: {item.withholding_rate}/10</span>
                              )}
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <p className="font-mono font-bold text-stone-900">
                              {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(
                                item.amount - prepayments.filter(p => p.title === item.title).reduce((sum, p) => sum + p.amount, 0)
                              )}
                            </p>
                            {prepayments.filter(p => p.title === item.title).length > 0 && (
                              <p className="text-[10px] opacity-50 line-through mt-1">
                                {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(item.amount)}
                              </p>
                            )}
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex gap-2">
                              <button 
                                onClick={() => togglePaymentStatus(item.id, 0)}
                                className={cn(
                                  "w-8 h-8 rounded-lg border transition-all flex items-center justify-center shadow-sm",
                                  item.is_paid ? "bg-emerald-500 border-emerald-600 text-white" : "bg-white border-stone-200 text-stone-300 hover:border-emerald-300"
                                )}
                                title="Ödendi"
                              >
                                <Check size={16} />
                              </button>
                              <button 
                                onClick={() => togglePaymentStatus(item.id, 1)}
                                className={cn(
                                  "w-8 h-8 rounded-lg border transition-all flex items-center justify-center shadow-sm",
                                  !item.is_paid ? "bg-rose-500 border-rose-600 text-white" : "bg-white border-stone-200 text-stone-300 hover:border-rose-300"
                                )}
                                title="Ödenmedi"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          </td>
                          <td className="px-8 py-6 text-right">
                            <div className="flex justify-end gap-2 transition-all">
                              <button 
                                onClick={() => {
                                  setFormData(prev => ({ ...prev, title: item.title }));
                                  setModalTab('expense');
                                  setModalContext('row');
                                  setShowAddModal(true);
                                }}
                                className="p-2 text-stone-600 hover:bg-stone-100 rounded-xl transition-all"
                                title="Masraf/Ön Ödeme Ekle"
                              >
                                <Plus size={18} />
                              </button>
                              <button 
                                onClick={() => handleEdit(item)}
                                className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                                title="Düzenle"
                              >
                                <Pencil size={18} />
                              </button>
                              <button 
                                onClick={() => handleDelete(item.id, 'invoices')}
                                className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                                title="Sil"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </td>
                        </tr>
                        {expandedInvoices.has(item.id) && prepayments.filter(p => p.title === item.title).length > 0 && (
                          <tr className="bg-emerald-50/30">
                            <td colSpan={7} className="px-8 py-4">
                              <div className="flex flex-col gap-3">
                                <h4 className="text-[10px] uppercase tracking-[0.2em] font-bold text-emerald-700/60">Proje Ön Ödemeleri</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                  {prepayments.filter(p => p.title === item.title).map((p) => (
                                    <div key={p.id} className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-sm flex justify-between items-center group/pre">
                                      <div>
                                        <p className="text-xs font-bold text-emerald-900">{p.description || 'Ön Ödeme'}</p>
                                        <p className="text-[10px] opacity-50">{format(new Date(p.date), 'd MMM yyyy', { locale: tr })}</p>
                                      </div>
                                      <div className="flex items-center gap-3">
                                        <p className="font-mono font-bold text-emerald-600">
                                          {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(p.amount)}
                                        </p>
                                        <div className="flex items-center gap-2 transition-all">
                                          <button 
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setEditingPrepayment(p);
                                              setModalTab('prepayment');
                                              setModalContext('row');
                                              setFormData({
                                                title: p.title,
                                                amount: p.amount.toString(),
                                                date: p.date,
                                                description: p.description || '',
                                                kdv_rate: '20',
                                                withholding_rate: '0',
                                                due_days: '0',
                                                due_date: p.date,
                                                category: ''
                                              });
                                              setShowAddModal(true);
                                            }}
                                            className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl transition-all border border-indigo-100 shadow-sm cursor-pointer"
                                            title="Düzenle"
                                          >
                                            <Pencil size={16} />
                                          </button>
                                          <button 
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDelete(p.id, 'prepayments');
                                            }}
                                            className="flex items-center gap-1 px-4 py-2 bg-rose-600 text-white hover:bg-rose-700 rounded-xl transition-all shadow-md font-bold text-xs cursor-pointer active:scale-95"
                                            title="Sil"
                                          >
                                            <Trash2 size={16} />
                                            <span>Sil</span>
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                  {invoices.length > 0 && (
                    <tfoot className="bg-[#141414]/5 border-t-2 border-[#141414]/10">
                      <tr className="border-b border-[#141414]/5">
                        <td colSpan={4} className="px-8 py-3 text-right font-serif italic text-sm opacity-60">Toplam Fatura Tutarı:</td>
                        <td className="px-8 py-3">
                          <p className="font-mono font-medium text-stone-600">
                            {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(
                              invoices.reduce((sum, inv) => sum + inv.amount, 0)
                            )}
                          </p>
                        </td>
                        <td></td>
                      </tr>
                      <tr className="border-b border-[#141414]/5">
                        <td colSpan={4} className="px-8 py-3 text-right font-serif italic text-sm opacity-60">Toplam Ön Ödeme:</td>
                        <td className="px-8 py-3">
                          <p className="font-mono font-medium text-emerald-600">
                            {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(
                              prepayments.reduce((sum, pre) => sum + pre.amount, 0)
                            )}
                          </p>
                        </td>
                        <td></td>
                      </tr>
                      <tr>
                        <td colSpan={4} className="px-8 py-6 text-right font-serif italic text-lg font-bold">Genel Toplam (Kalan Alacak):</td>
                        <td className="px-8 py-6">
                          <p className="font-mono font-bold text-xl text-indigo-600">
                            {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(
                              invoices.reduce((sum, inv) => sum + inv.amount, 0) - prepayments.reduce((sum, pre) => sum + pre.amount, 0)
                            )}
                          </p>
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
              {invoices.length === 0 && (
                <div className="p-20 text-center opacity-30">
                  <PieChartIcon size={64} className="mx-auto mb-4" />
                  <p className="text-xl font-serif italic">Henüz kayıt bulunmuyor.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'expenses' && (
            <div className="space-y-4">
              {Object.entries(groupedExpenses).map(([projectName, items]) => (
                <div key={projectName} className="bg-white rounded-[2rem] border border-[#141414]/10 overflow-hidden shadow-sm">
                  <button 
                    onClick={() => toggleProject(projectName)}
                    className="w-full px-8 py-6 flex items-center justify-between hover:bg-[#141414]/5 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-[#141414]/5 rounded-2xl">
                        <Wallet size={24} />
                      </div>
                      <div className="text-left">
                        <h3 className="text-xl font-bold">{projectName}</h3>
                        <p className="text-xs opacity-50">{items.length} Masraf Kalemi</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-xs uppercase tracking-widest opacity-50">Toplam Masraf</p>
                        <p className="text-xl font-mono font-bold text-rose-600">
                          {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(items.reduce((sum, i) => sum + i.amount, 0))}
                        </p>
                      </div>
                      <div className={cn("transition-transform duration-300", expandedProjects.has(projectName) ? "rotate-180" : "")}>
                        <ChevronRight size={24} className="rotate-90" />
                      </div>
                    </div>
                  </button>

                  {expandedProjects.has(projectName) && (
                    <div className="border-t border-[#141414]/10">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-[#141414]/5 text-[10px] uppercase tracking-widest opacity-50">
                            <th className="px-8 py-3 font-medium">Açıklama</th>
                            <th className="px-8 py-3 font-medium">Tarih</th>
                            <th className="px-8 py-3 font-medium">KDV</th>
                            <th className="px-8 py-3 font-medium">Tutar</th>
                            <th className="px-8 py-3 font-medium text-right">İşlem</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#141414]/10">
                          {items.map((item) => (
                            <tr key={item.id} className="hover:bg-[#141414]/5 transition-colors group">
                              <td className="px-8 py-4">
                                <p className="font-medium text-sm">{item.category || item.title}</p>
                              </td>
                              <td className="px-8 py-4 text-xs opacity-70">
                                {format(new Date(item.date), 'd MMM yyyy', { locale: tr })}
                              </td>
                              <td className="px-8 py-4">
                                <span className="px-2 py-1 bg-[#141414]/5 rounded-lg text-[10px] font-mono">%{item.kdv_rate}</span>
                              </td>
                              <td className="px-8 py-4">
                                <p className="font-mono font-bold text-rose-600 text-sm">
                                  {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(item.amount)}
                                </p>
                              </td>
                              <td className="px-8 py-4 text-right">
                                <button 
                                  onClick={() => handleDelete(item.id, 'expenses')}
                                  className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                                  title="Sil"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-[#141414]/5 border-t border-[#141414]/10">
                          <tr>
                            <td colSpan={3} className="px-8 py-4 text-right font-medium text-xs uppercase tracking-widest opacity-50">Proje Toplamı:</td>
                            <td className="px-8 py-4">
                              <p className="font-mono font-bold text-rose-600">
                                {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(items.reduce((sum, i) => sum + i.amount, 0))}
                              </p>
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              ))}
              {expenses.length > 0 && (
                <div className="bg-white border border-[#141414]/10 rounded-[2rem] p-6 flex justify-between items-center shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-[#141414]/5 rounded-2xl">
                      <Wallet size={24} />
                    </div>
                    <div>
                      <h3 className="text-lg font-serif italic">Tüm Masraflar Genel Toplamı</h3>
                      <p className="text-[10px] opacity-50 uppercase tracking-widest">Toplam {expenses.length} kalem masraf</p>
                    </div>
                  </div>
                  <p className="text-2xl font-mono font-bold">
                    {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(expenses.reduce((sum, exp) => sum + exp.amount, 0))}
                  </p>
                </div>
              )}
              {expenses.length === 0 && (
                <div className="bg-white rounded-[2rem] border border-[#141414]/10 p-20 text-center opacity-30">
                  <PieChartIcon size={64} className="mx-auto mb-4" />
                  <p className="text-xl font-serif italic">Henüz kayıt bulunmuyor.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-[#141414]/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
            <div className="p-8 border-b border-[#141414]/10 flex justify-between items-center shrink-0">
              <h3 className="text-2xl font-serif italic">
                {editingInvoice ? 'Faturayı Düzenle' : 'Yeni Kayıt Ekle'}
              </h3>
              <button 
                onClick={() => {
                  setShowAddModal(false);
                  setEditingInvoice(null);
                }} 
                className="p-2 hover:bg-[#141414]/5 rounded-full transition-colors"
              >
                <Plus size={24} className="rotate-45" />
              </button>
            </div>
            
            {!editingInvoice && (
              <div className="flex border-b border-[#141414]/10 bg-[#141414]/5">
                {modalContext === 'general' && activeTab === 'invoices' ? (
                  <div className="flex-1 py-4 text-xs uppercase tracking-widest font-bold bg-white border-b-2 border-[#141414] text-center">
                    Yeni Fatura
                  </div>
                ) : modalContext === 'general' && activeTab === 'expenses' ? (
                  <div className="flex-1 py-4 text-xs uppercase tracking-widest font-bold bg-white border-b-2 border-[#141414] text-center">
                    Yeni Masraf
                  </div>
                ) : (
                  <>
                    <button 
                      onClick={() => setModalTab('expense')}
                      type="button"
                      className={cn(
                        "flex-1 py-4 text-xs uppercase tracking-widest font-bold transition-all",
                        modalTab === 'expense' ? "bg-white border-b-2 border-[#141414]" : "opacity-50 hover:opacity-100"
                      )}
                    >
                      Masraf
                    </button>
                    <button 
                      onClick={() => setModalTab('prepayment')}
                      type="button"
                      className={cn(
                        "flex-1 py-4 text-xs uppercase tracking-widest font-bold transition-all",
                        modalTab === 'prepayment' ? "bg-white border-b-2 border-[#141414]" : "opacity-50 hover:opacity-100"
                      )}
                    >
                      Ön Ödeme
                    </button>
                  </>
                )}
              </div>
            )}

            <form onSubmit={handleAdd} className="p-8 space-y-6 overflow-y-auto">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-widest opacity-50 font-bold">Proje İsmi</label>
                {modalTab === 'invoice' ? (
                  <input 
                    required
                    disabled={modalContext === 'row'}
                    type="text" 
                    value={formData.title}
                    onChange={e => setFormData({...formData, title: e.target.value})}
                    className="w-full bg-[#141414]/5 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-[#141414] transition-all disabled:opacity-50"
                    placeholder="Örn: NoxxHouse Web Tasarım"
                  />
                ) : (
                  <select 
                    required
                    disabled={modalContext === 'row'}
                    value={formData.title}
                    onChange={e => setFormData({...formData, title: e.target.value})}
                    className="w-full bg-[#141414]/5 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-[#141414] transition-all disabled:opacity-50"
                  >
                    <option value="">Proje Seçin...</option>
                    {projectNames.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-widest opacity-50 font-bold">
                    {modalTab === 'invoice' ? 'Fatura Kesim Tarihi' : modalTab === 'expense' ? 'Masraf Tarihi' : 'Ödeme Tarihi'}
                  </label>
                  <input 
                    required
                    type="date" 
                    value={formData.date}
                    onChange={e => setFormData({...formData, date: e.target.value})}
                    className="w-full bg-[#141414]/5 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-[#141414] transition-all"
                  />
                </div>
                {modalTab === 'invoice' && (
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-widest opacity-50 font-bold">Vade (Gün)</label>
                    <select 
                      value={formData.due_days}
                      onChange={e => setFormData({...formData, due_days: e.target.value})}
                      className="w-full bg-[#141414]/5 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-[#141414] transition-all"
                    >
                      <option value="0">Peşin</option>
                      <option value="15">15 Gün</option>
                      <option value="20">20 Gün</option>
                      <option value="30">30 Gün</option>
                      <option value="35">35 Gün</option>
                      <option value="60">60 Gün</option>
                      <option value="65">65 Gün</option>
                      <option value="70">70 Gün</option>
                      <option value="75">75 Gün</option>
                    </select>
                  </div>
                )}
              </div>

              {modalTab === 'invoice' && (
                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                  <p className="text-xs uppercase tracking-widest text-amber-600 font-bold mb-1">Ödeme Vade Tarihi</p>
                  <p className="text-lg font-mono font-bold text-amber-800">
                    {format(new Date(formData.due_date), 'd MMMM yyyy', { locale: tr })}
                  </p>
                </div>
              )}
              
              {modalTab === 'invoice' || modalTab === 'prepayment' ? (
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-widest opacity-50 font-bold">Tutar {modalTab === 'invoice' && '(KDV Dahil)'}</label>
                    <input 
                      required
                      type="number" 
                      step="0.01"
                      value={formData.amount}
                      onChange={e => setFormData({...formData, amount: e.target.value})}
                      onBlur={e => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val)) {
                          setFormData({...formData, amount: val.toFixed(2)});
                        }
                      }}
                      className="w-full bg-[#141414]/5 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-[#141414] transition-all font-mono"
                      placeholder="0.00"
                    />
                  </div>
                  {modalTab === 'invoice' && (
                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-widest opacity-50 font-bold">KDV Oranı (%)</label>
                      <select 
                        value={formData.kdv_rate}
                        onChange={e => setFormData({...formData, kdv_rate: e.target.value})}
                        className="w-full bg-[#141414]/5 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-[#141414] transition-all"
                      >
                        <option value="20">%20</option>
                        <option value="10">%10</option>
                        <option value="1">%1</option>
                        <option value="0">%0</option>
                      </select>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-xs uppercase tracking-widest opacity-50 font-bold">Masraf Kalemleri</label>
                    <button 
                      type="button"
                      onClick={() => setExpenseItems([...expenseItems, { title: '', amount: '', kdv_rate: '20' }])}
                      className="text-xs font-bold flex items-center gap-1 hover:underline"
                    >
                      <Plus size={14} /> Kalem Ekle
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    {expenseItems.map((item, index) => (
                      <div key={index} className="p-4 bg-[#141414]/5 rounded-2xl space-y-3 relative">
                        {expenseItems.length > 1 && (
                          <button 
                            type="button"
                            onClick={() => setExpenseItems(expenseItems.filter((_, i) => i !== index))}
                            className="absolute top-2 right-2 text-rose-600 p-1"
                          >
                            <Plus size={16} className="rotate-45" />
                          </button>
                        )}
                        <input 
                          required
                          type="text"
                          placeholder="Masraf Açıklaması"
                          value={item.title}
                          onChange={e => {
                            const newItems = [...expenseItems];
                            newItems[index].title = e.target.value;
                            setExpenseItems(newItems);
                          }}
                          className="w-full bg-white border-none rounded-xl px-4 py-2 text-sm focus:ring-1 focus:ring-[#141414]"
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <input 
                            required
                            type="number"
                            step="0.01"
                            placeholder="Tutar"
                            value={item.amount}
                            onChange={e => {
                              const newItems = [...expenseItems];
                              newItems[index].amount = e.target.value;
                              setExpenseItems(newItems);
                            }}
                            onBlur={e => {
                              const val = parseFloat(e.target.value);
                              if (!isNaN(val)) {
                                const newItems = [...expenseItems];
                                newItems[index].amount = val.toFixed(2);
                                setExpenseItems(newItems);
                              }
                            }}
                            className="w-full bg-white border-none rounded-xl px-4 py-2 text-sm font-mono focus:ring-1 focus:ring-[#141414]"
                          />
                          <select 
                            value={item.kdv_rate}
                            onChange={e => {
                              const newItems = [...expenseItems];
                              newItems[index].kdv_rate = e.target.value;
                              setExpenseItems(newItems);
                            }}
                            className="w-full bg-white border-none rounded-xl px-4 py-2 text-sm focus:ring-1 focus:ring-[#141414]"
                          >
                            <option value="20">%20 KDV</option>
                            <option value="10">%10 KDV</option>
                            <option value="1">%1 KDV</option>
                            <option value="0">%0 KDV</option>
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {modalTab === 'invoice' && (
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-widest opacity-50 font-bold">Tevkifat Oranı (X/10)</label>
                  <select 
                    value={formData.withholding_rate}
                    onChange={e => setFormData({...formData, withholding_rate: e.target.value})}
                    className="w-full bg-[#141414]/5 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-[#141414] transition-all"
                  >
                    <option value="0">Yok</option>
                    <option value="2">2/10</option>
                    <option value="3">3/10</option>
                    <option value="4">4/10</option>
                    <option value="5">5/10</option>
                    <option value="7">7/10</option>
                    <option value="9">9/10</option>
                    <option value="10">10/10</option>
                  </select>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-widest opacity-50 font-bold">Açıklama (Opsiyonel)</label>
                <textarea 
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  className="w-full bg-[#141414]/5 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-[#141414] transition-all min-h-[100px]"
                  placeholder="Ek notlar..."
                />
              </div>

              <button 
                type="submit"
                className="w-full bg-[#141414] text-white py-5 rounded-2xl font-bold text-lg hover:shadow-xl hover:-translate-y-1 transition-all active:translate-y-0"
              >
                Kaydet
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
// update
