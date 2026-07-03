import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { CommandPalette } from "@/components/CommandPalette";

export const metadata: Metadata = {
  title: "MUN Dashboard",
  description: "Model United Nations Club Executive Dashboard",
};

// Applies the saved theme before paint to avoid a flash of the wrong theme.
const themeScript = `
try {
  var t = localStorage.getItem('mun-theme');
  if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
  }
} catch (e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="bg-gray-50 min-h-screen">
        <div className="flex min-h-screen">
          <Sidebar />
          {/* pt-20 clears the fixed mobile top bar; lg reverts to the desktop gutter */}
          <main className="flex-1 min-w-0 p-4 pt-20 lg:p-8">{children}</main>
        </div>
        <CommandPalette />
      </body>
    </html>
  );
}
