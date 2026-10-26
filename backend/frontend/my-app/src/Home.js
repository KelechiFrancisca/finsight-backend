import { useNavigate } from "react-router-dom";
import { FaChartLine, FaBell, FaUpload, FaMoneyBillWave } from "react-icons/fa";

function Home() {
  const navigate = useNavigate();

  return (
    <div className="bg-gray-50 min-h-screen flex flex-col items-center justify-center p-8">
      {/* Hero Section */}
      <h1 className="text-4xl font-bold text-blue-700 mb-4 text-center">
        AI Business Insights Dashboard
      </h1>
      <p className="text-lg text-gray-700 max-w-2xl text-center mb-8">
        A simple, mobile‑optimized AI dashboard that helps SMBs track cashflow,
        forecast finances, and receive actionable alerts for better decision‑making.
      </p>

      {/* Call to Action */}
      <div className="space-x-4 mb-12">
        <button
          onClick={() => navigate("/register")}
          className="px-6 py-3 bg-green-600 text-white rounded hover:bg-green-700"
        >
          Get Started
        </button>
        <button
          onClick={() => navigate("/login")}
          className="px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Login
        </button>
        <button
          onClick={() => navigate("/settings")}
          className="px-6 py-3 bg-gray-600 text-white rounded hover:bg-gray-700"
        >
          Settings
        </button>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl">
        <div className="bg-white p-6 rounded shadow flex items-start space-x-4">
          <FaMoneyBillWave className="text-green-600 text-2xl mt-1" />
          <div>
            <h2 className="text-xl font-bold mb-2">Cashflow Tracking</h2>
            <p className="text-gray-600">
              Track income, expenses, and net cashflow with clarity and simplicity.
            </p>
          </div>
        </div>
        <div className="bg-white p-6 rounded shadow flex items-start space-x-4">
          <FaChartLine className="text-blue-600 text-2xl mt-1" />
          <div>
            <h2 className="text-xl font-bold mb-2">Predictive Forecasting</h2>
            <p className="text-gray-600">
              AI‑powered forecasts help you plan ahead and stay financially stable.
            </p>
          </div>
        </div>
        <div className="bg-white p-6 rounded shadow flex items-start space-x-4">
          <FaBell className="text-red-600 text-2xl mt-1" />
          <div>
            <h2 className="text-xl font-bold mb-2">Automated Alerts</h2>
            <p className="text-gray-600">
              Get notified when expenses exceed revenue or profit margins drop.
            </p>
          </div>
        </div>
        <div className="bg-white p-6 rounded shadow flex items-start space-x-4">
          <FaUpload className="text-purple-600 text-2xl mt-1" />
          <div>
            <h2 className="text-xl font-bold mb-2">Data Upload</h2>
            <p className="text-gray-600">
              Upload CSVs or enter transactions manually to keep your dashboard updated.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-12 text-gray-500 text-sm text-center">
        © 2026 AI Business Insights Dashboard. Helping SMBs stay financially informed.
      </footer>
    </div>
  );
}

export default Home;
