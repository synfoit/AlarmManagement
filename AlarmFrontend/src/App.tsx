import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { clearLogoutFlag, autoLogout } from "./features/auth/authSlice";
import AppRoutes from "./routes/AppRoutes";
import { ProgressListener } from "./components/ProgressListener";
import "./App.css";
import "nprogress/nprogress.css";
import type { RootState } from "./app/store";
import { Toaster, toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";

function App() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const justLoggedOut = useSelector(
    (state: RootState) => state.auth.justLoggedOut
  );

  // ✅ Check token expiration on initial mount
  useEffect(() => {
    const token = localStorage.getItem("authToken");
    const expiry = parseInt(localStorage.getItem("tokenExpiry") || "0", 10);

    const isExpired = token && expiry && expiry <= Date.now();
    if (isExpired) {
      dispatch(autoLogout());

      toast.error("Session expired. Please log in again.", {
        id: "session-expired",
        duration: 3000,
        position: "top-center",
      });

      setTimeout(() => {
        dispatch(clearLogoutFlag());
        navigate("/login", { replace: true });
      }, 1600);
    }
  }, [dispatch, navigate]);

  // ✅ Listen for auto logout from setTimeout in loginSuccess
  useEffect(() => {
    const handleAutoLogout = () => {
      dispatch(autoLogout());
    };

    window.addEventListener("auth/autoLogout", handleAutoLogout);
    return () => {
      window.removeEventListener("auth/autoLogout", handleAutoLogout);
    };
  }, [dispatch]);

  // ✅ Toast and redirect when logged out
  useEffect(() => {
    if (justLoggedOut) {
      toast.error("Session expired. Please log in again.", {
        id: "session-expired", // Prevent duplicates
        duration: 3000,
        position: "top-center",
      });

      const timer = setTimeout(() => {
        dispatch(clearLogoutFlag());
        navigate("/login", { replace: true });
      }, 1600);

      return () => clearTimeout(timer);
    }
  }, [justLoggedOut, dispatch, navigate]);

  return (
    <>
      <ProgressListener />
      <AppRoutes />
      <Toaster position="top-center" />
    </>
  );
}

export default App;
