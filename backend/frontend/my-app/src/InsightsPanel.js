function InsightsPanel({ transactions }) {
  // Totals
  const totalRevenue = transactions
    .filter(t => t.type && t.type.toLowerCase() === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalExpenses = transactions
    .filter(t => t.type && t.type.toLowerCase() === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  // Group by month
  const monthlyData = {};
  transactions.forEach(t => {
    const key = t.date.slice(0,7); // YYYY-MM
    if (!monthlyData[key]) monthlyData[key] = { income: 0, expense: 0 };
    if (t.type.toLowerCase() === "income") monthlyData[key].income += Number(t.amount);
    else monthlyData[key].expense += Number(t.amount);
  });

  const months = Object.keys(monthlyData).sort();
  const lastMonth = months[months.length - 1];
  const prevMonth = months[months.length - 2];

  let expenseTrend = "normal";
  let trendMessage = "";
  if (lastMonth && prevMonth) {
    const lastExp = monthlyData[lastMonth].expense;
    const prevExp = monthlyData[prevMonth].expense;
    const change = prevExp > 0 ? ((lastExp - prevExp) / prevExp) * 100 : 0;
    if (change > 15) {
      expenseTrend = "rising";
      trendMessage = `Expenses increased by ${change.toFixed(1)}% compared to last month.`;
    } else if (change < -10) {
      expenseTrend = "falling";
      trendMessage = `Expenses dropped by ${Math.abs(change).toFixed(1)}% compared to last month.`;
    } else {
      trendMessage = "Expenses are steady compared to last month.";
    }
  }

  // Forecast logic
  const forecast = netProfit < 2000
    ? "Cash reserves may drop below safe levels in 45 days."
    : "Cashflow looks stable for the next 2 months.";

  // Suggested action
  const suggestion =
    expenseTrend === "rising"
      ? "Consider renegotiating supplier contracts or cutting non‑essential costs."
      : expenseTrend === "falling"
      ? "You may have room to reinvest savings into growth."
      : "Maintain current expense levels to keep profit steady.";

  return (
    <div className="bg-yellow-50 p-6 rounded-lg shadow mb-8">
      <h2 className="text-xl font-bold mb-4">Cashflow Insights</h2>
      <ul className="space-y-2 text-gray-800">
        <li>📊 {trendMessage}</li>
        <li>🔮 Forecast: {forecast}</li>
        <li>💡 Suggested Action: {suggestion}</li>
        <li>📈 Net Profit: ${netProfit.toFixed(2)} (Margin: {profitMargin.toFixed(2)}%)</li>
      </ul>
    </div>
  );
}

export default InsightsPanel;
