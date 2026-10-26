import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaLock, FaCheckCircle } from "react-icons/fa";
import API_BASE_URL from "./apiConfig";

function ResetPassword() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState("");
  const navigate = useNavigate();
  const { token } = useParams();

  const validate = () => {
    const newErrors = {};
    if (newPassword.length < 8) newErrors.newPassword = "Password must be at least 8 characters.";
    if (newPassword !== confirmPassword) newErrors.confirmPassword = "Passwords do not match.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccessMessage("");
    if (!validate()) return;

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/reset-password/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }), // ✅ fixed to match backend
      });

      const data = await response.json();

      if (response.ok) {
        setSuccessMessage("Password reset successful! Redirecting to login...");
        setTimeout(() => navigate("/login"), 2000);
      } else {
        setErrors({ form: data.error || "Failed to reset password" });
      }
    } catch (error) {
      console.error("Reset password error:", error);
      setErrors({ form: "Server error, please try again." });
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full border border-gray-200 rounded-xl px-4 py-3 font-bold bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 pl-11 pr-16";
  const labelCls = "block text-sm font-bold text-gray-700 mb-1";

  return (
    <div className="bg-gradient-to-br from-gray-50 to-teal-50 min-h-screen p-6 flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-extrabold text-gray-800">Set new password</h1>
          <p className="text-gray-600 font-bold text-sm mt-1">Choose a strong password</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white/70 backdrop-blur-xl p-8 rounded-2xl shadow-xl">
          <h2 className="text-xl font-extrabold mb-6 text-gray-800">Reset Password</h2>

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

          <div className="mb-3">
            <label className={labelCls}>New Password</label>
            <div className="relative">
              <FaLock className="absolute left-4 top-4 text-gray-400 text-sm" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Minimum 8 characters"
                className={inputCls}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
              <span
                className="absolute right-4 top-3 cursor-pointer text-sm text-teal-600 font-bold"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? "Hide" : "Show"}
              </span>
            </div>
            {errors.newPassword && <p className="text-red-500 text-sm mt-1 font-bold">{errors.newPassword}</p>}
          </div>

          <div className="mb-4">
            <label className={labelCls}>Confirm Password</label>
            <div className="relative">
              <FaLock className="absolute left-4 top-4 text-gray-400 text-sm" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Repeat new password"
                className={inputCls}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            {errors.confirmPassword && <p className="text-red-500 text-sm mt-1 font-bold">{errors.confirmPassword}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-extrabold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 transition"
          >
            {loading ? "Resetting..." : "Reset Password"}
          </button>

          <p className="mt-4 text-sm font-bold text-center text-gray-600">
            Back to{" "}
            <span
              className="text-teal-600 cursor-pointer font-extrabold hover:underline"
              onClick={() => navigate("/login")}
            >
              Login
            </span>
          </p>
        </form>
      </div>
    </div>
  );
}

export default ResetPassword;