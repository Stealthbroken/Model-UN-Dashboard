"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("mun-theme", next ? "dark" : "light");
    } catch {
      // ignore storage failures
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
    >
      <span>{dark ? "☀️" : "🌙"}</span>
      {dark ? "Light mode" : "Dark mode"}
    </button>
  );
}
