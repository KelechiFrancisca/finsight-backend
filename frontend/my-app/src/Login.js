import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { FaEnvelope, FaLock } from "react-icons/fa";
import API_BASE_URL from "./apiConfig";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const navigate = useNavigate();

  const validate = () => {
    const newErrors = {};
    if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = "Invalid email address.";
    if (!password) newErrors.password = "Password is required.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password
        }),
      });

      const data = await response.json();

      if (response.ok && data.token) {
        localStorage.setItem("token", data.token);
        toast.success("Login successful! Redirecting...");
        setTimeout(() => navigate("/dashboard"), 1500);
      } else {
        toast.error(data.error || "Login failed");
      }
    } catch (error) {
      console.error("Login error:", error);
      toast.error("Network error, please try again");
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full border border-gray-200 rounded-xl px-4 py-3 font-bold bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 pl-11";
  const labelCls = "block text-sm font-bold text-gray-700 mb-1";

  return (
    <div className="bg-gradient-to-br from-gray-50 to-teal-50 min-h-screen p-6 flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-extrabold text-gray-800">Welcome back</h1>
          <p className="text-gray-600 font-bold text-sm mt-1">Log in to your Financial Tracker account</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white/70 backdrop-blur-xl p-8 rounded-2xl shadow-xl"
        >
          <h2 className="text-xl font-extrabold mb-6 text-gray-800">Login</h2>

          <div className="mb-4">
            <label className={labelCls}>Email Address</label>
            <div className="relative">
              <FaEnvelope className="absolute left-4 top-4 text-gray-400 text-sm" />
              <input
                type="email"
                placeholder="e.g. alex@company.com"
                className={inputCls}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            {errors.email && (
              <p className="text-red-500 text-sm mt-1 font-bold">{errors.email}</p>
            )}
          </div>

          <div className="mb-4">
            <label className={labelCls}>Password</label>
            <div className="relative">
              <FaLock className="absolute left-4 top-4 text-gray-400 text-sm" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                className={`${inputCls} pr-16`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <span
                className="absolute right-4 top-3 cursor-pointer text-sm text-teal-600 font-bold"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? "Hide" : "Show"}
              </span>
            </div>
            {errors.password && (
              <p className="text-red-500 text-sm mt-1 font-bold">{errors.password}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-extrabold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <svg
                  className="animate-spin h-5 w-5 mr-2 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8z"
                  ></path>
                </svg>
                Logging in...
              </div>
            ) : (
              "Login"
            )}
          </button>

          <ToastContainer position="top-right" autoClose={3000} />

          <p className="mt-4 text-sm font-bold text-center">
            <span
              className="text-teal-600 cursor-pointer font-extrabold hover:underline"
              onClick={() => navigate("/forgot-password")}
            >
              Forgot Password?
            </span>
          </p>

          <p className="mt-2 text-sm font-bold text-center text-gray-600">
            Don't have an account?{" "}
            <span
              className="text-teal-600 cursor-pointer font-extrabold hover:underline"
              onClick={() => navigate("/register")}
            >
              Register
            </span>
          </p>
        </form>
      </div>
    </div>
  );
}

export default Login;