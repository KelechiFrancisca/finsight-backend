import { useEffect, useState } from "react";
import API_BASE_URL from "./apiConfig";   // ✅ centralized import

function Upload() {
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "/login";
      return;
    }
    fetch(`${API_BASE_URL}/upload`, { headers: { Authorization: "Bearer " + token } })
      .then((res) => res.json())
      .then((data) => setUploads(Array.isArray(data) ? data : []))
      .catch((err) => console.error("Error fetching uploads:", err));
  }, []);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    setLoading(true);

    fetch(`${API_BASE_URL}/upload`, {
      method: "POST",
      headers: { Authorization: "Bearer " + localStorage.getItem("token") },
      body: formData,
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.filename) {
          fetch(`${API_BASE_URL}/upload`, {
            headers: { Authorization: "Bearer " + localStorage.getItem("token") },
          })
            .then((res) => res.json())
            .then((fresh) => setUploads(Array.isArray(fresh) ? fresh : []))
            .catch((err) => console.error("Error refreshing uploads:", err));
        } else {
          alert(data.error || "Upload failed");
        }
      })
      .catch((err) => console.error("Error uploading file:", err))
      .finally(() => setLoading(false));
  };

  return (
    <div className="bg-gray-100 min-h-screen p-6">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">Upload</h1>
      <p className="text-gray-600 mb-6">
        Upload financial documents (CSV) to enrich your dashboard insights.
      </p>

      {/* Upload Button */}
      <label className="px-4 py-2 bg-blue-600 text-white rounded cursor-pointer">
        {loading ? "Uploading..." : "Choose File"}
        <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
      </label>

      {/* ✅ Download Sample CSV */}
      <a
        href={`${API_BASE_URL}/sample_csv`}
        className="px-4 py-2 bg-green-600 text-white rounded ml-4"
        download="sample.csv"
      >
        Download Sample CSV
      </a>
      <p className="text-sm text-gray-500 mt-2">
        Use this template to avoid upload errors.
      </p>

      {/* Uploaded Files List */}
      <div className="mt-8">
        <h2 className="text-lg font-bold mb-4">Uploaded Files</h2>
        {uploads.length === 0 ? (
          <p className="text-gray-600">No files uploaded yet.</p>
        ) : (
          <ul className="space-y-2">
            {uploads.map((file) => (
              <li key={file.id} className="bg-white p-4 rounded shadow flex justify-between items-center">
                <span className="text-gray-800">{file.filename}</span>
                <span className="text-sm text-gray-500">ID: {file.id}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default Upload;
