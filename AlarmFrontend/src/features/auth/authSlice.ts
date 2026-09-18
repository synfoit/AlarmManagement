// src/features/auth/authSlice.ts
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { jwtDecode } from "jwt-decode";
import type { AuthState, JwtPayload } from "./authTypes";

const DEBUG = false;

// 🔒 Centralized utility to clear auth-related localStorage keys
const clearAuthStorage = () => {
  ["authToken", "tokenExpiry", "name", "role", "userId"].forEach((key) =>
    localStorage.removeItem(key)
  );
};

// 🕒 Clears storage early if token already expired before app starts
const token = localStorage.getItem("authToken");
const expiresStr = localStorage.getItem("tokenExpiry");
const initialExpires = expiresStr ? parseInt(expiresStr, 10) : null;
const now = Date.now();

if (initialExpires && initialExpires <= now) {
  clearAuthStorage();
}

const initialState: AuthState = {
  isAuthenticated: !!token && !!initialExpires && initialExpires > now,
  token,
  expiresAt: initialExpires,
  logoutTimerId: null,
  justLoggedOut: false,
};

// 🧼 Cleanup helper shared by logout and autoLogout
const clearSessionState = (state: AuthState, justLoggedOut = false) => {
  clearAuthStorage();
  if (state.logoutTimerId) clearTimeout(state.logoutTimerId);

  Object.assign(state, {
    isAuthenticated: false,
    token: null,
    expiresAt: null,
    logoutTimerId: null,
    justLoggedOut,
  });
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    loginSuccess(state, action: PayloadAction<string>) {
      const token = action.payload;
      let expiresAt: number;

      try {
        const { exp } = jwtDecode<JwtPayload>(token);
        expiresAt = exp * 1000; // convert to ms
      } catch (e) {
        console.error("Invalid JWT:", e);
        return;
      }

      if (DEBUG) console.log("Token exp:", expiresAt, "Now:", Date.now());

      localStorage.setItem("authToken", token);
      localStorage.setItem("tokenExpiry", expiresAt.toString());

      if (state.logoutTimerId) {
        clearTimeout(state.logoutTimerId);
      }

      const msUntilExpiry = expiresAt - Date.now();
      const timerId = setTimeout(() => {
        window.dispatchEvent(new Event("auth/autoLogout"));
      }, msUntilExpiry);

      Object.assign(state, {
        isAuthenticated: true,
        token,
        expiresAt,
        logoutTimerId: timerId,
        justLoggedOut: false,
      });
    },

    logout(state) {
      clearSessionState(state);
    },

    autoLogout(state) {
      clearSessionState(state, true);
    },

    clearLogoutFlag(state) {
      state.justLoggedOut = false;
    },
  },
});

export const { loginSuccess, logout, autoLogout, clearLogoutFlag } =
  authSlice.actions;
export default authSlice.reducer;
