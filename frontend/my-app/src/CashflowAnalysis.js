import React, { useState, useEffect } from "react";

function CashflowAnalysis() {
  const [entries, setEntries] = useState([]);
  const [income, setIncome] = useState(0);
  const [expenses, setExpenses] = useState(0);
  const [net, setNet] = useState(0);

  // Recalculate totals
  const recalcTotals = (data) => {
    let inc = 0, exp = 0;
    data.forEach((e) => {
      if (e.category === "income") inc += e.amount;
      else exp += e.amount;
    });
    setIncome(inc);
    setExpenses(exp);
    setNet(inc - exp);
  };

  useEffect(() => {
    const loadEntries = async () => {
      const res = await fetch("http://127.0.0.1:5000/cashflow");
      const data = await res.json();
      setEntries(Array.isArray(data) ? data : []);
      recalcTotals(data);
    };

    loadEntries();
  }, []); // ✅ no ESLint warning now

  return (
    <div>
      <h2>Cashflow Analysis</h2>
      <div style={{ display: "flex", gap: "20px" }}>
        <div style={{ color: "green" }}>Income: ${income}</div>
        <div style={{ color: "red" }}>Expenses: ${expenses}</div>
        <div style={{ color: "gray" }}>Net: ${net}</div>
      </div>

      <h3>Entries</h3>
      <table border="1">
        <thead>
          <tr>
            <th>ID</th><th>Category</th><th>Description</th><th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {entries.length === 0 ? (
            <tr><td colSpan="4">No data available</td></tr>
          ) : (
            entries.map((e) => (
              <tr key={e.id}>
                <td>{e.id}</td>
                <td>{e.category}</td>
                <td>{e.description}</td>
                <td>${e.amount}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default CashflowAnalysis;
