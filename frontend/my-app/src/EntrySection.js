import { useEffect, useState } from "react";
import EntrySection from "./EntrySection";

// ✅ Currency symbols + formatter
const currencySymbols = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  CAD: "C$",
  JPY: "¥",
  NGN: "₦",
  ZAR: "R",
  KES: "KSh",
  GHS: "₵",
  EGP: "£E",
  XOF: "CFA",
  XAF: "CFA"
};

function formatAmount(amount, currency) {
  const symbol = currencySymbols[currency] || "";
  return `${symbol}${Number(amount).toLocaleString()}`;
}

function Entries() {
  const [entries, setEntries] = useState([]);
  const [currency, setCurrency] = useState("USD"); // default until fetched

  useEffect(() => {
    const token = localStorage.getItem("token");
    fetch("http://127.0.0.1:5000/api/settings", {
      headers: { Authorization: "Bearer " + token }
    })
      .then(res => res.json())
      .then(data => setCurrency(data.currency || "USD"))
      .catch(err => console.error("Fetch settings error:", err));

    fetch("http://127.0.0.1:5000/api/entries", {
      headers: { Authorization: "Bearer " + token }
    })
      .then(res => res.json())
      .then(data => setEntries(data))
      .catch(err => console.error("Fetch entries error:", err));
  }, []);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Financial Entries</h2>
      <EntrySection onAdd={setEntries} />
      <table className="min-w-full bg-white border">
        <thead>
          <tr>
            <th className="px-4 py-2 border">Date</th>
            <th className="px-4 py-2 border">Category</th>
            <th className="px-4 py-2 border">Description</th>
            <th className="px-4 py-2 border">Amount</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(entry => (
            <tr key={entry.id}>
              <td className="px-4 py-2 border">{entry.date}</td>
              <td className="px-4 py-2 border">{entry.category}</td>
              <td className="px-4 py-2 border">{entry.description}</td>
              {/* ✅ Use formatAmount here */}
              <td className="px-4 py-2 border">
                {formatAmount(entry.amount, currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Entries;
