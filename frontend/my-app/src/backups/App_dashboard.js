import { useState } from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import { ArrowUpCircleIcon, ArrowDownCircleIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import { Bar } from "react-chartjs-2";
import Papa from "papaparse";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// Insights Panel Component
function InsightsPanel({ transactions }) {
  const totalRevenue = transactions.filter(t => t.type === "Income").reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = transactions.filter(t => t.type === "Expense").reduce((sum, t) => sum + t.amount, 0);
  const netProfit = totalRevenue - totalExpenses;

  const expenseTrend = totalExpenses > 4000 ? "high" : "normal";
  const forecast = netProfit < 2000
    ? "Cash reserves may drop below safe levels in 45 days."
    : "Cashflow looks stable for the next 2 months.";

  const suggestion = expenseTrend === "high"
    ? "Consider renegotiating supplier contracts or cutting non‑essential costs."
    : "Maintain current expense levels to keep profit steady.";

  return (
    <div className="bg-yellow-50 p-6 rounded-lg shadow mb-8">
      <h2 className="text-xl font-bold mb-4">Cashflow Insights</h2>
      <ul className="space-y-2 text-gray-800">
        <li>📊 Expenses are currently {expenseTrend} compared to typical levels.</li>
        <li>🔮 Forecast: {forecast}</li>
        <li>💡 Suggested Action: {suggestion}</li>
        <li>📈 Net Profit: ${netProfit.toFixed(2)}</li>
      </ul>
    </div>
  );
}

function Dashboard() {
  const [transactions, setTransactions] = useState([
    { date: "13/11/2025", type: "Expense", category: "Rent", description: "Office rent", amount: 1200 },
    { date: "18/11/2025", type: "Income", category: "Sales", description: "November revenue", amount: 3300 },
    { date: "12/12/2025", type: "Expense", category: "Utilities", description: "Monthly utilities", amount: 700 },
  ]);

  const [showForm, setShowForm] = useState(false);
  const [newTransactions, setNewTransactions] = useState([{ date: "", type: "Expense", category: "", description: "", amount: "" }]);
  const [darkMode, setDarkMode] = useState(false);

  // Add another row
  const handleAddRow = () => {
    setNewTransactions([...newTransactions, { date: "", type: "Expense", category: "", description: "", amount: "" }]);
  };

  // Handle input change
  const handleChange = (index, field, value) => {
    const updated = [...newTransactions];
    updated[index][field] = value;
    setNewTransactions(updated);
  };

  // Save all typed rows
  const handleSaveAll = (e) => {
    e.preventDefault();
    const formatted = newTransactions.map(t => ({
      ...t,
      amount: parseFloat(t.amount) || 0
    }));
    setTransactions([...transactions, ...formatted]);
    setNewTransactions([{ date: "", type: "Expense", category: "", description: "", amount: "" }]);
    setShowForm(false);
  };

  // Handle CSV upload
  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsed = results.data
          .filter(row => row.Date && row.Amount)
          .map(row => ({
            date: row.Date?.trim(),
            type: row.Type?.trim(),
            category: row.Category?.trim(),
            description: row.Description?.trim(),
            amount: parseFloat(row.Amount?.replace(/[^0-9.-]/g, "")) || 0
          }));
        setTransactions([...transactions, ...parsed]);
      }
    });
  };

  // Totals
  const totalRevenue = transactions.filter(t => t.type === "Income").reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = transactions.filter(t => t.type === "Expense").reduce((sum, t) => sum + t.amount, 0);
  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  // Group transactions by month
  const monthlyData = {};
  transactions.forEach(t => {
    const [, month, year] = t.date.split("/");
    const key = `${month}/${year}`;
    if (!monthlyData[key]) monthlyData[key] = { income: 0, expense: 0 };
    if (t.type === "Income") monthlyData[key].income += t.amount;
    else monthlyData[key].expense += t.amount;
  });

  const chartData = {
    labels: Object.keys(monthlyData),
    datasets: [
      { label: "Revenue", data: Object.values(monthlyData).map(m => m.income), backgroundColor: "rgba(34,197,94,0.7)" },
      { label: "Expenses", data: Object.values(monthlyData).map(m => m.expense), backgroundColor: "rgba(239,68,68,0.7)" },
    ],
  };

  const options = {
    responsive: true,
    plugins: { legend: { position: "top" }, title: { display: true, text: "Revenue vs Expenses" } },
  };

  // Edit transaction
  const editTransaction = (index) => {
    const newDescription = prompt("Edit description:", transactions[index].description);
    if (newDescription !== null) {
      const updated = [...transactions];
      updated[index].description = newDescription;
      setTransactions(updated);
    }
  };

  // Delete transaction
  const deleteTransaction = (index) => {
    const updated = transactions.filter((_, i) => i !== index);
    setTransactions(updated);
  };

  return (
    <div className={darkMode ? "bg-gray-900 text-white min-h-screen p-6" : "bg-gray-50 text-black min-h-screen p-6"}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-gray-600">Track revenue vs expenses and manage transactions.</p>
        </div>
        <div className="space-x-4">
          <label className="px-4 py-2 bg-blue-600 text-white rounded cursor-pointer">
            Upload CSV
            <input type="file" accept=".csv" onChange={handleCSVUpload} className="hidden" />
          </label>
          <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-green-600 text-white rounded">Add Transactions</button>
          <button onClick={() => setDarkMode(!darkMode)} className="px-4 py-2 bg-gray-800 text-white rounded">
            Toggle {darkMode ? "Light" : "Dark"} Mode
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-green-100 p-6 rounded-lg shadow">
          <div className="flex items-center space-x-3">
            <ArrowUpCircleIcon className="h-8 w-8 text-green-600" />
            <h2 className="text-xl font-semibold text-green-700">Total Revenue</h2>
          </div>
          <p className="text-2xl font-bold text-green-900 mt-2">${totalRevenue.toFixed(2)}</p>
        </div>
        <div className="bg-red-100 p-6 rounded-lg shadow">
          <div className="flex items-center space-x-3">
            <ArrowDownCircleIcon className="h-8 w-8 text-red-600" />
            <h2 className="text-xl font-semibold text-red-700">Total Expenses</h2>
          </div>
          <p className="text-2xl font-bold text-red-900 mt-2">${totalExpenses.toFixed(2)}</p>
        </div>
                <div className="bg-blue-100 p-6 rounded-lg shadow">
          <div className="flex items-center space-x-3">
            <ChartBarIcon className="h-8 w-8 text-blue-600" />
            <h2 className="text-xl font-semibold text-blue-700">Net Profit</h2>
          </div>
          <p className="text-2xl font-bold text-blue-900 mt-2">${netProfit.toFixed(2)}</p>
        </div>

        {/* Profit Margin Card */}
        <div className="bg-purple-100 p-6 rounded-lg shadow">
          <div className="flex items-center space-x-3">
            <ArrowUpCircleIcon className="h-8 w-8 text-purple-600" />
            <h2 className="text-xl font-semibold text-purple-700">Profit Margin</h2>
          </div>
          <p className="text-2xl font-bold text-purple-900 mt-2">{profitMargin.toFixed(2)}%</p>
        </div>
      </div>

      {/* Insights Panel */}
      <InsightsPanel transactions={transactions} />

      {/* Chart */}
      <div className="bg-white p-6 rounded shadow mb-8">
        <Bar data={chartData} options={options} />
      </div>

      {/* Multi-row Form */}
      {showForm && (
        <div className="bg-gray-100 p-6 rounded mb-8">
          <h2 className="text-xl font-bold mb-4 text-gray-900">New Transactions</h2>
          <form onSubmit={handleSaveAll} className="space-y-6">
            {newTransactions.map((t, index) => (
              <div key={index} className="grid grid-cols-5 gap-4">
                <input type="text" placeholder="Date" value={t.date} onChange={(e) => handleChange(index, "date", e.target.value)} className="p-2 border-2 rounded text-black" required />
                <select value={t.type} onChange={(e) => handleChange(index, "type", e.target.value)} className="p-2 border-2 rounded text-black">
                  <option>Expense</option>
                  <option>Income</option>
                </select>
                <input type="text" placeholder="Category" value={t.category} onChange={(e) => handleChange(index, "category", e.target.value)} className="p-2 border-2 rounded text-black" required />
                <input type="text" placeholder="Description" value={t.description} onChange={(e) => handleChange(index, "description", e.target.value)} className="p-2 border-2 rounded text-black" required />
                <input type="number" placeholder="Amount" value={t.amount} onChange={(e) => handleChange(index, "amount", e.target.value)} className="p-2 border-2 rounded text-black" required />
              </div>
            ))}
            <div className="flex space-x-4 mt-4">
              <button type="button" onClick={handleAddRow} className="px-4 py-2 bg-blue-600 text-white rounded">Add Another Row</button>
              <button type="submit" className="px-6 py-2 bg-green-600 text-white font-bold rounded">Save Transactions</button>
            </div>
          </form>
        </div>
      )}

      {/* Recent Transactions */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded shadow">
        <h2 className="text-xl font-bold mb-4">Recent Transactions</h2>
        <table className="min-w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b bg-gray-100 dark:bg-gray-700">
              <th className="py-2 px-4">Date</th>
              <th className="py-2 px-4">Type</th>
              <th className="py-2 px-4">Category</th>
              <th className="py-2 px-4">Description</th>
              <th className="py-2 px-4">Amount</th>
              <th className="py-2 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t, index) => (
              <tr key={index} className="border-b hover:bg-gray-50 dark:hover:bg-gray-600">
                <td className="py-2 px-4">{t.date}</td>
                <td className={`py-2 px-4 font-semibold ${t.type === "Income" ? "text-green-600" : "text-red-600"}`}>
                  {t.type}
                </td>
                <td className="py-2 px-4">{t.category}</td>
                <td className="py-2 px-4">{t.description}</td>
                <td className={`py-2 px-4 font-bold ${t.type === "Income" ? "text-green-600" : "text-red-600"}`}>
                  ${t.amount.toFixed(2)}
                </td>
                <td className="py-2 px-4 space-x-2">
                  <button
                    onClick={() => editTransaction(index)}
                    className="px-2 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteTransaction(index)}
                    className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Placeholder pages
function Forecast() {
  return <h1 className="text-2xl font-bold">Forecast Page</h1>;
}

function Alerts() {
  return <h1 className="text-2xl font-bold">Alerts Page</h1>;
}

function Settings() {
  return <h1 className="text-2xl font-bold">Settings Page</h1>;
}

function App() {
  return (
    <Router>
      <div className="flex min-h-screen bg-gray-50">
        {/* Sidebar */}
        <aside className="w-64 bg-white shadow-md p-6">
          <div className="mb-6">
            <div className="flex items-center space-x-2">
              <span className="text-3xl font-bold text-blue-600">$</span>
              <h2 className="text-2xl font-bold">Financial Tracker</h2>
            </div>
            <p className="text-gray-500 text-sm">Business Analytics</p>
          </div>
          <nav className="space-y-4">
            <Link to="/" className="block text-gray-700 hover:text-blue-600">Dashboard</Link>
            <Link to="/forecast" className="block text-gray-700 hover:text-blue-600">Forecast</Link>
            <Link to="/alerts" className="block text-gray-700 hover:text-blue-600">Alerts</Link>
            <Link to="/settings" className="block text-gray-700 hover:text-blue-600">Settings</Link>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/forecast" element={<Forecast />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
