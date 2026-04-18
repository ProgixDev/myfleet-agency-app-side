import { create } from 'zustand';
import type { LucideIcon } from 'lucide-react-native';

/**
 * Global sticky CTA shown as a top row glued onto the tab bar capsule.
 * Screens register a CTA via `useStickyCta(...)` (see StickyButton) and the
 * TabBar renders it as part of the same floating container, making the pair
 * read as one visual unit.
 */

export type StickyCtaVariant = 'primary' | 'secondary' | 'danger';

export interface StickyCtaConfig {
  id: string;
  label: string;
  onPress: () => void;
  leftIcon?: LucideIcon;
  rightIcon?: LucideIcon;
  disabled?: boolean;
  variant?: StickyCtaVariant;
}

interface StickyCtaState {
  cta: StickyCtaConfig | null;
  setCta: (cta: StickyCtaConfig) => void;
  clearCta: (id: string) => void;
}

export const useStickyCtaStore = create<StickyCtaState>((set) => ({
  cta: null,
  setCta: (cta) => set({ cta }),
  clearCta: (id) =>
    set((state) => (state.cta?.id === id ? { cta: null } : state)),
}));
