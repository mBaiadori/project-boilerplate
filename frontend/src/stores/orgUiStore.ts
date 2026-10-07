import { create } from "zustand";

interface OrgUiState {
  isOrgDropdownOpen: boolean;
  toggleOrgDropdown: () => void;
  openOrgDropdown: () => void;
  closeOrgDropdown: () => void;
}

export const useOrgUiStore = create<OrgUiState>((set) => ({
  isOrgDropdownOpen: false,
  toggleOrgDropdown: () =>
    set((state) => ({ isOrgDropdownOpen: !state.isOrgDropdownOpen })),
  openOrgDropdown: () => set({ isOrgDropdownOpen: true }),
  closeOrgDropdown: () => set({ isOrgDropdownOpen: false }),
}));
