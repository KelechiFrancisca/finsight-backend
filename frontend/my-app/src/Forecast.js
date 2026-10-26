import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { Line, Bar } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend } from "chart.js";
import API_BASE_URL from "./apiConfig";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import AskMyBusiness from "./AskMyBusiness";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend);

const currencySymbols = { USD: "$", EUR: "€", GBP: "£", CAD: "C$", JPY: "¥", NGN: "₦", ZAR: "R", KES: "KSh", GHS: "₵", EGP: "£E", XOF: "CFA", XAF: "CFA" };
function formatAmount(amount, currency = "USD") {
  const symbol = currencySymbols[currency] || "";
  return `${symbol}${Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

const GOAL_OPTIONS = [
  { id: "profit", label: "Make More Money", question: "How do I make more money?" },
  { id: "cashflow", label: "Make Cash Last Longer", question: "How do I make my cash last longer?" },
  { id: "costs", label: "Spend Less", question: "How do I spend less?" },
  { id: "hire", label: "Hire Someone", question: "Can I hire someone now?" },
  { id: "branch", label: "Open Another Shop", question: "Can I open another shop?" },
  { id: "equipment", label: "Buy Equipment", question: "Can I buy equipment now?" },
  { id: "margin", label: "Keep 20 From 100", question: "How do I keep 20 from every 100 I sell?" },
  { id: "custom", label: "My Own Goal", question: "" },
];

function Forecast({ isDarkMode }) {
  const [transactions, setTransactions] = useState([]);
  const [activeTab, setActiveTab] = useState("trend");
  const [activeScenario, setScenario] = useState("Realistic");
  const [showModal, setShowModal] = useState(false);
  const [horizon, setHorizon] = useState(12);
  const [currency, setCurrency] = useState("USD");
  const [businessName, setBusinessName] = useState("");
  const [toast, setToast] = useState(null);
  const [costCutSlider, setCostCutSlider] = useState(10);
  const [goalInput, setGoalInput] = useState("");
  const [selectedGoal, setSelectedGoal] = useState("margin");
  const [goalResult, setGoalResult] = useState(null);
  const [businessMemory, setBusinessMemory] = useState(null);
  const [showWhy, setShowWhy] = useState(true);
  const [isBuilding, setIsBuilding] = useState(false);
  const reportRef = useRef();
  const yearRef = useRef();

  const glassCard = isDarkMode? "bg-gray-800 border border-white/10 text-white" : "bg-white border-2 border-gray-900 text-gray-900";
  const glassCardSoft = isDarkMode? "bg-gray-800/80 border border-white/10 text-white" : "bg-white border-2 border-gray-900 text-gray-900";

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { window.location.href = "/login"; return; }
    fetch(`${API_BASE_URL}/entries`, { headers: { Authorization: "Bearer " + token } }).then(r => r.json()).then(d => { if (Array.isArray(d)) setTransactions(d); }).catch(() => {});
    fetch(`${API_BASE_URL}/settings`, { headers: { Authorization: "Bearer " + token } }).then(r => r.json()).then(d => { setCurrency(d.currency || "USD"); setBusinessName(d.business_name || ""); }).catch(() => {});
    fetch(`${API_BASE_URL}/business-memory`, { headers: { Authorization: "Bearer " + token } }).then(r => r.json()).then(d => { if (d &&!d.error) setBusinessMemory(d); }).catch(() => {});
    const params = new URLSearchParams(window.location.search);
    const g = params.get("goal") || localStorage.getItem("coach_goal");
    if (g) {
      const found = GOAL_OPTIONS.find(x => x.id === g);
      if (found) { setSelectedGoal(found.id); setGoalInput(found.question); }
      localStorage.removeItem("coach_goal");
    }
  }, []);

  const totalRevenue = useMemo(() => transactions.filter(t => t.type?.toLowerCase() === "income").reduce((s, t) => s + Number(t.amount || 0), 0), [transactions]);
  const totalExpenses = useMemo(() => transactions.filter(t => t.type?.toLowerCase() === "expense").reduce((s, t) => s + Number(t.amount || 0), 0), [transactions]);
  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0? (netProfit / totalRevenue) * 100 : 0;
  const currentCash = netProfit;

  const { monthlyData, sortedMonths } = useMemo(() => {
    const data = {};
    transactions.forEach(t => {
      if (!t.date) return;
      const key = t.date.slice(0, 7);
      if (!data[key]) data[key] = { income: 0, expense: 0 };
      if (t.type?.toLowerCase() === "income") data[key].income += Number(t.amount || 0);
      else data[key].expense += Number(t.amount || 0);
    });
    return { monthlyData: data, sortedMonths: Object.keys(data).sort() };
  }, [transactions]);

  const realMonthsCount = sortedMonths.length || businessMemory?.total_months || 0;
  const avgMonthlyRevenue = businessMemory?.total_income? businessMemory.total_income / Math.max(businessMemory.total_months, 1) : totalRevenue / Math.max(realMonthsCount, 1);
  const avgMonthlyExpense = businessMemory?.total_expense? businessMemory.total_expense / Math.max(businessMemory.total_months, 1) : totalExpenses / Math.max(realMonthsCount, 1);
  const avgDailyIncome = businessMemory?.avg_daily_income || avgMonthlyRevenue / 30;

  const realRunwayData = useMemo(() => {
    const last3 = sortedMonths.slice(-3);
    if (last3.length === 0 &&!businessMemory) return { avg: 0, text: "No data yet", months: 0 };
    const avg = last3.length? last3.reduce((s, k) => s + (monthlyData[k]?.expense || 0), 0) / last3.length : avgMonthlyExpense;
    if (currentCash <= 0) return { avg, text: "No cash left", months: 0 };
    if (avg === 0) return { avg, text: "Many months", months: 99 };
    return { avg, text: `${(currentCash / avg).toFixed(1)} Months`, months: currentCash / avg };
  }, [sortedMonths, monthlyData, currentCash, businessMemory, avgMonthlyExpense]);

  const expenseByCategory = useMemo(() => {
    const map = {};
    transactions.filter(t => t.type?.toLowerCase() === "expense").forEach(t => { map[t.category || "Other"] = (map[t.category || "Other"] || 0) + Number(t.amount || 0); });
    if (Object.keys(map).length === 0 && businessMemory?.spending_pattern) return businessMemory.spending_pattern;
    return map;
  }, [transactions, businessMemory]);

  const topExpense = useMemo(() => Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1])[0] || [businessMemory?.top_expense_category || "costs", businessMemory?.top_expense_amount || 0], [expenseByCategory, businessMemory]);

  const scenarios = { Optimistic: { revenueChange: 10, expenseChange: 3 }, Realistic: { revenueChange: 5, expenseChange: 2 }, Pessimistic: { revenueChange: 2, expenseChange: 5 } };
  const scenario = scenarios[activeScenario];

  const monthsAhead = useMemo(() => Array.from({ length: horizon }, (_, i) => { const d = new Date(); d.setMonth(d.getMonth() + i + 1); return d.toLocaleString("default", { month: "short", year: "numeric" }); }), [horizon]);

  const projectedRevenue = useMemo(() => monthsAhead.map((_, i) => avgMonthlyRevenue * Math.pow(1 + scenario.revenueChange / 100, i + 1)), [monthsAhead, avgMonthlyRevenue, scenario.revenueChange]);
  const projectedExpenses = useMemo(() => monthsAhead.map((_, i) => avgMonthlyExpense * Math.pow(1 + scenario.expenseChange / 100, i + 1)), [monthsAhead, avgMonthlyExpense, scenario.expenseChange]);
  const projectedProfit = useMemo(() => projectedRevenue.map((rev, i) => rev - projectedExpenses[i]), [projectedRevenue, projectedExpenses]);
  const cumulativeCash = useMemo(() => projectedProfit.reduce((acc, profit, i) => { const prev = i === 0? currentCash : acc[i - 1]; acc.push(prev + profit); return acc; }, []), [projectedProfit, currentCash]);
  const cutAmount = (topExpense?.[1] || 0) * (costCutSlider / 100);
  const newRunway = useMemo(() => { const simBurn = Math.max(realRunwayData.avg - cutAmount, 0); if (currentCash <= 0) return 0; if (simBurn === 0) return 999; return currentCash / simBurn; }, [realRunwayData.avg, cutAmount, currentCash]);

  const runOutMonthIndex = cumulativeCash.findIndex(c => c <= 0);
  const runOutMonth = runOutMonthIndex!== -1? monthsAhead[runOutMonthIndex] : `Not in next ${horizon} months`;
  const howStrong = Math.max(0, Math.min(100, Math.round((profitMargin / 60) * 100)));

  const busiestDay = businessMemory?.busiest_day || "Friday";
  const weakestDay = businessMemory?.weakest_day || "Thursday";
  const namePart = businessName || businessMemory?.business_name || "";

  const yearReview = useMemo(() => {
    const monthsToUse = sortedMonths.length? sortedMonths : businessMemory?.sorted_months || [];
    if (monthsToUse.length === 0) return null;
    const yearMap = {};
    monthsToUse.forEach(k => {
      const year = k.split("-")[0];
      if (!yearMap[year]) yearMap[year] = [];
      const data = monthlyData[k] || { income: 0, expense: 0 };
      yearMap[year].push({ month: k,...data, profit: (data.income || 0) - (data.expense || 0) });
    });
    const years = Object.keys(yearMap).sort();
    const currentYear = years[years.length - 1];
    const monthsInYear = yearMap[currentYear] || [];
    const totalYearIncome = monthsInYear.reduce((s, m) => s + (m.income || 0), 0);
    const totalYearExpense = monthsInYear.reduce((s, m) => s + (m.expense || 0), 0);
    const totalYearProfit = totalYearIncome - totalYearExpense;
    const bestMonth = [...monthsInYear].sort((a, b) => b.profit - a.profit)[0];
    const worstMonth = [...monthsInYear].sort((a, b) => a.profit - b.profit)[0];
    const all12 = [];
    for (let m = 1; m <= 12; m++) {
      const mm = String(m).padStart(2, "0");
      const key = `${currentYear}-${mm}`;
      const found = monthlyData[key];
      all12.push({ label: new Date(`${currentYear}-${mm}-01`).toLocaleString("default", { month: "short" }), key, income: found?.income || 0, expense: found?.expense || 0, profit: found? (found.income || 0) - (found.expense || 0) : 0, hasData:!!found });
    }
    return { year: currentYear, totalYearIncome, totalYearExpense, totalYearProfit, bestMonth, worstMonth, all12 };
  }, [sortedMonths, monthlyData, businessMemory]);

  const handleGoalCalc = useCallback(async (forcedGoal) => {
    const goalType = forcedGoal || selectedGoal;
    setIsBuilding(true);
    setToast("Building your plan...");
    try {
      const token = localStorage.getItem("token");
      await fetch(`${API_BASE_URL}/goal-plan`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify({ goal: goalInput, goal_type: goalType, horizon }) });
    } catch {}
    const realTopCat = topExpense?.[0] || businessMemory?.top_expense_category || "costs";
    const realTopAmt = topExpense?.[1] || businessMemory?.top_expense_amount || totalExpenses;
    const realTotalExp = businessMemory?.total_expense || totalExpenses;
    const realAvgBurn = realRunwayData.avg || avgMonthlyExpense;
    const realBusiestAvg = businessMemory?.busiest_day_avg || businessMemory?.busiest_day_income || 0;
    const realWeakestAvg = businessMemory?.weakest_day_avg || businessMemory?.weakest_day_income || 0;

    let whatsNeededText = "";
    let moneyNeeded = 0;
    let moneySave = 0;
    let difficulty = "Medium";
    let probability = 55 + realMonthsCount * 6;
    if (profitMargin > 0) probability += 8;

    if (goalType === "profit") {
      whatsNeededText = `Reduce ${realTopCat} by 10% and focus more sales on ${busiestDay}. You earn ${formatAmount(realBusiestAvg, currency)} on ${busiestDay} on average.`;
      moneyNeeded = 0;
      moneySave = realTopAmt * 0.1;
    }
    else if (goalType === "costs") {
      const pct = businessMemory?.top_expense_percent || (realTopAmt / Math.max(realTotalExp, 1) * 100);
      whatsNeededText = `Reduce ${realTopCat} by 20%. It is ${pct.toFixed(0)}% of your total spending (${formatAmount(realTopAmt, currency)}).`;
      moneyNeeded = 0;
      moneySave = realTopAmt * 0.2;
      difficulty = "Easy";
      probability += 10;
    }
    else if (goalType === "hire") {
      const staffCost = Math.round(realAvgBurn * 0.6) || Math.round(avgDailyIncome * 20);
      const canHire = netProfit > staffCost;
      whatsNeededText = canHire? `You can hire now. You have ${formatAmount(netProfit, currency)} left per month. Salary ${formatAmount(staffCost, currency)} leaves ${formatAmount(netProfit - staffCost, currency)}.` : `Wait 2 months. You need ${formatAmount(staffCost, currency)} for salary. Cut ${realTopCat} first.`;
      moneyNeeded = staffCost;
      moneySave = canHire? netProfit - staffCost : 0;
      probability = canHire? 85 : 45;
      difficulty = canHire? "Easy" : "High";
    }
    else if (goalType === "branch") {
      const branchCost = realTotalExp * 3;
      const canBranch = currentCash > branchCost;
      whatsNeededText = canBranch? `You have enough to open another shop. You have ${formatAmount(currentCash, currency)} and you need ${formatAmount(branchCost, currency)}.` : `You need ${formatAmount(branchCost, currency)} to open another shop. Save for ${Math.ceil(branchCost / Math.max(netProfit, 1))} months.`;
      moneyNeeded = branchCost;
      moneySave = canBranch? realTotalExp * 0.1 : 0;
      probability = canBranch? 78 : 40;
      difficulty = canBranch? "Medium" : "High";
    }
    else if (goalType === "equipment") {
      const equipCost = Math.round(realTopAmt * 1.2) || Math.round(avgMonthlyExpense * 2);
      whatsNeededText = `Equipment costs ${formatAmount(equipCost, currency)}. It will help reduce your ${realTopCat} spending.`;
      moneyNeeded = equipCost;
      moneySave = equipCost * 0.3;
      probability = 80;
    }
    else if (goalType === "cashflow") {
      whatsNeededText = `Focus sales on ${busiestDay}. You make ${formatAmount(realBusiestAvg, currency)} on ${busiestDay} compared to ${formatAmount(realWeakestAvg, currency)} on ${weakestDay}.`;
      moneyNeeded = 0;
      moneySave = (realBusiestAvg - realWeakestAvg);
    }
    else if (goalType === "margin") {
      if (profitMargin >= 20) whatsNeededText = `Great job. You keep ${profitMargin.toFixed(0)}% of every ${formatAmount(100, currency)} you sell. Your target was 20%.`;
      else whatsNeededText = `You keep ${profitMargin.toFixed(0)}% of every ${formatAmount(100, currency)} you sell. To reach 20%, cut ${realTopCat} by 10% to save ${formatAmount(realTopAmt * 0.1, currency)} per month.`;
      moneyNeeded = 0;
      moneySave = realTopAmt * 0.1;
    }
    else if (goalType === "custom") {
      const nums = goalInput.match(/\d+/g);
      let customCost = nums? parseInt(nums[0]) * (avgDailyIncome || 1000) : realTotalExp * 1.5;
      whatsNeededText = `"${goalInput}" will cost about ${formatAmount(customCost, currency)}. You have ${formatAmount(currentCash, currency)} now. ${currentCash >= customCost? "You can start now." : `Save for ${Math.ceil(customCost / Math.max(avgMonthlyRevenue, 1))} months.`}`;
      moneyNeeded = customCost;
      moneySave = currentCash >= customCost? currentCash - customCost : 0;
      difficulty = currentCash >= customCost? "Easy" : "Medium";
      probability = currentCash >= customCost? 90 : 60;
    }

    probability = Math.min(94, Math.max(35, probability));
    const busyDisplay = realBusiestAvg || businessMemory?.busiest_day_income || 40000;
const weakDisplay = realWeakestAvg || businessMemory?.weakest_day_income || 3300;
setGoalResult({ whatsNeededText, targetRevenue: moneyNeeded, moneySave, probability, difficulty, horizon, gap: moneyNeeded, memoryNote: `Best day: ${busiestDay} ${formatAmount(busyDisplay, currency)} average. Slowest: ${weakestDay} ${formatAmount(weakDisplay, currency)} average. Based on ${realMonthsCount} months of sales.` });
    setIsBuilding(false);
    setToast("Plan built!");
    setTimeout(() => setToast(null), 2000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [netProfit, totalExpenses, currency, topExpense, horizon, goalInput, selectedGoal, realMonthsCount, currentCash, busiestDay, weakestDay, profitMargin, avgMonthlyRevenue, businessMemory, avgMonthlyExpense, avgDailyIncome, realRunwayData]);

  useEffect(() => {
    if (totalRevenue > 0 || totalExpenses > 0) {
      handleGoalCalc();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalRevenue, totalExpenses]);

  const planA_save = (topExpense?.[1] || 0) * 0.1;
  const planC_total = planA_save;

  const chartTextColor = isDarkMode? "#F9FAFB" : "#111827";
  const chartOptions = { responsive: true, maintainAspectRatio: false, animation: { duration: 800 }, plugins: { legend: { labels: { font: { size: 14, weight: "bold" }, color: chartTextColor, padding: 16 } }, tooltip: { backgroundColor: isDarkMode? "#1F2937" : "#fff", titleColor: chartTextColor, bodyColor: chartTextColor } }, scales: { x: { ticks: { color: chartTextColor, font: { size: 12, weight: "bold" } }, grid: { color: isDarkMode? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)" } }, y: { ticks: { color: chartTextColor, font: { size: 12, weight: "bold" } }, grid: { color: isDarkMode? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)" } } } };

  const exportCSV = () => {
    const rows = [["Month", "Money You Make", "Money You Spend", "Money You Keep"]];
    monthsAhead.forEach((m, i) => { rows.push([m, projectedRevenue[i], projectedExpenses[i], projectedProfit[i]]); });
    const csvContent = "data:text/csv;charset=utf-8," + rows.map(r => r.join(",")).join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = "business-coach.csv";
    link.click();
    setToast("CSV exported");
    setTimeout(() => setToast(null), 3000);
  };

  const exportPDF = async () => {
    const element = reportRef.current; if (!element) return;
    const canvas = await html2canvas(element, { scale: 2, backgroundColor: isDarkMode? "#111827" : "#ffffff" });
    const imgData = canvas.toDataURL("image/png"); const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = pdf.internal.pageSize.getWidth(); const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight); pdf.save(`Business-Coach-${horizon}M.pdf`);
    setToast("PDF exported"); setTimeout(() => setToast(null), 3000);
  };

  const priceSuggest = useMemo(() => {
    const avg = businessMemory?.avg_daily_income || 1000;
    return { current: avg, suggested: Math.round(avg * 1.08), extra: Math.round(avg * 0.08 * 4) };
  }, [businessMemory]);

  const stockSuggest = useMemo(() => {
    return {
      busyDay: busiestDay,
      weakDay: weakestDay,
      busyIncome: businessMemory?.busiest_day_avg || businessMemory?.busiest_day_income || 0,
      weakIncome: businessMemory?.weakest_day_avg || businessMemory?.weakest_day_income || 0
    };
  }, [busiestDay, weakestDay, businessMemory]);

  const seasonSuggest = useMemo(() => {
    if (businessMemory?.growth_text) {
      let t = businessMemory.growth_text;
      try {
        const months = { "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr", "05": "May", "06": "Jun", "07": "Jul", "08": "Aug", "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dec" };
        t = t.replace(/(\d{4})-(\d{2})/g, (m, y, mo) => `${months[mo]} ${y}`);
        t = t.replace(" — ", " — Sales grew from ");
        return { text: t, growth: businessMemory.growth_rate };
      } catch {
        return { text: t, growth: businessMemory.growth_rate };
      }
    }
    return { text: "Add more months to see your growth", growth: null };
  }, [businessMemory]);

  return (
    <div ref={reportRef} className={isDarkMode? "bg-gray-900 text-white min-h-screen p-4 md:p-6" : "bg-[#fbfaf8] min-h-screen p-4 md:p-6 text-gray-900"}>
      <h1 className="text-4xl font-black">Business Coach {namePart? `— ${namePart}` : ""}</h1>
      <p className="text-sm font-bold opacity-70 mt-1">{realMonthsCount} months • You made {formatAmount(totalRevenue, currency)} • Spent {formatAmount(totalExpenses, currency)} • You keep {formatAmount(netProfit, currency)} • Last month expense {formatAmount(businessMemory?.last_month_expense || 0, currency)}</p>
      <p className="text-xs opacity-60 mb-6">Business strength {howStrong}/100 • Cash lasts {realRunwayData.text} • You keep {profitMargin.toFixed(0)}% of every {formatAmount(100, currency)} you sell</p>

      <div className={glassCard + " rounded-[20px] p-6 shadow-xl mb-6"}>
        <h2 className="text-sm font-black uppercase tracking-widest">Ask anything</h2>
        <p className="text-xs opacity-60 mt-1">Your best day is {busiestDay} ({formatAmount(businessMemory?.busiest_day_avg || businessMemory?.busiest_day_income || 0, currency)} average) • Slowest is {weakestDay} ({formatAmount(businessMemory?.weakest_day_avg || businessMemory?.weakest_day_income || 0, currency)} average)</p>
        <div className="flex flex-wrap gap-2 mt-3">
          {["Can I hire someone?", "Why is Food so high?", `Should I focus on ${busiestDay}?`, "What if I give 10% discount?", "How to make more?"].map(q => (
            <button key={q} onClick={() => setGoalInput(q)} className={isDarkMode? "px-4 py-2 bg-gray-700 border border-white/10 rounded-full text-xs font-black" : "px-4 py-2 bg-yellow-100 border-2 border-gray-900 rounded-full text-xs font-black"}>{q}</button>
          ))}
        </div>
        <div className="mt-4"><AskMyBusiness context="forecast" transactions={transactions} totalRevenue={totalRevenue} totalExpenses={totalExpenses} topExpense={topExpense} horizon={horizon} currency={currency} realRunway={realRunwayData.text} profitMargin={profitMargin} businessMemory={businessMemory} isDarkMode={isDarkMode} /></div>
      </div>

      {businessMemory && (
        <div className={glassCard + " rounded-[20px] p-5 shadow-xl mb-6"}>
          <h2 className="text-xs font-black uppercase tracking-widest">What I know about your business</h2>
          <p className="text-sm font-bold mt-3">Busiest day: {busiestDay} ({formatAmount(businessMemory.busiest_day_avg || businessMemory.busiest_day_income, currency)} average) • Slowest day: {weakestDay} ({formatAmount(businessMemory.weakest_day_avg || businessMemory.weakest_day_income, currency)} average) • Top product: {businessMemory.top_income_category || "Sales"} • Daily average: {formatAmount(businessMemory.avg_daily_income, currency)}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
            <div className={isDarkMode? "bg-gray-700 border border-white/10 p-4 rounded-xl" : "bg-[#e0e7ff] border-2 border-gray-900 p-4 rounded-xl"}>
              <p className="text-xs uppercase font-black">Price idea</p>
              <p className="text-sm font-bold mt-2">Raise price to {formatAmount(priceSuggest.suggested, currency)} from {formatAmount(priceSuggest.current, currency)}</p>
              <p className="text-xs mt-1 opacity-70">Extra {formatAmount(priceSuggest.extra, currency)} per month from price increase</p>
            </div>
            <div className={isDarkMode? "bg-gray-700 border border-white/10 p-4 rounded-xl" : "bg-[#fef08a] border-2 border-gray-900 p-4 rounded-xl"}>
              <p className="text-xs uppercase font-black">Stock idea</p>
              <p className="text-sm font-bold mt-2">{stockSuggest.busyDay}: {formatAmount(stockSuggest.busyIncome, currency)} average • {stockSuggest.weakDay}: {formatAmount(stockSuggest.weakIncome, currency)} average</p>
              <p className="text-xs mt-1 opacity-70">Put more stock on {busiestDay}. That is your best day for sales.</p>
            </div>
            <div className={isDarkMode? "bg-gray-700 border border-white/10 p-4 rounded-xl" : "bg-[#dcfce7] border-2 border-gray-900 p-4 rounded-xl"}>
              <p className="text-xs uppercase font-black">Growth</p>
              <p className="text-sm font-bold mt-2">{seasonSuggest.text}</p>
              <p className="text-xs mt-1 opacity-70">Monthly average: {formatAmount(avgMonthlyRevenue, currency)}</p>
            </div>
          </div>
        </div>
      )}

      <div className={glassCard + " rounded-[20px] p-6 shadow-xl mb-6"}>
        <h2 className="text-sm font-black uppercase tracking-widest">What do you want to achieve?</h2>
        <div className="flex flex-wrap gap-2 mt-4">
          {GOAL_OPTIONS.map(g => (
            <button key={g.id} onClick={() => { setSelectedGoal(g.id); setGoalInput(g.question); setTimeout(() => handleGoalCalc(g.id), 100); }} className={`px-4 py-2 rounded-full text-xs font-black border-2 ${selectedGoal === g.id? "bg-gray-900 text-white border-gray-900" : isDarkMode? "bg-gray-800 border-white/20 text-white" : "bg-white border-gray-200"}`}>{g.label}</button>
          ))}
        </div>
        <div className="flex gap-2 mt-4">
          <input value={goalInput} onChange={e => setGoalInput(e.target.value)} placeholder={`Ask about ${topExpense?.[0] || "your business"}...`} className={isDarkMode? "flex-1 border border-white/20 rounded-xl px-4 py-3 text-sm font-bold bg-gray-700 text-white" : "flex-1 border-2 border-gray-900 rounded-xl px-4 py-3 text-sm font-bold"} />
          <button onClick={() => handleGoalCalc()} disabled={isBuilding} className="bg-gray-900 text-white px-6 py-3 rounded-xl text-sm font-black">{isBuilding? "Building..." : "Build My Plan"}</button>
        </div>
        {goalResult && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-5">
            <div className={isDarkMode? "bg-gray-700 border border-white/10 p-4 rounded-xl" : "bg-[#fef08a] border-2 border-gray-900 p-4 rounded-xl"}><p className="text-xs uppercase opacity-60">What needs to change</p><p className="text-sm font-bold mt-2">{goalResult.whatsNeededText}</p></div>
            <div className={glassCardSoft + " p-4 rounded-xl"}>
              <p className="text-xs uppercase opacity-60">Money needed</p>
              <p className="text-sm font-black mt-2">{goalResult.targetRevenue === 0? `No extra money needed. You save ${formatAmount(goalResult.moneySave, currency)} per month` : formatAmount(goalResult.targetRevenue, currency)}</p>
              <p className="text-xs mt-1 opacity-60">{goalResult.targetRevenue === 0? "Just reduce spending" : `You need ${formatAmount(goalResult.gap, currency)}`}</p>
            </div>
            <div className={glassCardSoft + " p-4 rounded-xl"}><p className="text-xs uppercase opacity-60">Effort needed</p><p className="text-sm font-black mt-2">{goalResult.difficulty}</p><p className="text-xs mt-1">{goalResult.horizon} months plan</p></div>
            <div className="bg-green-600 text-white p-4 rounded-xl border-2 border-gray-900"><p className="text-xs uppercase">Confidence</p><p className="text-lg font-black mt-1">{goalResult.probability}%</p><p className="text-xs mt-1">{goalResult.memoryNote}</p></div>
          </div>
        )}
      </div>

      <div className="bg-gray-900 text-white rounded-[24px] p-6 md:p-8 shadow-2xl mb-6 border-4 border-yellow-300">
        <div className="flex justify-between"><h2 className="text-xs font-black uppercase tracking-widest text-yellow-300">What should I do next?</h2><button onClick={() => setShowWhy(!showWhy)} className="text-xs bg-white text-gray-900 px-3 py-1 rounded-full font-black">{showWhy? "Hide details" : "Show why"}</button></div>
        <p className="text-xl font-black mt-2">{namePart? `${namePart}, ` : ""}{goalInput || `You keep ${profitMargin.toFixed(0)}% of every ${formatAmount(100, currency)} you sell`}</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="bg-white text-gray-900 p-5 rounded-2xl"><p className="text-xs uppercase opacity-60">Best action</p><p className="text-lg font-black mt-2">Cut {topExpense?.[0]} by 10%</p><p className="text-sm mt-2">Save {formatAmount(planA_save, currency)} per month on {topExpense?.[0]}</p></div>
          <div className="bg-white text-gray-900 p-5 rounded-2xl"><p className="text-xs uppercase opacity-60">You will save</p><p className="text-lg font-black mt-2">{formatAmount(planC_total * 12, currency)} per year</p><p className="text-sm mt-2">{formatAmount(planC_total, currency)} per month</p></div>
          <div className="bg-[#fef08a] text-gray-900 p-5 rounded-2xl"><p className="text-xs uppercase">Confidence</p><p className="text-lg font-black mt-2">{goalResult?.probability || 87}%</p><p className="text-sm mt-2">Cash will last {(newRunway > 100? "Many" : newRunway.toFixed(1))} months after cutting</p></div>
        </div>
        {showWhy && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <div className="bg-white/10 border border-white/20 p-5 rounded-xl"><h3 className="text-xs font-black uppercase text-green-300">Why this plan?</h3><ul className="text-sm font-bold mt-3 space-y-1"><li>• Save {formatAmount(planA_save * 12, currency)} per year by cutting {topExpense?.[0]} by 10%</li><li>• This is based on your own spending history</li></ul></div>
            <div className="bg-white/10 border border-white/20 p-5 rounded-xl"><h3 className="text-xs font-black uppercase text-white">If you do it</h3><ul className="text-sm font-bold mt-3 space-y-1"><li>• You keep {profitMargin.toFixed(0)}% of every sale now</li><li>• You save {formatAmount(planC_total, currency)} extra per month</li></ul></div>
          </div>
        )}
        <div className="mt-6 bg-white text-gray-900 p-5 rounded-xl">
          <h3 className="text-xs font-black uppercase">Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-sm">
            <div><p className="text-xs uppercase opacity-60">You keep</p><p className="font-black">{profitMargin >= 20? `You keep ${profitMargin.toFixed(0)}% (above 20% target)` : `${profitMargin.toFixed(0)}% now → target 20%`}</p></div>
            <div><p className="text-xs uppercase opacity-60">Per month</p><p className="font-black">{formatAmount(planC_total, currency)}</p></div>
            <div><p className="text-xs uppercase opacity-60">Cash lasts</p><p className="font-black">{newRunway > 100? "Many months" : newRunway.toFixed(1) + " Months"}</p></div>
            <div><p className="text-xs uppercase opacity-60">Strength</p><p className="font-black">{howStrong}/100</p></div>
          </div>
        </div>
      </div>

      <div className={glassCard + " p-5 rounded-2xl shadow-xl mb-6"}>
        <h2 className="text-xs font-black uppercase tracking-widest opacity-60 mb-3">Cash check</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><p className="text-xs uppercase opacity-60">When cash finishes</p><p className="font-black">{runOutMonth}</p></div>
          <div><p className="text-xs uppercase opacity-60">Business strength</p><p className="font-black">{howStrong}/100</p></div>
          <div><p className="text-xs uppercase opacity-60">Cash lasts</p><p className="font-black">{realRunwayData.text}</p></div>
          <div><p className="text-xs uppercase opacity-60">Plan</p><p className="font-black">{horizon} months • {activeScenario}</p></div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {["Optimistic", "Realistic", "Pessimistic"].map(s => (<button key={s} onClick={() => setScenario(s)} className={`px-4 py-2 rounded-full font-black text-xs ${activeScenario === s? "bg-gray-900 text-white" : glassCard}`}>{s}</button>))}
        <select value={horizon} onChange={e => setHorizon(Number(e.target.value))} className={isDarkMode? "border border-white/20 p-2 rounded-full font-black bg-gray-800 text-white text-xs" : "border-2 border-gray-900 p-2 rounded-full font-black bg-white text-xs"}><option value={6}>6 months</option><option value={12}>12 months</option><option value={24}>24 months</option></select>
        <button onClick={exportCSV} className={glassCard + " px-4 py-2 rounded-full font-black text-xs"}>Export CSV</button>
        <button onClick={exportPDF} className="bg-gray-900 text-white px-4 py-2 rounded-full font-black text-xs">Export PDF</button>
        <button onClick={() => setShowModal(true)} className="bg-yellow-300 border-2 border-gray-900 px-4 py-2 rounded-full font-black text-xs text-gray-900">Action Plan</button>
      </div>

      <div className={glassCard + " p-5 rounded-2xl shadow mb-6"}>
        <h3 className="font-black text-sm">What if you cut {topExpense?.[0]} ({formatAmount(topExpense?.[1] || 0, currency)}) by {costCutSlider}%?</h3>
        <input type="range" min="0" max="30" value={costCutSlider} onChange={e => setCostCutSlider(Number(e.target.value))} className="w-full mt-3" />
        <p className="text-sm font-bold mt-2">Save {formatAmount(cutAmount, currency)} per month → Cash lasts {realRunwayData.text} → {(newRunway > 100? "Many months" : newRunway.toFixed(1) + " months")} after cut</p>
      </div>

      <div className={glassCard + " p-5 rounded-2xl shadow-xl"}>
        <div className="flex gap-2 mb-5 flex-wrap">
          {["trend", "cashflow", "where-money-goes", "compare", "year"].map(tab => (<button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-full font-black text-xs ${activeTab === tab? "bg-gray-900 text-white" : isDarkMode? "bg-gray-700 border border-white/10 text-white" : "bg-gray-100 border-2 border-gray-900"}`}>{tab === "trend"? "Money you make" : tab === "cashflow"? "Your cash" : tab === "where-money-goes"? "Where money goes" : tab === "compare"? "Compare" : "Year Review"}</button>))}
        </div>
        {activeTab === "trend" && (<div style={{ height: "360px" }}><Line options={chartOptions} data={{ labels: monthsAhead, datasets: [{ label: "You Make", data: projectedRevenue, borderColor: "#10B981", backgroundColor: "rgba(16,185,129,0.2)", fill: true }, { label: "You Spend", data: projectedExpenses, borderColor: "#F43F5E", backgroundColor: "rgba(244,63,94,0.2)", fill: true }, { label: "You Keep", data: projectedProfit, borderColor: "#3B82F6", backgroundColor: "rgba(59,130,246,0.2)", fill: true }] }} /></div>)}
        {activeTab === "cashflow" && (<div style={{ height: "360px" }}><Line options={chartOptions} data={{ labels: monthsAhead, datasets: [{ label: "Your Cash", data: cumulativeCash, borderColor: "#14B8A6", backgroundColor: "rgba(20,184,166,0.2)", fill: true }] }} /></div>)}
        {activeTab === "where-money-goes" && (<div style={{ height: "360px" }}><Bar options={chartOptions} data={{ labels: monthsAhead, datasets: [{ label: "You Spend", data: projectedExpenses, backgroundColor: "#F43F5E" }, { label: "You Keep", data: projectedProfit, backgroundColor: "#10B981" }] }} /></div>)}
        {activeTab === "compare" && (<div style={{ height: "360px" }}><Line options={chartOptions} data={{ labels: monthsAhead, datasets: [{ label: "Best", data: monthsAhead.map((_, i) => currentCash + (avgMonthlyRevenue * 1.10 - avgMonthlyExpense * 1.03) * (i + 1)), borderColor: "#10B981" }, { label: "Average", data: cumulativeCash, borderColor: "#14B8A6" }, { label: "Worst", data: monthsAhead.map((_, i) => currentCash + (avgMonthlyRevenue * 1.02 - avgMonthlyExpense * 1.05) * (i + 1)), borderColor: "#F43F5E" }] }} /></div>)}
        {activeTab === "year" && yearReview && (
          <div ref={yearRef} className={isDarkMode? "bg-gray-900 border border-white/10 rounded-xl p-5" : "bg-white border-2 border-gray-900 rounded-xl p-5"}>
            <h3 className="text-xl font-black">Year {yearReview.year} {namePart? `— ${namePart}` : ""}</h3>
            <p className="text-xs opacity-60 mt-1">Best month: {yearReview.bestMonth?.month} ({formatAmount(yearReview.bestMonth?.profit, currency)}) • Slowest month: {yearReview.worstMonth?.month} ({formatAmount(yearReview.worstMonth?.profit, currency)})</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
              <div className={glassCard + " p-4 rounded-xl"}><p className="text-xs uppercase opacity-60">Made this year</p><p className="text-sm font-black mt-1">{formatAmount(yearReview.totalYearIncome, currency)}</p></div>
              <div className={glassCard + " p-4 rounded-xl"}><p className="text-xs uppercase opacity-60">Spent this year</p><p className="text-sm font-black mt-1">{formatAmount(yearReview.totalYearExpense, currency)}</p></div>
              <div className={glassCard + " p-4 rounded-xl"}><p className="text-xs uppercase opacity-60">You kept</p><p className="text-sm font-black mt-1">{formatAmount(yearReview.totalYearProfit, currency)}</p></div>
              <div className={glassCard + " p-4 rounded-xl"}><p className="text-xs uppercase opacity-60">Growth</p><p className="text-sm font-black mt-1">{businessMemory?.growth_text || "No growth data yet"}</p></div>
            </div>
            <div className="mt-6" style={{ height: "300px" }}><Bar options={chartOptions} data={{ labels: yearReview.all12.map(m => m.label), datasets: [{ label: "You Make", data: yearReview.all12.map(m => m.income), backgroundColor: "#10B981" }, { label: "You Spend", data: yearReview.all12.map(m => m.expense), backgroundColor: "#F43F5E" }] }} /></div>
          </div>
        )}
        {toast && <div className="fixed bottom-6 right-6 bg-gray-900 text-white px-5 py-3 rounded-xl text-xs font-black shadow-2xl z-50">{toast}</div>}
      </div>

      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50 p-4">
          <div className={glassCard + " p-6 rounded-2xl max-w-md w-full"}><h3 className="font-black">Action Plan — {horizon} months</h3><p className="text-sm mt-2">Cut {topExpense?.[0]} by 10% to save {formatAmount(cutAmount, currency)} per month</p><div className="flex justify-end gap-3 mt-4"><button onClick={() => setShowModal(false)} className="bg-gray-200 px-4 py-2 rounded-full font-bold text-xs border-2 border-gray-900">Close</button><a href="/alerts" className="bg-gray-900 text-white px-4 py-2 rounded-full font-bold text-xs">Go to Alerts</a></div></div>
        </div>
      )}
    </div>
  );
}
export default Forecast;