import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./index.css";

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: any }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("React ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ color: "#f87171", background: "#0f172a", padding: "30px", height: "100vh", fontFamily: "monospace" }}>
          <h2 style={{ fontSize: "20px", fontWeight: "bold", color: "#ef4444" }}>React Render Error</h2>
          <p style={{ marginTop: "10px", color: "#e2e8f0" }}>{String(this.state.error?.message || this.state.error)}</p>
          <pre style={{ marginTop: "16px", background: "#1e293b", padding: "12px", borderRadius: "8px", overflow: "auto", fontSize: "12px" }}>
            {this.state.error?.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
