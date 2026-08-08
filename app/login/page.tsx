import { LoginForm } from "@/components/LoginForm";
import { hasPrivilegedAccount, teamPasswordLoginAllowed } from "@/lib/auth";
import { CheckCircle2, Globe2 } from "lucide-react";

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
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-8 sm:px-6">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl shadow-primary-900/10 lg:grid-cols-2">
        <section className="hidden bg-ink p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10"><Globe2 size={27} /></span><p className="mt-8 text-xs font-bold uppercase tracking-[0.18em] text-primary-200">IRHS Model UN</p><h1 className="mt-3 text-4xl font-extrabold leading-tight tracking-tight">Keep the team ready for every meeting.</h1><p className="mt-4 text-sm leading-relaxed text-primary-100">Plan agendas, share topic guides, take attendance, and finish follow-up work from one place.</p></div>
          <ul className="mt-12 space-y-3 text-sm text-primary-50"><li className="flex items-center gap-2"><CheckCircle2 size={17} className="text-primary-300" />See what needs attention</li><li className="flex items-center gap-2"><CheckCircle2 size={17} className="text-primary-300" />Run meetings from any device</li><li className="flex items-center gap-2"><CheckCircle2 size={17} className="text-primary-300" />Keep ownership clear</li></ul>
        </section>
        <section className="p-6 sm:p-10">
          <div className="mb-8 lg:hidden"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-ink text-white"><Globe2 size={24} /></span><p className="mt-4 section-kicker">IRHS Model UN</p></div>
          <p className="section-kicker">Welcome back</p><h2 className="mt-2 text-3xl font-extrabold tracking-tight text-gray-900">Sign in to your workspace</h2><p className="mt-2 text-sm text-gray-500">Use your executive account to continue.</p>
          <div className="mt-7"><LoginForm teamPasswordAllowed={teamAllowed} unclaimed={!claimed} next={next} /></div>
        </section>
      </div>
    </div>
  );
}
