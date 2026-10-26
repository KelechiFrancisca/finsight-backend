import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement } from 'chart.js';
import Papa from "papaparse";
import { FaArrowUp, FaArrowDown, FaBalanceScale, FaPercentage, FaPlus, FaDownload, FaShieldAlt, FaChevronDown, FaChevronUp, FaLightbulb, FaBullseye, FaExclamationTriangle } from "react-icons/fa";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import API_BASE_URL from "./apiConfig";
import AskMyBusiness from "./AskMyBusiness";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement);

const currencySymbols = { USD: "$", EUR: "€", GBP: "£", CAD: "C$", JPY: "¥", NGN: "₦", ZAR: "R", KES: "KSh", GHS: "₵", EGP: "£E", XOF: "CFA", XAF: "CFA" };
function formatAmount(amount, currency = "USD") { const symbol = currencySymbols[currency] || ""; return `${symbol}${Number(amount || 0).toLocaleString()}`; }
function formatAmountPlain(amount, currency = "USD") { const symbol = currencySymbols[currency] || ""; return `${symbol}${Number(amount || 0).toLocaleString(undefined, {minimumFractionDigits:0, maximumFractionDigits:0})}`; }
const normalizeCategory = (cat) => { if (!cat) return "Uncategorized"; const trimmed = String(cat).trim(); return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase(); };
const apiFetch = async (endpoint, options = {}) => {
  const token = localStorage.getItem("token");
  const headers = { "Content-Type": "application/json",...(token? { Authorization: `Bearer ${token}` } : {}),...options.headers };
  const res = await fetch(`${API_BASE_URL}${endpoint}`, {...options, headers });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
};
function normalizeDate(dateStr) { if (!dateStr) return ""; if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr; if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) { const [day, month, year] = dateStr.split("/"); return `${year}-${month}-${day}`; } return dateStr; }
const formatMonthLabel = (key) => { const [year, month] = key.split('-'); const date = new Date(year, month - 1); return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }); };

