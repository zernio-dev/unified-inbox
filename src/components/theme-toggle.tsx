'use client';

import { useEffect, useState } from 'react';
import { Check, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getStoredTheme, setTheme, watchSystemTheme, type Theme } from '@/lib/theme';

const OPTIONS: { value: Theme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

export function ThemeToggle() {
  // 'system' default matches SSR; real preference loads in the mount effect.
  const [theme, setThemeState] = useState<Theme>('system');

  useEffect(() => {
    setThemeState(getStoredTheme());
  }, []);

  // In system mode, follow live OS changes.
  useEffect(() => {
    if (theme !== 'system') return;
    return watchSystemTheme(() => setTheme('system'));
  }, [theme]);

  const select = (value: Theme) => {
    setThemeState(value);
    setTheme(value);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Change theme">
          <Sun className="size-4 dark:hidden" />
          <Moon className="hidden size-4 dark:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-32">
        {OPTIONS.map((option) => (
          <DropdownMenuItem key={option.value} onSelect={() => select(option.value)}>
            <span className="flex-1">{option.label}</span>
            {theme === option.value && <Check className="size-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
