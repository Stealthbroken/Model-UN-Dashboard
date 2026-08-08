import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { ToastProvider } from "@/components/Toast";
import { getCurrentUser } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/session";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"),
  title: "IRHS Model UN — Executive Workspace",
  description: "Plan meetings, manage tasks, and keep the IRHS Model UN executive team ready.",
  icons: { icon: "/favicon.ico" },
  openGraph: {
    title: "IRHS Model UN",
    description: "Ready for every meeting.",
    images: [{ url: "/og.png", width: 1536, height: 1024, alt: "IRHS Model UN executive workspace" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "IRHS Model UN",
    description: "Ready for every meeting.",
    images: ["/og.png"],
  },
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
      <body className="bg-canvas min-h-screen text-gray-900 antialiased">
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
              <main className="flex-1 min-w-0 px-4 pb-24 pt-5 sm:px-6 sm:pt-7 lg:px-10 lg:pb-10 lg:pt-9">{children}</main>
            </div>
          ) : (
            children
          )}
        </ToastProvider>
      </body>
    </html>
  );
}
