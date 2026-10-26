import { BrowserRouter as Router, Routes, Route, NavLink, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from "chart.js";
import { useState } from "react";
import { FaBars, FaTimes, FaSignOutAlt, FaDollarSign } from "react-icons/fa";
import Login from "./Login"; import Register from "./Register"; import Dashboard from "./Dashboard"; import Forecast from "./Forecast"; import Alerts from "./Alerts"; import Settings from "./Settings"; import Profile from "./Profile"; import ForgotPassword from "./ForgotPassword"; import ResetPassword from "./ResetPassword"; import ProtectedRoute from "./ProtectedRoute";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const token = localStorage.getItem("token");
  const location = useLocation(); const navigate = useNavigate();
  const isAuthPage = ["/login", "/register", "/forgot-password"].some(p=>location.pathname.startsWith(p)) || location.pathname.startsWith("/reset-password");
  const handleLogout = () => { localStorage.removeItem("token"); navigate("/login"); };

  // SIMPLIFIED - 4 ITEMS ONLY AS YOU ASKED
  const navItems = [
    { to: "/dashboard", label: "My Business", emoji: "🏠", sub: "How's my business?" },
    { to: "/forecast", label: "Business Coach", emoji: "🤖", sub: "What should I do?", badge: "AI" },
    { to: "/alerts", label: "Alerts", emoji: "⚠️", sub: "What needs attention?" },
    { to: "/settings", label: "Settings", emoji: "⚙️", sub: "Profile & app" },
  ];

  const linkBase = "flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-sm font-black border-2 transition-all text-left";
  const linkActive = `${linkBase} bg-gray-900 text-white border-gray-900 shadow-lg scale-[1.02]`;
  const linkInactive = (isDark) => `${linkBase} ${isDark? "text-gray-300 border-transparent hover:bg-white/10 hover:text-white" : "text-gray-700 border-transparent hover:bg-white hover:border-gray-900"}`;

  return (
    <div className={`flex min-h-screen ${isDarkMode? "dark bg-gray-900 text-gray-100" : "bg-[#fbfaf8] text-gray-900"}`}>
      {!isAuthPage && sidebarOpen && (
        <aside className={`w-64 flex flex-col shadow-xl ${isDarkMode? "bg-gray-800/90 backdrop-blur-xl border-r border-white/10 text-gray-100" : "bg-white text-gray-900 border-r-2 border-gray-900"}`}>
          <div className="p-6 pb-3 flex justify-between items-start">
            <div className="flex items-center space-x-3">
              <div className="w-11 h-11 bg-[#fef08a] border-2 border-gray-900 rounded-[12px] flex items-center justify-center text-gray-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"><FaDollarSign className="text-xl" /></div>
              <div><h2 className="text-[16px] font-black leading-none tracking-tight">FinSight</h2><p className={`text-[10px] font-black tracking-[0.2em] mt-1 ${isDarkMode? "text-yellow-300" : "text-gray-900"}`}>MAKE MORE MONEY</p></div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className={`p-2 rounded-lg ${isDarkMode? "hover:bg-white/10" : "hover:bg-gray-100"}`}><FaTimes /></button>
          </div>

          <div className="px-5 pb-4">
            <div className={`${isDarkMode? "bg-yellow-900/30 border-yellow-500/30 text-yellow-100" : "bg-[#fef08a] border-gray-900 text-gray-900"} border-2 rounded-xl px-3 py-3`}>
              <p className="text-[10px] font-black uppercase tracking-widest leading-none">FinSight helps you stop losing money</p>
              <p className="text-[11px] font-bold mt-1 opacity-80">Knows best Monday • Weak Thursday</p>
            </div>
          </div>

          <nav className="flex-1 px-4 space-y-2">
            {navItems.map(item => (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => isActive? linkActive : linkInactive(isDarkMode)}>
                <span className="flex flex-col"><span className="flex items-center gap-2"><span className="text-lg">{item.emoji}</span>{item.label}</span><span className="text-[10px] font-bold opacity-60 ml-7 -mt-0.5">{item.sub}</span></span>
                {item.badge && <span className="text-[9px] bg-yellow-300 text-black px-2 py-0.5 rounded-full border-2 border-black font-black">{item.badge}</span>}
              </NavLink>
            ))}
            {!token && (<><NavLink to="/login" className={({ isActive }) => isActive? linkActive : linkInactive(isDarkMode)}>Login</NavLink><NavLink to="/register" className={({ isActive }) => isActive? linkActive : linkInactive(isDarkMode)}>Register</NavLink></>)}
          </nav>

          {token && (
            <div className={`p-4 border-t-2 ${isDarkMode? "border-white/10" : "border-gray-900"}`}>
              <div className={`flex items-center gap-3 p-3 rounded-xl mb-3 border-2 ${isDarkMode? "bg-white/5 border-white/10" : "bg-[#fbfaf8] border-gray-900"}`}>
                <div className="w-10 h-10 rounded-full bg-[#fef08a] border-2 border-gray-900 flex items-center justify-center text-gray-900 font-black">U</div>
                <div className="flex-1 min-w-0"><p className="text-sm font-black truncate">Business Owner</p><p className="text-xs font-bold opacity-60 truncate">FinSight is remembering you</p></div>
              </div>
              <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-black bg-red-600 hover:bg-red-700 text-white border-2 border-gray-900 transition-all"><FaSignOutAlt /> Logout</button>
            </div>
          )}
        </aside>
      )}
      <main className="flex-1 p-4 sm:p-6 md:p-8 min-w-0">
        {!isAuthPage &&!sidebarOpen && (<button onClick={() => setSidebarOpen(true)} className="mb-4 flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl hover:bg-black border-2 border-gray-900 font-black"><FaBars /> Open Menu</button>)}
        <Routes>
          <Route path="/login" element={<Login />} /><Route path="/register" element={<Register />} /><Route path="/forgot-password" element={<ForgotPassword />} /><Route path="/reset-password/:token" element={<ResetPassword />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} /></ProtectedRoute>} />
          <Route path="/forecast" element={<ProtectedRoute><Forecast isDarkMode={isDarkMode} /></ProtectedRoute>} />
          <Route path="/alerts" element={<ProtectedRoute><Alerts isDarkMode={isDarkMode} /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings isDarkMode={isDarkMode} /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile isDarkMode={isDarkMode} /></ProtectedRoute>} />
          <Route path="/" element={token? <Navigate to="/dashboard" /> : <Navigate to="/login" />} />
        </Routes>
      </main>
    </div>
  );
}
function App() { return <Router><AppLayout /></Router>; }
export default App;