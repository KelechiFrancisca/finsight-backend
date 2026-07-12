import { useEffect, useState } from "react";
import { Line, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import InsightsPanel from "./InsightsPanel";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

function Forecast() {
  const [transactions, setTransactions] = useState([]);
  const [activeTab, setActiveTab] = useState("trend");
  const [activeScenario, setScenario] = useState("Realistic");
  const [showModal, setShowModal] = useState(false);
  const [horizon, setHorizon] = useState(12);

  const baseUrl =
    window.location.hostname === "localhost"
      ? "http://127.0.0.1:5000/api"
      : "https://ai-business-insights-dashboard.onrender.com/api";

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "/login";
      return;
    }
    fetch(`${baseUrl}/entries`, {
      headers: { Authorization: "Bearer " + token },
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setTransactions(data);
        }
      })
      .catch((err) => console.error("Error fetching entries:", err));
  }, [baseUrl]);

  // Totals
  const totalRevenue = transactions
    .filter(t => t.type && t.type.toLowerCase() === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalExpenses = transactions
    .filter(t => t.type && t.type.toLowerCase() === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  // Scenario datasets
  const scenarios = {
    Optimistic: { revenueChange: 10, expenseChange: -5, churn: [4,4,3.5,3.5,3,3], salesGrowth: [12,13,14,15,16,17], inventory: [4.5,4.6,4.7,4.8,4.9,5], expenseRatio: [38,37,36,36,35,35] },
    Realistic: { revenueChange: 5, expenseChange: 0, churn: [5,5,5,5,5,5], salesGrowth: [10,11,12,12,12,13], inventory: [4,4.1,4.1,4.2,4.2,4.3], expenseRatio: [40,40,40,41,40,40] },
    Pessimistic: { revenueChange: 2, expenseChange: 5, churn: [6,6.5,7,7,7.5,8], salesGrowth: [8,8.5,9,9,9.5,10], inventory: [3.8,3.7,3.6,3.5,3.5,3.4], expenseRatio: [42,43,44,44,45,45] },
  };

  const scenario = scenarios[activeScenario];

  // Adjusted values
  const adjustedRevenue = totalRevenue * (1 + scenario.revenueChange / 100);
  const adjustedExpenses = totalExpenses * (1 + scenario.expenseChange / 100);
  const adjustedProfit = adjustedRevenue - adjustedExpenses;
  const adjustedMargin = adjustedRevenue > 0 ? (adjustedProfit / adjustedRevenue) * 100 : 0;

  // Multi‑month projections (dynamic horizon)
  const monthsAhead = Array.from({ length: horizon }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() + i + 1);
    return d.toLocaleString("default", { month: "short", year: "numeric" });
  });

  const projectedRevenue = monthsAhead.map((_, i) =>
    adjustedRevenue * Math.pow(1 + scenario.revenueChange / 100, i + 1)
  );
  const projectedExpenses = monthsAhead.map((_, i) =>
    adjustedExpenses * Math.pow(1 + scenario.expenseChange / 100, i + 1)
  );
  const projectedProfit = projectedRevenue.map((rev, i) => rev - projectedExpenses[i]);
  const projectedMargin = projectedRevenue.map((rev, i) =>
    rev > 0 ? ((rev - projectedExpenses[i]) / rev) * 100 : 0
  );

  // Cumulative cashflow
  const startingReserves = 5000;
  const cumulativeCashflow = projectedProfit.reduce((acc, profit, i) => {
    const prev = i === 0 ? startingReserves : acc[i - 1];
    acc.push(prev + profit);
    return acc;
  }, []);

  // Export CSV
  const exportCSV = () => {
    const rows = [["Month","Revenue","Expenses","Profit","Margin"]];
    monthsAhead.forEach((m, i) => {
      rows.push([m, projectedRevenue[i], projectedExpenses[i], projectedProfit[i], projectedMargin[i]]);
    });
    const csvContent = "data:text/csv;charset=utf-8," + rows.map(r => r.join(",")).join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = "forecast.csv";
    link.click();
  };

  return (
    <div className="bg-gray-100 min-h-screen p-6">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">AI-Powered Forecast</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-md">
          <h2 className="text-sm font-semibold text-gray-600">Revenue</h2>
          <p className="text-xl font-bold text-teal-600">${totalRevenue.toFixed(2)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-md">
          <h2 className="text-sm font-semibold text-gray-600">Expenses</h2>
          <p className="text-xl font-bold text-red-600">${totalExpenses.toFixed(2)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-md">
          <h2 className="text-sm font-semibold text-gray-600">Net Profit</h2>
          <p className="text-xl font-bold text-blue-600">${netProfit.toFixed(2)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-md">
          <h2 className="text-sm font-semibold text-gray-600">Margin</h2>
          <p className="text-xl font-bold text-purple-600">{profitMargin.toFixed(2)}%</p>
        </div>
      </div>

      {/* Cashflow Insights */}
      <InsightsPanel transactions={transactions} />

      {/* Scenario Compare Toggle */}
      <div className="flex space-x-4 mb-6">
        {["Optimistic", "Realistic", "Pessimistic"].map((s) => (
          <button
            key={s}
            onClick={() => setScenario(s)}
            className={`px-4 py-2 rounded-lg font-semibold ${
              activeScenario === s ? "bg-teal-500 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Forecast Horizon Dropdown */}
      <div className="mb-6 flex items-center space-x-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Forecast Horizon</label>
          <select
            value={horizon}
            onChange={(e) => setHorizon(Number(e.target.value))}
            className="border p-2 rounded w-40"
          >
            <option value={6}>6 months</option>
            <option value={12}>12 months</option>
            <option value={24}>24 months</option>
          </select>
        </div>
        <button
          onClick={exportCSV}
          className="bg-teal-500 text-white px-4 py-2 rounded hover:bg-teal-600"
        >
          Export CSV
        </button>
      </div>

            {/* Forecast Summary Card */}
      <div className="bg-gradient-to-r from-teal-500 to-teal-300 text-white p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-xl font-bold mb-2">Forecast Summary ({activeScenario})</h2>
        <p className="text-lg">
          {netProfit < 2000
            ? "⚠️ Cash reserves may dip below safe levels. Consider reducing expenses or boosting revenue."
            : "✅ Cashflow looks stable. Current reserves are sufficient to sustain operations."}
        </p>
        <p className="mt-2">
          Current Margin: <span className="font-bold">{profitMargin.toFixed(2)}%</span>
        </p>
        <p>
          Projected Profit in {horizon} months:{" "}
          <span className="font-bold">${projectedProfit[horizon-1].toFixed(2)}</span>
        </p>
        <p>
          Projected Margin in {horizon} months:{" "}
          <span className="font-bold">{projectedMargin[horizon-1].toFixed(2)}%</span>{" "}
          {projectedMargin[horizon-1] > profitMargin ? "⬆️" : projectedMargin[horizon-1] < profitMargin ? "⬇️" : "➡️"}
        </p>

        {/* Adjusted Margin Badge with Arrow */}
        <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg font-semibold mt-2 inline-block">
          Adjusted Margin: {adjustedMargin.toFixed(2)}%{" "}
          {adjustedMargin > profitMargin ? "⬆️" : adjustedMargin < profitMargin ? "⬇️" : "➡️"}
        </span>

        {/* Recommended Action Button */}
        <div className="mt-4">
          <button
            onClick={() => setShowModal(true)}
            className="bg-white text-teal-600 font-semibold px-4 py-2 rounded-lg shadow hover:bg-gray-100"
          >
            {netProfit < 2000 ? "Cut Costs by 10%" : "Invest in Growth"}
          </button>
        </div>
      </div>

      {/* Modal Popup */}
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md">
            <h3 className="text-lg font-bold mb-4 text-gray-800">Recommended Action</h3>
            <p className="text-gray-700 mb-4">
              {netProfit < 2000
                ? "Reducing costs by 10% saves ~$360/month, improving cash reserves and lowering risk."
                : "Investing in growth could raise revenue by ~15%, boosting profit margins and long-term stability."}
            </p>
            <div className="flex justify-between">
              <button
                onClick={() => setShowModal(false)}
                className="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400"
              >
                Close
              </button>
              <a
                href="/alerts"
                className="bg-teal-500 text-white px-4 py-2 rounded hover:bg-teal-600"
              >
                Take Action →
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Tabs for Trend, Proportion, Liquidity, Growth, Risk, Efficiency, Breakdown, Heatmap */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Forecast Visuals</h2>
        <div className="flex space-x-4 mb-6 flex-wrap">
          {["trend","proportion","liquidity","growth","risk","efficiency","breakdown","heatmap"].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded mb-2 ${
                activeTab === tab ? "bg-teal-600 text-white" : "bg-gray-200"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Trend Chart */}
        {activeTab === "trend" && (
          <div>
            <Line data={{
              labels: monthsAhead,
              datasets: [
                { label: "Revenue", data: projectedRevenue, borderColor: "#10B981", backgroundColor: "#A7F3D0", fill: false, tension: 0.4, pointRadius: 5 },
                { label: "Expenses", data: projectedExpenses, borderColor: "#EF4444", backgroundColor: "#FCA5A5", fill: false, tension: 0.4, pointRadius: 5 },
                { label: "Profit", data: projectedProfit, borderColor: "#3B82F6", backgroundColor: "#93C5FD", fill: true, tension: 0.4, pointRadius: 5 },
              ],
            }} />
            <p className={`mt-3 text-base font-semibold px-3 py-2 rounded-lg shadow-sm ${profitMargin > 50 ? "bg-green-50 text-gray-900" : "bg-blue-50 text-gray-900"}`}>
              {profitMargin > 50 ? "✅ Strong margins above 50%." : "📈 Profit remains stable, with expenses steady at ~40% of revenue."}
            </p>
          </div>
        )}

        {/* Proportion Chart */}
        {activeTab === "proportion" && (
          <div>
            <Bar
              data={{
                labels: monthsAhead,
                datasets: [
                  { label: "Expenses", data: projectedExpenses, backgroundColor: "#FCA5A5", stack: "combined" },
                  { label: "Profit", data: projectedProfit, backgroundColor: "#A7F3D0", stack: "combined" },
                ],
              }}
              options={{ scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } }}}
            />
            <p className="mt-3 text-base text-gray-900 font-semibold bg-green-50 px-3 py-2 rounded-lg shadow-sm">
              💰 Each month, profit consistently exceeds expenses, showing healthy margins.
            </p>
          </div>
        )}

        {/* Liquidity Chart */}
        {activeTab === "liquidity" && (
          <div>
            <Line
              data={{
                labels: monthsAhead,
                datasets: [{ label: "Cash Reserves ($)", data: cumulativeCashflow, borderColor: "#14B8A6", backgroundColor: "#67E8F9", fill: true, tension: 0.4, pointRadius: 5 }],
              }}
            />
            <p className="mt-3 text-base text-gray-900 font-semibold bg-blue-50 px-3 py-2 rounded-lg shadow-sm">
              📊 Cash reserves are projected to grow steadily, reaching ~${cumulativeCashflow[horizon-1].toFixed(0)} by {monthsAhead[horizon-1]}.
            </p>
          </div>
        )}

        {/* Growth Tab */}
        {activeTab === "growth" && (
          <div>
            <Line
              data={{
                labels: monthsAhead,
                datasets: [
                  { label: "Sales Growth (%)", data: scenario.salesGrowth, borderColor: "#10B981", backgroundColor: "#A7F3D0", fill: false, tension: 0.4, pointRadius: 5 },
                  { label: "Customer Churn (%)", data: scenario.churn, borderColor: "#EF4444", backgroundColor: "#FCA5A5", fill: false, tension: 0.4, pointRadius: 5 },
                ],
              }}
            />
            <p className={`mt-3 text-base font-semibold px-3 py-2 rounded-lg shadow-sm ${Math.max(...scenario.churn) > 7 ? "bg-red-50 text-gray-900" : "bg-blue-50 text-gray-900"}`}>
              {Math.max(...scenario.churn) > 7 ? "⚠️ Churn risk rising above 7%." : "📈 Sales expected to grow, while churn remains manageable."}
            </p>
          </div>
        )}

                {/* Risk Tab */}
        {activeTab === "risk" && (
          <div>
            <Line
              data={{
                labels: monthsAhead,
                datasets: [
                  {
                    label: "Best Case Profit",
                    data: projectedProfit.map((p) => p * 1.1),
                    borderColor: "#3B82F6",
                    backgroundColor: "#93C5FD",
                    fill: true,
                    tension: 0.4,
                    pointRadius: 5,
                  },
                  {
                    label: "Most Likely Profit",
                    data: projectedProfit,
                    borderColor: "#14B8A6",
                    backgroundColor: "#67E8F9",
                    fill: true,
                    tension: 0.4,
                    pointRadius: 5,
                  },
                  {
                    label: "Worst Case Profit",
                    data: projectedProfit.map((p) => p * 0.8),
                    borderColor: "#EF4444",
                    backgroundColor: "#FCA5A5",
                    fill: true,
                    tension: 0.4,
                    pointRadius: 5,
                  },
                ],
              }}
            />
            <p className="mt-3 text-base text-gray-900 font-semibold bg-red-50 px-3 py-2 rounded-lg shadow-sm">
              ⚠️ 20% chance of reserves dipping below $5,000 in Q4; 📊 60% chance of profit growth above 10%.
            </p>
          </div>
        )}

        {/* Efficiency Tab (Stacked Bar) */}
        {activeTab === "efficiency" && (
          <div>
            <Bar
              data={{
                labels: monthsAhead,
                datasets: [
                  {
                    label: "Inventory Turnover (x/month)",
                    data: scenario.inventory,
                    backgroundColor: "#A7F3D0",
                    stack: "efficiency",
                  },
                  {
                    label: "Expense Ratio (% of Revenue)",
                    data: scenario.expenseRatio,
                    backgroundColor: "#93C5FD",
                    stack: "efficiency",
                  },
                ],
              }}
              options={{
                scales: {
                  x: { stacked: true },
                  y: { stacked: true, beginAtZero: true },
                },
              }}
            />
            <p className="mt-3 text-base text-gray-900 font-semibold bg-green-50 px-3 py-2 rounded-lg shadow-sm">
              💡 Inventory turns ~4x per month; expenses remain ~40% of revenue, indicating stable efficiency.
            </p>
          </div>
        )}

        {/* Breakdown Tab (Waterfall Chart) */}
        {activeTab === "breakdown" && (
          <div>
            <Bar
              data={{
                labels: ["Revenue", "Expenses", "Profit"],
                datasets: [
                  {
                    label: "Financial Flow",
                    data: [adjustedRevenue, -adjustedExpenses, adjustedProfit],
                    backgroundColor: ["#10B981", "#EF4444", "#3B82F6"],
                  },
                ],
              }}
              options={{
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true } },
              }}
            />
            <p className="mt-3 text-base text-gray-900 font-semibold bg-purple-50 px-3 py-2 rounded-lg shadow-sm">
              📊 Waterfall view shows how revenue flows into expenses and results in net profit.
            </p>
          </div>
        )}

        {/* Heatmap Tab (Expenses by Category vs Month) */}
        {activeTab === "heatmap" && (
          <div>
            <Bar
              data={{
                labels: monthsAhead,
                datasets: [
                  {
                    label: "Marketing",
                    data: monthsAhead.map(() => totalExpenses * 0.3),
                    backgroundColor: "#F59E0B",
                  },
                  {
                    label: "Operations",
                    data: monthsAhead.map(() => totalExpenses * 0.4),
                    backgroundColor: "#3B82F6",
                  },
                  {
                    label: "Miscellaneous",
                    data: monthsAhead.map(() => totalExpenses * 0.3),
                    backgroundColor: "#10B981",
                  },
                ],
              }}
              options={{
                responsive: true,
                scales: {
                  x: { stacked: true },
                  y: { stacked: true, beginAtZero: true },
                },
              }}
            />
            <p className="mt-3 text-base text-gray-900 font-semibold bg-yellow-50 px-3 py-2 rounded-lg shadow-sm">
              🔎 Heatmap shows Marketing and Operations dominate monthly expenses, with Miscellaneous steady at ~30%.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Forecast;
