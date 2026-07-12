import { useEffect, useState } from "react";
import { Bar, Line, Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    fetch("/api/alerts", {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          // ✅ Normalize levels before saving
          const normalized = data.map((a) => ({
            ...a,
            level: (a.level || "").toLowerCase(),
          }));
          setAlerts(normalized);
        } else {
          setAlerts([]);
        }
      })
      .catch((err) => console.error("Error fetching alerts:", err));
  }, []);

  // ✅ Case-insensitive priority counts
  const highPriority = alerts.filter((a) => a.level === "high").length;
  const mediumPriority = alerts.filter((a) => a.level === "medium").length;
  const informational = alerts.filter((a) => a.level === "info").length;

  // ✅ Export CSV function
  const exportCSV = () => {
    const rows = [["ID", "Level", "Message"]];
    alerts.forEach((a) => {
      rows.push([a.id, a.level, a.message]);
    });
    const csvContent =
      "data:text/csv;charset=utf-8," + rows.map((r) => r.join(",")).join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = "alerts.csv";
    link.click();

    setToast("📂 Alerts exported successfully!");
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="bg-gray-100 min-h-screen p-6">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">Alerts Dashboard</h1>
      <p className="text-gray-600 mb-6">
        Stay informed with intelligent alerts about your business finances.
      </p>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-lg font-semibold text-red-600">High Priority</h2>
          <p className="text-xl font-bold">{highPriority}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-lg font-semibold text-yellow-600">Medium Priority</h2>
          <p className="text-xl font-bold">{mediumPriority}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-lg font-semibold text-blue-600">Informational</h2>
          <p className="text-xl font-bold">{informational}</p>
        </div>
      </div>

      {/* Visual Charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Alert Distribution</h2>
          <Pie
            data={{
              labels: ["High", "Medium", "Info"],
              datasets: [
                {
                  data: [highPriority, mediumPriority, informational],
                  backgroundColor: ["#EF4444", "#F59E0B", "#3B82F6"],
                },
              ],
            }}
          />
          <p className="text-gray-600 mt-2">
            Shows proportion of alerts by severity.
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Alerts Trend</h2>
          <Line
            data={{
              labels: alerts.map(
                (a) => a.date || new Date(a.created_at).toISOString().slice(0, 10)
              ),
              datasets: [
                {
                  label: "Alerts Over Time",
                  data: alerts.map((_, i) => i + 1),
                  borderColor: "#10B981",
                  backgroundColor: "#A7F3D0",
                  fill: true,
                  tension: 0.4,
                },
              ],
            }}
          />
          <p className="text-gray-600 mt-2">
            Tracks how alerts accumulate over time, helping spot spikes or steady growth.
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Alerts by Category</h2>
          <Bar
            data={{
              labels: ["Fraud", "Expenses", "Revenue", "Churn"],
              datasets: [
                {
                  label: "Alerts by Category",
                  data: [
                    alerts.filter((a) => a.type === "fraud").length,
                    alerts.filter((a) => a.type === "expense").length,
                    alerts.filter((a) => a.type === "revenue").length,
                    alerts.filter((a) => a.type === "churn").length,
                  ],
                  backgroundColor: ["#EF4444", "#F59E0B", "#3B82F6", "#10B981"],
                },
              ],
            }}
            options={{ scales: { y: { beginAtZero: true } } }}
          />
          <p className="text-gray-600 mt-2">
            Breaks down alerts by type — Fraud, Expenses, Revenue, Churn — to highlight problem areas.
          </p>
        </div>
      </div>

      {/* Alerts List */}
      <div className="space-y-4">
        {alerts.map((alert) => {
          const level = (alert.level || "").toLowerCase();
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
              key={alert.id}
              className={`bg-white p-6 rounded-lg shadow-md border-l-4 ${borderColor}`}
            >
              <h3 className={`text-lg font-bold ${titleColor}`}>{title}</h3>
              <p className="text-gray-700">{alert.message}</p>
              <p className="text-gray-500 text-sm mt-1">
                {level === "high"
                  ? "Critical issue — requires immediate attention."
                  : level === "medium"
                  ? "Monitor spending closely."
                  : "Informational alert — keep monitoring."}
              </p>
              <div className="mt-3 flex space-x-4">
                <button
                  onClick={() => {
                    setSelectedAlert(alert);
                    setShowModal(true);
                  }}
                  className="bg-teal-500 text-white px-4 py-2 rounded hover:bg-teal-600"
                >
                  Resolve
                </button>
                <a
                  href="/forecast"
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                  Take Action →
                </a>
              </div>
            </div>
          );
        })}
      </div>

            {/* Modal Popup */}
      {showModal && selectedAlert && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md">
            <h3 className="text-lg font-bold mb-4 text-gray-800">Alert Details</h3>
            <p className="text-gray-700 mb-4">{selectedAlert.message}</p>
            <p className="text-gray-600 mb-4">
              Suggested Action:{" "}
              {(selectedAlert.level || "").toLowerCase() === "high"
                ? "Investigate immediately and reduce expenses."
                : (selectedAlert.level || "").toLowerCase() === "medium"
                ? "Monitor closely and adjust forecast."
                : "Informational only — keep monitoring and plan ahead."}
            </p>
            <div className="flex justify-between">
              <button
                onClick={() => setShowModal(false)}
                className="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400"
              >
                Close
              </button>
              <button
                onClick={async () => {
                  try {
                    // ✅ Call backend resolve route
                    await fetch(`/api/alerts/${selectedAlert.id}/resolve`, {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${localStorage.getItem("token")}`,
                      },
                    });
                    // Remove resolved alert from state
                    setAlerts(alerts.filter((a) => a.id !== selectedAlert.id));
                    // Show success toast
                    setToast("✅ Alert resolved successfully!");
                    setTimeout(() => setToast(null), 3000);
                  } catch (err) {
                    console.error("Error resolving alert:", err);
                    setToast("❌ Error resolving alert.");
                    setTimeout(() => setToast(null), 3000);
                  }
                  setShowModal(false);
                }}
                className="bg-teal-500 text-white px-4 py-2 rounded hover:bg-teal-600"
              >
                Mark Resolved
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Button */}
      <div className="mt-6">
        <button
          onClick={exportCSV}
          className="bg-teal-500 text-white px-4 py-2 rounded hover:bg-teal-600"
        >
          Export Alerts CSV
        </button>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-4 right-4 bg-gray-800 text-white px-4 py-2 rounded shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

export default Alerts;
