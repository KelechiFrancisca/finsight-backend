import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaUser, FaLock, FaSignOutAlt, FaCheckCircle } from "react-icons/fa";
import API_BASE_URL from "./apiConfig";

function Profile() {
  const [profile, setProfile] = useState({ name: "", email: "", phone: "", role: "" });
  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "" });
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }
    fetch(`${API_BASE_URL}/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((res) => res.json())
    .then((data) => {
        if (data.error) {
          navigate("/login");
        } else {
          setProfile({
            name: data.name || "",
            email: data.email || "",
            phone: data.phone || "",
            role: data.role || ""
          });
        }
      })
    .catch((err) => console.error("Error fetching profile:", err))
    .finally(() => setLoading(false));
  }, [navigate]);

  const handleChange = (e) => {
    setProfile({...profile, [e.target.name]: e.target.value });
    setErrors({...errors, [e.target.name]: "" });
    setSuccessMessage("");
  };

  const handlePasswordChange = (e) => {
    setPasswords({...passwords, [e.target.name]: e.target.value });
    setErrors({...errors, [e.target.name]: "" });
    setSuccessMessage("");
  };

  const validateProfile = () => {
    const newErrors = {};
    if (!profile.name.trim()) newErrors.name = "Name is required.";
    if (!/\S+@\S+\.\S+/.test(profile.email)) newErrors.email = "Invalid email address.";
    if (profile.phone &&!/^\+?[0-9\s-]{7,15}$/.test(profile.phone)) newErrors.phone = "Invalid phone number.";
    if (!profile.role) newErrors.role = "Role is required.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validatePassword = () => {
    const newErrors = {};
    if (!passwords.currentPassword) newErrors.currentPassword = "Current password is required.";
    if (passwords.newPassword.length < 8) newErrors.newPassword = "New password must be at least 8 characters.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveProfile = async () => {
    if (!validateProfile()) return;
    const token = localStorage.getItem("token");
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/users/me`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(profile),
      });
      const data = await response.json();
      if (response.ok) setSuccessMessage("Profile updated successfully!");
      else setErrors({ form: data.error || "Failed to update profile" });
    } catch {
      setErrors({ form: "Server error" });
    } finally {
      setSaving(false);
    }
  };

  const handleSavePassword = async () => {
    if (!validatePassword()) return;
    const token = localStorage.getItem("token");
    setSavingPassword(true);
    try {
      const response = await fetch(`${API_BASE_URL}/change-password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(passwords),
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMessage("Password updated successfully!");
        setPasswords({ currentPassword: "", newPassword: "" });
      } else setErrors({ form: data.error || "Failed to update password" });
    } catch {
      setErrors({ form: "Server error" });
    } finally {
      setSavingPassword(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  const inputCls = "w-full border border-gray-200 rounded-xl px-4 py-3 font-bold bg-white focus:outline-none focus:ring-2 focus:ring-teal-500";
  const labelCls = "block text-sm font-bold text-gray-700 mb-1";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="font-bold animate-pulse">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-gray-50 to-teal-50 min-h-screen p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-extrabold text-gray-800 mb-1">Profile</h1>
        <p className="text-gray-600 font-bold mb-6">Manage your personal account and security.</p>

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

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white/70 backdrop-blur-xl p-6 rounded-2xl shadow-xl">
            <div className="flex items-center gap-2 mb-4">
              <FaUser className="text-teal-600" />
              <h2 className="text-lg font-extrabold text-gray-800">Personal Information</h2>
            </div>

            <div className="space-y-3">
              <div>
                <label className={labelCls}>Full Name</label>
                <input type="text" name="name" placeholder="e.g. Alex Morgan" className={inputCls} value={profile.name} onChange={handleChange} />
                {errors.name && <p className="text-red-500 text-sm font-bold mt-1">{errors.name}</p>}
              </div>
              <div>
                <label className={labelCls}>Email Address</label>
                <input type="email" name="email" placeholder="e.g. alex@company.com" className={inputCls} value={profile.email} onChange={handleChange} />
                {errors.email && <p className="text-red-500 text-sm font-bold mt-1">{errors.email}</p>}
              </div>
              <div>
                <label className={labelCls}>Phone Number</label>
                <input type="text" name="phone" placeholder="e.g. +1 555 000 1234" className={inputCls} value={profile.phone} onChange={handleChange} />
                {errors.phone && <p className="text-red-500 text-sm font-bold mt-1">{errors.phone}</p>}
              </div>
              <div>
                <label className={labelCls}>Role</label>
                <select name="role" className={inputCls} value={profile.role} onChange={handleChange}>
                  <option value="">Select Role</option>
                  <option value="owner">Owner</option>
                  <option value="admin">Admin</option>
                  <option value="user">User</option>
                </select>
                {errors.role && <p className="text-red-500 text-sm font-bold mt-1">{errors.role}</p>}
              </div>

              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="w-full bg-teal-600 text-white py-3 rounded-xl hover:bg-teal-700 font-extrabold disabled:opacity-50"
              >
                {saving? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white/70 backdrop-blur-xl p-6 rounded-2xl shadow-xl">
              <div className="flex items-center gap-2 mb-4">
                <FaLock className="text-indigo-600" />
                <h2 className="text-lg font-extrabold text-gray-800">Change Password</h2>
              </div>
              <div className="space-y-3">
                <div>
                  <label className={labelCls}>Current Password</label>
                  <input type="password" name="currentPassword" placeholder="••••••••" className={inputCls} value={passwords.currentPassword} onChange={handlePasswordChange} />
                  {errors.currentPassword && <p className="text-red-500 text-sm font-bold mt-1">{errors.currentPassword}</p>}
                </div>
                <div>
                  <label className={labelCls}>New Password</label>
                  <input type="password" name="newPassword" placeholder="Minimum 8 characters" className={inputCls} value={passwords.newPassword} onChange={handlePasswordChange} />
                  {errors.newPassword && <p className="text-red-500 text-sm font-bold mt-1">{errors.newPassword}</p>}
                </div>
                <button
                  onClick={handleSavePassword}
                  disabled={savingPassword}
                  className="w-full bg-indigo-600 text-white py-3 rounded-xl hover:bg-indigo-700 font-extrabold disabled:opacity-50"
                >
                  {savingPassword? "Updating..." : "Update Password"}
                </button>
              </div>
            </div>

            <div className="bg-white/70 backdrop-blur-xl p-6 rounded-2xl shadow-xl">
              <h2 className="text-lg font-extrabold text-gray-800 mb-2">Session</h2>
              <p className="text-gray-600 font-bold text-sm mb-4">Log out of your account on this device.</p>
              <button
                onClick={handleLogout}
                className="w-full bg-red-600 text-white py-3 rounded-xl hover:bg-red-700 font-extrabold flex items-center justify-center gap-2"
              >
                <FaSignOutAlt /> Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Profile;