import { useEffect, useRef, useState } from "react";
import { Mic, Square, Trash2 } from "lucide-react";

export function VoiceRecorder({
  onRecorded,
  disabled,
}: {
  onRecorded: (blob: Blob) => void;
  disabled?: boolean;
}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [recording]);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      cancelledRef.current = false;
      recorder.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (cancelledRef.current) return;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (blob.size > 0) onRecorded(blob);
      };
      recorder.start();
      recorderRef.current = recorder;
      setSeconds(0);
      setRecording(true);
    } catch {
      setRecording(false);
    }
  }

  function stop(cancel = false) {
    cancelledRef.current = cancel;
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  }

  if (!recording)
    return (
      <button
        type="button"
        onClick={start}
        disabled={disabled}
        aria-label="Record voice note"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-primary disabled:opacity-50"
      >
        <Mic size={18} />
      </button>
    );

  return (
    <div className="flex items-center gap-2 rounded-full bg-surface-2 px-3 py-1.5">
      <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" />
      <span className="text-xs tabular-nums text-muted-foreground">
        {String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}
      </span>
      <button type="button" onClick={() => stop(true)} aria-label="Cancel recording" className="p-1">
        <Trash2 size={16} className="text-muted-foreground" />
      </button>
      <button
        type="button"
        onClick={() => stop(false)}
        aria-label="Stop and send voice note"
        className="flex h-8 w-8 items-center justify-center rounded-full gradient-emerald text-primary-foreground"
      >
        <Square size={13} />
      </button>
    </div>
  );
}
