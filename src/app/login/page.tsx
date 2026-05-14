"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui";
import { useAuthStore } from "@/store/useAuthStore";
import { useLanguage } from "@/lib/translations";
import { Package } from "lucide-react";

export default function LoginPage() {
  const { t, language } = useLanguage();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState("");
  
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);

  useEffect(() => {
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = language;
  }, [language]);

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
          router.push("/dashboard");
        }
      } catch {
        // Not authenticated, stay on login
      } finally {
        setIsChecking(false);
      }
    }
    checkAuth();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.ok) {
        setUser(data.user);
        router.push("/dashboard");
      } else {
        setError(data.error || t.loginError);
      }
    } catch (err) {
      setError(t.genericError);
    } finally {
      setIsLoading(false);
    }
  };

  const isRtl = language === "ar";

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-20 h-20 bg-slate-900 rounded-[28px] flex items-center justify-center text-white shadow-2xl shadow-slate-900/10 mx-auto mb-8">
            <Package size={40} />
          </div>
          <div className="flex items-center justify-center gap-1.5 mb-4">
            <div className="w-3 h-3 bg-slate-900 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
            <div className="w-3 h-3 bg-slate-900 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
            <div className="w-3 h-3 bg-slate-900 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
          <p className="text-sm font-bold text-slate-400 tracking-wider uppercase">{isRtl ? "جارٍ التحقق..." : "Checking credentials..."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 bg-slate-50 ${isRtl ? "font-cairo" : ""}`}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-8 border border-slate-100">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">{t.login}</h1>
          <p className="text-slate-500 text-sm">{t.welcomeBack}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg text-center">
              {error}
            </div>
          )}

          <Input
            label={t.username}
            placeholder={isRtl ? "أدخل اسم المستخدم" : "Enter username"}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />

          <Input
            label={t.password}
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <Button type="submit" className="w-full h-11" isLoading={isLoading}>
            {t.login}
          </Button>
        </form>
      </div>
    </div>
  );
}
