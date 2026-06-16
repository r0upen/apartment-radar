import { supabase } from "@/lib/supabase";
import ApartmentGrid from "./components/ApartmentGrid";

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
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 text-sm font-bold text-white shadow-lg">
              R
            </div>
            <span className="text-lg font-semibold tracking-tight text-white">
              Apartment Radar
            </span>
          </div>
          <span className="hidden text-sm text-slate-500 sm:block">
            AI-Powered Apartment Finder
          </span>
        </div>
      </header>

      {/* Hero stripe */}
      <div className="border-b border-slate-800 px-6 py-10">
        <div className="mx-auto max-w-7xl">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-violet-400">
            Live Listings
          </p>
          <h1 className="text-3xl font-bold text-white">
            Naryne&rsquo;s Apartment Hunt
          </h1>
          <p className="mt-2 text-slate-400">
            {apartments?.length ?? 0} apartments scraped from Zillow and
            StreetEasy
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
