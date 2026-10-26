import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaEnvelope, FaCheckCircle } from "react-icons/fa";
import API_BASE_URL from "./apiConfig";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState("");
  const navigate = useNavigate();

  const validate = () => {
    const newErrors = {};
    if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = "Invalid email address.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccessMessage("");
    if (!validate()) return;

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccessMessage("Password reset link sent to your email!");
      } else {
        setErrors({ form: data.error || "Failed to send reset link" });
      }
    } catch (error) {
      console.error("Forgot password error:", error);
      setErrors({ form: "Server error, please try again." });
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
          <h1 className="text-2xl font-extrabold text-gray-800">Reset password</h1>
          <p className="text-gray-600 font-bold text-sm mt-1">We'll send you a reset link</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white/70 backdrop-blur-xl p-8 rounded-2xl shadow-xl"
        >
          <h2 className="text-xl font-extrabold mb-6 text-gray-800">Forgot Password</h2>

          {successMessage && (
            <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl font-bold flex items-center gap-2">
              <FaCheckCircle /> {successMessage}
            </div>
          )}
          {errors.form && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl font-bold">
              {errors.form}
            </div>
          )}

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
            {errors.email && <p className="text-red-500 text-sm mt-1 font-bold">{errors.email}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-teal-600 text-white py-3 rounded-xl hover:bg-teal-700 disabled:opacity-50 font-extrabold transition"
          >
            {loading ? "Sending..." : "Send Reset Link"}
          </button>

          <p className="mt-4 text-sm font-bold text-center text-gray-600">
            Remembered your password?{" "}
            <span
              className="text-teal-600 cursor-pointer font-extrabold hover:underline"
              onClick={() => navigate("/login")}
            >
              Back to Login
            </span>
          </p>
        </form>
      </div>
    </div>
  );
}

export default ForgotPassword;