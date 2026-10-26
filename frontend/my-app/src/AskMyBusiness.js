import { useState, useMemo } from "react";
import API_BASE_URL from "./apiConfig";

export default function AskMyBusiness({
  transactions = [],
  totalRevenue = 0,
  totalExpenses = 0,
  topExpense = null,
  horizon = 12,
  currency = "NGN",
  realRunway = "N/A",
  profitMargin = 0,
  businessMemory = null,
  context = "dashboard",
  isDarkMode = false
}) {
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState(null);
  const [loading, setLoading] = useState(false);
  const sym = ({ USD: "$", EUR: "€", GBP: "£", NGN: "₦", ZAR: "R", KES: "KSh", GHS: "₵" }[currency] || "$");

  const page = useMemo(() => {
    const path = window.location.pathname.toLowerCase();
    if (path.includes("alert")) return "alerts";
    if (path.includes("forecast")) return "forecast";
    return context;
  }, [context]);

  const detectLanguage = (text) => {
    const t = text.toLowerCase();
    if (/abeg|dey|no dey|wetin|shebi|una|my shop|customers no dey|how e be/.test(t)) return "pidgin";
    if (/pourquoi|comment|perds|argent|boutique|loyer|gagner|perte/.test(t)) return "fr";
    if (/por qué|por que|ganar|perdiendo|dinero|alquiler|pérdida/.test(t)) return "es";
    if (/kilode|owo|bawo|se lo/.test(t)) return "yo";
    return "en";
  };

  const monthsWithData = useMemo(() => {
    const s = new Set();
    transactions.forEach(t => {
      if(t.date){
        const d = new Date(t.date);
        if(!isNaN(d.getTime())) s.add(d.toISOString().slice(0,7));
      }
    });
    return s.size || 2;
  }, [transactions]);

  const topExpenseDesc = useMemo(() => {
    if (!topExpense) return null;
    const cat = (topExpense[0]||"").toLowerCase();
    const same = transactions.filter(t => t.type?.toLowerCase() === "expense" && (t.category||"").toLowerCase() === cat && t.description);
    if (!same.length) return null;
    const freq = {};
    same.forEach(t=> { const d=t.description.trim(); freq[d]=(freq[d]||0)+1; });
    return Object.entries(freq).sort((a,b)=>b[1]-a[1])[0]?.[0] || same[0].description;
  }, [transactions, topExpense]);

  const getSmart = (question) => {
    const lo = question.toLowerCase();
    const lang = detectLanguage(question);
    const cash = totalRevenue - totalExpenses;
    const rent = topExpense?.[1] || 0;
    const rentName = topExpense?.[0] || businessMemory?.top_expense_category || "Your biggest cost";
    const rentFull = topExpenseDesc? `${rentName} (${topExpenseDesc})` : rentName;
    const busy = businessMemory?.busiest_day || "Monday";
    const weak = businessMemory?.weakest_day || "Thursday";

    const t = (en, fr, pi) => {
      if (lang === "fr") return fr;
      if (lang === "pidgin") return pi || en;
      return en;
    };

    if (lo.includes("hire") || lo.includes("staff") || lo.includes("worker") || lo.includes("employ")) {
      const cost = currency === "NGN"? 40000 : 500;
      const can = cash > cost;
      return {
        title: t(`Can you hire now?`, `Peux-tu embaucher?`, `You fit hire?`),
        plain: t(can? `Yes, you can hire for ${busy} rush. It will cost ${sym}${cost.toLocaleString()} per month. You have enough because you make ${sym}${cash.toLocaleString()} per month.` : `Not now. You are losing ${sym}${Math.abs(cash).toLocaleString()} per month. Fix your costs first.`, can? `Oui, tu peux embaucher pour ${busy}.` : `Pas maintenant, tu perds de l'argent.`, can? `Yes, you fit hire for ${busy} rush.` : `No, you no fit hire now. You dey lose money.`),
        action: t(`Hire part-time only on ${busy}, test for 2 weeks.`, `Embauche seulement ${busy} à temps partiel.`, `Hire part-time only for ${busy}.`)
      };
    }
    if (lo.includes("discount")) {
      const lossExtra = totalRevenue * 0.1;
      return {
        title: t(`What if you give 10% discount?`, `Et si tu donnes 10% de remise?`, `Wetin go happen if you give 10% discount?`),
        plain: t(`If you give 10% discount, you will lose extra ${sym}${lossExtra.toLocaleString()} per month. Your money will finish in ${realRunway}.`, `Si tu donnes 10% de remise, tu perds ${sym}${lossExtra.toLocaleString()} en plus.`, `If you give 10% discount, you go lose extra ${sym}${lossExtra.toLocaleString()} per month.`),
        action: t(`Don't give 10% discount now. Give a small free item instead. Focus on selling more on ${weak}.`, `Ne donne pas 10% de remise maintenant.`, `No give 10% discount now. Focus for ${weak}.`)
      };
    }
    return {
      title: t(`Your business today`, `Ton business aujourd'hui`, `How your business be today`),
      plain: t(
        `You ${cash>=0?'make':'lose'} ${sym}${Math.abs(cash).toLocaleString()} per month because ${rentFull} is high and ${weak} sales are slow. Your best day is ${busy}. You keep ${profitMargin.toFixed(0)} for every 100 you sell. You have ${monthsWithData} months of history.`,
        `Tu ${cash>=0?'gagnes':'perds'} ${sym}${Math.abs(cash).toLocaleString()} par mois car ${rentFull} trop cher et ${weak} faible. Meilleur jour ${busy}. ${monthsWithData} mois d'historique.`,
        `You dey ${cash>=0?'make':'lose'} ${sym}${Math.abs(cash).toLocaleString()} per month because ${rentFull} too high and ${weak} sales low. Best na ${busy}. You get ${monthsWithData} months history.`
      ),
      action: t(`1) Cut ${rentFull} by 10% (save ${sym}${(rent*0.1).toLocaleString()}), 2) Sell 20% more on ${busy}, 3) Do small promo on ${weak}.`, `1) Coupe ${rentFull} 10%, 2) Vends plus sur ${busy}, 3) Promo sur ${weak}.`, `1) Cut ${rentFull} 10%, 2) Sell more for ${busy}, 3) Small promo for ${weak}.`)
    };
  };

  const askAI = async (customQ) => {
    const question = customQ || q;
    if (!question.trim()) return;
    setLoading(true);
    setAnswer(null);
    try {
      const token = localStorage.getItem("token");
      const ctx = {
        totalRevenue, totalExpenses, netProfit: totalRevenue - totalExpenses, profitMargin, realRunway, topExpense, topExpenseDesc, horizon, currency,
        last3Months: transactions.slice(-20),
        businessMemory: businessMemory? { busiest_day: businessMemory.busiest_day, weakest_day: businessMemory.weakest_day, total_months: monthsWithData, insights: businessMemory.insights } : null,
        page, question, language: detectLanguage(question)
      };
      const res = await fetch(`${API_BASE_URL}/ask-ai`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify(ctx)
      });
      const data = await res.json();
      if (!data.plain) throw new Error("empty");
      setAnswer(data);
    } catch {
      setAnswer(getSmart(question));
    }
    setLoading(false);
  };

  const cardCls = isDarkMode? "bg-gray-800/70 backdrop-blur-xl border border-white/10 text-white" : "bg-white border-2 border-gray-900 text-gray-900";
  const inputCls = isDarkMode? "border border-white/20 bg-gray-700/80 text-white placeholder-gray-400" : "border-2 border-gray-900 bg-white text-gray-900 placeholder-gray-500";
  const resultCls = isDarkMode? "bg-gray-900 border border-white/10 text-white" : "bg-gray-900 text-white";

  return (
    <div className={`${cardCls} p-8 rounded-2xl shadow-2xl mb-8`}>
      <h2 className={`text-[11px] font-black uppercase tracking-widest ${isDarkMode? "text-indigo-300" : "text-indigo-600"}`}>
        Ask about your business • {monthsWithData} months history {businessMemory?.busiest_day? `• Best day ${businessMemory.busiest_day}` : ""}
      </h2>

      <div className="flex gap-3 mt-5">
        <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && askAI()} placeholder="Ask anything: Abeg my shop no dey profit / Pourquoi je perds de l'argent?" className={`flex-1 rounded-xl px-6 py-5 text-[14px] font-bold outline-none ${inputCls}`} />
        <button onClick={() => askAI()} className={`${isDarkMode? "bg-white text-gray-900" : "bg-gray-900 text-white"} px-8 py-5 rounded-xl font-black text-[14px]`}>{loading? "..." : "Ask →"}</button>
      </div>

      <div className="flex gap-2 mt-4 flex-wrap">
        {["Can I hire someone?", `Why is ${topExpense?.[0] || "my cost"} so high?`, `Should I focus on ${businessMemory?.busiest_day || "Monday"}?`, "What if I give 10% discount?", "How to make more profit?", "My customers no dey come"].map(t => (
          <button key={t} onClick={() => { setQ(t); askAI(t); }} className={`${isDarkMode? "bg-white/10 border border-white/20 text-white" : "bg-[#fef08a] border-2 border-gray-900 text-gray-900"} px-3 py-1.5 rounded-full text-[11px] font-black`}>{t}</button>
        ))}
      </div>

      <p className={`mt-4 text-[12px] font-bold ${isDarkMode? "text-gray-400" : "text-gray-500"}`}>Ask in English, Pidgin, French, Spanish. Your data is real — from your own sales.</p>

      {answer && (
        <div className={`mt-8 p-7 rounded-2xl ${resultCls}`}>
          <h3 className="text-[16px] font-black">{answer.title}</h3>
          <p className="mt-3 text-[14px] font-bold leading-relaxed">{answer.plain}</p>
          <p className="mt-4 text-[14px] font-black text-emerald-300">✅ {answer.action}</p>
        </div>
      )}
    </div>
  );
}