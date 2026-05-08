export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { MagicLinkForm } from "@/components/auth/MagicLinkForm";
import { BookOpen, BrainCircuit, TrendingUp, ShieldCheck } from "lucide-react";

const features = [
  {
    icon: BookOpen,
    title: "Upload your materials",
    description: "PDFs and YouTube lecture videos — indexed automatically.",
  },
  {
    icon: BrainCircuit,
    title: "Guided Socratic questions",
    description: "Gemini asks you questions calibrated to your level, not give you answers.",
  },
  {
    icon: TrendingUp,
    title: "Track your mastery",
    description: "Score per topic rises as you answer correctly — see growth over time.",
  },
];

export default async function LandingPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user) {
    if (session.user.role === "admin") redirect("/admin/users");
    redirect("/dashboard");
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Subtle grid background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "linear-gradient(var(--foreground) 1px, transparent 1px), linear-gradient(90deg, var(--foreground) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 lg:flex-row lg:items-center lg:gap-16 lg:py-16">

        {/* ── Left: hero content ── */}
        <div className="flex flex-1 flex-col justify-center pt-16 pb-8 lg:py-0">
          {/* Wordmark */}
          <div className="mb-8 inline-flex w-fit items-center gap-2 rounded-full border border-border bg-muted/60 px-4 py-1.5 text-xs font-medium text-muted-foreground">
            <span className="size-1.5 rounded-full bg-primary" />
            B.Sc. Thesis — UNIOSUN Osogbo
          </div>

          <h1 className="mb-4 text-5xl font-bold tracking-tight text-foreground lg:text-6xl">
            Learn<span className="text-primary">AI</span>
          </h1>

          <p className="mb-10 max-w-md text-lg leading-relaxed text-muted-foreground">
            Upload your lecture materials. Ask questions. Get guided back to the answer — not given it. Your mastery score grows with every correct response.
          </p>

          {/* Feature list */}
          <ul className="space-y-5">
            {features.map(({ icon: Icon, title, description }) => (
              <li key={title} className="flex items-start gap-3.5">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
                  <Icon className="size-4 text-foreground" strokeWidth={1.75} />
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">{title}</p>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* ── Right: sign-in card ── */}
        <div className="flex w-full flex-col pb-16 lg:w-[380px] lg:shrink-0 lg:pb-0">
          <div className="rounded-2xl border border-border bg-card shadow-lg">
            {/* Card header */}
            <div className="border-b border-border px-6 py-5">
              <h2 className="text-base font-semibold text-card-foreground">Sign in to LearnAI</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Enter your email — we&apos;ll send a sign-in link. No password needed.
              </p>
            </div>

            {/* Card body */}
            <div className="px-6 py-5">
              <MagicLinkForm />
            </div>
          </div>

          {/* Admin link */}
          <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5" />
            <span>Admin?</span>
            <Link
              href="/admin/login"
              className="font-medium text-foreground underline underline-offset-2 transition-opacity hover:opacity-70"
            >
              Sign in here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
