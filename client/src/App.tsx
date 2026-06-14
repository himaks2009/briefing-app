import { useState } from "react";
import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient, setAdminSecret } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import AdminPage from "./pages/AdminPage";
import BriefingPage from "./pages/BriefingPage";
import ReadPage from "./pages/ReadPage";
import NotFound from "./pages/not-found";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldCheck, Lock } from "lucide-react";

function AdminLogin({ onLogin }: { onLogin: () => void }) {
  const [secret, setSecret] = useState("");
  const [error, setError] = useState(false);

  const handleLogin = async () => {
    setAdminSecret(secret);
    try {
      const res = await fetch("/api/briefings", {
        headers: { "x-admin-secret": secret },
      });
      if (res.ok) {
        onLogin();
      } else {
        setError(true);
        setAdminSecret("");
      }
    } catch {
      setError(true);
      setAdminSecret("");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-primary-foreground" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold">Система інструктажів</h1>
            <p className="text-sm text-muted-foreground mt-1">Адміністративний доступ</p>
          </div>
        </div>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              Пароль адміністратора
            </label>
            <Input
              data-testid="input-admin-secret"
              type="password"
              value={secret}
              onChange={e => { setSecret(e.target.value); setError(false); }}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              placeholder="Введіть пароль..."
              className={error ? "border-destructive" : ""}
            />
            {error && <p className="text-xs text-destructive">Невірний пароль</p>}
          </div>
          <Button data-testid="button-admin-login" className="w-full" onClick={handleLogin}>
            Увійти
          </Button>
        </div>
      </div>
    </div>
  );
}

function AdminRoutes() {
  const [authed, setAuthed] = useState(false);

  if (!authed) return <AdminLogin onLogin={() => setAuthed(true)} />;

  return (
    <Switch>
      <Route path="/" component={AdminPage} />
      <Route path="/briefing/:id" component={BriefingPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router hook={useHashLocation}>
        <Switch>
          {/* Public route for personnel — no auth needed */}
          <Route path="/read/:briefingId/:personnelId/:token" component={ReadPage} />
          {/* Admin routes — password protected */}
          <Route>{() => <AdminRoutes />}</Route>
        </Switch>
      </Router>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
