import { useState, useEffect, useCallback } from "react";
import { Bar } from "react-chartjs-2";
import Papa from "papaparse";
import InsightsPanel from "./InsightsPanel";
import { FaArrowUp, FaArrowDown, FaBalanceScale, FaPercentage } from "react-icons/fa";

const baseUrl =
  window.location.hostname === "localhost"
    ? "http://127.0.0.1:5000/api"
    : "https://ai-business-insights-dashboard.onrender.com/api";

const apiFetch = async (endpoint, options = {}) => {
  const token = localStorage.getItem("token");
  if (!token) return null;
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    ...options.headers,
  };
  const res = await fetch(`${baseUrl}${endpoint}`, { ...options, headers });
  return res.json();
};

function normalizeDate(dateStr) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    const [day, month, year] = dateStr.split("/");
    return `${year}-${month}-${day}`;
  }
  return dateStr;
}

function Dashboard() {
  const [transactions, setTransactions] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [newTransactions, setNewTransactions] = useState([
    { date: "", type: "Expense", category: "", description: "", amount: "" }
  ]);
  const [darkMode, setDarkMode] = useState(false);
  const [alerts, setAlerts] = useState([]);

  // Protect dashboard
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setTransactions([]);
      setAlerts([]);
      window.location.href = "/login";
    }
  }, []);

  // Load entries
  const loadEntries = useCallback(() => {
    apiFetch("/entries")
      .then(data => {
        if (Array.isArray(data)) {
          console.log("Dashboard transactions fetched:", data); // ✅ Debug log
          setTransactions(data);
        } else {
          setTransactions([]);
        }
      })
      .catch(err => console.error("Error fetching entries:", err));
  }, []);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  const loadAlerts = useCallback(() => {
  apiFetch("/alerts")
    .then(data => {
      if (Array.isArray(data)) {
        console.log("Dashboard alerts fetched:", data); // ✅ Debug log
        setAlerts(data);
      } else {
        setAlerts([]);
      }
    })
    .catch(err => console.error("Error fetching alerts:", err));
}, []);



  useEffect(() => { loadAlerts(); }, [loadAlerts]);

  // Logout clears state
  const handleLogout = () => {
    apiFetch("/clear_entries", { method: "DELETE" });
    localStorage.clear();
    setTransactions([]);
    setAlerts([]);
    window.location.href = "/login";
  };

  // Metrics
  const totalRevenue = transactions.filter(t => t.type.toLowerCase() === "income").reduce((sum, t) => sum + Number(t.amount), 0);
  const totalExpenses = transactions.filter(t => t.type.toLowerCase() === "expense").reduce((sum, t) => sum + Number(t.amount), 0);
  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  // Chart data
  const monthlyData = {};
  transactions.forEach(t => {
    const key = t.date.slice(0,7);
    if (!monthlyData[key]) monthlyData[key] = { income: 0, expense: 0 };
    if (t.type.toLowerCase() === "income") monthlyData[key].income += Number(t.amount);
    else monthlyData[key].expense += Number(t.amount);
  });

  const chartData = {
    labels: Object.keys(monthlyData),
    datasets: [
      { label: "Revenue", data: Object.values(monthlyData).map(m => m.income), backgroundColor: "rgba(34,197,94,0.7)" },
      { label: "Expenses", data: Object.values(monthlyData).map(m => m.expense), backgroundColor: "rgba(239,68,68,0.7)" },
    ],
  };
  const options = { responsive: true, plugins: { legend: { position: "top" }, title: { display: true, text: "Revenue vs Expenses" } } };

  // Handlers
  const handleAddRow = () => setNewTransactions([...newTransactions, { date: "", type: "Expense", category: "", description: "", amount: "" }]);
  const handleChange = (i, f, v) => { const u=[...newTransactions]; u[i][f]=v; setNewTransactions(u); };

  const handleSaveAll = (e) => {
    e.preventDefault();
    const formatted = newTransactions.map(t => ({
      ...t,
      date: normalizeDate(t.date),
      type: t.type.toLowerCase(),   // ✅ normalize type
      amount: parseFloat(t.amount) || 0
    }));
    console.log("Saving transactions:", formatted); // ✅ Debug log
    apiFetch("/add", { method: "POST", body: JSON.stringify(formatted) })
      .then(() => { loadEntries(); loadAlerts(); setNewTransactions([{ date: "", type: "Expense", category: "", description: "", amount: "" }]); setShowForm(false); });
  };

  const handleCSVUpload = (e) => {
    const file = e.target.files[0]; if (!file) return;
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (results) => {
        const parsed = results.data.filter(r => r.Date && r.Amount).map(r => ({
          date: normalizeDate(r.Date.trim()),
          type: r.Type.trim().toLowerCase(),   // ✅ normalize type
          category: r.Category.trim(),
          description: r.Description.trim(),
          amount: parseFloat(r.Amount.replace(/[^0-9.-]/g, "")) || 0
        }));
        console.log("CSV parsed transactions:", parsed); // ✅ Debug log
        apiFetch("/add", { method: "POST", body: JSON.stringify(parsed) })
          .then(() => { loadEntries(); loadAlerts(); });
      }
    });
  };

  const editTransaction = (id) => {
    const entry = transactions.find(t => t.id === id); if (!entry) return;
    const newDescription = prompt("Edit description:", entry.description); if (newDescription === null) return;
    apiFetch("/edit_entry", { method: "PUT", body: JSON.stringify({ ...entry, description: newDescription }) })
      .then(() => { loadEntries(); loadAlerts(); });
  };

  const deleteTransaction = (id) => {
    apiFetch("/delete_entry", { method: "DELETE", body: JSON.stringify({ id }) })
      .then(() => { loadEntries(); loadAlerts(); });
  };

  return (
    <div className={darkMode ? "bg-gray-900 text-white min-h-screen p-6" : "bg-gray-50 text-black min-h-screen p-6"}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <div className="space-x-4">
          <label className="px-4 py-2 bg-blue-600 text-white rounded cursor-pointer">
            Upload CSV
            <input type="file" accept=".csv" onChange={handleCSVUpload} className="hidden" />
          </label>
          <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-green-600 text-white rounded">Add Transactions</button>
          <button onClick={() => setDarkMode(!darkMode)} className="px-4 py-2 bg-gray-800 text-white rounded">Toggle {darkMode ? "Light" : "Dark"} Mode</button>
          <button onClick={handleLogout} className="px-4 py-2 bg-red-600 text-white rounded">Logout</button>
        </div>
      </div>

            {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-green-100 p-6 rounded-lg shadow">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold">Total Revenue</h3>
            <FaArrowUp className="text-green-600" />
          </div>
          <p className="text-2xl text-green-600">${Number(totalRevenue).toFixed(2)}</p>
        </div>
        <div className="bg-red-100 p-6 rounded-lg shadow">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold">Total Expenses</h3>
            <FaArrowDown className="text-red-600" />
          </div>
          <p className="text-2xl text-red-600">${Number(totalExpenses).toFixed(2)}</p>
        </div>
        <div className="bg-blue-100 p-6 rounded-lg shadow">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold">Net Profit</h3>
            <FaBalanceScale className="text-blue-600" />
          </div>
          <p className="text-2xl text-blue-600">${Number(netProfit).toFixed(2)}</p>
        </div>
        <div className="bg-purple-100 p-6 rounded-lg shadow">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold">Profit Margin</h3>
            <FaPercentage className="text-purple-600" />
          </div>
          <p className="text-2xl text-purple-600">{Number(profitMargin).toFixed(2)}%</p>
        </div>
      </div>

      {/* Forecast Panel */}
      <InsightsPanel transactions={transactions} />

      {/* Alerts Panel */}
      <div className="bg-white p-6 rounded shadow mb-8">
        <h2 className="text-xl font-bold mb-4">Alerts</h2>
        {alerts.length > 0 ? (
          alerts.map((a) => {
  const level = a.level.toLowerCase();  // ✅ normalize here
  let borderColor = "border-blue-600";
  let titleColor = "text-blue-600";
  let title = "Informational";

  if (level === "high") {
    borderColor = "border-red-600";
    titleColor = "text-red-600";
    title = "High Priority";
  } else if (level === "medium") {
    borderColor = "border-yellow-600";
    titleColor = "text-yellow-600";
    title = "Medium Priority";
  }

            return (
              <div
                key={a.id}
                className={`bg-white p-4 rounded shadow mb-4 border-l-4 ${borderColor}`}
              >
                <h3 className={`text-lg font-bold ${titleColor}`}>{title}</h3>
                <p className="text-gray-700">{a.message}</p>
              </div>
            );
          })
        ) : (
          <p className="text-gray-600">No alerts available.</p>
        )}
      </div>

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
                <input type="text" placeholder="Date (YYYY-MM-DD)" value={t.date}
                  onChange={(e) => handleChange(index, "date", e.target.value)}
                  className="p-2 border-2 rounded text-black" required />
                <select value={t.type} onChange={(e) => handleChange(index, "type", e.target.value)}
                  className="p-2 border-2 rounded text-black">
                  <option>Expense</option>
                  <option>Income</option>
                </select>
                <input type="text" placeholder="Category" value={t.category}
                  onChange={(e) => handleChange(index, "category", e.target.value)}
                  className="p-2 border-2 rounded text-black" required />
                <input type="text" placeholder="Description" value={t.description}
                  onChange={(e) => handleChange(index, "description", e.target.value)}
                  className="p-2 border-2 rounded text-black" required />
                <input type="number" placeholder="Amount" value={t.amount}
                  onChange={(e) => handleChange(index, "amount", e.target.value)}
                  className="p-2 border-2 rounded text-black" required />
              </div>
            ))}
            <div className="flex space-x-4 mt-4">
              <button type="button" onClick={handleAddRow}
                className="px-4 py-2 bg-blue-600 text-white rounded">Add Another Row</button>
              <button type="submit"
                className="px-6 py-2 bg-green-600 text-white font-bold rounded">Save Transactions</button>
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
            {transactions.map((t) => (
              <tr key={t.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-600">
                <td className="py-2 px-4">{t.date}</td>
                <td className={`py-2 px-4 font-semibold ${t.type.toLowerCase() === "income" ? "text-green-600" : "text-red-600"}`}>
                  {t.type}
                </td>
                <td className="py-2 px-4">{t.category}</td>
                <td className="py-2 px-4">{t.description}</td>
                <td className={`py-2 px-4 font-bold ${t.type.toLowerCase() === "income" ? "text-green-600" : "text-red-600"}`}>
                  ${Number(t.amount).toFixed(2)}
                </td>
                <td className="py-2 px-4 space-x-2">
                  <button onClick={() => editTransaction(t.id)}
                    className="px-2 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600">Edit</button>
                  <button onClick={() => deleteTransaction(t.id)}
                    className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Dashboard;
