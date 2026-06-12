'use client';

import { useEffect, useState } from 'react';
import { Loader2, LocateFixed, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export type ExtraMode = 'location' | 'contact';

/**
 * What the composer receives on send: the POST body (minus accountId), the
 * metadata record for the optimistic bubble (location / contacts, matching the
 * server's persisted shape), and a short text preview. The composer owns the
 * fetch + optimistic UI.
 */
export interface ExtraSendPayload {
  body: Record<string, unknown>;
  preview: string;
  optimisticMeta: Record<string, unknown>;
}

/**
 * Composer dialog for the two WhatsApp rich message types that aren't files: a
 * location pin and a contact card. Opens on the tab matching the attach-menu
 * item that launched it.
 */
export function LocationContactDrawer({
  mode,
  onClose,
  sending,
  onSend,
}: {
  mode: ExtraMode | null;
  onClose: () => void;
  sending: boolean;
  onSend: (payload: ExtraSendPayload) => void;
}) {
  const [tab, setTab] = useState<ExtraMode>('location');

  // Location fields
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [locName, setLocName] = useState('');
  const [address, setAddress] = useState('');
  const [locating, setLocating] = useState(false);

  // Contact fields
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  // Open on the launching tab; reset all fields on close so the next open
  // starts clean.
  useEffect(() => {
    if (mode) {
      setTab(mode);
      return;
    }
    setLat('');
    setLng('');
    setLocName('');
    setAddress('');
    setContactName('');
    setContactPhone('');
  }, [mode]);

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not available in this browser');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setLocating(false);
      },
      () => {
        toast.error('Could not get your location');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const latNum = parseFloat(lat);
  const lngNum = parseFloat(lng);
  const locationValid = Number.isFinite(latNum) && Number.isFinite(lngNum);
  const contactValid = contactName.trim().length > 0 && contactPhone.trim().length > 0;
  const canSend = tab === 'location' ? locationValid : contactValid;

  const handleSend = () => {
    if (!canSend || sending) return;
    if (tab === 'location') {
      const location = {
        latitude: latNum,
        longitude: lngNum,
        ...(locName.trim() ? { name: locName.trim() } : {}),
        ...(address.trim() ? { address: address.trim() } : {}),
      };
      onSend({
        body: { location },
        preview: `📍 ${locName.trim() || 'Location'}`,
        optimisticMeta: { location },
      });
      return;
    }
    const name = contactName.trim();
    const contacts = [
      {
        name: { formatted_name: name, first_name: name },
        phones: [{ phone: contactPhone.trim(), type: 'CELL' }],
      },
    ];
    onSend({
      body: { contacts },
      preview: `👤 ${name}`,
      optimisticMeta: { contacts },
    });
  };

  return (
    <Dialog open={mode !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{tab === 'location' ? 'Send location' : 'Send contact'}</DialogTitle>
          <DialogDescription>
            {tab === 'location' ? 'Share a location pin' : 'Share a contact card'}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as ExtraMode)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="location">Location</TabsTrigger>
            <TabsTrigger value="contact">Contact</TabsTrigger>
          </TabsList>

          <TabsContent value="location" className="space-y-3 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={useCurrentLocation}
              disabled={locating}
            >
              <LocateFixed className="size-4" />
              {locating ? 'Getting location…' : 'Use my current location'}
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Latitude</Label>
                <Input
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  placeholder="41.3874"
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-1">
                <Label>Longitude</Label>
                <Input
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  placeholder="2.1686"
                  inputMode="decimal"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Name (optional)</Label>
              <Input
                value={locName}
                onChange={(e) => setLocName(e.target.value)}
                placeholder="e.g. Office"
              />
            </div>
            <div className="space-y-1">
              <Label>Address (optional)</Label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street, city"
              />
            </div>
            {locationValid && (
              <div className="flex items-center gap-2 rounded-lg border border-[var(--chat-border)] bg-muted/40 p-3 text-sm text-muted-foreground">
                <MapPin className="size-4 shrink-0" />
                {locName.trim() || `${latNum}, ${lngNum}`}
              </div>
            )}
          </TabsContent>

          <TabsContent value="contact" className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Full name"
              />
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+1 555 123 4567"
                inputMode="tel"
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={!canSend || sending}>
            {sending && <Loader2 className="size-4 animate-spin" />}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
