import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

function Profile() {
  const [profile, setProfile] = useState({ name: "", email: "", role: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const baseUrl =
    window.location.hostname === "localhost"
      ? "http://127.0.0.1:5000/api"
      : "https://ai-business-insights-dashboard.onrender.com/api";

  // ✅ Load profile
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      alert("You must be logged in to view your profile.");
      navigate("/login");
      return;
    }

    fetch(`${baseUrl}/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          alert(data.error);
          navigate("/login");
        } else {
          setProfile(data);
        }
      })
      .catch((err) => {
        console.error("Error fetching profile:", err);
        alert("Server error");
      })
      .finally(() => setLoading(false));
  }, [navigate, baseUrl]);

  // ✅ Handle input change
  const handleChange = (e) => {
    setProfile({ ...profile, [e.target.name]: e.target.value });
  };

  // ✅ Save profile
  const handleSave = async () => {
    const token = localStorage.getItem("token");
    setSaving(true);
    try {
      const response = await fetch(`${baseUrl}/users/me`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(profile),
      });
      const data = await response.json();
      if (response.ok) {
        alert("Profile updated successfully!");
      } else {
        alert(data.error || "Failed to update profile");
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Server error");
    } finally {
      setSaving(false);
    }
  };

  // ✅ Logout
  const handleLogout = () => {
    localStorage.removeItem("token");
    alert("Logged out successfully!");
    navigate("/login");
  };

  if (loading) return <p>Loading profile...</p>;

  return (
    <div className="max-w-md mx-auto bg-white p-6 rounded shadow-md">
      <h2 className="text-2xl font-bold mb-4">My Profile</h2>
      <input
        type="text"
        name="name"
        placeholder="Name"
        className="w-full mb-3 p-2 border rounded"
        value={profile.name}
        onChange={handleChange}
      />
      <input
        type="email"
        name="email"
        placeholder="Email"
        className="w-full mb-3 p-2 border rounded"
        value={profile.email}
        onChange={handleChange}
      />
      <input
        type="text"
        name="role"
        placeholder="Role"
        className="w-full mb-3 p-2 border rounded"
        value={profile.role}
        onChange={handleChange}
      />
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-green-500 text-white py-2 rounded hover:bg-green-600 mb-3 disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save Profile"}
      </button>
      <button
        onClick={handleLogout}
        className="w-full bg-red-500 text-white py-2 rounded hover:bg-red-600"
      >
        Logout
      </button>
    </div>
  );
}

export default Profile;
