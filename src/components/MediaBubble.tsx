import { useEffect, useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import { fileName, signedUrl } from "@/lib/media";

export function MediaBubble({ path, kind }: { path: string; kind: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setUrl(null);
    setFailed(false);
    signedUrl(path)
      .then((u) => active && setUrl(u))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [path]);

  if (failed) return <p className="text-xs opacity-70">Media unavailable</p>;
  if (!url)
    return (
      <div className="flex h-20 w-40 items-center justify-center rounded-xl bg-black/10">
        <Loader2 size={16} className="animate-spin opacity-60" />
      </div>
    );

  if (kind === "image")
    return (
      <a href={url} target="_blank" rel="noreferrer">
        <img
          src={url}
          alt="Shared photo"
          loading="lazy"
          className="max-h-72 w-full rounded-xl object-cover"
        />
      </a>
    );

  if (kind === "audio")
    return <audio controls src={url} className="h-10 w-56 max-w-full" preload="metadata" />;

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 rounded-xl bg-black/10 px-3 py-2 text-xs"
    >
      <FileText size={16} />
      <span className="max-w-40 truncate">{fileName(path)}</span>
      <Download size={14} className="opacity-70" />
    </a>
  );
}
