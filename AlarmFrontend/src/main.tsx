import "./index.css";
import "./app/axiosSetup";

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { BrowserRouter } from "react-router-dom";
import { Provider, useSelector } from "react-redux";
import { store, type RootState } from "./app/store";

async function loadConfig() {
  const res = await fetch("/config.json");
  window.APP_CONFIG = await res.json();
}

const ThemedRoot: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  const darkMode = useSelector((s: RootState) => s.ui.darkMode);

  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  return <>{children}</>;
};

loadConfig().then(() => {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <Provider store={store}>
        <BrowserRouter>
          <ThemedRoot>
            <App />
          </ThemedRoot>
        </BrowserRouter>
      </Provider>
    </React.StrictMode>
  );
});
