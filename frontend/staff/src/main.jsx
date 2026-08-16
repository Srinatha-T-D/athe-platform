import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App apiBaseUrl={import.meta.env.VITE_API_BASE_URL} />
  </React.StrictMode>
);
