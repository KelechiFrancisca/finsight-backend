import React, { useState, useEffect, useCallback } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Title, Tooltip, Legend);

function ForecastSection() {
  const [entries, setEntries] = useState([]);
  const [income, setIncome] = useState(0);
  const [expenses, setExpenses] = useState(0);
  const [net, setNet] = useState(0);
  const [forecast, setForecast] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [insights, setInsights] = useState([]);
  const [newEntry, setNewEntry] = useState({ category: "income", description: "", amount: "", date: "" });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const recalcTotals = (data) => {
    let inc = 0, exp = 0;
    data.forEach((e) => {
      if (e.category === "income") inc += e.amount;
      else exp += e.amount;
    });
    setIncome(inc);
    setExpenses(exp);
    setNet(inc - exp);

    // Alerts
    const newAlerts = [];
    if (exp > inc * 0.5) newAlerts.push("⚠️ Expenses exceeded 50% of income.");
    if (inc - exp < 0) newAlerts.push("❌ Negative cashflow detected.");
    if (inc < 5000) newAlerts.push("⚠️ Income below target threshold.");
    if (exp > inc) newAlerts.push("❌ Expenses exceeded income this month!");
    setAlerts(newAlerts);

    // Insights
    const highestExpense = data.filter(e => e.category === "expense")
                               .sort((a, b) => b.amount - a.amount)[0];
    const newInsights = [];
    if (highestExpense) newInsights.push(`Highest expense: ${highestExpense.description} ($${highestExpense.amount})`);
    newInsights.push(`Average net cashflow: $${(inc - exp)}`);

    // Month-to-month comparison
    const months = {};
    data.forEach(e => {
      const month = e.date.slice(0,7); // YYYY-MM
      if (!months[month]) months[month] = { inc:0, exp:0 };
      if (e.category === "income") months[month].inc += e.amount;
      else months[month].exp += e.amount;
    });
    const keys = Object.keys(months).sort();
    if (keys.length >= 2) {
      const last = months[keys[keys.length-2]];
      const current = months[keys[keys.length-1]];
      const lastNet = last.inc - last.exp;
      const currentNet = current.inc - current.exp;
      newInsights.push(`Net cashflow changed by ${currentNet - lastNet} compared to last month`);
    }

    setInsights(newInsights);
  };

  const refreshDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("http://127.0.0.1:5000/cashflow");
      const data = await res.json();
      setEntries(Array.isArray(data) ? data : []);
      recalcTotals(data);

      const f = await fetch("http://127.0.0.1:5000/forecast").then(r => r.json());
      setForecast(f);
    } catch (err) {
      setMessage("Error loading dashboard data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshDashboard();
  }, [refreshDashboard]);

  const handleUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);

    setLoading(true);
    await fetch("http://127.0.0.1:5000/upload", { method: "POST", body: formData });
    setMessage("File uploaded successfully.");
    await refreshDashboard(); 
    setLoading(false);
  };

  const addEntry = async () => {
    if (!newEntry.date) {
      setMessage("Please select a date.");
      return;
    }
    const payload = { ...newEntry, amount: parseFloat(newEntry.amount) };
    setLoading(true);
    await fetch("http://127.0.0.1:5000/add_entry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setNewEntry({ category: "income", description: "", amount: "", date: "" });
    setMessage("Entry added successfully.");
    await refreshDashboard();
    setLoading(false);
  };

  const deleteEntry = async (id) => {
    setLoading(true);
    await fetch(`http://127.0.0.1:5000/delete_entry/${id}`, { method: "POST" });
    setMessage("Entry deleted.");
    await refreshDashboard();
    setLoading(false);
  };

  const deleteAll = async () => {
    if (!window.confirm("Are you sure you want to delete all entries?")) return;
    setLoading(true);
    await fetch("http://127.0.0.1:5000/delete_all", { method: "POST" });
    setEntries([]);
    setIncome(0);
    setExpenses(0);
    setNet(0);
    setForecast(null);
    setAlerts([]);
    setInsights([]);
    setMessage("All entries deleted.");
    setLoading(false);
  };

  const chartData = {
    labels: entries.map((e) => e.description),
    datasets: [
      {
        label: "Income",
        data: entries.filter(e => e.category === "income").map(e => e.amount),
        borderColor: "green",
        backgroundColor: "lightgreen",
      },
      {
        label: "Expenses",
        data: entries.filter(e => e.category === "expense").map(e => e.amount),
        borderColor: "red",
        backgroundColor: "pink",
      },
      {
        label: "Net",
        data: entries.map((e) => (e.category === "income" ? e.amount : -e.amount)),
        borderColor: "gray",
        backgroundColor: "lightgray",
      },
    ],
  };

  const chartOptions = {
  responsive: true,
  plugins: {
    legend: {
      position: 'top',
      labels: {
        color: '#333',
        font: { size: 14, weight: 'bold' }
      }
    },
    title: {
      display: true,
      text: 'Cashflow Trend',
      color: '#333',
      font: { size: 18, weight: 'bold' }
    }
  },
  scales: {
    x: {
      grid: { color: '#ddd' },
      ticks: { color: '#333' }
    },
    y: {
      grid: { color: '#ddd' },
      ticks: { color: '#333' }
    }
  },
  elements: {
    line: {
      tension: 0.4, // smooth curves
      borderWidth: 3
    },
    point: {
      radius: 5,
      backgroundColor: '#fff',
      borderWidth: 2
    }
  }
};


  return (
    <div className="dashboard">
      {loading && <div className="spinner">Loading...</div>}
      {message && <div className="message">{message}</div>}

      <section className="summary grid grid-cols-3 gap-4 my-6">
        <div className="card green">
          <h4>Income</h4>
          <p>${income.toLocaleString()}</p>
        </div>
        <div className="card red">
          <h4>Expenses</h4>
          <p>${expenses.toLocaleString()}</p>
        </div>
        <div className="card gray">
          <h4>Net</h4>
          <p>${net.toLocaleString()}</p>
        </div>
      </section>

      <section className="upload card">
        <h3>Upload File</h3>
        <input type="file" onChange={handleUpload} />
      </section>

      <section className="add-entry card">
        <h3>Add Entry</h3>
        <select
          value={newEntry.category}
          onChange={(e) => setNewEntry({ ...newEntry, category: e.target.value })}
        >
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </select>
        <input
          type="text"
          placeholder="Description"
          value={newEntry.description}
          onChange={(e) => setNewEntry({ ...newEntry, description: e.target.value })}
        />
        <input
          type="number"
          placeholder="Amount"
          value={newEntry.amount}
          onChange={(e) => setNewEntry({ ...newEntry, amount: e.target.value })}
        />
        <input
          type="date"
          value={newEntry.date}
          onChange={(e) => setNewEntry({ ...newEntry, date: e.target.value })}
        />
        <button onClick={addEntry}>Add</button>
      </section>

      <section className="entries card">
  <h3>Entries</h3>
  <table className="min-w-full border border-gray-200 rounded-lg shadow-sm">
    <thead className="bg-gray-100">
      <tr>
        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">ID</th>
        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Date</th>
        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Category</th>
        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Description</th>
        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Amount</th>
        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Action</th>
      </tr>
    </thead>
    <tbody>
      {entries.map((e) => (
        <tr
          key={e.id}
          className={e.category === "income" ? "income-row" : "expense-row"}
        >
          <td className="px-4 py-2">{e.id}</td>
          <td className="px-4 py-2">{e.date}</td>
          <td className="px-4 py-2">{e.category}</td>
          <td className="px-4 py-2">{e.description}</td>
          <td className="px-4 py-2">${e.amount.toLocaleString()}</td>
          <td className="px-4 py-2">
            <button className="delete-btn" onClick={() => deleteEntry(e.id)}>
              Delete
            </button>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
  <button
    className="mt-4 delete-btn"
    onClick={deleteAll}
  >
    Delete All Entries
  </button>
</section>

<section className="chart card">
  <h3>Cashflow Chart</h3>
  <div style={{ width: "600px", height: "400px" }}>
    <Line data={chartData} options={chartOptions} />
  </div>
</section>

<section className="forecast card">
  <h3>Forecast</h3>
  {forecast ? (
    <div style={{color:"green", fontWeight:"bold"}}>
      Current Net Cashflow: ${net.toLocaleString()} <br />
      Predicted Next Net Cashflow: ${(net + (income - expenses) * 0.1).toLocaleString()}
    </div>
  ) : (
    <div>No forecast available</div>
  )}
</section>

<section className="alerts card">
  <h3>Automated Alerts</h3>
  {alerts.length === 0 ? (
    <div style={{color:"gray"}}>No alerts</div>
  ) : (
    alerts.map((a, i) => <div key={i} style={{color:"red", fontWeight:"bold"}}>{a}</div>)
  )}
</section>

<section className="insights card">
  <h3>Insights</h3>
  {insights.length === 0 ? (
    <div>No insights</div>
  ) : (
    insights.map((i, idx) => <div key={idx} style={{color:"blue"}}>{i}</div>)
  )}
</section>


</div>
);
}

export default ForecastSection;
