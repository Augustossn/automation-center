import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import { Toaster } from "sonner";
import App from "./App";
import "./styles.css";
import "./operations-theme.css";
const client = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 10000 } },
});
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <MotionConfig reducedMotion="user">
        <App />
        <Toaster richColors position="bottom-right" />
      </MotionConfig>
    </QueryClientProvider>
  </React.StrictMode>,
);
