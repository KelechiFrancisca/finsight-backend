import { useEffect, useState } from "react";
import EntrySection from "./EntrySection";

function Entries() {
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    fetch("http://127.0.0.1:5000/entries")
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
              <td className="px-4 py-2 border">{entry.amount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Entries;
