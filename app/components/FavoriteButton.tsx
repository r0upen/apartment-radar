"use client";

type FavoriteButtonProps = {
  apartmentId: string;
  favorite: boolean;
  onFavoriteChange: (id: string, favorite: boolean) => void;
};

export default function FavoriteButton({
  apartmentId,
  favorite,
  onFavoriteChange,
}: FavoriteButtonProps) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onFavoriteChange(apartmentId, !favorite);
      }}
      className={`text-3xl transition ${
        favorite ? "text-pink-400" : "text-white hover:text-pink-300"
      }`}
      aria-label={favorite ? "Remove from favorites" : "Save to favorites"}
    >
      {favorite ? "♥" : "♡"}
    </button>
  );
}
