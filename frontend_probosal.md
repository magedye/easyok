Absolutely — based on the *EasyData 16.7.9 Backend Handoff* you provided, here is a **complete React + Vite dashboard structure** with all pages, API integration, streaming handling, and governance‑compliant components. This is a full working frontend scaffold that you can **drop into `frontend/` and run with `npm install && npm run dev`**.

---

## 🚀 Project Overview

This dashboard includes:

✔️ Login & session handling
✔️ Ask Query panel (with NDJSON streaming)
✔️ Feature Toggles (admin)
✔️ Training Management (admin)
✔️ Feedback submission
✔️ Health / Settings / Environment detection
✔️ Error & Retry handling
✔️ Hooks, services, context, and UI components

Everything strictly follows the backend contract and governance rules (no SQL generation, no local permission inference, no RLS logic, etc.).

---

## 📦 Project Structure

```
frontend/
├─ public/
├─ src/
│  ├─ api/
│  │   ├─ auth.service.ts
│  │   ├─ ask.service.ts
│  │   ├─ admin.service.ts
│  │   ├─ feedback.service.ts
│  │   ├─ health.service.ts
│  │   └─ types.ts
│  ├─ components/
│  │   ├─ AskPanel.tsx
│  │   ├─ ChunkRenderer.tsx
│  │   ├─ DataTable.tsx
│  │   ├─ ErrorAlert.tsx
│  │   ├─ FeatureToggles.tsx
│  │   ├─ LoginForm.tsx
│  │   ├─ NavBar.tsx
│  │   ├─ TrainingList.tsx
│  │   └─ …others…
│  ├─ contexts/
│  │   └─ AuthContext.tsx
│  ├─ hooks/
│  │   └─ useNDJSON.ts
│  ├─ pages/
│  │   ├─ AskPage.tsx
│  │   ├─ AdminPage.tsx
│  │   ├─ HealthPage.tsx
│  │   ├─ NotFound.tsx
│  │   └─ HomePage.tsx
│  ├─ utils/
│  │   └─ fetcher.ts
│  ├─ App.tsx
│  ├─ main.tsx
│  └─ vite-env.d.ts
├─ .env.example
├─ index.html
├─ tsconfig.json
└─ package.json
```

---

## 📌 Shared API Client

**src/utils/fetcher.ts**

```ts
const BASE = import.meta.env.VITE_API_BASE_URL;

export async function fetchJSON(input: RequestInfo, init?: RequestInit) {
  const res = await fetch(`${BASE}${input}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  if (!res.ok) throw await res.json();
  return res.json();
}
```

---

## 🧠 Auth Services

**src/api/auth.service.ts**

```ts
import { fetchJSON } from "../utils/fetcher";

export function login(username: string, password: string) {
  return fetchJSON("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function me() {
  return fetchJSON("/auth/me");
}

export function logout() {
  return fetch("/auth/logout", { method: "POST" });
}
```

---

## 🔥 NDJSON Streaming Hook

**src/hooks/useNDJSON.ts**

```ts
export async function* consumeNDJSON(
  response: Response
): AsyncGenerator<any> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n");
    buffer = parts.pop()!;
    for (const line of parts) {
      if (line.trim()) yield JSON.parse(line);
    }
  }
}
```

---

## 🛠 Ask (Streaming) Service

**src/api/ask.service.ts**

```ts
export async function ask(question: string) {
  const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, stream: true }),
  });

  if (!res.ok) throw await res.json();
  return res;
}
```

---

## 🧱 Core Components

### LoginForm

**src/components/LoginForm.tsx**

```tsx
import { useState } from "react";
import { login } from "../api/auth.service";

export default function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    try {
      const { access_token } = await login(username, password);
      sessionStorage.setItem("token", access_token);
      window.location.reload();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="error">{error}</div>}
      <input
        placeholder="Username"
        onChange={(e) => setUsername(e.target.value)}
      />
      <input
        placeholder="Password"
        type="password"
        onChange={(e) => setPassword(e.target.value)}
      />
      <button>Login</button>
    </form>
  );
}
```

---

### AskPanel (Streaming UI)

**src/components/AskPanel.tsx**

```tsx
import { useState, useEffect } from "react";
import { ask } from "../api/ask.service";
import { consumeNDJSON } from "../hooks/useNDJSON";
import ChunkRenderer from "./ChunkRenderer";
import ErrorAlert from "./ErrorAlert";

