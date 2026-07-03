export default function LoginLayout({ children }: { children: React.ReactNode }) {
  // Cancel the root layout's main padding (incl. the mobile top-bar offset)
  // so the login screen is truly full-bleed and centered.
  return <div className="-m-4 -mt-20 lg:-m-8">{children}</div>;
}
