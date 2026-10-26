import React from "react";
import { NavLink, useNavigate } from "react-router-dom";

function NavBar() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  return (
    <nav className="bg-white shadow-md rounded-lg mb-6 p-4 flex justify-between items-center font-bold">
      <h1 className="text-xl font-extrabold text-gray-800">Business Dashboard</h1>
      <div className="space-x-4 flex items-center">
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            `px-3 py-2 rounded font-bold ${
              isActive ? "bg-teal-600 text-white" : "bg-gray-200 hover:bg-teal-500 hover:text-white"
            }`
          }
        >
          Dashboard
        </NavLink>
        <NavLink
          to="/forecast"
          className={({ isActive }) =>
            `px-3 py-2 rounded font-bold ${
              isActive ? "bg-teal-600 text-white" : "bg-gray-200 hover:bg-teal-500 hover:text-white"
            }`
          }
        >
          Forecast
        </NavLink>
        <NavLink
          to="/alerts"
          className={({ isActive }) =>
            `px-3 py-2 rounded font-bold ${
              isActive ? "bg-teal-600 text-white" : "bg-gray-200 hover:bg-teal-500 hover:text-white"
            }`
          }
        >
          Alerts
        </NavLink>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `px-3 py-2 rounded font-bold ${
              isActive ? "bg-teal-600 text-white" : "bg-gray-200 hover:bg-teal-500 hover:text-white"
            }`
          }
        >
          Settings
        </NavLink>
        <NavLink
          to="/profile"
          className={({ isActive }) =>
            `px-3 py-2 rounded font-bold ${
              isActive ? "bg-teal-600 text-white" : "bg-gray-200 hover:bg-teal-500 hover:text-white"
            }`
          }
        >
          Profile
        </NavLink>
        <NavLink
          to="/login"
          className={({ isActive }) =>
            `px-3 py-2 rounded font-bold ${
              isActive ? "bg-blue-600 text-white" : "bg-gray-200 hover:bg-blue-500 hover:text-white"
            }`
          }
        >
          Login
        </NavLink>
        <NavLink
          to="/register"
          className={({ isActive }) =>
            `px-3 py-2 rounded font-bold ${
              isActive ? "bg-green-600 text-white" : "bg-gray-200 hover:bg-green-500 hover:text-white"
            }`
          }
        >
          Register
        </NavLink>

        {/* ✅ Logout Button */}
        <button
          onClick={handleLogout}
          className="px-3 py-2 rounded bg-red-600 text-white hover:bg-red-700 font-extrabold"
        >
          Logout
        </button>
      </div>
    </nav>
  );
}

export default NavBar;