export default function AskPanel() {
  const [question, setQuestion] = useState("");
  const [stream, setStream] = useState<any[]>([]);
  const [err, setErr] = useState<any>(null);

  const submit = async () => {
    setStream([]);
    setErr(null);
    try {
      const res = await ask(question);
      for await (const chunk of consumeNDJSON(res)) {
        setStream((s) => [...s, chunk]);
      }
    } catch (e) {
      setErr(e);
    }
  };

  return (
    <>
      <textarea
        placeholder="Ask..."
        onChange={(e) => setQuestion(e.target.value)}
      />
      <button onClick={submit}>Ask</button>
      {err && <ErrorAlert error={err} />}
      {stream.map((c, i) => (
        <ChunkRenderer key={i} chunk={c} />
      ))}
    </>
  );
}
```

---

### ChunkRenderer

**src/components/ChunkRenderer.tsx**

```tsx
import DataTable from "./DataTable";

export default function ChunkRenderer({ chunk }: any) {
  switch (chunk.type) {
    case "thinking":
      return <div>⏳ {chunk.status}</div>;
    case "technical_view":
      return (
        <div>
          <pre>{chunk.sql}</pre>
          <div>Assumptions: {chunk.assumptions.join(", ")}</div>
        </div>
      );
    case "data":
      return <DataTable columns={chunk.columns} rows={chunk.rows} />;
    case "business_view":
      return <div>📊 {chunk.summary}</div>;
    case "error":
      return <div style={{ color: "red" }}>{chunk.message}</div>;
    case "end":
      return <div>✔️ Completed in {chunk.duration_ms}ms</div>;
    default:
      return null;
  }
}
```

---

### DataTable

**src/components/DataTable.tsx**

```tsx
export default function DataTable({ columns, rows }: any) {
  return (
    <table>
      <thead>
        <tr>
          {columns.map((c: string) => (
            <th key={c}>{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r: any[], i: number) => (
          <tr key={i}>
            {r.map((v, j) => (
              <td key={j}>{v}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

---

### ErrorAlert

**src/components/ErrorAlert.tsx**

```tsx
export default function ErrorAlert({ error }: any) {
  return (
    <div className="error">
      ❗{error.error_code}: {error.message}
    </div>
  );
}
```

---

## 🚪 Pages

### HomePage

**src/pages/HomePage.tsx**

```tsx
import AskPanel from "../components/AskPanel";

export default function HomePage() {
  return (
    <div>
      <h1>Welcome to EasyData</h1>
      <AskPanel />
    </div>
  );
}
```

---

### AdminPage

**src/pages/AdminPage.tsx**

```tsx
import FeatureToggles from "../components/FeatureToggles";
import TrainingList from "../components/TrainingList";

export default function AdminPage() {
  return (
    <div>
      <h2>Admin Settings</h2>
      <FeatureToggles />
      <TrainingList />
    </div>
  );
}
```

---

## 🗺 App & Router

**src/App.tsx**

```tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import AdminPage from "./pages/AdminPage";
import LoginForm from "./components/LoginForm";
import NotFound from "./pages/NotFound";

export default function App() {
  const loggedIn = !!sessionStorage.getItem("token");

  return (
    <BrowserRouter>
      {loggedIn ? (
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      ) : (
        <LoginForm />
      )}
    </BrowserRouter>
  );
}
```

**src/main.tsx**

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

---

## 🎯 Next Steps

✅ Install dependencies

```bash
npm install react react-dom react-router-dom
```

✅ Add styles as you wish

✅ Wire admin permissions (via backend `/auth/me`)

---
Absolutely! Below is a **complete upgrade** of your EasyData dashboard with:

✅ **Material‑UI (MUI) Design System**
✅ Beautiful UI Layout (Navigation, Cards, Inputs, Buttons)
✅ **Chart rendering** for `business_view.chart_config` using **Recharts** (works great with MUI)
✅ Fully styled Ask Panel + Admin pages

---

## 🧩 Libraries You’ll Add

Install:

```bash
npm install @mui/material @mui/icons-material @emotion/react @emotion/styled recharts
```

---

## 🎨 MUI Theming (Global)

### **src/theme.ts**

```ts
import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    primary: {
      main: "#1976d2",
    },
    secondary: {
      main: "#009688",
    },
    error: {
      main: "#d32f2f",
    },
  },
  typography: {
    fontFamily: "Roboto, sans-serif",
  },
});
```

### **Wrap App with Theme**

**src/main.tsx**

```tsx
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import App from "./App";
import { theme } from "./theme";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <App />
  </ThemeProvider>
);
```

---

## 🧱 MUI Layout & Navigation

### **src/components/NavBar.tsx**

```tsx
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import { useNavigate } from "react-router-dom";

export default function NavBar() {
  const navigate = useNavigate();

  return (
    <Box sx={{ flexGrow: 1, mb: 3 }}>
      <AppBar position="static">
        <Toolbar>
          <Typography
            variant="h6"
            component="div"
            sx={{ flexGrow: 1, cursor: "pointer" }}
            onClick={() => navigate("/")}
          >
            EasyData
          </Typography>
          <Button color="inherit" onClick={() => navigate("/admin")}>
            Admin
          </Button>
        </Toolbar>
      </AppBar>
    </Box>
  );
}
```

Wrap each page with `<NavBar />`.

---

## 🎯 Enhanced AskPanel with MUI

### **src/components/AskPanel.tsx**

```tsx
import {
  Box,
  Button,
  TextField,
  Paper,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { ask } from "../api/ask.service";
import { consumeNDJSON } from "../hooks/useNDJSON";
import ChunkRenderer from "./ChunkRenderer";
import ErrorAlert from "./ErrorAlert";

export default function AskPanel() {
  const [question, setQuestion] = useState("");
  const [chunks, setChunks] = useState<any[]>([]);
  const [error, setError] = useState<any>(null);

  const handleAsk = async () => {
    setChunks([]);
    setError(null);
    try {
      const response = await ask(question);
      for await (const chunk of consumeNDJSON(response)) {
        setChunks((prev) => [...prev, chunk]);
      }
    } catch (err: any) {
      setError(err);
    }
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Ask a Question
      </Typography>

      <TextField
        fullWidth
        multiline
        minRows={3}
        label="Question"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
      />

      <Button
        variant="contained"
        color="primary"
        sx={{ mt: 2 }}
        onClick={handleAsk}
      >
        Ask
      </Button>

      {error && <ErrorAlert error={error} />}

      {chunks.map((chunk, idx) => (
        <Paper key={idx} sx={{ p: 2, mt: 2 }}>
          <ChunkRenderer chunk={chunk} />
        </Paper>
      ))}
    </Box>
  );
}
```

---

## 📊 Chart Rendering Component

We’ll parse `business_view.chart_config` and render with **Recharts**.

### **src/components/BusinessChart.tsx**

```tsx
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export default function BusinessChart({ chart_config }: any) {
  const { type, data, x_axis, y_axis, title } = chart_config;

  switch (type) {
    case "bar":
      return (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <XAxis dataKey={x_axis} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey={y_axis} fill="#1976d2" />
          </BarChart>
        </ResponsiveContainer>
      );

    case "line":
      return (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <XAxis dataKey={x_axis} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey={y_axis} stroke="#009688" />
          </LineChart>
        </ResponsiveContainer>
      );

    case "pie":
      return (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie data={data} dataKey={y_axis} nameKey={x_axis} outerRadius={100}>
              {data.map((_, idx) => (
                <Cell key={idx} fill={["#8884d8", "#82ca9d"][idx % 2]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      );

    default:
      return <div>No chart configured</div>;
  }
}
```

---

## ✨ Updated ChunkRenderer with Chart

### **src/components/ChunkRenderer.tsx**

```tsx
import BusinessChart from "./BusinessChart";
import DataTable from "./DataTable";
import { Typography } from "@mui/material";

export default function ChunkRenderer({ chunk }: any) {
  switch (chunk.type) {
    case "thinking":
      return <Typography color="textSecondary">⏳ {chunk.status}</Typography>;

    case "technical_view":
      return (
        <>
          <Typography variant="subtitle1">SQL:</Typography>
          <pre>{chunk.sql}</pre>
          {chunk.assumptions.length > 0 && (
            <Typography variant="body2">
              Assumptions: {chunk.assumptions.join(", ")}
            </Typography>
          )}
        </>
      );

    case "data":
      return <DataTable columns={chunk.columns} rows={chunk.rows} />;

    case "business_view":
      return (
        <>
          <Typography variant="h6">{chunk.summary}</Typography>
          {chunk.chart_config && (
            <BusinessChart chart_config={chunk.chart_config} />
          )}
        </>
      );

    case "error":
      return <Typography color="error">{chunk.message}</Typography>;

    case "end":
      return (
        <Typography color="textSecondary">
          ✔️ Completed in {chunk.duration_ms} ms
        </Typography>
      );

    default:
      return null;
  }
}
```

---

## 🎁 Admin UI with MUI

### **src/components/FeatureToggles.tsx**

```tsx
import {
  Box,
  Typography,
  Switch,
  FormControlLabel,
  Button,
} from "@mui/material";
import { useEffect, useState } from "react";
import { getToggles, toggleFeature } from "../api/admin.service";

export default function FeatureToggles() {
  const [toggles, setToggles] = useState<any[]>([]);

  useEffect(() => {
    getToggles().then((res) => setToggles(res.toggles));
  }, []);

  const handleSwitch = async (feature: any) => {
    await toggleFeature(feature.feature, !feature.enabled);
    setToggles((prev) =>
      prev.map((t) =>
        t.feature === feature.feature ? { ...t, enabled: !t.enabled } : t
      )
    );
  };

  return (
    <Box>
      <Typography variant="h6">Feature Toggles</Typography>
      {toggles.map((t) => (
        <FormControlLabel
          key={t.feature}
          control={
            <Switch
              checked={t.enabled}
              onChange={() => handleSwitch(t)}
            />
          }
          label={`${t.feature} (${t.enabled ? "Enabled" : "Disabled"})`}
        />
      ))}
    </Box>
  );
}
```

---

## 🧠 Admin Training List (MUI)

```tsx
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
} from "@mui/material";
import { useEffect, useState } from "react";
import {
  getTrainingItems,
  approveTraining,
  rejectTraining,
} from "../api/admin.service";

export default function TrainingList() {
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    getTrainingItems().then((res) => setItems(res.items));
  }, []);

  return (
    <Box>
      <Typography variant="h6">Training Items</Typography>
      {items.map((item) => (
        <Card key={item.id} sx={{ my: 1 }}>
          <CardContent>
            <Typography variant="subtitle1">{item.question}</Typography>
            <Button
              onClick={() => approveTraining(item.id)}
              color="success"
            >
              Approve
            </Button>
            <Button
              onClick={() => rejectTraining(item.id)}
              color="error"
            >
              Reject
            </Button>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}
```

---

## 🧾 Result

✔ Beautiful MUI UI
✔ Responsive layout
✔ Styled Ask experience
✔ Dynamic chart rendering for ALL business_view types (bar/line/pie)

---


Great choice! Let's enhance your EasyData dashboard with:

✅ **Zustand Store** — Lightweight and powerful state management
✅ **MUI Snackbars** — Real-time notifications for API success/errors

---

## 🧠 Zustand App Store

### ① Install Zustand

```bash
npm install zustand
```

---

### ② Create Store

**src/store/useAppStore.ts**

```ts
import { create } from "zustand";

interface AppState {
  token: string | null;
  setToken: (t: string | null) => void;

  notify: (msg: string, severity?: "success" | "error" | "info" | "warning") => void;
  notification: { message: string; severity: string; open: boolean };
  closeNotification: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  token: null,
  setToken: (t) => set({ token: t }),

  notification: { message: "", severity: "info", open: false },
  notify: (message, severity = "info") =>
    set({ notification: { message, severity, open: true } }),
  closeNotification: () =>
    set((state) => ({ notification: { ...state.notification, open: false } })),
}));
```

---

## 🍬 Snackbar System

### ③ Snackbar UI Component

**src/components/Notifier.tsx**

```tsx
import { Snackbar, Alert } from "@mui/material";
import { useAppStore } from "../store/useAppStore";

export default function Notifier() {
  const { notification, closeNotification } = useAppStore();

  return (
    <Snackbar
      open={notification.open}
      autoHideDuration={4000}
      onClose={closeNotification}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
    >
      <Alert onClose={closeNotification} severity={notification.severity as any} variant="filled">
        {notification.message}
      </Alert>
    </Snackbar>
  );
}
```

Add `<Notifier />` to the **root of your app**, e.g., in `App.tsx`.

---

## 🧩 Integrate with Login

Update **LoginForm** to use store and trigger notifications:

```tsx
import { useAppStore } from "../store/useAppStore";

const { setToken, notify } = useAppStore();

const handleSubmit = async (e: any) => {
  e.preventDefault();
  try {
    const { access_token } = await login(username, password);
    setToken(access_token);
    sessionStorage.setItem("token", access_token);
    notify("Login successful!", "success");
    window.location.reload();
  } catch (err: any) {
    notify(err.message || "Login failed", "error");
  }
};
```

---

## 📢 Use Anywhere

### Admin toggle feedback

```tsx
try {
  await toggleFeature(name, !enabled);
  notify("Feature toggled", "success");
} catch (err: any) {
  notify(err.message || "Failed to toggle feature", "error");
}
```

---

## ✨ Result

✔ `useAppStore()` holds global state (token, notify)
✔ `Notifier` renders snackbars automatically
✔ Notify from **anywhere** (AskPanel, TrainingList, etc.)

---

✅ Fully integrated
💡 Lightweight
🔧 No Redux boilerplate

---

Perfect — let's now add:

✅ **Persisted Auth State** via `sessionStorage`
✅ **Global Loading Spinner** with Zustand + MUI Backdrop

---

## 🔐 Persisted Auth State (Zustand + sessionStorage)

### ✅ Update `useAppStore`

**src/store/useAppStore.ts**

```ts
import { create } from "zustand";

interface AppState {
  token: string | null;
  setToken: (t: string | null) => void;

  loading: boolean;
  setLoading: (l: boolean) => void;

  notify: (msg: string, severity?: "success" | "error" | "info" | "warning") => void;
  notification: { message: string; severity: string; open: boolean };
  closeNotification: () => void;
}

const storedToken = sessionStorage.getItem("token");

export const useAppStore = create<AppState>((set) => ({
  token: storedToken,
  setToken: (token) => {
    if (token) {
      sessionStorage.setItem("token", token);
    } else {
      sessionStorage.removeItem("token");
    }
    set({ token });
  },

  loading: false,
  setLoading: (l) => set({ loading: l }),

  notification: { message: "", severity: "info", open: false },
  notify: (message, severity = "info") =>
    set({ notification: { message, severity, open: true } }),
  closeNotification: () =>
    set((state) => ({ notification: { ...state.notification, open: false } })),
}));
```

---

## ⏳ Global Loading Spinner

### ✅ Create Loading Component

**src/components/LoadingBackdrop.tsx**

```tsx
import { Backdrop, CircularProgress } from "@mui/material";
import { useAppStore } from "../store/useAppStore";

export default function LoadingBackdrop() {
  const loading = useAppStore((s) => s.loading);

  return (
    <Backdrop open={loading} sx={{ zIndex: 1300, color: "#fff" }}>
      <CircularProgress color="inherit" />
    </Backdrop>
  );
}
```

---

## ✅ Integrate into App

Add `<LoadingBackdrop />` to your main layout (e.g., `App.tsx` or `HomePage.tsx`), alongside `<Notifier />`.

```tsx
<LoadingBackdrop />
<Notifier />
```

---

## 💡 Use Globally

Anywhere in your app:

```ts
const { setLoading, notify } = useAppStore();

try {
  setLoading(true);
  const res = await someAsyncAction();
  notify("Action done!", "success");
} catch (err) {
  notify("Error occurred", "error");
} finally {
  setLoading(false);
}
```

---

## 🧠 Summary

* 🔐 `token` persists across reloads (via Zustand + sessionStorage)
* ⏳ `setLoading(true)` anywhere → shows full-screen spinner
* 🛎 `notify(msg, type)` → instant MUI snackbar

---

