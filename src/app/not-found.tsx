import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-4 py-16 text-center">
      <p className="text-xs font-bold uppercase tracking-wider text-muted">Not found</p>
      <h1 className="mt-1 font-display text-3xl font-semibold text-navy">We couldn&apos;t find that</h1>
      <p className="mt-2 text-sm text-muted">
        It may have been removed, or your role may not include it. Check the link, or go back to your home screen.
      </p>
      <Link href="/" className="btn btn-primary mt-6">
        Go to my home
      </Link>
    </main>
  );
}
