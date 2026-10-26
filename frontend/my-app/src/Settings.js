import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { FaCheckCircle, FaExclamationTriangle, FaBuilding, FaCoins, FaLock, FaTags, FaRobot, FaUniversity, FaBrain, FaUser, FaSignOutAlt, FaBullseye, FaUsers, FaCalendarAlt } from "react-icons/fa";
import API_BASE_URL from "./apiConfig";

const currencySymbols = {
  USD: "$", EUR: "€", GBP: "£", CAD: "C$", JPY: "¥",
  NGN: "₦", ZAR: "R", KES: "KSh", GHS: "₵", EGP: "£E", XOF: "CFA", XAF: "CFA"
};

function formatAmount(amount, currency = "USD") {
  const symbol = currencySymbols[currency] || "";
  return `${symbol}${Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function Settings({ isDarkMode }) {
  const navigate = useNavigate();
  const [businessName, setBusinessName] = useState("");
  const getInitialCurrency = () => {
    const locale = navigator.language || "en-US";
    if (locale.toLowerCase().includes("ng")) return "NGN";
    if (locale.toLowerCase().includes("gh")) return "GHS";
    if (locale.toLowerCase().includes("ke")) return "KES";
    if (locale.toLowerCase().includes("za")) return "ZAR";
    return "USD";
  };
  const [currency, setCurrency] = useState(getInitialCurrency());
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState(["Sales", "Rent", "Food", "Transport", "Utilities", "Marketing"]);
  const [newCategory, setNewCategory] = useState("");
  const [businessMemory, setBusinessMemory] = useState(null);
  const [realMonths, setRealMonths] = useState(null);
  const [businessType, setBusinessType] = useState(localStorage.getItem("businessType") || "Retail");
  const [businessSize, setBusinessSize] = useState(localStorage.getItem("businessSize") || "Just Me");
  const [aiMode, setAiMode] = useState(localStorage.getItem("aiMode") || "Simple");
  const [dailyAdvice, setDailyAdvice] = useState(localStorage.getItem("dailyAdvice")!== "off");
  const [adviceLang, setAdviceLang] = useState(localStorage.getItem("adviceLang") || "Auto");
  const [adviceFrequency, setAdviceFrequency] = useState(localStorage.getItem("adviceFrequency") || "Daily");
  const [mainGoal, setMainGoal] = useState(localStorage.getItem("mainGoal") || "Increase Profit");

  const [profile, setProfile] = useState({ name: "", email: "", phone: "", role: "" });
  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "" });
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { window.location.href = "/login"; return; }
    fetch(`${API_BASE_URL}/settings`, { headers: { Authorization: "Bearer " + token } })
.then((res) => res.json()).then((data) => {
        setBusinessName(data.business_name || "");
        setCurrency(data.currency || getInitialCurrency());
        setLoading(false);
      }).catch(() => setLoading(false));

    fetch(`${API_BASE_URL}/categories`, { headers: { Authorization: "Bearer " + token } })
.then(res => res.json()).then(data => {
        if (Array.isArray(data)) setCategories(data.map(c => c.name));
      }).catch(() => {});

    fetch(`${API_BASE_URL}/business-memory`, { headers: { Authorization: "Bearer " + token } })
.then(res => res.json()).then(data => {
        if (data &&!data.error) setBusinessMemory(data);
      }).catch(() => {});

    fetch(`${API_BASE_URL}/users/me`, { headers: { Authorization: "Bearer " + token } })
.then((res) => res.json()).then((data) => {
        if (!data.error) {
          setProfile({ name: data.name || "", email: data.email || "", phone: data.phone || "", role: data.role || "" });
        }
      }).catch(()=>{});

    fetch(`${API_BASE_URL}/entries`, { headers: { Authorization: "Bearer " + token } })
.then(res => res.json()).then(data => {
        const list = Array.isArray(data)? data : data.entries || data.transactions || [];
        if (list.length > 0) {
          const uniqMonths = new Set(
            list.map(e => {
              const d = new Date(e.date || e.created_at || e.transaction_date);
              if (isNaN(d)) return null;
              return `${d.getFullYear()}-${d.getMonth()}`;
            }).filter(Boolean)
          );
          setRealMonths(uniqMonths.size || null);
        }
      }).catch(()=>{});
  }, []);

  const saveLocalPrefWithToast = (key, val) => { localStorage.setItem(key, val); toast.success(`${key} saved!`); };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!businessName.trim()) { toast.warn("Please enter a business name"); return; }
    setSaving(true);
    const token = localStorage.getItem("token");
    fetch(`${API_BASE_URL}/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ business_name: businessName.trim(), currency }),
    }).then((res) => res.json()).then((data) => {
        localStorage.setItem("businessType", businessType);
        localStorage.setItem("businessSize", businessSize);
        localStorage.setItem("aiMode", aiMode);
        localStorage.setItem("adviceLang", adviceLang);
        localStorage.setItem("adviceFrequency", adviceFrequency);
        localStorage.setItem("mainGoal", mainGoal);
        localStorage.setItem("dailyAdvice", dailyAdvice? "on" : "off");
        toast.success(<div className="flex items-center space-x-2 font-bold"><FaCheckCircle className="text-green-600" /><span>{data.message || "Settings saved!"}</span></div>);
      }).catch(() => toast.error("Failed to save settings.")).finally(() => setSaving(false));
  };

  const handleClearEntries = () => {
    if (window.confirm("Clear all transactions? This cannot be undone.")) {
      const token = localStorage.getItem("token");
      fetch(`${API_BASE_URL}/clear_entries`, { method: "DELETE", headers: { Authorization: "Bearer " + token } })
 .then(() => toast.info("Transactions cleared!")).catch(() => toast.error("Failed to clear transactions."));
    }
  };

  const confirmClearAll = () => {
    if (confirmText!== "RESET") { toast.warn(<div className="flex items-center space-x-2 font-bold"><FaExclamationTriangle className="text-yellow-500" /><span>You must type RESET to confirm.</span></div>); return; }
    const token = localStorage.getItem("token");
    fetch(`${API_BASE_URL}/clear_all`, { method: "DELETE", headers: { Authorization: "Bearer " + token } })
.then(() => {
        toast.success("All data cleared successfully!");
        setShowModal(false);
        setTimeout(() => { localStorage.clear(); window.location.href = "/login"; }, 2000);
      }).catch(() => toast.error("Failed to clear all data."));
  };

  const handleAddCategory = async () => {
    const catName = newCategory.trim();
    if (!catName) return toast.warn("Enter category name");
    if (categories.includes(catName)) return toast.warn("Category already exists");
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_BASE_URL}/categories`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify({ name: catName }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error || "Failed");
      setCategories([...categories, data.name]); setNewCategory(""); toast.success("Category added — saved!");
    } catch (err) { toast.error(err.message); }
  };

  const handleDeleteCategory = async (catToDelete) => {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_BASE_URL}/categories/${encodeURIComponent(catToDelete)}`, { method: "DELETE", headers: { Authorization: "Bearer " + token } });
      if (!res.ok) throw new Error("Failed to delete");
      setCategories(categories.filter(c => c!== catToDelete)); toast.info("Category removed");
    } catch { toast.error("Failed to delete category"); }
  };

  const handleChange = (e) => { setProfile({...profile, [e.target.name]: e.target.value }); setErrors({...errors, [e.target.name]: "" }); setSuccessMessage(""); };
  const handlePasswordChange = (e) => { setPasswords({...passwords, [e.target.name]: e.target.value }); setErrors({...errors, [e.target.name]: "" }); setSuccessMessage(""); };
  const validateProfile = () => { const ne = {}; if (!profile.name.trim()) ne.name = "Name is required."; if (!/\S+@\S+\.\S+/.test(profile.email)) ne.email = "Invalid email address."; if (profile.phone &&!/^\+?[0-9\s-]{7,15}$/.test(profile.phone)) ne.phone = "Invalid phone number."; if (!profile.role) ne.role = "Role is required."; setErrors(ne); return Object.keys(ne).length===0; };
  const validatePassword = () => { const ne = {}; if (!passwords.currentPassword) ne.currentPassword = "Current password is required."; if (passwords.newPassword.length < 8) ne.newPassword = "New password must be at least 8 characters."; setErrors(ne); return Object.keys(ne).length===0; };
  const handleSaveProfile = async () => { if (!validateProfile()) return; const token = localStorage.getItem("token"); setSavingProfile(true); try { const res = await fetch(`${API_BASE_URL}/users/me`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(profile) }); const data = await res.json(); if (res.ok) { setSuccessMessage("Profile updated successfully!"); toast.success("Profile updated successfully!"); } else setErrors({ form: data.error }); } catch { setErrors({ form: "Server error" }); } finally { setSavingProfile(false); } };
  const handleSavePassword = async () => { if (!validatePassword()) return; const token = localStorage.getItem("token"); setSavingPassword(true); try { const res = await fetch(`${API_BASE_URL}/change-password`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(passwords) }); const data = await res.json(); if (res.ok) { setSuccessMessage("Password updated successfully!"); setPasswords({ currentPassword: "", newPassword: "" }); toast.success("Password updated successfully!"); } else setErrors({ form: data.error }); } catch { setErrors({ form: "Server error" }); } finally { setSavingPassword(false); } };
  const handleLogout = () => { localStorage.removeItem("token"); navigate("/login"); };

  const inputCls = isDarkMode? "w-full border border-white/20 rounded-xl px-4 py-3 font-bold bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-teal-500" : "w-full border border-gray-200 rounded-xl px-4 py-3 font-bold bg-white focus:outline-none focus:ring-2 focus:ring-gray-900";
  const labelCls = isDarkMode? "block text-sm font-bold text-gray-200 mb-1" : "block text-sm font-bold text-gray-700 mb-1";
  const displayMonths = realMonths || businessMemory?.total_months || null;
  const busyAvg = businessMemory?.busiest_day_avg || businessMemory?.busiest_day_income || 0;
  const weakAvg = businessMemory?.weakest_day_avg || businessMemory?.weakest_day_income || 0;
  const topExpAmt = businessMemory?.top_expense_amount || 0;
  const topExpPct = businessMemory?.top_expense_percent || 0;

  return (
    <div className={isDarkMode? "bg-gray-900 min-h-screen p-6 text-[15px] text-white" : "bg-[#f6f7f9] min-h-screen p-6 text-[15px] text-gray-900"}>
      <div className={isDarkMode? "bg-gray-800 border border-white/10 shadow-sm rounded-xl mb-6 p-4 flex justify-between items-center" : "bg-white border border-gray-200 shadow-sm rounded-xl mb-6 p-4 flex justify-between items-center"}>
        <h1 className="text-[16px] font-black tracking-tight">FinSight <span className="font-normal text-gray-500">• Your Business Coach</span> <span className="text-gray-400 font-normal">• {currencySymbols[currency]}</span></h1>
        <p className="text-[12px] font-bold text-gray-500">{businessType} • {businessSize} • {displayMonths? `${displayMonths} months of sales` : ""}</p>
      </div>

      <h1 className="text-[22px] font-black tracking-tight mb-1">Settings</h1>
      <p className="text-[14px] text-gray-500 mb-6 font-medium">Manage your business and how you want advice.</p>

      {successMessage && (<div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl font-bold flex items-center gap-2"><FaCheckCircle /> {successMessage}</div>)}
      {errors.form && (<div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl font-bold">{errors.form}</div>)}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className={isDarkMode? "bg-gray-800 border border-white/10 p-5 rounded-xl" : "bg-white border border-gray-200 p-5 rounded-xl shadow-sm"}><div className="flex items-center gap-2 mb-2"><FaBuilding className="text-gray-400 text-[13px]" /><h2 className="text-[12px] uppercase tracking-widest font-semibold text-gray-500">Business Name</h2></div><p className="text-[18px] font-bold truncate">{businessName || profile.name || "Not Set"}</p></div>
        <div className={isDarkMode? "bg-gray-800 border border-white/10 p-5 rounded-xl" : "bg-white border border-gray-200 p-5 rounded-xl shadow-sm"}><div className="flex items-center gap-2 mb-2"><FaCoins className="text-gray-400 text-[13px]" /><h2 className="text-[12px] uppercase tracking-widest font-semibold text-gray-500">Currency</h2></div><p className="text-[18px] font-bold">{currency || "Not Set"} {currencySymbols[currency]}</p></div>
        <div className={isDarkMode? "bg-gray-800 border border-white/10 p-5 rounded-xl" : "bg-white border border-gray-200 p-5 rounded-xl shadow-sm"}><div className="flex items-center gap-2 mb-2"><FaBrain className="text-indigo-500 text-[13px]" /><h2 className="text-[12px] uppercase tracking-widest font-semibold text-gray-500">Your Sales History</h2></div><p className="text-[18px] font-bold text-emerald-600">{displayMonths? `${displayMonths} months of sales` : "Add your first sale"}</p><p className="text-[11px] text-gray-500 mt-1">Based on your real transactions</p></div>
      </div>

      {businessMemory && (
        <div className="bg-[#fef08a] border-2 border-gray-900 p-6 rounded-xl shadow-sm mb-6">
          <div className="flex items-center gap-2 mb-3"><FaRobot className="text-gray-900" /><h2 className="text-[13px] font-black uppercase tracking-widest">What I Know About Your Business</h2></div>
          <p className="text-[14px] font-black leading-relaxed">
            Your best day is {businessMemory.busiest_day || "Friday"} ({formatAmount(busyAvg, currency)} average), your slowest day is {businessMemory.weakest_day || "Thursday"} ({formatAmount(weakAvg, currency)} average).
            You sell most {businessMemory.top_income_category || "Sales"}, your biggest spending is {businessMemory.top_expense_category || "Food"} ({formatAmount(topExpAmt, currency)} — {topExpPct.toFixed(0)}% of spending).
            Based on {displayMonths || businessMemory.total_months || 0} months of sales. You keep {businessMemory.profit_margin?.toFixed(0) || 57}% of every {formatAmount(100, currency)} you sell.
          </p>
        </div>
      )}

      <div className="bg-white border-2 border-gray-900 p-6 rounded-xl shadow-sm mb-6">
        <div className="flex items-center gap-2 mb-3"><FaBrain className="text-gray-900" /><h2 className="text-[13px] font-black uppercase tracking-widest">Your Business Summary</h2></div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-[14px]">
          <div className="bg-gray-50 border border-gray-200 p-3 rounded-lg"><p className="text-[11px] uppercase font-bold opacity-60">History</p><p className="text-[18px] font-black">{displayMonths? `${displayMonths} months` : "No sales yet"}</p><p className="text-[11px] opacity-60 mt-1">Based on {displayMonths || 0} months of sales</p></div>
          <div className="bg-gray-50 border border-gray-200 p-3 rounded-lg"><p className="text-[11px] uppercase font-bold opacity-60">Best Day — Most Sales</p><p className="text-[18px] font-black text-green-600">{businessMemory?.busiest_day || "Add sales"} {busyAvg? `(${formatAmount(busyAvg, currency)})` : ""}</p><p className="text-[11px] opacity-60 mt-1">You earn most on this day — stock more</p></div>
          <div className="bg-gray-50 border border-gray-200 p-3 rounded-lg"><p className="text-[11px] uppercase font-bold opacity-60">Slowest Day</p><p className="text-[18px] font-black text-amber-600">{businessMemory?.weakest_day || "Add sales"} {weakAvg? `(${formatAmount(weakAvg, currency)})` : ""}</p><p className="text-[11px] opacity-60 mt-1">Do promo on this day to sell more</p></div>
        </div>
      </div>

      <div className={isDarkMode? "bg-gray-800 border border-white/10 p-6 rounded-xl shadow-sm mb-6" : "bg-white border-2 border-indigo-200 p-6 rounded-xl shadow-sm mb-6"}>
        <div className="flex items-center gap-2 mb-3"><FaBullseye className="text-indigo-600" /><h2 className="text-[16px] font-semibold">My Main Goal</h2></div>
        <p className="text-[13px] text-gray-500 mb-4">What is most important to you now? We will tailor advice to this.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {["Increase Profit", "Improve Cashflow", "Reduce Costs", "Grow Revenue", "Open New Branch", "Hire Staff"].map(goal=>(
            <label key={goal} className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer ${mainGoal===goal? "border-gray-900 bg-gray-900 text-white" : isDarkMode? "border-white/20 bg-white/5" : "border-gray-200 bg-white"}`}>
              <input type="radio" name="mainGoal" checked={mainGoal===goal} onChange={()=>{ setMainGoal(goal); saveLocalPrefWithToast("mainGoal", goal); }} className="accent-black" />
              <span className="font-bold text-[14px]">{goal}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div className={isDarkMode? "bg-gray-800 border border-white/10 p-6 rounded-2xl shadow-xl" : "bg-white border border-gray-200 p-6 rounded-2xl shadow-sm"}>
          <div className="flex items-center gap-2 mb-4"><FaUser className="text-teal-600" /><h2 className="text-lg font-extrabold">Personal Information</h2></div>
          <div className="space-y-3">
            <div><label className={labelCls}>Full Name</label><input type="text" name="name" placeholder="e.g. Alex Morgan" className={inputCls} value={profile.name} onChange={handleChange} />{errors.name && <p className="text-red-500 text-sm font-bold mt-1">{errors.name}</p>}</div>
            <div><label className={labelCls}>Email Address</label><input type="email" name="email" placeholder="e.g. alex@company.com" className={inputCls} value={profile.email} onChange={handleChange} />{errors.email && <p className="text-red-500 text-sm font-bold mt-1">{errors.email}</p>}</div>
            <div><label className={labelCls}>Phone Number</label><input type="text" name="phone" placeholder="e.g. +1 555 000 1234" className={inputCls} value={profile.phone} onChange={handleChange} />{errors.phone && <p className="text-red-500 text-sm font-bold mt-1">{errors.phone}</p>}</div>
            <div><label className={labelCls}>Role</label><select name="role" className={inputCls} value={profile.role} onChange={handleChange}><option value="">Select Role</option><option value="owner">Owner</option><option value="admin">Admin</option><option value="user">User</option></select>{errors.role && <p className="text-red-500 text-sm font-bold mt-1">{errors.role}</p>}</div>
            <button onClick={handleSaveProfile} disabled={savingProfile} className="w-full bg-teal-600 text-white py-3 rounded-xl hover:bg-teal-700 font-extrabold disabled:opacity-50">{savingProfile? "Saving..." : "Save Changes"}</button>
          </div>
        </div>
        <div className="space-y-6">
          <div className={isDarkMode? "bg-gray-800 border border-white/10 p-6 rounded-2xl shadow-xl" : "bg-white border border-gray-200 p-6 rounded-2xl shadow-sm"}>
            <div className="flex items-center gap-2 mb-4"><FaLock className="text-indigo-600" /><h2 className="text-lg font-extrabold">Change Password</h2></div>
            <div className="space-y-3">
              <div><label className={labelCls}>Current Password</label><input type="password" name="currentPassword" placeholder="••••••••" className={inputCls} value={passwords.currentPassword} onChange={handlePasswordChange} />{errors.currentPassword && <p className="text-red-500 text-sm font-bold mt-1">{errors.currentPassword}</p>}</div>
              <div><label className={labelCls}>New Password</label><input type="password" name="newPassword" placeholder="Minimum 8 characters" className={inputCls} value={passwords.newPassword} onChange={handlePasswordChange} />{errors.newPassword && <p className="text-red-500 text-sm font-bold mt-1">{errors.newPassword}</p>}</div>
              <button onClick={handleSavePassword} disabled={savingPassword} className="w-full bg-indigo-600 text-white py-3 rounded-xl hover:bg-indigo-700 font-extrabold disabled:opacity-50">{savingPassword? "Updating..." : "Update Password"}</button>
            </div>
          </div>
          <div className={isDarkMode? "bg-gray-800 border border-white/10 p-6 rounded-2xl shadow-xl" : "bg-white border border-gray-200 p-6 rounded-2xl shadow-sm"}>
            <h2 className="text-lg font-extrabold mb-2">Session</h2>
            <p className="text-gray-600 font-bold text-sm mb-4">Log out of your account on this device.</p>
            <button onClick={handleLogout} className="w-full bg-red-600 text-white py-3 rounded-xl hover:bg-red-700 font-extrabold flex items-center justify-center gap-2"><FaSignOutAlt /> Logout</button>
          </div>
        </div>
      </div>

      <div className={isDarkMode? "bg-gray-800 border border-white/10 p-6 rounded-xl shadow-sm mb-6" : "bg-white border border-gray-200 p-6 rounded-xl shadow-sm mb-6"}>
        <h2 className="text-[16px] font-semibold mb-4">Business Information</h2>
        {loading? (<p className="font-medium animate-pulse text-[14px] text-gray-500">Loading...</p>) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div><label className={labelCls}>Business Name</label><input type="text" placeholder="e.g. Divine Ventures" className={inputCls} value={businessName} onChange={(e) => setBusinessName(e.target.value)} /></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><label className={labelCls}>Business Type</label><select className={inputCls} value={businessType} onChange={(e) => { setBusinessType(e.target.value); saveLocalPrefWithToast("businessType", e.target.value); }}><option>Retail</option><option>Restaurant</option><option>Salon</option><option>Pharmacy</option><option>Manufacturing</option><option>Services</option><option>Other</option></select></div>
              <div><label className={labelCls}><FaUsers className="inline mr-1"/>Business Size</label><select className={inputCls} value={businessSize} onChange={(e) => { setBusinessSize(e.target.value); saveLocalPrefWithToast("businessSize", e.target.value); }}><option>Just Me</option><option>2-5 Employees</option><option>6-20 Employees</option><option>20+ Employees</option></select></div>
              <div><label className={labelCls}>Currency</label><select className={inputCls} value={currency} onChange={(e) => setCurrency(e.target.value)}><option value="USD">USD ($) - US Dollar</option><option value="EUR">EUR (€) - Euro</option><option value="GBP">GBP (£) - British Pound</option><option value="CAD">CAD (C$) - Canadian Dollar</option><option value="JPY">JPY (¥) - Japanese Yen</option><option value="NGN">NGN (₦) - Nigerian Naira</option><option value="ZAR">ZAR (R) - South African Rand</option><option value="KES">KES (KSh) - Kenyan Shilling</option><option value="GHS">GHS (₵) - Ghanaian Cedi</option><option value="EGP">EGP (£E) - Egyptian Pound</option><option value="XOF">XOF (CFA) - West African CFA</option><option value="XAF">XAF (CFA) - Central African CFA</option></select></div>
            </div>
            <div className="bg-gray-50 border border-gray-200 p-3.5 rounded-lg"><p className="text-[12px] uppercase tracking-widest font-semibold text-gray-500">Preview how money will look:</p><p className="text-[15px] font-bold mt-1">{formatAmount(12500, currency)} • {formatAmount(1000000, currency)} • You keep 57% of every {formatAmount(100, currency)} you sell</p></div>
            <button type="submit" disabled={saving} className="bg-gray-900 text-white px-6 py-3 rounded-lg hover:bg-black font-medium disabled:opacity-50 text-[15px]">{saving? "Saving..." : "Save Settings"}</button>
          </form>
        )}
      </div>

      <div className={isDarkMode? "bg-gray-800 border border-white/10 p-6 rounded-xl shadow-sm mb-6" : "bg-white border border-gray-200 p-6 rounded-xl shadow-sm mb-6"}>
        <h2 className="text-[16px] font-semibold mb-3">How Should We Explain Things?</h2>
        <div className="space-y-3">
          {[
            { id: "Simple", title: "Simple", desc: "Everyday language — like talking to a friend. Shows 'You keep 57% of every $100 you sell'." },
            { id: "Balanced", title: "Balanced", desc: "Simple language + real numbers from your sales." },
            { id: "Expert", title: "Expert", desc: "Shows all numbers, charts and business strength." }
          ].map(opt => (
            <label key={opt.id} className={`flex gap-3 p-3 rounded-lg border-2 cursor-pointer ${aiMode === opt.id? "border-gray-900 bg-gray-50" : "border-gray-200"}`}>
              <input type="radio" name="aiMode" checked={aiMode === opt.id} onChange={() => { setAiMode(opt.id); saveLocalPrefWithToast("aiMode", opt.id); }} />
              <div><p className="font-bold text-[14px] text-gray-900">{opt.title}</p><p className="text-[13px] text-gray-500">{opt.desc}</p></div>
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className={isDarkMode? "bg-gray-800 border border-white/10 p-6 rounded-xl" : "bg-white border border-gray-200 p-6 rounded-xl shadow-sm"}>
          <h2 className="text-[16px] font-semibold mb-3">Advice Preferences</h2>
          <div className="flex items-center justify-between mb-4"><p className="text-[14px] font-medium">Get daily tips based on your sales</p><button onClick={() => { setDailyAdvice(!dailyAdvice); localStorage.setItem("dailyAdvice",!dailyAdvice? "on" : "off"); }} className={`px-4 py-1.5 rounded-full text-[13px] font-black ${dailyAdvice? "bg-green-600 text-white" : "bg-gray-200"}`}>{dailyAdvice? "On" : "Off"}</button></div>
          <label className="block text-[14px] font-medium mb-1.5">Language for advice</label><select className={inputCls} value={adviceLang} onChange={(e) => { setAdviceLang(e.target.value); saveLocalPrefWithToast("adviceLang", e.target.value); }}><option>Auto</option><option>English</option><option>French</option><option>Spanish</option><option>Pidgin</option></select>
          <div className="mt-5">
            <label className="block text-[14px] font-bold mb-2"><FaCalendarAlt className="inline mr-1"/>How often?</label>
            <div className="space-y-2">
              {["Daily", "Weekly", "Only Important Updates"].map(freq=>(
                <label key={freq} className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer ${adviceFrequency===freq? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white text-black"}`}>
                  <input type="radio" name="adviceFrequency" checked={adviceFrequency===freq} onChange={()=>{ setAdviceFrequency(freq); saveLocalPrefWithToast("adviceFrequency", freq); }} />
                  <span className="text-[14px] font-bold">{freq}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className={isDarkMode? "bg-gray-800 border border-indigo-500/30 p-6 rounded-xl" : "bg-white border-2 border-indigo-200 p-6 rounded-xl shadow-sm"}>
          <div className="flex items-center gap-2 mb-2"><FaUniversity className="text-indigo-600" /><h2 className="text-[16px] font-semibold">Bank Connection</h2><span className="bg-yellow-300 text-[11px] font-black px-2 py-0.5 rounded-full border border-gray-900">Coming Soon</span></div>
          <p className="text-[14px] text-gray-600">Connect your bank to auto-import sales. You can disconnect anytime.</p>
          <button disabled className="mt-4 bg-gray-100 border border-gray-300 px-5 py-2.5 rounded-lg text-[13px] font-bold text-gray-500">Connect Bank — v2</button>
        </div>
      </div>

      <div className={isDarkMode? "bg-gray-800 border border-white/10 p-6 rounded-xl shadow-sm mb-6" : "bg-white border border-gray-200 p-6 rounded-xl shadow-sm mb-6"}>
        <div className="flex items-center gap-2 mb-1"><FaTags className="text-gray-400 text-[13px]" /><h2 className="text-[16px] font-semibold">Your Categories</h2></div>
        <p className="text-[14px] text-gray-500 mb-4">Add your own spending types like Marketing, Logistics.</p>
        <div className="flex gap-2 mb-4"><input type="text" placeholder="e.g. Marketing, Logistics" className="flex-1 border border-gray-200 rounded-lg px-4 py-3 font-medium bg-white text-[15px]" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCategory())} /><button onClick={handleAddCategory} className="bg-gray-900 text-white px-6 py-3 rounded-lg hover:bg-black font-medium text-[14px]">Add Category</button></div>
        <div className="flex flex-wrap gap-2.5">{categories.map(cat => (<span key={cat} className="bg-gray-50 border border-gray-200 px-3.5 py-2 rounded-full text-[14px] font-medium flex items-center gap-2">{cat}<button onClick={() => handleDeleteCategory(cat)} className="text-gray-400 hover:text-red-600 font-bold ml-1">×</button></span>))}</div>
      </div>

      <div className={isDarkMode? "bg-gray-800 border border-green-500/30 p-6 rounded-xl mb-6" : "bg-white border border-green-200 p-6 rounded-xl shadow-sm mb-6"}>
        <div className="flex items-center gap-2 mb-3"><FaLock className="text-green-600" /><h2 className="text-[16px] font-bold">Your Data Is Safe</h2></div>
        <ul className="text-[14px] font-medium space-y-2"><li>✅ Only you can see your sales and spending.</li><li>✅ Your password is encrypted.</li><li>✅ We never share your business info.</li><li>✅ You can export or delete your data anytime.</li><li>✅ Secure connection (HTTPS).</li></ul>
      </div>

      <div className={isDarkMode? "bg-gray-800 border border-white/10 p-6 rounded-xl mb-6" : "bg-white border border-gray-200 p-6 rounded-xl shadow-sm mb-6"}>
        <h2 className="text-[16px] font-semibold mb-1">Clear Sales History</h2>
        <p className="text-gray-500 mb-4 text-[14px]">Remove all sales and spending but keep your settings and categories.</p>
        <div className="flex gap-2"><button className="bg-amber-500 text-white px-6 py-3 rounded-lg hover:bg-amber-600 text-[14px]" onClick={handleClearEntries}>Clear Transactions</button><button className="bg-white border-2 border-gray-900 px-6 py-3 rounded-lg font-bold text-[14px]" onClick={() => { if(window.confirm("Reset AI Memory? This clears learned patterns but keeps transactions.")){ setBusinessMemory(null); toast.info("AI Memory reset — will relearn from your sales."); } }}>Reset AI Memory</button></div>
      </div>

      <div className={isDarkMode? "bg-gray-800 border border-red-500/30 p-6 rounded-xl" : "bg-white border border-red-200 p-6 rounded-xl shadow-sm"}>
        <h2 className="text-[16px] font-semibold mb-1 text-red-700">Danger Zone</h2>
        <p className="text-red-600 mb-4 text-[14px]">This will delete everything — sales, spending, alerts, and settings. Cannot be undone.</p>
        <button className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 text-[14px]" onClick={() => setShowModal(true)}>Reset Everything</button>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md border border-gray-200">
            <h2 className="text-[18px] font-bold mb-2 text-red-700">Confirm Reset</h2>
            <p className="text-gray-700 mb-4 text-[14px]">Type <span className="font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded">RESET</span> to delete everything forever.</p>
            <input type="text" placeholder="Type RESET" className="w-full border border-gray-200 rounded-lg px-4 py-3 mb-4 text-[15px]" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
            <div className="flex justify-end gap-2"><button className="px-4 py-2.5 bg-gray-100 rounded-lg text-[14px]" onClick={() => { setShowModal(false); setConfirmText(""); }}>Cancel</button><button className="px-4 py-2.5 bg-red-600 text-white rounded-lg text-[14px]" onClick={confirmClearAll}>Confirm Reset</button></div>
          </div>
        </div>
      )}
      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
}
export default Settings;