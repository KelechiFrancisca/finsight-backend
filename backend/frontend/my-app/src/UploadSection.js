import { useEffect, useState } from "react";

function Upload() {
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(false);

  const baseUrl =
    window.location.hostname === "localhost"
      ? "http://127.0.0.1:5000/api"
      : "https://ai-business-insights-dashboard.onrender.com/api";

  // ✅ Load uploaded files
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "/login";
      return;
    }

    fetch(`${baseUrl}/upload`, {
      headers: { Authorization: "Bearer " + token },
    })
      .then((res) => res.json())
      .then((data) => setUploads(Array.isArray(data) ? data : []))
      .catch((err) => console.error("Error fetching uploads:", err));
  }, [baseUrl]);

  // ✅ Handle file upload
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    setLoading(true);

    fetch(`${baseUrl}/upload`, {
      method: "POST",
      headers: { Authorization: "Bearer " + localStorage.getItem("token") },
      body: formData,
    })
      .then((res) => res.json())
      .then((data) => {
        console.log("Upload response:", data);
        if (data.filename) {
          setUploads([...uploads, { id: uploads.length + 1, filename: data.filename }]);
        } else {
          alert(data.error || "Upload failed");
        }
      })
      .catch((err) => console.error("Upload error:", err))
      .finally(() => setLoading(false));
  };

  return (
    <div className="bg-gray-100 min-h-screen p-6">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">Upload</h1>
      <p className="text-gray-600 mb-6">
        Upload financial documents (CSV, Excel, etc.) to enrich your dashboard insights.
      </p>

      {/* Upload Button */}
      <label className="px-4 py-2 bg-blue-600 text-white rounded cursor-pointer">
        {loading ? "Uploading..." : "Choose File"}
        <input
          type="file"
          accept=".csv,.xlsx,.xls,.txt"
          onChange={handleFileUpload}
          className="hidden"
        />
      </label>

      {/* Uploaded Files List */}
      <div className="mt-8">
        <h2 className="text-lg font-bold mb-4">Uploaded Files</h2>
        {uploads.length === 0 ? (
          <p className="text-gray-600">No files uploaded yet.</p>
        ) : (
          <ul className="space-y-2">
            {uploads.map((file) => (
              <li
                key={file.id}
                className="bg-white p-4 rounded shadow flex justify-between items-center"
              >
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
