import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

function Dashboard() {
  const [transactions, setTransactions] = useState([]);
  const [forecast, setForecast] = useState({});
  const [alerts, setAlerts] = useState([]);
  const navigate = useNavigate();

  // ✅ Verify token on load
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    const baseUrl =
      window.location.hostname === "localhost"
        ? "http://localhost:5000"
        : "https://ai-business-insights-dashboard.onrender.com";

    fetch(`${baseUrl}/verify_token`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data.valid) {
          localStorage.removeItem("token");
          navigate("/login");
        }
      })
      .catch(() => {
        localStorage.removeItem("token");
        navigate("/login");
      });
  }, [navigate]);

  // ✅ Fetch entries, forecast, alerts
  useEffect(() => {
    const baseUrl =
      window.location.hostname === "localhost"
        ? "http://localhost:5000"
        : "https://ai-business-insights-dashboard.onrender.com";

    const token = localStorage.getItem("token");

    fetch(`${baseUrl}/get_entries`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setTransactions(data));

    fetch(`${baseUrl}/forecast`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setForecast(data));

    fetch(`${baseUrl}/alerts`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setAlerts(data));
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>

      {/* Forecast Section */}
      <div className="mb-6 p-4 bg-blue-100 rounded">
        <h2 className="text-xl font-semibold">Forecast</h2>
        <p>Current Net: {forecast.current_net}</p>
        <p>Next Forecast: {forecast.forecast_next}</p>
      </div>

      {/* Alerts Section */}
      <div className="mb-6 p-4 bg-red-100 rounded">
        <h2 className="text-xl font-semibold">Alerts</h2>
        {alerts.length === 0 ? (
          <p>No alerts</p>
        ) : (
          <ul>
            {alerts.map((alert, idx) => (
              <li key={idx} className="text-red-600">
                {alert}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Transactions Section */}
      <div className="p-4 bg-gray-100 rounded">
        <h2 className="text-xl font-semibold">Transactions</h2>
        {transactions.length === 0 ? (
          <p>No transactions yet</p>
        ) : (
          <table className="w-full border mt-3">
            <thead>
              <tr className="bg-gray-200">
                <th className="p-2 border">Date</th>
                <th className="p-2 border">Type</th>
                <th className="p-2 border">Category</th>
                <th className="p-2 border">Description</th>
                <th className="p-2 border">Amount</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id}>
                  <td className="p-2 border">{t.date}</td>
                  <td className="p-2 border">{t.type}</td>
                  <td className="p-2 border">{t.category}</td>
                  <td className="p-2 border">{t.description}</td>
                  <td className="p-2 border">{t.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default Dashboard;





import { useState, useEffect } from "react";
import { ArrowUpCircleIcon, ArrowDownCircleIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import { Bar } from "react-chartjs-2";
import Papa from "papaparse";
import InsightsPanel from "./InsightsPanel";


function Dashboard() {
  const [transactions, setTransactions] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [newTransactions, setNewTransactions] = useState([{ date: "", type: "Expense", category: "", description: "", amount: "" }]);
  const [darkMode, setDarkMode] = useState(false);
  const [forecast, setForecast] = useState(null);
  const [alerts, setAlerts] = useState([]);

  const baseUrl =
    window.location.hostname === "localhost"
      ? "http://localhost:5000"
      : "https://ai-business-insights-dashboard.onrender.com";

  // Load entries
  useEffect(() => {
    fetch(`${baseUrl}/get_entries`, {
      headers: { Authorization: "Bearer " + localStorage.getItem("token") },
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setTransactions(data);
        else setTransactions([]);
      })
      .catch((err) => console.error("Error fetching entries:", err));
  }, [baseUrl]);

  // Load forecast
  useEffect(() => {
    fetch(`${baseUrl}/forecast`, {
      headers: { Authorization: "Bearer " + localStorage.getItem("token") },
    })
      .then((res) => res.json())
      .then((data) => setForecast(data))
      .catch((err) => console.error("Forecast error:", err));
  }, [baseUrl]);

  // Load alerts
  useEffect(() => {
    fetch(`${baseUrl}/alerts`, {
      headers: { Authorization: "Bearer " + localStorage.getItem("token") },
    })
      .then((res) => res.json())
      .then((data) => setAlerts(Array.isArray(data) ? data : []))
      .catch((err) => console.error("Alerts error:", err));
  }, [baseUrl]);

  const handleAddRow = () => {
    setNewTransactions([...newTransactions, { date: "", type: "Expense", category: "", description: "", amount: "" }]);
  };

  const handleChange = (index, field, value) => {
    const updated = [...newTransactions];
    updated[index][field] = value;
    setNewTransactions(updated);
  };

  const handleSaveAll = (e) => {
    e.preventDefault();
    const formatted = newTransactions.map(t => ({
      ...t,
      amount: parseFloat(t.amount) || 0
    }));

    fetch(`${baseUrl}/add`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + localStorage.getItem("token"),
      },
      body: JSON.stringify(formatted),
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setTransactions([...transactions, ...data]);
        } else {
          alert(data.message || "Save successful");
        }
        setNewTransactions([{ date: "", type: "Expense", category: "", description: "", amount: "" }]);
        setShowForm(false);
      })
      .catch((err) => console.error("Add entry error:", err));
  };

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

        fetch(`${baseUrl}/add`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + localStorage.getItem("token"),
          },
          body: JSON.stringify(parsed),
        })
          .then((res) => res.json())
          .then((data) => {
            if (Array.isArray(data)) setTransactions([...transactions, ...data]);
            else alert(data.message || "CSV upload successful");
          })
          .catch((err) => console.error("CSV upload error:", err));
      }
    });
  };

  const totalRevenue = transactions.filter(t => t.type === "Income").reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = transactions.filter(t => t.type === "Expense").reduce((sum, t) => sum + t.amount, 0);
  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

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

  const editTransaction = (index) => {
    const newDescription = prompt("Edit description:", transactions[index].description);
    if (newDescription !== null) {
      const updated = [...transactions];
      updated[index].description = newDescription;
      setTransactions(updated);
    }
  };

  const deleteTransaction = (index) => {
    const entry = transactions[index];
    fetch(`${baseUrl}/delete_entry`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + localStorage.getItem("token"),
      },
      body: JSON.stringify({ id: entry.id }),
    })
      .then((res) => res.json())
      .then(() => {
        setTransactions(transactions.filter((_, i) => i !== index));
      })
      .catch((err) => console.error("Delete error:", err));
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
        {/* Revenue, Expenses, Net Profit, Profit Margin cards */}
        {/* ...same as before */}
      </div>

            {/* Insights Panel */}
      <InsightsPanel transactions={transactions} />

      {/* Forecast & Alerts */}
      <div className="bg-white p-6 rounded shadow mb-8">
        <h2 className="text-xl font-bold mb-4">Cashflow Insights</h2>
        {forecast && (
          <div className="mb-2">
            <p>Current Net: ${forecast.current_net?.toFixed(2)}</p>
            <p>Forecast Next: ${forecast.forecast_next?.toFixed(2)}</p>
          </div>
        )}
        {alerts.length > 0 ? (
          alerts.map((a, i) => (
            <p key={i} className="text-red-600">{a}</p>
          ))
        ) : (
          <p>No alerts at this time.</p>
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
                <input
                  type="text"
                  placeholder="Date"
                  value={t.date}
                  onChange={(e) => handleChange(index, "date", e.target.value)}
                  className="p-2 border-2 rounded text-black"
                  required
                />
                <select
                  value={t.type}
                  onChange={(e) => handleChange(index, "type", e.target.value)}
                  className="p-2 border-2 rounded text-black"
                >
                  <option>Expense</option>
                  <option>Income</option>
                </select>
                <input
                  type="text"
                  placeholder="Category"
                  value={t.category}
                  onChange={(e) => handleChange(index, "category", e.target.value)}
                  className="p-2 border-2 rounded text-black"
                  required
                />
                <input
                  type="text"
                  placeholder="Description"
                  value={t.description}
                  onChange={(e) => handleChange(index, "description", e.target.value)}
                  className="p-2 border-2 rounded text-black"
                  required
                />
                <input
                  type="number"
                  placeholder="Amount"
                  value={t.amount}
                  onChange={(e) => handleChange(index, "amount", e.target.value)}
                  className="p-2 border-2 rounded text-black"
                  required
                />
              </div>
            ))}
            <div className="flex space-x-4 mt-4">
              <button
                type="button"
                onClick={handleAddRow}
                className="px-4 py-2 bg-blue-600 text-white rounded"
              >
                Add Another Row
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-green-600 text-white font-bold rounded"
              >
                Save Transactions
              </button>
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
                <td
                  className={`py-2 px-4 font-semibold ${
                    t.type === "Income" ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {t.type}
                </td>
                <td className="py-2 px-4">{t.category}</td>
                <td className="py-2 px-4">{t.description}</td>
                <td
                  className={`py-2 px-4 font-bold ${
                    t.type === "Income" ? "text-green-600" : "text-red-600"
                  }`}
                >
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

export default Dashboard;

