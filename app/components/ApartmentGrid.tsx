"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import FavoriteButton from "./FavoriteButton";
import { supabase } from "@/lib/supabase";

type Apartment = {
  id: string;
  listing_url: string;
  source: string | null;
  address: string;
  neighborhood: string | null;
  rent: number;
  bedrooms: number;
  bathrooms: number;
  sqft: number | null;
  pets_allowed: string | null;
  listing_agent: string | null;
  status: string | null;
  favorite: boolean;
  notes: string | null;
  decision_status: string | null;
  created_at: string | null;
};

const DECISION_OPTIONS = [
  { value: "Interested", label: "Interested" },
  { value: "Tour", label: "Tour" },
  { value: "Applied", label: "Applied" },
  { value: "Rejected", label: "Rejected" },
] as const;

type SortOption = "newest" | "rent-low" | "rent-high";

function sourceBadgeClasses(source: string | null) {
  if (source === "Zillow")
    return "border border-amber-500/30 bg-amber-500/10 text-amber-400";
  if (source === "StreetEasy")
    return "border border-sky-500/30 bg-sky-500/10 text-sky-400";
  return "border border-slate-700 bg-slate-800 text-slate-400";
}

function isNew(createdAt: string | null): boolean {
  if (!createdAt) return false;
  const date = new Date(createdAt);
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

function formatAddedDate(createdAt: string | null): string | null {
  if (!createdAt) return null;
  const date = new Date(createdAt);
  if (isNew(createdAt)) return "Added today";
  return (
    "Added " +
    date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  );
}

function getDateGroupKey(createdAt: string | null): string {
  if (!createdAt) return "unknown";
  const d = new Date(createdAt);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatGroupLabel(dateKey: string): string {
  if (dateKey === "unknown") return "Unknown Date";
  const [y, mo, day] = dateKey.split("-").map(Number);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (
    y === today.getFullYear() &&
    mo === today.getMonth() + 1 &&
    day === today.getDate()
  )
    return "New Today";
  if (
    y === yesterday.getFullYear() &&
    mo === yesterday.getMonth() + 1 &&
    day === yesterday.getDate()
  )
    return "Yesterday";
  return new Date(y, mo - 1, day).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function decisionBadgeClasses(status: string | null): string | null {
  switch (status) {
    case "Interested":
      return "border border-sky-500/40 bg-sky-500/10 text-sky-400";
    case "Tour":
      return "border border-amber-500/40 bg-amber-500/10 text-amber-400";
    case "Applied":
      return "border border-emerald-500/40 bg-emerald-500/10 text-emerald-400";
    case "Rejected":
      return "border border-slate-600/60 bg-slate-700/30 text-slate-400";
    default:
      return null;
  }
}

export default function ApartmentGrid({
  apartments: initialApartments,
}: {
  apartments: Apartment[];
}) {
  const [apartments, setApartments] = useState(initialApartments);
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("all");
  const [selectedNeighborhoods, setSelectedNeighborhoods] = useState<string[]>([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [maxRent, setMaxRent] = useState("");
  const [minBedrooms, setMinBedrooms] = useState("all");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [mapApartment, setMapApartment] = useState<Apartment | null>(null);
  const [selectedApartment, setSelectedApartment] = useState<Apartment | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const notesSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSaveStatus("idle");
    if (notesSaveTimerRef.current) {
      clearTimeout(notesSaveTimerRef.current);
      notesSaveTimerRef.current = null;
    }
  }, [selectedApartment?.id]);

  async function saveApartmentField(
    id: string,
    field: "decision_status" | "notes",
    value: string
  ) {
    setSaveStatus("saving");
    const { error } = await supabase
      .from("apartments")
      .update({ [field]: value || null })
      .eq("id", id);
    if (error) {
      console.error(`Failed to save ${field}:`, error);
      setSaveStatus("error");
    } else {
      setSaveStatus("saved");
      setTimeout(
        () => setSaveStatus((s) => (s === "saved" ? "idle" : s)),
        2000
      );
    }
  }

  const mapQuery = mapApartment
    ? [mapApartment.address, mapApartment.neighborhood]
        .filter(Boolean)
        .join(", ")
    : "New York City, NY";

  function closeModal() {
    setSelectedApartment(null);
  }

  function handleCardClick(apartment: Apartment) {
    setMapApartment(apartment);
  }

  useEffect(() => {
    if (!selectedApartment) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [selectedApartment]);

  async function handleFavoriteChange(id: string, favorite: boolean) {
    // Optimistic update — both card grid and open modal reflect the change immediately
    setApartments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, favorite } : a))
    );
    setSelectedApartment((prev) =>
      prev && prev.id === id ? { ...prev, favorite } : prev
    );

    console.log("[favorite] saving", id, "→", favorite);

    const { error } = await supabase
      .from("apartments")
      .update({ favorite })
      .eq("id", id);

    if (error) {
      console.error("[favorite] save failed:", error.message, error);
      // Roll back using functional update so we always invert the correct current value
      setApartments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, favorite: !favorite } : a))
      );
      setSelectedApartment((prev) =>
        prev && prev.id === id ? { ...prev, favorite: !favorite } : prev
      );
      alert(
        `Favorite could not be saved.\n\nError: ${error.message}\n\nCheck the browser console (F12 → Console) for details.`
      );
    } else {
      console.log("[favorite] saved ✓", id, "→", favorite);
    }
  }

  function toggleNeighborhood(n: string) {
    setSelectedNeighborhoods((prev) =>
      prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]
    );
  }

  function clearFilters() {
    setSearch("");
    setSource("all");
    setSelectedNeighborhoods([]);
    setShowFavoritesOnly(false);
    setMaxRent("");
    setMinBedrooms("all");
    setSortBy("newest");
  }

  const neighborhoods = useMemo(() => {
    const uniqueNeighborhoods = new Set(
      apartments
        .map((apartment) => apartment.neighborhood)
        .filter(Boolean) as string[]
    );

    return Array.from(uniqueNeighborhoods).sort();
  }, [apartments]);

  const visibleApartments = useMemo(() => {
    const normalizedSearch = search.toLowerCase().trim();

    return apartments
      .filter((apartment) => {
        const matchesSearch =
          normalizedSearch.length === 0 ||
          apartment.address.toLowerCase().includes(normalizedSearch) ||
          apartment.neighborhood?.toLowerCase().includes(normalizedSearch) ||
          apartment.source?.toLowerCase().includes(normalizedSearch) ||
          apartment.listing_agent?.toLowerCase().includes(normalizedSearch);

        const matchesSource =
          source === "all" ||
          apartment.source?.toLowerCase() === source.toLowerCase();

        const matchesNeighborhood =
          selectedNeighborhoods.length === 0 ||
          (apartment.neighborhood != null &&
            selectedNeighborhoods.includes(apartment.neighborhood));

        const matchesFavorite =
          !showFavoritesOnly || apartment.favorite === true;

        const matchesMaxRent =
          maxRent === "" || apartment.rent <= Number(maxRent);

        const matchesBedrooms =
          minBedrooms === "all" || apartment.bedrooms >= Number(minBedrooms);

        return (
          matchesSearch &&
          matchesSource &&
          matchesNeighborhood &&
          matchesFavorite &&
          matchesMaxRent &&
          matchesBedrooms
        );
      });
  }, [
    apartments,
    search,
    source,
    selectedNeighborhoods,
    showFavoritesOnly,
    maxRent,
    minBedrooms,
  ]);

  const groupedApartments = useMemo(() => {
    const sorted = [...visibleApartments].sort((a, b) => {
      const aKey = getDateGroupKey(a.created_at);
      const bKey = getDateGroupKey(b.created_at);
      // Primary: date descending (YYYY-MM-DD string comparison is lexically correct)
      if (bKey !== aKey) return bKey > aKey ? 1 : -1;
      // Secondary: within the same day
      if (sortBy === "rent-low") return a.rent - b.rent;
      if (sortBy === "rent-high") return b.rent - a.rent;
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bTime - aTime;
    });

    const groupMap = new Map<string, Apartment[]>();
    for (const apt of sorted) {
      const key = getDateGroupKey(apt.created_at);
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(apt);
    }

    return Array.from(groupMap.entries()).map(([dateKey, apts]) => ({
      label: formatGroupLabel(dateKey),
      dateKey,
      apts,
    }));
  }, [visibleApartments, sortBy]);

  return (
    <>
      {/* ── Filter panel ── */}
      <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search address, neighborhood, agent…"
            className="sm:col-span-2 rounded-xl border border-slate-700/60 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-violet-500"
          />
          <select
            value={source}
            onChange={(event) => setSource(event.target.value)}
            className="rounded-xl border border-slate-700/60 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 outline-none transition focus:border-violet-500"
          >
            <option value="all">All Sources</option>
            <option value="Zillow">Zillow</option>
            <option value="StreetEasy">StreetEasy</option>
          </select>
          <input
            value={maxRent}
            onChange={(event) => setMaxRent(event.target.value)}
            placeholder="Max rent ($)"
            type="number"
            className="rounded-xl border border-slate-700/60 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-violet-500"
          />
          <select
            value={minBedrooms}
            onChange={(event) => setMinBedrooms(event.target.value)}
            className="rounded-xl border border-slate-700/60 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 outline-none transition focus:border-violet-500"
          >
            <option value="all">Any Bedrooms</option>
            <option value="0">Studio+</option>
            <option value="1">1 Bed+</option>
            <option value="2">2 Bed+</option>
            <option value="3">3 Bed+</option>
          </select>
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as SortOption)}
            className="rounded-xl border border-slate-700/60 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 outline-none transition focus:border-violet-500"
          >
            <option value="newest">Newest First</option>
            <option value="rent-low">↑ Lowest Rent</option>
            <option value="rent-high">↓ Highest Rent</option>
          </select>
        </div>

        {/* Neighborhood chips — multi-select */}
        <div className="mt-5">
          <div className="mb-3 flex items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
              Neighborhood
            </p>
            {selectedNeighborhoods.length > 0 && (
              <span className="rounded-full bg-violet-600/20 px-2 py-0.5 text-[10px] font-bold text-violet-400">
                {selectedNeighborhoods.length}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedNeighborhoods([])}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                selectedNeighborhoods.length === 0
                  ? "border-violet-500 bg-violet-600 text-white shadow-md"
                  : "border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600 hover:bg-slate-700"
              }`}
            >
              All
            </button>
            {neighborhoods.map((neighborhood) => {
              const active = selectedNeighborhoods.includes(neighborhood);
              return (
                <button
                  key={neighborhood}
                  onClick={() => toggleNeighborhood(neighborhood)}
                  className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? "border-violet-500 bg-violet-600 text-white shadow-md"
                      : "border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600 hover:bg-slate-700"
                  }`}
                >
                  {neighborhood}
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom row */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          {/* Segmented tab control */}
          <div className="flex rounded-xl bg-slate-800 p-1">
            <button
              onClick={() => setShowFavoritesOnly(false)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                !showFavoritesOnly
                  ? "bg-slate-950 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              All Listings
            </button>
            <button
              onClick={() => setShowFavoritesOnly(true)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                showFavoritesOnly
                  ? "bg-slate-950 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              ♥ Saved
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">
              {visibleApartments.length} of {apartments.length} listings
            </span>
            <button
              onClick={clearFilters}
              className="rounded-xl border border-slate-700 px-4 py-1.5 text-sm text-slate-400 transition hover:border-violet-500 hover:text-violet-400"
            >
              Clear filters
            </button>
          </div>
        </div>
      </div>

      {/* ── Sticky-map + cards two-column layout ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[520px_1fr] xl:grid-cols-[560px_1fr]">

        {/* Left column — sticky map */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-800 h-[360px] lg:h-[calc(100vh-140px)]">
            <div className="relative h-full w-full">
              <iframe
                key={mapApartment?.id ?? "default"}
                title="Area map"
                className="absolute inset-0 h-full w-full"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                src={`https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed`}
              />

              {/* Info overlay */}
              {mapApartment ? (
                <div className="pointer-events-none absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-950 via-slate-950/75 to-transparent px-5 pb-5 pt-16">
                  <div className="flex items-end justify-between gap-4">
                    <div className="min-w-0">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${sourceBadgeClasses(mapApartment.source)}`}
                      >
                        {mapApartment.source ?? "Unknown"}
                      </span>
                      <p className="mt-1 truncate text-base font-semibold text-white">
                        {mapApartment.address}
                      </p>
                      {mapApartment.neighborhood && (
                        <p className="text-sm text-slate-400">
                          📍 {mapApartment.neighborhood}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-2xl font-extrabold text-violet-300">
                        ${mapApartment.rent.toLocaleString()}
                      </p>
                      <p className="text-xs text-slate-400">/mo</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-5">
                  <span className="rounded-full border border-slate-700/50 bg-slate-900/80 px-4 py-2 text-xs text-slate-400 backdrop-blur-sm">
                    Click a listing to preview its location
                  </span>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Right column — count row + cards */}
        <div className="min-w-0">
          {/* Count row */}
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-slate-500">
              {visibleApartments.length} listing
              {visibleApartments.length !== 1 ? "s" : ""}
              {mapApartment && (
                <span className="ml-2 text-violet-400">· 1 selected</span>
              )}
            </p>
            {mapApartment && (
              <button
                onClick={() => setMapApartment(null)}
                className="text-xs text-slate-500 transition hover:text-slate-300"
              >
                Clear selection
              </button>
            )}
          </div>

          {/* ── Cards grouped by date ── */}
          {visibleApartments.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-14 text-center">
              <p className="text-5xl">🏘️</p>
              <p className="mt-4 text-lg font-semibold text-slate-200">
                No listings found
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Try adjusting your filters.
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {groupedApartments.map(({ label, dateKey, apts }) => {
            const isToday = label === "New Today";
            return (
              <section key={dateKey}>
                {/* Date section header */}
                <div className="mb-4 flex items-center gap-3">
                  {isToday && (
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                    </span>
                  )}
                  <h2
                    className={`text-sm font-bold tracking-tight ${
                      isToday ? "text-emerald-400" : "text-slate-400"
                    }`}
                  >
                    {label}
                  </h2>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      isToday
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-slate-800 text-slate-500"
                    }`}
                  >
                    {apts.length} listing{apts.length !== 1 ? "s" : ""}
                  </span>
                  <div className="flex-1 border-t border-slate-800" />
                </div>

                {/* Cards grid */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {apts.map((apartment) => {
                    const isSelected = mapApartment?.id === apartment.id;
                    return (
                      <article
                        key={apartment.id}
                        onClick={() => handleCardClick(apartment)}
                        className={`group flex cursor-pointer flex-col rounded-2xl border p-5 transition-all ${
                          isSelected
                            ? "border-2 border-violet-500 bg-violet-900/10 shadow-lg shadow-violet-500/20"
                            : "border border-slate-800 bg-slate-900 shadow-sm hover:border-violet-500/40 hover:shadow-md"
                        }`}
                      >
                        {/* Card header */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${sourceBadgeClasses(apartment.source)}`}
                              >
                                {apartment.source ?? "Unknown"}
                              </span>
                              {decisionBadgeClasses(apartment.decision_status) && (
                                <span
                                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${decisionBadgeClasses(apartment.decision_status)}`}
                                >
                                  {apartment.decision_status}
                                </span>
                              )}
                              {isNew(apartment.created_at) && (
                                <span className="inline-flex items-center rounded-full border border-emerald-500/50 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400">
                                  New
                                </span>
                              )}
                              {isSelected && (
                                <span className="inline-flex items-center gap-1 rounded-full border border-violet-600/60 bg-violet-900/50 px-2 py-0.5 text-[10px] font-bold text-violet-300">
                                  📍 On Map
                                </span>
                              )}
                            </div>
                            <h2 className="mt-2 text-base font-semibold leading-snug text-slate-100">
                              {apartment.address}
                            </h2>
                            {apartment.neighborhood && (
                              <p className="mt-0.5 text-sm text-slate-500">
                                {apartment.neighborhood}
                              </p>
                            )}
                          </div>
                          <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                            <FavoriteButton
                              apartmentId={apartment.id}
                              favorite={!!apartment.favorite}
                              onFavoriteChange={handleFavoriteChange}
                            />
                          </div>
                        </div>

                        {/* Rent */}
                        <div className="mt-4">
                          <span className="text-2xl font-bold text-slate-100">
                            ${apartment.rent.toLocaleString()}
                          </span>
                          <span className="ml-1 text-sm text-slate-500">/mo</span>
                        </div>

                        {/* Stats pills */}
                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          <span className="rounded-lg bg-slate-800 px-3 py-1.5 font-medium text-slate-300">
                            {apartment.bedrooms === 0
                              ? "Studio"
                              : `${apartment.bedrooms} bd`}
                          </span>
                          <span className="rounded-lg bg-slate-800 px-3 py-1.5 font-medium text-slate-300">
                            {apartment.bathrooms} ba
                          </span>
                          {apartment.sqft && (
                            <span className="rounded-lg bg-slate-800 px-3 py-1.5 font-medium text-slate-300">
                              {apartment.sqft.toLocaleString()} sqft
                            </span>
                          )}
                          {apartment.pets_allowed && (
                            <span className="rounded-lg border border-emerald-900/50 bg-emerald-900/30 px-3 py-1.5 font-medium text-emerald-400">
                              🐾 Pets OK
                            </span>
                          )}
                        </div>

                        {/* Notes preview */}
                        {apartment.notes && (
                          <p className="mt-3 line-clamp-2 text-xs italic leading-relaxed text-slate-500">
                            {apartment.notes}
                          </p>
                        )}

                        {/* Card footer */}
                        <div className="mt-auto flex items-center justify-between gap-2 pt-4">
                          <p className="min-w-0 truncate text-xs text-slate-500">
                            {apartment.listing_agent
                              ? `Agent: ${apartment.listing_agent}${formatAddedDate(apartment.created_at) ? ` · ${formatAddedDate(apartment.created_at)}` : ""}`
                              : (formatAddedDate(apartment.created_at) ?? "")}
                          </p>
                          <div
                            className="flex shrink-0 items-center gap-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => setSelectedApartment(apartment)}
                              className="rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-violet-500/60 hover:text-violet-300"
                            >
                              Details
                            </button>
                            <a
                              href={apartment.listing_url}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-xl bg-violet-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-500"
                            >
                              View Listing
                            </a>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
            </div>
          )}
        </div>{/* end right column */}
      </div>{/* end two-column grid */}

      {/* ── Modal ── */}
      {selectedApartment && (
        <>
          {/* Backdrop */}
          <div
            onClick={closeModal}
            className="fixed inset-0 z-40 bg-black/75 backdrop-blur-md"
          />

          {/* Centering wrapper — clicking outside card closes */}
          <div
            onClick={closeModal}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
          >
            {/* Modal card */}
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative flex w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-slate-900 shadow-2xl"
              style={{ maxHeight: "92vh" }}
            >
              {/* Gradient header */}
              <div className="relative shrink-0 bg-gradient-to-r from-violet-700 via-indigo-600 to-sky-600 px-7 py-6">
                <div className="pr-12">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
                      selectedApartment.source === "Zillow"
                        ? "bg-amber-400/20 text-amber-200"
                        : selectedApartment.source === "StreetEasy"
                          ? "bg-sky-300/20 text-sky-100"
                          : "bg-white/20 text-white/70"
                    }`}
                  >
                    {selectedApartment.source ?? "Unknown"}
                  </span>
                  <h2 className="mt-2 text-2xl font-bold leading-snug text-white">
                    {selectedApartment.address}
                  </h2>
                  {selectedApartment.neighborhood && (
                    <p className="mt-1 text-sm text-indigo-200">
                      📍 {selectedApartment.neighborhood}
                    </p>
                  )}
                </div>
                <button
                  onClick={closeModal}
                  aria-label="Close modal"
                  className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
                >
                  ✕
                </button>
              </div>

              {/* Body: details left, map right */}
              <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[380px_1fr]">
                {/* Left — listing details */}
                <div className="flex flex-col gap-5 overflow-y-auto border-slate-800 p-6 md:border-r">
                  {/* Rent hero */}
                  <div className="rounded-xl border border-violet-800/40 bg-gradient-to-br from-violet-900/40 to-indigo-900/30 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-violet-400">
                      Monthly Rent
                    </p>
                    <p className="mt-1 flex items-baseline gap-1.5">
                      <span className="text-4xl font-extrabold text-white">
                        ${selectedApartment.rent.toLocaleString()}
                      </span>
                      <span className="text-base font-medium text-violet-300/70">
                        /mo
                      </span>
                    </p>
                  </div>

                  {/* Stat grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Bedrooms
                      </p>
                      <p className="mt-1 text-xl font-bold text-slate-100">
                        {selectedApartment.bedrooms === 0
                          ? "Studio"
                          : selectedApartment.bedrooms}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Bathrooms
                      </p>
                      <p className="mt-1 text-xl font-bold text-slate-100">
                        {selectedApartment.bathrooms}
                      </p>
                    </div>
                    {selectedApartment.sqft && (
                      <div className="col-span-2 rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          Square Feet
                        </p>
                        <p className="mt-1 text-xl font-bold text-slate-100">
                          {selectedApartment.sqft.toLocaleString()}
                          <span className="ml-1 text-sm font-normal text-slate-400">
                            sqft
                          </span>
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Apartment Snapshot */}
                  <div>
                    <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                      Apartment Snapshot
                    </p>
                    <div className="rounded-xl border border-slate-800 overflow-hidden">
                      {(
                        [
                          {
                            icon: "📍",
                            label: "Neighborhood",
                            value: selectedApartment.neighborhood,
                          },
                          {
                            icon: "🐾",
                            label: "Pets Allowed",
                            value: selectedApartment.pets_allowed,
                          },
                          {
                            icon: "👤",
                            label: "Listing Agent",
                            value: selectedApartment.listing_agent,
                          },
                          {
                            icon: "🔗",
                            label: "Source",
                            value: selectedApartment.source,
                          },
                        ] as { icon: string; label: string; value: string | null | undefined }[]
                      )
                        .filter((item) => item.value)
                        .map((item, i, arr) => (
                          <div
                            key={item.label}
                            className={`flex items-center justify-between px-4 py-3 text-sm ${
                              i < arr.length - 1
                                ? "border-b border-slate-800/80"
                                : ""
                            } ${i % 2 === 0 ? "bg-slate-800/30" : ""}`}
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="text-base leading-none">
                                {item.icon}
                              </span>
                              <span className="text-slate-400">
                                {item.label}
                              </span>
                            </div>
                            <span className="text-right font-medium text-slate-100">
                              {item.value}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Your Decision */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                        Your Decision
                      </p>
                      {saveStatus === "saving" && (
                        <span className="text-[10px] text-slate-400">
                          Saving…
                        </span>
                      )}
                      {saveStatus === "saved" && (
                        <span className="text-[10px] text-emerald-400">
                          Saved ✓
                        </span>
                      )}
                      {saveStatus === "error" && (
                        <span className="text-[10px] text-red-400">
                          Error saving
                        </span>
                      )}
                    </div>
                    <select
                      value={selectedApartment.decision_status ?? ""}
                      onChange={async (e) => {
                        const val = e.target.value;
                        setSelectedApartment((prev) =>
                          prev
                            ? { ...prev, decision_status: val || null }
                            : prev
                        );
                        setApartments((prev) =>
                          prev.map((a) =>
                            a.id === selectedApartment.id
                              ? { ...a, decision_status: val || null }
                              : a
                          )
                        );
                        await saveApartmentField(
                          selectedApartment.id,
                          "decision_status",
                          val
                        );
                      }}
                      className="w-full rounded-xl border border-slate-700/60 bg-slate-800/60 px-4 py-2.5 text-sm text-slate-100 outline-none transition focus:border-violet-500"
                    >
                      <option value="">Not Reviewed</option>
                      {DECISION_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Notes */}
                  <div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                      Notes
                    </p>
                    <textarea
                      value={selectedApartment.notes ?? ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        const aptId = selectedApartment.id;
                        setSelectedApartment((prev) =>
                          prev ? { ...prev, notes: val } : prev
                        );
                        setApartments((prev) =>
                          prev.map((a) =>
                            a.id === aptId ? { ...a, notes: val } : a
                          )
                        );
                        // Debounced save — fires even if modal closes before blur
                        if (notesSaveTimerRef.current)
                          clearTimeout(notesSaveTimerRef.current);
                        notesSaveTimerRef.current = setTimeout(() => {
                          notesSaveTimerRef.current = null;
                          saveApartmentField(aptId, "notes", val);
                        }, 1000);
                      }}
                      onBlur={(e) => {
                        // Immediate save on blur; cancel the debounce
                        if (notesSaveTimerRef.current) {
                          clearTimeout(notesSaveTimerRef.current);
                          notesSaveTimerRef.current = null;
                        }
                        saveApartmentField(
                          selectedApartment.id,
                          "notes",
                          e.target.value
                        );
                      }}
                      placeholder="Add notes about this apartment…"
                      rows={3}
                      className="w-full resize-none rounded-xl border border-slate-700/60 bg-slate-800/60 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-violet-500"
                    />
                  </div>

                  {/* Favorite + CTA */}
                  <div className="mt-auto flex items-center justify-between gap-4 pt-2">
                    <div className="flex items-center gap-2">
                      <FavoriteButton
                        apartmentId={selectedApartment.id}
                        favorite={!!selectedApartment.favorite}
                        onFavoriteChange={handleFavoriteChange}
                      />
                      <span className="text-sm text-slate-400">
                        {selectedApartment.favorite ? "Saved" : "Save"}
                      </span>
                    </div>
                    <a
                      href={selectedApartment.listing_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:from-violet-500 hover:to-indigo-500"
                    >
                      View Listing ↗
                    </a>
                  </div>
                </div>

                {/* Right — Google Maps embed */}
                <div className="relative min-h-72 md:min-h-0">
                  <iframe
                    title="Apartment location map"
                    className="absolute inset-0 h-full w-full"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    src={`https://maps.google.com/maps?q=${encodeURIComponent(
                      [
                        selectedApartment.address,
                        selectedApartment.neighborhood,
                      ]
                        .filter(Boolean)
                        .join(", ")
                    )}&output=embed`}
                  />
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}