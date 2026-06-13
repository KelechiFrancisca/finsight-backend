import { useState, useEffect } from "react";

function Settings() {
  const [businessName, setBusinessName] = useState("");
  const [currency, setCurrency] = useState("");
  const [loading, setLoading] = useState(true);

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

    fetch(`${baseUrl}/settings`, {
      headers: { Authorization: "Bearer " + token },
    })
      .then((res) => res.json())
      .then((data) => {
        setBusinessName(data.business_name || "");
        setCurrency(data.currency || "");
        setLoading(false);
      })
      .catch((err) => {
        console.error("Settings fetch error:", err);
        setLoading(false);
      });
  }, [baseUrl]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const token = localStorage.getItem("token");

    fetch(`${baseUrl}/settings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({ business_name: businessName, currency }),
    })
      .then((res) => res.json())
      .then((data) => {
        alert(data.message || "Settings saved!");
      })
      .catch((err) => console.error("Settings save error:", err));
  };

  const handleClearData = () => {
    if (window.confirm("Are you sure you want to clear all data?")) {
      const token = localStorage.getItem("token");
      fetch(`${baseUrl}/clear_entries`, {
        method: "DELETE",
        headers: { Authorization: "Bearer " + token },
      })
        .then(() => {
          localStorage.clear();
          window.location.href = "/login";
        })
        .catch((err) => console.error("Error clearing data:", err));
    }
  };

  return (
    <div className="bg-gray-100 min-h-screen p-6">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">Settings</h1>

      {/* Business Info */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-lg font-semibold mb-4">Business Information</h2>
        {loading ? (
          <p>Loading...</p>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-gray-700">Business Name</label>
              <input
                type="text"
                className="w-full border rounded px-3 py-2"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-gray-700">Currency</label>
              <input
                type="text"
                className="w-full border rounded px-3 py-2"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              />
            </div>
            <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">
              Save Settings
            </button>
          </form>
        )}
      </div>

      {/* Data Management */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-lg font-semibold mb-4">Data Management</h2>
        <p className="text-gray-700 mb-4">Manage your financial records here.</p>
        <button
          className="bg-red-600 text-white px-4 py-2 rounded"
          onClick={handleClearData}
        >
          Clear All Data
        </button>
      </div>

      {/* About */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-lg font-semibold mb-4">About</h2>
        <p className="text-gray-700">
          AI Business Insights Dashboard v1.0.0 — helping SMBs track cashflow, forecast finances, and receive actionable alerts.
        </p>
      </div>
    </div>
  );
}

export default Settings;
