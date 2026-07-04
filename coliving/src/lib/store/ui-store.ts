import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// ── Client UI state (Zustand) ───────────────────────────────────────
// Clear separation of concerns:
//   • TanStack Query  → server state (search results, listings, bookings)
//   • Zustand         → client UI state (wishlist, drawers, recently viewed)
// Only non-server, session/preference state lives here.

interface UIState {
  // Wishlist — saved room ids, persisted to localStorage.
  savedIds: string[];
  toggleSaved: (id: string) => void;
  isSaved: (id: string) => boolean;

  // Filter drawer (search page) — ephemeral UI, not persisted.
  filterOpen: boolean;
  setFilterOpen: (open: boolean) => void;

  // Recently viewed rooms (max 8), persisted.
  recentlyViewed: string[];
  addRecentlyViewed: (id: string) => void;

  // Map/list view toggle on search, persisted.
  searchView: "split" | "list" | "map";
  setSearchView: (v: "split" | "list" | "map") => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      savedIds: [],
      toggleSaved: (id) =>
        set((s) => ({
          savedIds: s.savedIds.includes(id)
            ? s.savedIds.filter((x) => x !== id)
            : [...s.savedIds, id],
        })),
      isSaved: (id) => get().savedIds.includes(id),

      filterOpen: false,
      setFilterOpen: (filterOpen) => set({ filterOpen }),

      recentlyViewed: [],
      addRecentlyViewed: (id) =>
        set((s) => ({
          recentlyViewed: [id, ...s.recentlyViewed.filter((x) => x !== id)].slice(0, 8),
        })),

      searchView: "split",
      setSearchView: (searchView) => set({ searchView }),
    }),
    {
      name: "nested-ui",
      storage: createJSONStorage(() => localStorage),
      // only persist durable preferences, not ephemeral drawer state
      partialize: (s) => ({
        savedIds: s.savedIds,
        recentlyViewed: s.recentlyViewed,
        searchView: s.searchView,
      }),
    }
  )
);
