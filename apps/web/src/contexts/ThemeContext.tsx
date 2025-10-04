import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  primaryColor: string;
  updatePrimaryColor: (value: string) => void;
  resetColor: () => void;
}

const defaultPrimaryColor = '#9146ff'; // Twitch purple

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme') as Theme;
    return saved || 'dark';
  });

  const [primaryColor, setPrimaryColor] = useState<string>(() => {
    const saved = localStorage.getItem('primaryColor');
    return saved || defaultPrimaryColor;
  });

  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('primaryColor', primaryColor);

    // Helper to lighten/darken colors
    const adjustColor = (hex: string, percent: number) => {
      const num = parseInt(hex.replace('#', ''), 16);
      const r = Math.max(0, Math.min(255, Math.floor((num >> 16) * (1 + percent))));
      const g = Math.max(0, Math.min(255, Math.floor(((num >> 8) & 0x00FF) * (1 + percent))));
      const b = Math.max(0, Math.min(255, Math.floor((num & 0x0000FF) * (1 + percent))));
      return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
    };

    const darken = (hex: string, percent: number) => adjustColor(hex, -percent);
    const lighten = (hex: string, percent: number) => adjustColor(hex, percent);

    // Set primary color (purple) - all shades
    document.documentElement.style.setProperty('--color-game-purple', primaryColor); // 500
    document.documentElement.style.setProperty('--color-game-purple-600', darken(primaryColor, 0.15));
    document.documentElement.style.setProperty('--color-game-purple-700', darken(primaryColor, 0.25));
    document.documentElement.style.setProperty('--color-game-purple-800', darken(primaryColor, 0.35));
    document.documentElement.style.setProperty('--color-game-purple-900', darken(primaryColor, 0.45));
    document.documentElement.style.setProperty('--color-game-purple-400', lighten(primaryColor, 0.15));
    document.documentElement.style.setProperty('--color-game-purple-300', lighten(primaryColor, 0.25));
    document.documentElement.style.setProperty('--color-game-purple-200', lighten(primaryColor, 0.35));
    document.documentElement.style.setProperty('--color-game-purple-100', lighten(primaryColor, 0.45));
  }, [primaryColor]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const updatePrimaryColor = (value: string) => {
    setPrimaryColor(value);
  };

  const resetColor = () => {
    setPrimaryColor(defaultPrimaryColor);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, primaryColor, updatePrimaryColor, resetColor }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
