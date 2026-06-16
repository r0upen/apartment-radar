"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

type FavoriteButtonProps = {
  apartmentId: string;
  initialFavorite: boolean;
  onFavoriteChange?: (id: string, favorite: boolean) => void;
};

export default function FavoriteButton({
  apartmentId,
  initialFavorite,
  onFavoriteChange,
}: FavoriteButtonProps) {
  const [favorite, setFavorite] = useState(initialFavorite);
  const [loading, setLoading] = useState(false);

  async function toggleFavorite() {
    if (loading) return;

    const newValue = !favorite;
    setFavorite(newValue);
    onFavoriteChange?.(apartmentId, newValue);
    setLoading(true);

    const { error } = await supabase
      .from("apartments")
      .update({ favorite: newValue })
      .eq("id", apartmentId);

    if (error) {
      console.error(error);
      setFavorite(!newValue);
      onFavoriteChange?.(apartmentId, !newValue);
      alert("Failed to update favorite.");
    }

    setLoading(false);
  }

  return (
    <button
      onClick={toggleFavorite}
      disabled={loading}
      className="text-3xl"
      aria-label="Toggle favorite"
    >
      {favorite ? "♥" : "♡"}
    </button>
  );
}