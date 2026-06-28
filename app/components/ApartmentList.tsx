"use client";

import { useState } from "react";
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
};

export default function ApartmentList({
  initialApartments,
}: {
  initialApartments: Apartment[];
}) {
  const [apartments, setApartments] = useState(initialApartments);

  async function toggleFavorite(id: string, currentValue: boolean) {
    const newValue = !currentValue;

    setApartments((prev) =>
      prev.map((apt) =>
        apt.id === id ? { ...apt, favorite: newValue } : apt
      )
    );

    const { error } = await supabase
      .from("apartments")
      .update({ favorite: newValue })
      .eq("id", id);

    if (error) {
      setApartments((prev) =>
        prev.map((apt) =>
          apt.id === id ? { ...apt, favorite: currentValue } : apt
        )
      );
      alert("Could not update favorite.");
    }
  }

  return (
    <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
      {apartments.map((apartment) => (
        <article
          key={apartment.id}
          className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5 shadow-sm"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-neutral-500">
                {apartment.source ?? "Unknown Source"}
              </p>
              <h2 className="text-lg font-semibold mt-1">
                {apartment.address}
              </h2>
            </div>

            <button
              onClick={() =>
                toggleFavorite(apartment.id, apartment.favorite)
              }
              className="text-2xl"
              aria-label="Toggle favorite"
            >
              {apartment.favorite ? "♥" : "♡"}
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <span className="rounded-full bg-white text-black px-3 py-1 font-medium">
              ${apartment.rent}
            </span>
            <span className="rounded-full bg-neutral-800 px-3 py-1">
              {apartment.bedrooms} bd
            </span>
            <span className="rounded-full bg-neutral-800 px-3 py-1">
              {apartment.bathrooms} ba
            </span>
            {apartment.sqft && (
              <span className="rounded-full bg-neutral-800 px-3 py-1">
                {apartment.sqft} sqft
              </span>
            )}
          </div>

          <div className="mt-4 text-sm text-neutral-300">
            <p>{apartment.neighborhood}</p>
            {apartment.pets_allowed && <p>Pets: {apartment.pets_allowed}</p>}
            {apartment.listing_agent && <p>Agent: {apartment.listing_agent}</p>}
          </div>

          <a
            href={apartment.listing_url}
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-neutral-200"
          >
            View Listing
          </a>
        </article>
      ))}
    </section>
  );
}