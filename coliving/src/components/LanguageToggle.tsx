"use client";

import { useLanguage, type Locale } from "@/contexts/LanguageContext";

const LANGUAGES: {
  value: Locale;
  label: string;
}[] = [
  { value: "ko", label: "KO" },
  { value: "en", label: "EN" },
];

export function LanguageToggle() {
  const { locale, setLocale } = useLanguage();

  return (
    <div
      role="group"
      aria-label="언어 선택"
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: 3,
        border: "1px solid var(--border)",
        borderRadius: 999,
        background: "var(--bg-2)",
      }}
    >
      {LANGUAGES.map((language) => {
        const active = locale === language.value;

        return (
          <button
            type="button"
            key={language.value}
            onClick={() => setLocale(language.value)}
            aria-pressed={active}
            style={{
              minWidth: 34,
              height: 28,
              padding: "0 8px",
              border: "none",
              borderRadius: 999,
              background: active ? "var(--surface, #fff)" : "transparent",
              color: active ? "var(--text)" : "var(--text-2)",
              boxShadow: active ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
              fontSize: 11.5,
              fontWeight: active ? 700 : 500,
              cursor: "pointer",
            }}
          >
            {language.label}
          </button>
        );
      })}
    </div>
  );
}
