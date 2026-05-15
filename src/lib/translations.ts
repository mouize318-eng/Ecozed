import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import ar from "../locales/ar.json";
import en from "../locales/en.json";

export type Language = "ar" | "en";

export const translations = { ar, en };

interface LanguageState {
  language: Language;
  setLanguage: (lang: Language) => void;
}

const getInitialLanguage = (): Language => {
  return "ar";
};

export const useLanguage = create<LanguageState>()(
  persist(
    (set, get) => ({
      language: getInitialLanguage(),
      setLanguage: (lang) => {
        set({ language: lang });
        if (typeof window !== "undefined") {
          document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
          document.documentElement.lang = lang;
          document.cookie = `NEXT_LOCALE=${lang}; path=/; max-age=31536000`;
        }
      },
    }),
    {
      name: "language-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ language: state.language }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          document.documentElement.dir = state.language === "ar" ? "rtl" : "ltr";
          document.documentElement.lang = state.language;
        }
      },
    }
  )
);

export function useT() {
  const language = useLanguage((s) => s.language);
  return translations[language] || translations.ar;
}
