// The order here is the order of the category menu and the tie-break order in the summary.
export const CATEGORIES = [
  { id: "market", label: "Market" },
  { id: "yeme-icme", label: "Yeme içme" },
  { id: "ulasim", label: "Ulaşım" },
  { id: "fatura", label: "Fatura" },
  { id: "kira", label: "Kira ve aidat" },
  { id: "saglik", label: "Sağlık" },
  { id: "eglence", label: "Eğlence" },
  { id: "giyim", label: "Giyim" },
  { id: "egitim", label: "Eğitim" },
  { id: "diger", label: "Diğer" },
];

const BY_ID = new Map(CATEGORIES.map((category) => [category.id, category]));

export function categoryById(id) {
  return BY_ID.get(id);
}

export function isCategory(id) {
  return BY_ID.has(id);
}
