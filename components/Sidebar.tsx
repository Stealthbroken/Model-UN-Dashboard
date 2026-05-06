"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Sidebar() {
  const pathname = usePathname();

  if (pathname === "/login") return null;

  return (
    <aside className="w-64 bg-white border-r border-gray-200 min-h-screen p-6 flex flex-col">
      <div className="mb-8">
        <h1 className="text-xl font-bold text-gray-900">MUN Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Executive Team</p>
      </div>

      <nav className="space-y-1 flex-1">
        <Link
          href="/"
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            pathname === "/"
              ? "bg-primary-50 text-primary-700"
              : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          }`}
        >
          <span>📅</span>
          Upcoming Meetings
        </Link>
        <Link
          href="/archive"
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            pathname === "/archive"
              ? "bg-primary-50 text-primary-700"
              : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          }`}
        >
          <span>🗂️</span>
          Past Meetings
        </Link>
        <Link
          href="/instagram"
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            pathname === "/instagram"
              ? "bg-primary-50 text-primary-700"
              : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          }`}
        >
          <span>📷</span>
          Instagram
        </Link>
        <Link
          href="https://app.slack.com/client/T09DZJJ5UE5"
          target="_blank"
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            pathname === "https://app.slack.com/client/T09DZJJ5UE5"
              ? "bg-primary-50 text-primary-700"
              : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          }`}
        >
          <span>💬</span>
          Open the Slack
        </Link>
        <Link
          href="https://classroom.google.com/u/0/c/NDI4NzY3NDUzNzNa"
          target="_blank"
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            pathname === "https://classroom.google.com/u/0/c/NDI4NzY3NDUzNzNa"
              ? "bg-primary-50 text-primary-700"
              : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          }`}
        >
          <span>📚</span>
          Open the Classroom
        </Link>
        <Link
          href="https://drive.google.com/drive/u/0/folders/1K5Q-qlF0RIVPJGQaIViOYQQTHYpJrR_x"
          target="_blank"
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            pathname === "https://drive.google.com/drive/u/0/folders/1K5Q-qlF0RIVPJGQaIViOYQQTHYpJrR_x"
              ? "bg-primary-50 text-primary-700"
              : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          }`}
        >
          <span>🗄️</span>
          Open the Drive
        </Link>
      </nav>

      <div className="pt-4 border-t border-gray-100">
        <p className="text-xs text-gray-400 mb-2">Thursdays · 11:10 AM · Room 137</p>
        <form action="/api/auth/logout" method="POST">
          <button
            type="submit"
            className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:text-red-600 transition-colors"
          >
            Log out
          </button>
        </form>
      </div>
    </aside>
  );
}
