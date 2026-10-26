import { BrowserRouter as Router, Routes, Route, NavLink, Navigate } from "react-router-dom";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { useState } from "react";

import Login from "./Login";
import Register from "./Register";
import Dashboard from "./Dashboard";
import Forecast from "./Forecast";
import Alerts from "./Alerts";
import Settings from "./Settings";
import Profile from "./Profile";
import ProtectedRoute from "./ProtectedRoute";
import UploadSection from "./UploadSection"; // ✅ Upload

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const token = localStorage.getItem("token");

  return (
    <Router>
      <div className="flex min-h-screen bg-gray-50">
        {/* Sidebar */}
        {sidebarOpen && (
          <aside className="w-64 bg-white shadow-md p-6 transition-transform duration-300">
            <div className="mb-6 flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <span className="text-3xl font-bold text-blue-600">$</span>
                <h2 className="text-2xl font-bold">Financial Tracker</h2>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="text-gray-500 hover:text-blue-600"
              >
                ✖
              </button>
            </div>
            <p className="text-gray-500 text-sm mb-6">Business Analytics</p>
            <nav className="space-y-4">
              <NavLink to="/dashboard" className={({ isActive }) => isActive ? "block text-blue-600 font-bold" : "block text-gray-700 hover:text-blue-600"}>Dashboard</NavLink>
              <NavLink to="/forecast" className={({ isActive }) => isActive ? "block text-blue-600 font-bold" : "block text-gray-700 hover:text-blue-600"}>Forecast</NavLink>
              <NavLink to="/alerts" className={({ isActive }) => isActive ? "block text-blue-600 font-bold" : "block text-gray-700 hover:text-blue-600"}>Alerts</NavLink>
              <NavLink to="/upload" className={({ isActive }) => isActive ? "block text-blue-600 font-bold" : "block text-gray-700 hover:text-blue-600"}>Upload</NavLink>
              <NavLink to="/settings" className={({ isActive }) => isActive ? "block text-blue-600 font-bold" : "block text-gray-700 hover:text-blue-600"}>Settings</NavLink>
              <NavLink to="/profile" className={({ isActive }) => isActive ? "block text-blue-600 font-bold" : "block text-gray-700 hover:text-blue-600"}>Profile</NavLink>
              <NavLink to="/login" className={({ isActive }) => isActive ? "block text-blue-600 font-bold" : "block text-gray-700 hover:text-blue-600"}>Login</NavLink>
              <NavLink to="/register" className={({ isActive }) => isActive ? "block text-blue-600 font-bold" : "block text-gray-700 hover:text-blue-600"}>Register</NavLink>
            </nav>
          </aside>
        )}

        {/* Main Content */}
        <main className="flex-1 p-8">
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="mb-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              ☰ Open Menu
            </button>
          )}
          <Routes>
            {/* Default route: redirect based on token */}
            <Route path="/" element={token ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />} />

            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Protected routes */}
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/forecast" element={<ProtectedRoute><Forecast /></ProtectedRoute>} />
            <Route path="/alerts" element={<ProtectedRoute><Alerts /></ProtectedRoute>} />
            <Route path="/upload" element={<ProtectedRoute><UploadSection onUpload={(data) => console.log("Uploaded:", data)} /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
