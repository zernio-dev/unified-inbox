'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

/**
 * Mic button that records a WhatsApp voice note via MediaRecorder.
 *
 * Idle: a single mic icon among the other composer controls.
 * Recording: the recorder takes over the whole composer row (the parent hides
 * its siblings via onRecordingChange): trash cancel, pulsing red dot, mm:ss
 * timer, a live waveform driven by the real mic amplitude, and a send button.
 *
 * Format note: we record in the most WhatsApp-friendly container the browser
 * supports (mp4/AAC on Safari, ogg/Opus on Firefox, webm/Opus on Chrome); the
 * server transcodes webm to a WhatsApp-native container.
 */

const WAVEFORM_BARS = 32;

// Preference order: formats WhatsApp accepts natively first, webm last.
// Returns the first the browser can actually record.
function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  const candidates = ['audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm;codecs=opus', 'audio/webm'];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t));
}

function extForMime(mime: string): string {
  if (mime.startsWith('audio/mp4')) return 'm4a';
  if (mime.startsWith('audio/ogg')) return 'ogg';
  return 'webm';
}

export function VoiceRecorder({
  disabled,
  onRecorded,
  onRecordingChange,
}: {
  disabled?: boolean;
  /** Called with the recorded audio File when the user confirms the note. */
  onRecorded: (file: File) => void;
  /** Lets the parent collapse the rest of the composer while recording. */
  onRecordingChange?: (recording: boolean) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  // Rolling amplitude window (0..1 per bar), oldest first.
  const [levels, setLevels] = useState<number[]>(() => new Array(WAVEFORM_BARS).fill(0));

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

  const teardown = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // Release everything on unmount so we never leave the mic hot.
  useEffect(() => () => teardown(), [teardown]);

  useEffect(() => {
    onRecordingChange?.(recording);
  }, [recording, onRecordingChange]);

  const start = useCallback(async () => {
    const mimeType = pickMimeType();
    if (!mimeType) {
      toast.error('Voice recording is not supported in this browser');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Live waveform: read RMS amplitude each frame into a scrolling window.
      // Analyser is read-only (not connected to output). Optional: recording
      // still works without Web Audio, just without the waveform.
      try {
        const w = window as Window & { webkitAudioContext?: typeof AudioContext };
        const Ctx = window.AudioContext ?? w.webkitAudioContext;
        if (Ctx) {
          const audioCtx = new Ctx();
          audioCtxRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);
          const data = new Uint8Array(analyser.fftSize);
          const tick = () => {
            analyser.getByteTimeDomainData(data);
            let sum = 0;
            for (let i = 0; i < data.length; i++) {
              const v = (data[i] - 128) / 128;
              sum += v * v;
            }
            const rms = Math.sqrt(sum / data.length); // 0..~1
            // Boost a little so quiet speech still moves the bars, then clamp.
            const level = Math.min(1, rms * 2.2);
            setLevels((prev) => [...prev.slice(1), level]);
            rafRef.current = requestAnimationFrame(tick);
          };
          rafRef.current = requestAnimationFrame(tick);
        }
      } catch {
        // No Web Audio; skip the waveform.
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      cancelledRef.current = false;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const wasCancelled = cancelledRef.current;
        teardown();
        setRecording(false);
        setSeconds(0);
        setLevels(new Array(WAVEFORM_BARS).fill(0));
        if (wasCancelled || chunksRef.current.length === 0) return;
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const file = new File([blob], `voice-${Date.now()}.${extForMime(mimeType)}`, {
          type: mimeType,
        });
        onRecorded(file);
      };

      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (err) {
      console.error('Voice recording failed to start:', err);
      toast.error('Could not access the microphone');
      teardown();
    }
  }, [onRecorded, teardown]);

  const finish = (cancelled: boolean) => {
    cancelledRef.current = cancelled;
    // onstop handles cleanup + emitting the file.
    recorderRef.current?.stop();
    recorderRef.current = null;
  };

  if (recording) {
    const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
    const ss = String(seconds % 60).padStart(2, '0');
    return (
      <div className="flex flex-1 items-center gap-2 px-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => finish(true)}
          title="Discard"
          aria-label="Discard recording"
          className="size-8 shrink-0 rounded-lg text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </Button>

        <span className="size-2 shrink-0 animate-pulse rounded-full bg-destructive" />
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {mm}:{ss}
        </span>

        {/* Live waveform: bar heights track the mic amplitude. */}
        <div className="flex h-8 flex-1 items-center justify-end gap-0.5 overflow-hidden">
          {levels.map((lvl, i) => (
            <span
              key={i}
              className="w-[3px] shrink-0 rounded-full bg-primary/70 transition-[height] duration-75"
              style={{ height: `${Math.max(8, lvl * 100)}%` }}
            />
          ))}
        </div>

        <Button
          size="icon"
          onClick={() => finish(false)}
          title="Send voice note"
          aria-label="Send voice note"
          className="size-8 shrink-0 rounded-lg"
        >
          <Send className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => void start()}
      disabled={disabled}
      title="Record voice note"
      aria-label="Record voice note"
      className="size-8 shrink-0 rounded-lg text-muted-foreground hover:text-foreground"
    >
      <Mic className="size-4" />
    </Button>
  );
}
