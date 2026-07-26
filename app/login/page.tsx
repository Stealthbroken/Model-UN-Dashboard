import { LoginForm } from "@/components/LoginForm";
import { hasPrivilegedAccount, teamPasswordLoginAllowed } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  const [teamAllowed, claimed] = await Promise.all([
    teamPasswordLoginAllowed(),
    hasPrivilegedAccount(),
  ]);

  // Only send people back to in-app paths — never to an absolute URL.
  const raw = searchParams.next ?? "";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-10">
      <div className="max-w-sm w-full">
        <div className="text-center mb-7">
          <h1 className="text-3xl font-bold text-gray-900">MUN Dashboard</h1>
          <p className="text-gray-500 mt-2 text-sm">Executive team workspace</p>
        </div>
        <LoginForm teamPasswordAllowed={teamAllowed} unclaimed={!claimed} next={next} />
      </div>
    </div>
  );
}
