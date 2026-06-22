import Link from "next/link";
import { supabase } from "@/lib/supabase";
import ApartmentGrid from "./components/ApartmentGrid";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  const { data: apartments, error } = await supabase
    .from("apartments")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-8 text-slate-400">
        Error loading apartments: {error.message}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Sticky nav */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          {/* Logo — clicking goes to homepage */}
          <Link href="/" className="group flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 via-indigo-500 to-sky-500 shadow-lg shadow-violet-500/30 transition group-hover:shadow-violet-500/50">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-6 w-6 text-white"
              >
                <circle cx="12" cy="12" r="2" />
                <path d="M12 2a10 10 0 0 1 0 20" opacity="0.3" />
                <path d="M12 6a6 6 0 0 1 0 12" opacity="0.6" />
                <path d="M4.93 4.93l1.41 1.41" />
                <path d="M17.66 17.66l1.41 1.41" />
              </svg>
            </div>
            <div className="flex flex-col gap-0.5 leading-none">
              <span className="text-xl font-extrabold tracking-tight text-white transition group-hover:text-violet-300">
                Apartment Radar
              </span>
              <span className="text-xs font-medium tracking-wide text-slate-500">
                AI-Powered Apartment Finder
              </span>
            </div>
          </Link>

          {/* Live indicator */}
          <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span className="text-xs font-semibold text-emerald-400">Live</span>
          </div>
        </div>
      </header>

      {/* Page title bar — compact, like Zillow's search results header */}
      <div className="border-b border-slate-800/60 bg-slate-950 px-6 py-4">
        <div className="mx-auto max-w-7xl flex items-center justify-between gap-4">
          <h1 className="text-lg font-semibold text-white">
            Apartment Hunt
          </h1>
          <p className="text-sm text-slate-500">
            {apartments?.length ?? 0} listings from{" "}
            <span className="text-blue-400">Zillow</span>,{" "}
            <span className="text-orange-400">StreetEasy</span> &{" "}
            <span className="text-cyan-400">RentHop</span>
          </p>
        </div>
      </div>

      {/* Content */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        <ApartmentGrid apartments={apartments ?? []} />
      </main>
    </div>
  );
}
