import { Facebook, Instagram, MessageCircle, Send, Twitter, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Platform } from '@/lib/types';

export const PLATFORM_LABELS: Record<Platform, string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  facebook: 'Messenger',
  twitter: 'X',
  telegram: 'Telegram',
  bluesky: 'Bluesky',
  reddit: 'Reddit',
};

const ICONS: Partial<Record<Platform, { Icon: LucideIcon; colorClass: string }>> = {
  whatsapp: { Icon: MessageCircle, colorClass: 'text-[#25d366]' },
  instagram: { Icon: Instagram, colorClass: 'text-[#e1306c]' },
  facebook: { Icon: Facebook, colorClass: 'text-[#1877f2]' },
  twitter: { Icon: Twitter, colorClass: 'text-foreground' },
  telegram: { Icon: Send, colorClass: 'text-[#229ed9]' },
};

// No fitting lucide glyph for these; a brand-colored letter badge instead.
const TEXT_FALLBACKS: Partial<Record<Platform, { letter: string; colorClass: string }>> = {
  bluesky: { letter: 'B', colorClass: 'text-[#0085ff]' },
  reddit: { letter: 'R', colorClass: 'text-[#ff4500]' },
};

export function PlatformIcon({
  platform,
  className,
}: {
  platform: Platform;
  className?: string;
}) {
  const icon = ICONS[platform];
  if (icon) {
    const { Icon, colorClass } = icon;
    return <Icon aria-label={PLATFORM_LABELS[platform]} className={cn('size-4', colorClass, className)} />;
  }
  const fallback = TEXT_FALLBACKS[platform];
  return (
    <span
      aria-label={PLATFORM_LABELS[platform]}
      className={cn(
        'inline-flex size-4 items-center justify-center text-[0.6875rem] font-bold leading-none',
        fallback?.colorClass,
        className,
      )}
    >
      {fallback?.letter ?? platform.charAt(0).toUpperCase()}
    </span>
  );
}
