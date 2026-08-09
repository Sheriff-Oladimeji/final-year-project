export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { Fraunces } from "next/font/google";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { UploadCloud, MessagesSquare, LineChart, ArrowRight } from "lucide-react";

const display = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

const steps = [
  {
    number: "01",
    icon: UploadCloud,
    title: "Upload your materials",
    description:
      "Drop in PDFs or paste a YouTube lecture link. Each notebook holds up to ten sources — indexed and ready to talk to within a minute or two.",
  },
  {
    number: "02",
    icon: MessagesSquare,
    title: "Ask, and get guided — not spoon-fed",
    description:
      "Ask a question grounded in your own sources. Instead of a flat answer, you get an explanation followed by a Quick check calibrated to how well you already know the topic.",
  },
  {
    number: "03",
    icon: LineChart,
    title: "Prove it, and watch mastery grow",
    description:
      "Answer the Quick check and your topic score moves — up for a solid answer, down if you guessed. Recall, application, analysis: the tiers track how deep your understanding actually goes.",
  },
];

export default async function LandingPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user) redirect("/dashboard");

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

      {/* ── Nav ── */}
      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="text-lg font-semibold tracking-tight text-foreground">
          Learn<span className="text-primary">AI</span>
        </span>
        <Button asChild variant="ghost" size="sm">
          <Link href="/login">Sign in</Link>
        </Button>
      </header>

      {/* ── Hero ── */}
      <section className="relative mx-auto flex max-w-6xl flex-col gap-12 px-6 pt-8 pb-24 lg:flex-row lg:items-center lg:gap-16 lg:pt-16 lg:pb-32">
        {/* Left: headline */}
        <div className="flex flex-1 flex-col justify-center animate-in fade-in slide-in-from-bottom-3 duration-700">
          <p className="mb-4 text-sm font-medium tracking-wide text-primary">
            Guided learning, grounded in your own notes
          </p>

          <h1
            className={`${display.className} mb-6 text-4xl leading-[1.08] font-medium tracking-tight text-foreground sm:text-5xl lg:text-[3.4rem]`}
          >
            Ask a question.
            <br />
            Get taught<span className="italic text-primary">,</span> not just told.
          </h1>

          <p className="mb-8 max-w-md text-base leading-relaxed text-muted-foreground">
            Upload your lecture PDFs and YouTube recordings, ask anything, and get an
            explanation grounded in your own sources — followed by a Quick check that
            proves whether it actually landed.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <Button asChild size="lg" className="h-11 px-6 text-[0.95rem]">
              <Link href="/login">
                Get started free
                <ArrowRight className="ml-1 size-4 transition-transform group-hover/button:translate-x-0.5" />
              </Link>
            </Button>
            <p className="text-sm text-muted-foreground">No credit card. Just your notes.</p>
          </div>
        </div>

        {/* Right: honest product mock — not a fabricated screenshot */}
        <div className="w-full flex-1 lg:max-w-md animate-in fade-in slide-in-from-bottom-4 duration-700 [animation-delay:150ms] [animation-fill-mode:backwards]">
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_20px_50px_-25px_rgba(0,0,0,0.35)]">
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                Binary Search Trees
              </span>
              <span className="ml-auto text-xs text-muted-foreground">Recall · 20/100</span>
            </div>

            <div className="space-y-4 p-5 text-sm">
              <div className="ml-auto max-w-[80%] rounded-2xl rounded-tr-sm bg-muted px-3.5 py-2 text-right text-foreground">
                why is a BST faster to search than a plain list?
              </div>

              <div className="max-w-[88%] space-y-2 text-foreground">
                <p className="leading-relaxed">
                  Each step in a BST search throws away half the remaining nodes — a plain
                  list has to check them one by one.
                </p>
                <p className="leading-relaxed">
                  Think of it like this: it's the difference between scanning a shelf book
                  by book versus knowing which half of the library to skip entirely.
                </p>
              </div>

              <div className="rounded-xl border border-primary/15 bg-primary/[0.06] px-3.5 py-2.5">
                <p className="text-xs font-medium text-primary">Quick check</p>
                <p className="mt-0.5 leading-relaxed text-foreground/90">
                  What happens to search time if the tree becomes unbalanced?
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="relative mx-auto max-w-6xl px-6 pb-24 lg:pb-32">
        <div className="mb-14 max-w-lg">
          <h2 className={`${display.className} text-2xl font-medium tracking-tight text-foreground sm:text-3xl`}>
            How it works
          </h2>
        </div>

        <div className="grid grid-cols-1 divide-y divide-border border-t border-border">
          {steps.map(({ number, icon: Icon, title, description }, i) => (
            <div
              key={number}
              className="grid grid-cols-1 gap-4 py-10 sm:grid-cols-[auto_1fr] sm:gap-8 lg:grid-cols-[6rem_auto_1fr] lg:items-start animate-in fade-in slide-in-from-bottom-2 duration-700"
              style={{ animationDelay: `${i * 100}ms`, animationFillMode: "backwards" }}
            >
              <span className={`${display.className} text-3xl text-muted-foreground/40 lg:text-4xl`}>
                {number}
              </span>
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-muted">
                <Icon className="size-5 text-foreground" strokeWidth={1.6} />
              </span>
              <div className="max-w-lg">
                <h3 className="mb-1.5 text-base font-semibold text-foreground">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="relative mx-auto max-w-6xl px-6 pb-24">
        <div className="flex flex-col items-start gap-6 rounded-3xl border border-border bg-muted/40 px-8 py-12 sm:flex-row sm:items-center sm:justify-between sm:px-12">
          <div>
            <h2 className={`${display.className} mb-2 text-2xl font-medium tracking-tight text-foreground`}>
              Bring your notes. Leave with the mastery to match.
            </h2>
            <p className="max-w-md text-sm text-muted-foreground">
              Free to start — sign in and add your first source in under a minute.
            </p>
          </div>
          <Button asChild size="lg" className="h-11 shrink-0 px-6 text-[0.95rem]">
            <Link href="/login">
              Get started free
              <ArrowRight className="ml-1 size-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative mx-auto max-w-6xl px-6 pb-10">
        <div className="flex flex-col items-center justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row">
          <span>
            Learn<span className="text-primary">AI</span> — a guided learning assistant
          </span>
          <Link href="/login" className="transition-colors hover:text-foreground">
            Sign in
          </Link>
        </div>
      </footer>
    </div>
  );
}
