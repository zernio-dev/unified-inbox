'use client';

import { ChevronDown, ExternalLink, LayoutGrid, MousePointerClick, Phone } from 'lucide-react';
import type { WaInteractive } from '@/lib/message-metadata';

// Faux-button styling: a bordered pill that reads as a tappable control
// without being interactive on our side (the recipient taps on their phone;
// we just mirror what they see so the bubble isn't blank or text-only).
const CHIP =
  'flex items-center justify-center gap-1.5 rounded-lg border border-current/20 px-3 py-1.5 text-sm font-medium';

export function InteractivePreview({ meta }: { meta: WaInteractive }) {
  if (meta.kind === 'buttons') {
    return (
      <div className="mt-2 space-y-1.5">
        {meta.buttons.map((label, i) => (
          <div key={i} className={CHIP}>
            {label}
          </div>
        ))}
      </div>
    );
  }

  if (meta.kind === 'list') {
    return (
      <div className="mt-2 space-y-1.5">
        {meta.rows.length > 0 && (
          <ul className="space-y-1 rounded-lg border border-current/15 p-2">
            {meta.rows.map((row, i) => (
              <li key={i} className="text-sm">
                <span className="font-medium">{row.title}</span>
                {row.description && <span className="block text-xs opacity-70">{row.description}</span>}
              </li>
            ))}
          </ul>
        )}
        <div className={CHIP}>
          <LayoutGrid className="size-3.5" />
          {meta.button}
        </div>
      </div>
    );
  }

  if (meta.kind === 'cta_url') {
    return (
      <a
        href={meta.url}
        target="_blank"
        rel="nofollow noopener noreferrer"
        className={`${CHIP} mt-2 hover:opacity-90`}
        title={meta.url}
      >
        <ExternalLink className="size-3.5" />
        {meta.label}
      </a>
    );
  }

  if (meta.kind === 'flow') {
    return (
      <div className={`${CHIP} mt-2`}>
        <ChevronDown className="size-3.5" />
        {meta.label}
      </div>
    );
  }

  if (meta.kind === 'location_request') {
    return <div className={`${CHIP} mt-2`}>📍 Location requested</div>;
  }

  if (meta.kind === 'voice_call') {
    return (
      <div className={`${CHIP} mt-2`}>
        <Phone className="size-3.5" />
        {meta.label}
      </div>
    );
  }

  // Unknown / future kinds: never render an empty bubble.
  return (
    <div className={`${CHIP} mt-2`}>
      <MousePointerClick className="size-3.5" />
      Interactive message
    </div>
  );
}
