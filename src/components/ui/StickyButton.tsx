import { useEffect, useId } from 'react';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react-native';
import { useIsFocused } from '@react-navigation/native';

import { useStickyCtaStore, type StickyCtaVariant } from '@/stores/useStickyCtaStore';

/**
 * StickyButton no longer renders its own floating view. It registers a CTA in
 * the global sticky-cta store — the TabBar picks it up and renders it as a
 * top row inside the same floating container, so CTA and tabs read as one
 * visual unit.
 *
 * Registration is gated on screen focus, so the CTA only appears on the
 * screen that owns it. When the user navigates away (e.g. to the camera),
 * the screen blurs, the CTA is cleared, and only the bare tab bar remains.
 * Returning to the screen re-registers automatically.
 */

export interface StickyButtonProps {
  visible?: boolean;
  variant?: StickyCtaVariant;
  onPress: () => void;
  leftIcon?: LucideIcon;
  rightIcon?: LucideIcon;
  disabled?: boolean;
  children: ReactNode;
}

export function StickyButton({
  visible = true,
  variant = 'primary',
  onPress,
  leftIcon,
  rightIcon,
  disabled,
  children,
}: StickyButtonProps) {
  const setCta = useStickyCtaStore((s) => s.setCta);
  const clearCta = useStickyCtaStore((s) => s.clearCta);
  const reactId = useId();
  const isFocused = useIsFocused();

  const label = typeof children === 'string' ? children : String(children ?? '');

  useEffect(() => {
    if (!isFocused || !visible) {
      clearCta(reactId);
      return;
    }
    setCta({
      id: reactId,
      label,
      onPress,
      leftIcon,
      rightIcon,
      disabled,
      variant,
    });
    return () => clearCta(reactId);
  }, [
    isFocused,
    visible,
    label,
    onPress,
    leftIcon,
    rightIcon,
    disabled,
    variant,
    reactId,
    setCta,
    clearCta,
  ]);

  return null;
}
