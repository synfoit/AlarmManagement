import axios from "axios";

// 1) Base URL and default headers
axios.defaults.baseURL = import.meta.env.VITE_API_BASE_URL;
axios.defaults.headers.common["Content-Type"] = "application/json";

// ✅ 2) Attach token if available
const token = localStorage.getItem("authToken");
if (token) {
  axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
}

// 3) Intercept 401/403 → trigger global logout
axios.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    if (status === 401 || status === 403) {
      window.dispatchEvent(new Event("auth/autoLogout"));
    }
    return Promise.reject(err);
  }
);