function Dashboard({ isDarkMode, setIsDarkMode }) {
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [newTransactions, setNewTransactions] = useState([{ date: "", type: "Expense", category: "", description: "", amount: "" }]);
  const [currency, setCurrency] = useState("USD");
  const [businessName, setBusinessName] = useState("");
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const [businessMemory, setBusinessMemory] = useState(null);
  const [showDetailed, setShowDetailed] = useState(false);
  const formRef = useRef(null);
  const itemsPerPage = 10;

  const glassCard = isDarkMode? "bg-gray-800 border border-white/10 text-white" : "bg-white border border-gray-200 text-gray-900 shadow-sm";
  const glassInput = isDarkMode? "border border-white/20 rounded-xl px-4 py-3 bg-gray-700 text-white text-base font-medium focus:ring-2 focus:ring-teal-500 outline-none" : "border border-gray-300 rounded-xl px-4 py-3 bg-white text-gray-900 text-base font-medium focus:ring-2 focus:ring-teal-500 outline-none";
  const kpiBase = `${glassCard} p-6 rounded-2xl shadow-lg border-t-4 hover:scale-[1.02] transition cursor-pointer`;
  const todayCard = isDarkMode? "bg-gray-800 border border-yellow-500/20 text-yellow-100 p-6 rounded-[20px] mb-6 shadow-lg" : "bg-[#fef08a] border-2 border-gray-900 p-6 rounded-[20px] shadow-xl mb-6 text-gray-900";
  const yellowCardDark = isDarkMode? "bg-gray-800 border border-white/10 text-white" : "bg-[#fef08a] border-2 border-gray-900 text-gray-900";

  useEffect(() => { const token = localStorage.getItem("token"); if (!token) { setTransactions([]); window.location.href = "/login"; } }, []);
  const loadEntries = useCallback(() => { apiFetch("/entries").then(data => setTransactions(Array.isArray(data)? data : [])).catch(err => console.error("Error fetching entries:", err)); }, []);
  useEffect(() => { loadEntries(); }, [loadEntries]);
  useEffect(() => { apiFetch("/categories").then(data => setCategories(Array.isArray(data)? data : [])).catch(() => { }); }, []);
  useEffect(() => {
    const token = localStorage.getItem("token"); if (!token) return;
    fetch(`${API_BASE_URL}/settings`, { headers: { Authorization: "Bearer " + token } }).then(res => res.json()).then(data => {
      setCurrency(data.currency || "USD");
      setBusinessName(data.business_name || "");
    }).catch(() => setCurrency("USD"));
    fetch(`${API_BASE_URL}/business-memory`, { headers: { Authorization: "Bearer " + token } }).then(res => res.json()).then(data => { if(data &&!data.error) setBusinessMemory(data); }).catch(()=>{});
  }, []);

  const handleAddRow = () => setNewTransactions([...newTransactions, { date: "", type: "Expense", category: "", description: "", amount: "" }]);
  const handleChange = (i, f, v) => { const u = [...newTransactions]; u[i][f] = v; setNewTransactions(u); };
  const handleOpenForm = () => { setShowForm(true); setTimeout(() => { formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100); };
  const handleSaveAll = (e) => {
    e.preventDefault();
    const formatted = newTransactions.map(t => ({...t, date: normalizeDate(t.date), type: t.type.toLowerCase(), category: normalizeCategory(t.category), amount: parseFloat(t.amount) || 0 }));
    apiFetch("/add", { method: "POST", body: JSON.stringify(formatted) }).then(() => { loadEntries(); setNewTransactions([{ date: "", type: "Expense", category: "", description: "", amount: "" }]); setShowForm(false); });
  };
  const handleCSVUpload = (e) => {
    const file = e.target.files[0]; if (!file) return;
    Papa.parse(file, { header: true, skipEmptyLines: true, complete: (results) => {
      const parsed = results.data.filter(r => r.Date && r.Amount).map(r => ({
        date: normalizeDate(r.Date.trim()), type: r.Type.trim().toLowerCase(), category: normalizeCategory(r.Category.trim()),
        description: r.Description.trim(), amount: parseFloat(r.Amount.replace(/[^0-9.-]/g, "")) || 0
      }));
      apiFetch("/add", { method: "POST", body: JSON.stringify(parsed) }).then(() => { loadEntries(); });
    }});
  };
  const editTransaction = (id) => { const entry = transactions.find(t => t.id === id); if (!entry) return; const newDescription = prompt("Edit description:", entry.description); if (newDescription === null) return; apiFetch("/edit_entry", { method: "PUT", body: JSON.stringify({...entry, description: newDescription }) }).then(() => { loadEntries(); }); };
  const deleteTransaction = (id) => { if (!window.confirm("Delete this transaction?")) return; apiFetch("/delete_entry", { method: "DELETE", body: JSON.stringify({ id }) }).then(() => { loadEntries(); }); };
  const exportPDF = async () => { const input = document.getElementById('dashboard-to-pdf'); const canvas = await html2canvas(input, { scale: 2, backgroundColor: isDarkMode? '#111827' : '#ffffff' }); const imgData = canvas.toDataURL('image/png'); const pdf = new jsPDF('p', 'mm', 'a4'); const pdfWidth = pdf.internal.pageSize.getWidth(); const pdfHeight = (canvas.height * pdfWidth) / canvas.width; pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight); pdf.save(`Financial-Report-${new Date().toLocaleDateString()}.pdf`); };
  const exportCSV = () => { const csv = Papa.unparse(filteredTransactions); const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.setAttribute('download', `transactions-${new Date().toLocaleDateString()}.csv`); document.body.appendChild(link); link.click(); document.body.removeChild(link); };

  const { totalRevenue, totalExpenses, netProfit, profitMargin } = useMemo(() => {
    const rev = transactions.filter(t => t.type?.toLowerCase() === "income").reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const exp = transactions.filter(t => t.type?.toLowerCase() === "expense").reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const profit = rev - exp; const margin = rev > 0? (profit / rev) * 100 : 0;
    return { totalRevenue: rev, totalExpenses: exp, netProfit: profit, profitMargin: margin };
  }, [transactions]);

  const monthlyData = useMemo(() => { const data = {}; transactions.forEach(t => { if (!t.date) return; const key = t.date.slice(0, 7); if (!data[key]) data[key] = { income: 0, expense: 0 }; const amt = Number(t.amount || 0); if (t.type?.toLowerCase() === "income") data[key].income += amt; else if (t.type?.toLowerCase() === "expense") data[key].expense += amt; }); return data; }, [transactions]);
  const realMonthsCount = useMemo(() => Object.keys(monthlyData).length || businessMemory?.total_months || 0, [monthlyData, businessMemory]);
  const allMonthKeys = useMemo(() => Object.keys(monthlyData).sort(), [monthlyData]);

  const categoryData = useMemo(() => { const data = {}; transactions.filter(t => t.type?.toLowerCase() === "expense").forEach(t => { const cat = normalizeCategory(t.category); data[cat] = (data[cat] || 0) + Number(t.amount || 0); }); return data; }, [transactions]);
  const topExpense = useMemo(() => { const entries = Object.entries(categoryData).sort((a,b)=>b[1]-a[1]); return entries[0] || null; }, [categoryData]);
  const filterByType = (type) => { setFilterType(type); setCurrentPage(1); document.getElementById('transactions-table')?.scrollIntoView({ behavior: 'smooth' }); };

  const bestMove = useMemo(() => {
    const fallbackCat = businessMemory?.top_expense_category || (topExpense?.[0] || "costs");
    const fallbackAmt = businessMemory?.top_expense_amount || (topExpense?.[1] || totalExpenses);
    const saving = Math.round(fallbackAmt * 0.30);
    const pct = businessMemory?.top_expense_percent? businessMemory.top_expense_percent.toFixed(0) : (totalExpenses>0? ((fallbackAmt/totalExpenses)*100).toFixed(0) : "0");
    const totalExpReal = businessMemory?.total_expense || totalExpenses;
    return { action: `Reduce ${fallbackCat} Costs`, savings: saving, difficulty: "Easy", impact: "High", reason: `${fallbackCat} is ${pct}% of ${formatAmountPlain(totalExpReal, currency)} total spending` };
  }, [topExpense, totalExpenses, businessMemory, currency]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    const g = h < 12? "Good morning" : h < 18? "Good afternoon" : "Good evening";
    const namePart = businessName? ` ${businessName}` : (businessMemory?.business_name? ` ${businessMemory.business_name}` : "");
    const historyText = realMonthsCount? `${realMonthsCount} ${realMonthsCount===1?"Month":"Months"} history` : `${businessMemory?.total_months || 0} Months history`;
    const totalExpReal = businessMemory?.total_expense || totalExpenses;
    const lastExpReal = businessMemory?.last_month_expense || 0;
    if (netProfit < 0) return `${g}${namePart}. Your business is losing ${formatAmountPlain(Math.abs(netProfit), currency)}/month. Total expense ${formatAmountPlain(totalExpReal, currency)}, last month ${formatAmountPlain(lastExpReal, currency)}. Biggest cost is ${topExpense?.[0] || businessMemory?.top_expense_category || "costs"} — ${historyText}.`;
    return `${g}${namePart}. You made ${formatAmountPlain(netProfit, currency)} profit. You keep ${profitMargin.toFixed(0)}% from every ${formatAmountPlain(100, currency)} you sell — ${historyText}. Total expense ${formatAmountPlain(totalExpReal, currency)}, last month ${formatAmountPlain(lastExpReal, currency)}.`;
  }, [netProfit, currency, topExpense, profitMargin, realMonthsCount, businessName, businessMemory, totalExpenses]);

  const topFixes = useMemo(() => {
    const fixes = [];
    const realTopCat = topExpense?.[0] || businessMemory?.top_expense_category;
    const realTopAmt = topExpense?.[1] || businessMemory?.top_expense_amount || 0;
    const realTotalExp = businessMemory?.total_expense || totalExpenses;
    const realTotalRev = businessMemory?.total_income || totalRevenue;
    if (realTopCat) fixes.push({ title: `Cut ${realTopCat} Costs by 30%`, save: formatAmountPlain(realTopAmt*0.3, currency)+"/mo", diff: "Easy", impact: "High", detail: `${realTopCat} is ${businessMemory?.top_expense_percent?.toFixed(0) || ((realTopAmt/realTotalExp)*100).toFixed(0)}% of ${formatAmountPlain(realTotalExp, currency)}` });
    if (businessMemory?.weakest_day) fixes.push({ title: `Fix ${businessMemory.weakest_day} sales — promo that day`, save: formatAmountPlain(realTotalRev*0.08, currency)+"/mo", diff: "Medium", impact: "High", detail: `${businessMemory.weakest_day} ${formatAmountPlain(businessMemory.weakest_day_income, currency)} vs ${businessMemory.busiest_day} ${formatAmountPlain(businessMemory.busiest_day_income, currency)}` });
    if (businessMemory?.busiest_day) fixes.push({ title: `Invest more on ${businessMemory.busiest_day}`, save: formatAmountPlain(realTotalRev*0.1, currency)+"/mo", diff: "Easy", impact: "High", detail: `${businessMemory.busiest_day} brings ${formatAmountPlain(businessMemory.busiest_day_income, currency)}` });
    return fixes.slice(0,3);
  }, [topExpense, businessMemory, totalRevenue, currency, totalExpenses]);

  const chartData = useMemo(() => ({ labels: allMonthKeys.map(formatMonthLabel), datasets: [ { label: "Revenue", data: allMonthKeys.map(k => monthlyData[k]?.income || 0), backgroundColor: "#10B981", borderColor: "#059669", borderWidth: 2, borderRadius: 8 }, { label: "Expenses", data: allMonthKeys.map(k => monthlyData[k]?.expense || 0), backgroundColor: "#F43F5E", borderColor: "#E11D48", borderWidth: 2, borderRadius: 8 }, ], }), [allMonthKeys, monthlyData]);
  const categoryChartData = useMemo(() => ({ labels: Object.keys(categoryData), datasets: [{ label: "Expenses by Category", data: Object.values(categoryData), backgroundColor: ["#F43F5E", "#3B82F6", "#10B981", "#8B5CF6", "#F59E0B", "#EC4899"], borderColor: isDarkMode? "#1F2937" : "#fff", borderWidth: 3, hoverOffset: 12, cutout: '60%' }], }), [categoryData, isDarkMode]);
  const profitTrendData = useMemo(() => ({ labels: allMonthKeys.map(formatMonthLabel), datasets: [{ label: "Net Profit", data: allMonthKeys.map(k => (monthlyData[k]?.income || 0) - (monthlyData[k]?.expense || 0)), borderColor: isDarkMode? "#60A5FA" : "#2563EB", backgroundColor: isDarkMode? "rgba(96,165,250,0.2)" : "rgba(37,99,235,0.15)", borderWidth: 4, tension: 0.4, fill: true, pointRadius: 6, pointBorderWidth: 3, segment: { borderColor: ctx => ctx.p0.parsed.y < 0 || ctx.p1.parsed.y < 0? '#F43F5E' : (isDarkMode? "#60A5FA" : "#2563EB") } }], }), [allMonthKeys, monthlyData, isDarkMode]);

  const textColor = isDarkMode? '#F9FAFB' : '#111827'; const gridColor = isDarkMode? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
  const options = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "top", labels: { color: textColor, font: { size: 14, weight: 'bold' }, padding: 20 } }, title: { display: true, text: "Revenue vs Expenses", color: textColor, font: { size: 20, weight: 'bold' }, padding: 20 }, tooltip: { backgroundColor: isDarkMode? '#1F2937' : '#FFFFFF', titleColor: textColor, bodyColor: textColor, callbacks: { label: (c) => `${c.dataset.label}: ${formatAmount(c.parsed.y, currency)}` } } }, scales: { y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor, font: { size: 13 }, callback: (v) => formatAmount(v, currency) } }, x: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 13 }, maxRotation: 45, minRotation: 45 } } } };
  const categoryOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "right", labels: { color: textColor, font: { size: 14 } } }, title: { display: true, text: "Expenses by Category", color: textColor, font: { size: 20, weight: 'bold' } }, tooltip: { callbacks: { label: (c) => `${c.label}: ${formatAmount(c.parsed, currency)}` } } } };
  const profitOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "top", labels: { color: textColor } }, title: { display: true, text: "Net Profit Trend", color: textColor, font: { size: 20, weight: 'bold' } }, tooltip: { callbacks: { label: (c) => `Net Profit: ${formatAmount(c.parsed.y, currency)}` } } }, scales: { y: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 13 }, callback: (v) => formatAmount(v, currency) } }, x: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 13 }, maxRotation: 45, minRotation: 45 } } } };

  const filteredTransactions = useMemo(() => { return transactions.filter(tx => { const matchesSearch = tx.description.toLowerCase().includes(searchTerm.toLowerCase()) || tx.category.toLowerCase().includes(searchTerm.toLowerCase()); const matchesType = filterType === 'all' || tx.type?.toLowerCase() === filterType; const txDate = new Date(tx.date); const matchesDate = (!dateRange.start || txDate >= new Date(dateRange.start)) && (!dateRange.end || txDate <= new Date(dateRange.end)); return matchesSearch && matchesType && matchesDate; }); }, [transactions, searchTerm, filterType, dateRange]);
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const paginatedTransactions = filteredTransactions.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const highlightText = (text) => { if (!searchTerm) return text; const parts = String(text).split(new RegExp(`(${searchTerm})`, 'gi')); return parts.map((part, i) => part.toLowerCase() === searchTerm.toLowerCase()? <span key={i} className="bg-yellow-300 text-black px-1 rounded">{part}</span> : part); };

  const calcRunway = useMemo(() => { const sortedKeys = Object.keys(monthlyData).sort().slice(-3); if (sortedKeys.length === 0) return businessMemory?.total_expense? 'Many' : 'N/A'; const avgBurn = sortedKeys.reduce((s, k) => s + (monthlyData[k]?.expense || 0), 0) / sortedKeys.length; const cashLeft = totalRevenue - totalExpenses; if (cashLeft <= 0) return '0'; if (avgBurn === 0) return 'Many'; return `${(cashLeft / avgBurn).toFixed(1)}`; }, [monthlyData, totalRevenue, totalExpenses, businessMemory]);

  const hundredUnit = formatAmountPlain(100, currency);

  return (
    <div id="dashboard-to-pdf" className={isDarkMode? "bg-gray-900 text-white min-h-screen p-6" : "bg-[#f6f7f9] text-gray-900 min-h-screen p-6"}>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-4xl font-black tracking-tight flex items-center gap-3">My Business <span className="flex items-center text-sm font-bold bg-green-100 text-green-700 px-3 py-1 rounded-full"><FaShieldAlt className="mr-1" /> Secure • Encrypted</span></h1>
          <p className="text-base opacity-70 mt-1 font-medium">{realMonthsCount? `${realMonthsCount} Months history` : `${businessMemory?.total_months || 0} Months history`} {businessMemory?.busiest_day? `• Best ${businessMemory.busiest_day} ${formatAmountPlain(businessMemory.busiest_day_income, currency)}` : ""} {businessMemory?.weakest_day? `• Needs attention ${businessMemory.weakest_day} ${formatAmountPlain(businessMemory.weakest_day_income, currency)}` : ""}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={exportPDF} className="flex items-center px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-base font-bold"><FaDownload className="mr-2" /> PDF</button>
          <button onClick={exportCSV} className="flex items-center px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-base font-bold"><FaDownload className="mr-2" /> CSV</button>
          <a href={`${API_BASE_URL}/sample_csv`} className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-base font-bold">Sample CSV</a>
          <label className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl cursor-pointer text-base font-bold">Upload CSV<input type="file" accept=".csv" onChange={handleCSVUpload} className="hidden" /></label>
          <button onClick={handleOpenForm} className="flex items-center px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-base font-bold shadow-md"><FaPlus className="mr-2" /> Add</button>
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="px-4 py-2.5 bg-gray-800 hover:bg-gray-900 text-white rounded-xl text-base font-bold">Toggle {isDarkMode? "Light" : "Dark"}</button>
        </div>
      </div>

      {businessMemory && (
        <div className={todayCard}>
          <h2 className="text-xs font-black uppercase tracking-widest flex items-center gap-2"><FaLightbulb/> TODAY IN YOUR BUSINESS</h2>
          <p className="text-lg font-black mt-3 leading-snug">{greeting}</p>
          <p className="text-sm font-bold mt-2">
            {topExpense? `Biggest cost is ${topExpense[0]} (${((topExpense[1]/totalExpenses)*100).toFixed(0)}% of ${formatAmountPlain(businessMemory?.total_expense || totalExpenses, currency)}).` : `Biggest cost is ${businessMemory.top_expense_category} (${businessMemory.top_expense_percent?.toFixed(0)}% of ${formatAmountPlain(businessMemory.total_expense, currency)}).`}
            {businessMemory.busiest_day? ` Busiest day is ${businessMemory.busiest_day} ${formatAmountPlain(businessMemory.busiest_day_income, currency)}.` : ""}
            {businessMemory.weakest_day? ` Weakest day is ${businessMemory.weakest_day} ${formatAmountPlain(businessMemory.weakest_day_income, currency)}.` : ""}
          </p>
        </div>
      )}

      <div className={`${glassCard} p-6 rounded-[20px] shadow-xl mb-6`}>
        <h2 className="text-xs font-black uppercase tracking-widest flex items-center gap-2"><FaBullseye className="text-indigo-500"/> TODAY'S BEST MOVE</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
          <div className={yellowCardDark + " p-4 rounded-xl"}>
            <p className="text-[10px] uppercase font-black tracking-widest opacity-60">REDUCE FIRST</p>
            <p className="text-[15px] font-black mt-1 leading-tight">{bestMove.action}</p>
            <p className="text-[11px] font-bold opacity-70 mt-1">{bestMove.reason}</p>
          </div>
          <div className={`${glassCard} p-4 rounded-xl border-2`}>
            <p className="text-[10px] uppercase font-black opacity-60 tracking-widest">EXPECTED SAVINGS</p>
            <p className="text-[15px] font-black mt-1 text-green-500">{formatAmountPlain(bestMove.savings, currency)}/month</p>
            <p className="text-[11px] font-bold mt-1 opacity-70">{formatAmountPlain(bestMove.savings*12, currency)}/year</p>
          </div>
          <div className={`${glassCard} p-4 rounded-xl border-2`}>
            <p className="text-[10px] uppercase font-black opacity-60 tracking-widest">DIFFICULTY</p>
            <p className="text-[15px] font-black mt-1">{bestMove.difficulty}</p>
            <p className="text-[11px] font-bold mt-1 opacity-70">No loan needed</p>
          </div>
          <div className={`${isDarkMode? "bg-green-600 border-green-600" : "bg-green-600 border-gray-900"} text-white border-2 p-4 rounded-xl`}>
            <p className="text-[10px] uppercase font-black tracking-widest opacity-80">IMPACT</p>
            <p className="text-[15px] font-black mt-1">{bestMove.impact}</p>
            <p className="text-[11px] font-bold mt-1">Do this today →</p>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <a href="/forecast?goal=costs" className="px-5 py-2.5 bg-gray-900 text-white rounded-full text-xs font-black border-2 border-black">Fix in Business Coach →</a>
          <a href="/alerts" className={`px-5 py-2.5 rounded-full text-xs font-black border-2 ${isDarkMode? "bg-white text-black border-white" : "bg-white border-gray-900 text-black"}`}>See All Alerts</a>
        </div>
      </div>

      <div className={`${glassCard} p-6 rounded-2xl shadow-lg mb-8 border-l-4 border-cyan-500`}>
        <h2 className="text-xl font-extrabold mb-4 flex items-center gap-2"><FaLightbulb className="text-cyan-500"/> What I Learned About Your Business</h2>
        {(() => {
          const thisKey = businessMemory?.this_month_key || allMonthKeys[allMonthKeys.length - 1];
          const lastKey = businessMemory?.last_month_key || allMonthKeys[allMonthKeys.length - 2];
          const thisExp = businessMemory?.this_month_expense?? (thisKey? monthlyData[thisKey]?.expense || 0 : 0);
          const lastExp = businessMemory?.last_month_expense?? (lastKey? monthlyData[lastKey]?.expense || 0 : 0);
          const totalExp = businessMemory?.total_expense?? totalExpenses;
          const totalInc = businessMemory?.total_income?? totalRevenue;
          let changeText = "";
          if (lastExp > 0) {
            const pct = ((thisExp - lastExp) / lastExp) * 100;
            changeText = `(${pct >= 0? 'Up' : 'Down'} ${Math.abs(pct).toFixed(1)}% vs last month ${formatAmount(lastExp, currency)} ${lastKey? `(${lastKey})` : ""})`;
          } else if (thisExp > 0) {
            changeText = `(First month with expenses)`;
          }
          return (
            <div className="space-y-3 text-base leading-relaxed font-medium">
              <p>• Your biggest spending this month: <span className="font-bold">{formatAmount(thisExp, currency)}</span> {thisKey? `in ${thisKey}` : ""} {changeText}</p>
              <p>• Last month expense: <span className="font-bold">{formatAmount(lastExp, currency)}</span> {lastKey? `(${lastKey})` : ""} • Total expense all time: <span className="font-bold">{formatAmount(totalExp, currency)}</span> • Total income: <span className="font-bold">{formatAmount(totalInc, currency)}</span></p>
              {businessMemory?.weakest_day && businessMemory?.busiest_day && <p>• I noticed: Sales are weakest on {businessMemory.weakest_day} {formatAmountPlain(businessMemory.weakest_day_income, currency)} and strongest on {businessMemory.busiest_day} {formatAmountPlain(businessMemory.busiest_day_income, currency)}.</p>}
              {topExpense && <p>• I noticed: {topExpense[0]} is your largest cost — {((topExpense[1]/totalExpenses)*100).toFixed(0)}% of {formatAmount(totalExp, currency)}.</p>}
              {businessMemory?.top_income_category && <p>• Best income category: {businessMemory.top_income_category}.</p>}
              <div className={`${isDarkMode? "bg-gray-900 border-white/10 text-white" : "bg-yellow-100 border-yellow-300 text-gray-900"} border p-3 rounded-xl text-sm font-bold`}>
                Summary: {realMonthsCount} months history • {businessMemory?.top_expense_category || topExpense?.[0]} is largest expense {formatAmountPlain(businessMemory?.top_expense_amount || topExpense?.[1] || 0, currency)} • Total {formatAmount(totalExp, currency)} • Last month {formatAmount(lastExp, currency)} • Focus on {businessMemory?.busiest_day || "your best day"} {businessMemory?.busiest_day_income? formatAmountPlain(businessMemory.busiest_day_income, currency) : ""}
              </div>
            </div>
          )
        })()}
      </div>

      <div className={`${glassCard} p-6 rounded-2xl shadow-lg mb-8 border-l-4 border-red-500`}>
        <h2 className="text-xl font-extrabold mb-4 flex items-center gap-2"><FaExclamationTriangle className="text-red-500"/> Top 3 Things To Fix — Based on your data</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {topFixes.map((f,i)=>(
            <div key={i} className={`${glassCard} border-2 p-4 rounded-xl`}>
              <p className="text-xs font-black uppercase opacity-60">#{i+1} Fix</p>
              <p className="text-sm font-black mt-1">{f.title}</p>
              <p className="text-xs mt-2"><span className="font-black">Save:</span> {f.save} • {f.detail}</p>
              <p className="text-xs"><span className="font-black">Work:</span> {f.diff} • <span className="font-black">Impact:</span> {f.impact}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <AskMyBusiness transactions={transactions} totalRevenue={totalRevenue} totalExpenses={totalExpenses} topExpense={topExpense} horizon={12} currency={currency} realRunway={calcRunway} profitMargin={profitMargin} businessMemory={businessMemory} context="dashboard" isDarkMode={isDarkMode} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-5 mb-8">
        <div onClick={() => filterByType('income')} className={`${kpiBase} border-green-500`}><div className="flex justify-between items-center"><span className="text-base font-bold opacity-90 tracking-wide">Total Money In</span><FaArrowUp className="text-green-500 text-lg" /></div><p className="text-3xl font-black mt-3 tracking-tight">{formatAmount(totalRevenue, currency)}</p><p className="text-xs mt-1 opacity-60">All sales — {realMonthsCount} months • {businessMemory?.top_income_category || ""}</p></div>
        <div onClick={() => filterByType('expense')} className={`${kpiBase} border-red-500`}><div className="flex justify-between items-center"><span className="text-base font-bold opacity-90 tracking-wide">Total Money Out</span><FaArrowDown className="text-red-500 text-lg" /></div><p className="text-3xl font-black mt-3 tracking-tight">{formatAmount(totalExpenses, currency)}</p><p className="text-xs mt-1 opacity-60">All spending • Last {formatAmount(businessMemory?.last_month_expense || 0, currency)}</p></div>
        <div onClick={() => filterByType('all')} className={`${kpiBase} border-blue-500`}><div className="flex justify-between items-center"><span className="text-base font-bold opacity-90 tracking-wide">Money Left</span><FaBalanceScale className="text-blue-500 text-lg" /></div><p className="text-3xl font-black mt-3 tracking-tight">{formatAmount(netProfit, currency)}</p><p className="text-xs mt-1 opacity-70 font-bold">{netProfit>=0? `For every ${hundredUnit} you sell, you keep ${profitMargin.toFixed(0)}%` : `Losing ${Math.abs(profitMargin).toFixed(0)}% per ${hundredUnit}`} • Total {formatAmount(businessMemory?.total_expense || totalExpenses, currency)}</p></div>
        <div className={`${kpiBase} border-purple-500`}><div className="flex justify-between items-center"><span className="text-base font-bold opacity-90 tracking-wide">For Every {hundredUnit} You Sell</span><FaPercentage className="text-purple-500 text-lg" /></div><p className="text-3xl font-black mt-3 tracking-tight">{profitMargin>=0? `You Keep ${formatAmountPlain(profitMargin, currency)}` : `You Lose ${formatAmountPlain(Math.abs(profitMargin),currency)}`}</p><p className="text-xs mt-1 opacity-70 font-bold">{profitMargin>=0? `You keep ${profitMargin.toFixed(0)}%` : `You lose ${Math.abs(profitMargin).toFixed(0)}%`} • Busiest {businessMemory?.busiest_day || ""}</p></div>
        <div className={`${kpiBase} border-orange-500`}><div className="flex justify-between items-center"><span className="text-base font-bold opacity-90 tracking-wide">Cash Left</span><FaBalanceScale className="text-orange-500 text-lg" /></div><p className="text-3xl font-black mt-3 tracking-tight">{calcRunway==="N/A"? "N/A" : calcRunway==="0"? "None" : `${calcRunway} Months`}</p><p className="text-sm mt-1 font-bold opacity-80">{netProfit<=0? "No cash left — action needed" : `${realMonthsCount} months average • Total ${formatAmount(businessMemory?.total_expense || totalExpenses, currency)}`}</p></div>
      </div>

      <div className={`${glassCard} p-4 rounded-2xl shadow-lg mb-8`}>
        <button onClick={()=>setShowDetailed(!showDetailed)} className="w-full flex items-center justify-between p-4 text-lg font-black">
          <span>{showDetailed? "Hide Detailed Reports" : "View Detailed Reports — For Accountants"} </span>
          {showDetailed? <FaChevronUp/> : <FaChevronDown/>}
        </button>
        {showDetailed && (
          <div className="mt-4 space-y-8">
            <div className={`${glassCard} p-6 rounded-2xl shadow-lg`}><div style={{ height: '400px' }}><Bar data={chartData} options={options} /></div></div>
            <div className={`${glassCard} p-6 rounded-2xl shadow-lg`}><div style={{ height: '400px' }}><Doughnut data={categoryChartData} options={categoryOptions} /></div></div>
            <div className={`${glassCard} p-6 rounded-2xl shadow-lg`}><div style={{ height: '400px' }}><Line data={profitTrendData} options={profitOptions} /></div></div>
          </div>
        )}
      </div>

      {showForm && (<div ref={formRef} className={`${glassCard} p-6 rounded-2xl mb-8 shadow-lg border-2 border-teal-500`}><h2 className="text-2xl font-bold mb-5">New Transactions - Daily Operations</h2><form onSubmit={handleSaveAll} className="space-y-4">{newTransactions.map((t, index) => (<div key={index} className="grid grid-cols-1 md:grid-cols-5 gap-3"><input type="date" value={t.date} onChange={(e) => handleChange(index, "date", e.target.value)} className={glassInput} required /><select value={t.type} onChange={(e) => handleChange(index, "type", e.target.value)} className={glassInput}><option>Expense</option><option>Income</option></select><select value={t.category} onChange={(e) => handleChange(index, "category", e.target.value)} className={glassInput} required><option value="">Select Category</option>{categories.filter(c => c.type === (t.type?.toLowerCase() || "expense")).map(cat => (<option key={cat.id} value={cat.name}>{cat.name}</option>))}</select><input type="text" placeholder="Description" value={t.description} onChange={(e) => handleChange(index, "description", e.target.value)} className={glassInput} required /><input type="number" placeholder="Amount" value={t.amount} onChange={(e) => handleChange(index, "amount", e.target.value)} className={glassInput} required /></div>))}<div className="flex gap-3 mt-5"><button type="button" onClick={handleAddRow} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-base font-bold">Add Row</button><button type="button" onClick={() => setShowForm(false)} className="px-5 py-2.5 bg-gray-400 text-white rounded-xl text-base font-bold">Cancel</button><button type="submit" className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-base font-bold">Save</button></div></form></div>)}

      <div id="transactions-table" className={`${glassCard} p-6 rounded-2xl shadow-lg`}>
        <h2 className="text-2xl font-bold mb-5">Recent Transactions - Daily Operations</h2>
        <div className="flex gap-3 mb-5 flex-wrap">
          <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} className={glassInput} />
          <select value={filterType} onChange={(e) => { setFilterType(e.target.value); setCurrentPage(1); }} className={glassInput}><option value="all">All Types</option><option value="income">Income</option><option value="expense">Expense</option></select>
          <input type="date" value={dateRange.start} onChange={(e) => { setDateRange({...dateRange, start: e.target.value }); setCurrentPage(1); }} className={glassInput} />
          <input type="date" value={dateRange.end} onChange={(e) => { setDateRange({...dateRange, end: e.target.value }); setCurrentPage(1); }} className={glassInput} />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-base">
            <thead><tr className={isDarkMode? "border-b border-white/10 bg-white/5" : "border-b bg-black/5"}><th className="py-4 px-4 font-bold">Date</th><th className="py-4 px-4 font-bold">Type</th><th className="py-4 px-4 font-bold">Category</th><th className="py-4 px-4 font-bold">Description</th><th className="py-4 px-4 font-bold">Amount</th><th className="py-4 px-4 font-bold">Actions</th></tr></thead>
            <tbody>{paginatedTransactions.length > 0? (paginatedTransactions.map((t, idx) => (<tr key={t.id || idx} className={isDarkMode? `border-b border-white/5 hover:bg-white/5` : `border-b hover:bg-black/5`}><td className="py-4 px-4 font-medium">{t.date}</td><td className="py-4 px-4"><span className={`px-3 py-1 rounded-full text-sm font-bold ${t.type?.toLowerCase() === "income"? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{t.type}</span></td><td className="py-4 px-4 font-medium">{highlightText(normalizeCategory(t.category))}</td><td className="py-4 px-4">{highlightText(t.description)}</td><td className="py-4 px-4 font-bold text-base">{formatAmount(t.amount, currency)}</td><td className="py-4 px-4 space-x-2"><button onClick={() => editTransaction(t.id)} className="px-4 py-1.5 bg-yellow-500 text-white rounded-lg text-sm font-bold">Edit</button><button onClick={() => deleteTransaction(t.id)} className="px-4 py-1.5 bg-red-500 text-white rounded-lg text-sm font-bold">Delete</button></td></tr>))) : (<tr><td colSpan="6" className="py-6 text-center text-base">No transactions found.</td></tr>)}</tbody>
          </table>
        </div>
        {filteredTransactions.length > itemsPerPage && (
          <div className="flex justify-between items-center mt-6 text-base font-medium">
            <p>Showing {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredTransactions.length)} of {filteredTransactions.length}</p>
            <div className="flex gap-3 items-center">
              <button onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1} className="px-4 py-2 bg-gray-600 text-white rounded-lg disabled:opacity-50">Prev</button>
              <span>Page {currentPage} of {totalPages}</span>
              <button onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages} className="px-4 py-2 bg-gray-600 text-white rounded-lg disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
export default Dashboard;