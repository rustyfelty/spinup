import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="pixel-corners-sm dark:border-gray-700 border-gray-300">
      <button
        onClick={toggleTheme}
        className="pixel-corners-sm-content p-3 transition-all hover:scale-105
          bg-gradient-to-br dark:from-gray-800 dark:to-gray-900 from-gray-100 to-gray-200
          dark:text-yellow-400 text-gray-700
          hover:shadow-lg"
        style={{
          boxShadow: theme === 'dark'
            ? '0 2px 0 0 rgba(0,0,0,0.3), inset 0 1px 0 0 rgba(255,255,255,0.1)'
            : '0 2px 0 0 rgba(0,0,0,0.1), inset 0 1px 0 0 rgba(255,255,255,0.5)'
        }}
        title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      >
        {theme === 'light' ? (
          <Moon className="w-5 h-5" />
        ) : (
          <Sun className="w-5 h-5" />
        )}
      </button>
    </div>
  );
}
