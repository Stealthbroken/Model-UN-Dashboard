import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { ToastProvider } from "@/components/Toast";
import { getCurrentUser } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/session";

export const metadata: Metadata = {
  title: "MUN Dashboard",
  description: "Model United Nations Club Executive Dashboard",
  icons: { icon: "/favicon.ico" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Null on /login and /invite — those render without the app shell.
  const user = await getCurrentUser();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="bg-gray-50 min-h-screen">
        <ToastProvider>
          {user ? (
            <div className="lg:flex min-h-screen">
              <Sidebar
                user={{
                  name: user.name,
                  roleLabel: ROLE_LABEL[user.role],
                  canSecgen: user.canSecgen,
                  viaTeamPassword: user.viaTeamPassword,
                }}
              />
              <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">{children}</main>
            </div>
          ) : (
            children
          )}
        </ToastProvider>
      </body>
    </html>
  );
}
