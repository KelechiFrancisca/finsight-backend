import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import API_BASE_URL from "./apiConfig";   // ✅ centralized import

function ProtectedRoute({ children }) {
  const [valid, setValid] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setValid(false);
      return;
    }

    // ✅ Use /users/me to validate token
    fetch(`${API_BASE_URL}/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setValid(false);
          localStorage.removeItem("token");
        } else {
          setValid(true);
        }
      })
      .catch((err) => {
        console.error("ProtectedRoute error:", err);
        setValid(false);
      });
  }, []);

  if (valid === null) {
    return <p>Loading...</p>;
  }

  if (!valid) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default ProtectedRoute;
