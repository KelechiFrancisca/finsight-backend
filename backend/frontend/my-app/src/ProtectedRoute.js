import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";

function ProtectedRoute({ children }) {
  const [valid, setValid] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setValid(false);
      return;
    }

    const baseUrl =
      window.location.hostname === "localhost"
        ? "http://127.0.0.1:5000/api"
        : "https://ai-business-insights-dashboard.onrender.com/api";

    fetch(`${baseUrl}/verify_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.valid) {
          setValid(true);
        } else {
          setValid(false);
          localStorage.removeItem("token");
        }
      })
      .catch(() => setValid(false));
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
