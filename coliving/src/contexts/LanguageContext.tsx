"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { authStore } from "@/lib/api/auth-store";

export type Locale = "ko" | "en";

interface LanguageContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
}

const STORAGE_KEY = "nested-locale";

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("ko");

  useEffect(() => {
    function applyAccountLocale() {
      const preferredLocale = authStore.getUser()?.preferredLocale;

      if (!preferredLocale) return false;

      const accountLocale: Locale = preferredLocale === "EN" ? "en" : "ko";

      setLocaleState(accountLocale);
      window.localStorage.setItem(STORAGE_KEY, accountLocale);
      document.documentElement.lang = accountLocale;

      return true;
    }

    // 로그인 정보가 이미 저장돼 있다면 계정 언어를 우선 적용한다.
    if (!applyAccountLocale()) {
      const savedLocale = window.localStorage.getItem(STORAGE_KEY);

      if (savedLocale === "ko" || savedLocale === "en") {
        setLocaleState(savedLocale);
        document.documentElement.lang = savedLocale;
      } else {
        document.documentElement.lang = "ko";
      }
    }

    // 로그인·로그아웃·사용자 정보 갱신을 감지한다.
    return authStore.subscribe(() => {
      applyAccountLocale();
    });
  }, []);

  function setLocale(nextLocale: Locale) {
    setLocaleState(nextLocale);
    window.localStorage.setItem(STORAGE_KEY, nextLocale);
    document.documentElement.lang = nextLocale;
  }

  function toggleLocale() {
    setLocale(locale === "ko" ? "en" : "ko");
  }

  return (
    <LanguageContext.Provider
      value={{
        locale,
        setLocale,
        toggleLocale,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error("useLanguage must be used inside LanguageProvider.");
  }

  return context;
}
