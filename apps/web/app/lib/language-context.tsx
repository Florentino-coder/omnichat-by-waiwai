"use client";

import React, { createContext, useContext, useState } from "react";
import { Locale, defaultLocale } from "./i18n";

type LanguageContextType = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = window.localStorage.getItem("chatwai.locale") as Locale;
        if (stored === "th" || stored === "en") {
          return stored;
        }
      } catch {
        // Ignore
      }
    }
    return defaultLocale;
  });

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem("chatwai.locale", newLocale);
    } catch {
      // Ignore localStorage block
    }
  };

  return (
    <LanguageContext.Provider value={{ locale, setLocale }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
