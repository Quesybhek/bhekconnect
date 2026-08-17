import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, PhoneOff, Video, VideoOff } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  name: string;
  avatar?: string | null;
  video: boolean;
  callId: string;
  userId: string;
  peerId: string;
  initiator: boolean;
  incoming?: boolean;
  onEnd: (durationSeconds: number) => void;
};

export function CallOverlay({ name, avatar, video, callId, userId, peerId, initiator, incoming, onEnd }: Props) {
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [camOn, setCamOn] = useState(video);
  const [connected, setConnected] = useState(false);
  const [accepted, setAccepted] = useState(!incoming);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  useEffect(() => {
    if (!accepted) return;
    let alive = true;
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun.cloudflare.com:3478" },
      ],
    });
    pcRef.current = pc;

    const sendSignal = async (signal_type: "offer" | "answer" | "ice" | "hangup", payload: unknown = {}) => {
      await supabase.from("call_signals").insert({
        call_id: callId, sender_id: userId, recipient_id: peerId, signal_type, payload,
      });
    };

    const start = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: video });
      if (!alive) return;
      streamRef.current = stream;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      pc.ontrack = (event) => {
        const [remote] = event.streams;
        if (remoteRef.current && remote) {
          remoteRef.current.srcObject = remote;
          setConnected(true);
        }
      };
      pc.onicecandidate = (event) => {
        if (event.candidate) void sendSignal("ice", event.candidate.toJSON());
      };
      pc.onconnectionstatechange = () => setConnected(pc.connectionState === "connected");
      const handleSignal = async (raw: { sender_id: string; recipient_id: string; signal_type: string; payload: RTCSessionDescriptionInit & RTCIceCandidateInit }) => {
        const signal = raw;
        if (signal.recipient_id !== userId || signal.sender_id !== peerId) return;
        if (signal.signal_type === "offer") {
          await pc.setRemoteDescription(signal.payload);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await sendSignal("answer", answer);
        } else if (signal.signal_type === "answer") {
          await pc.setRemoteDescription(signal.payload);
        } else if (signal.signal_type === "ice") {
          try { await pc.addIceCandidate(signal.payload); } catch {}
        } else if (signal.signal_type === "hangup") {
          onEndRef.current(0);
        }
      };
      const existing = await supabase.from("call_signals").select("sender_id,recipient_id,signal_type,payload").eq("call_id", callId).order("created_at", { ascending: true });
      for (const signal of (existing.data ?? []) as Array<{ sender_id: string; recipient_id: string; signal_type: string; payload: RTCSessionDescriptionInit & RTCIceCandidateInit }>) await handleSignal(signal);
      const channel = supabase.channel(`call-signal-${callId}-${userId}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "call_signals", filter: `call_id=eq.${callId}` }, async ({ new: raw }) => {
          await handleSignal(raw as { sender_id: string; recipient_id: string; signal_type: string; payload: RTCSessionDescriptionInit & RTCIceCandidateInit });
        })
        .subscribe();
      if (initiator) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await sendSignal("offer", offer);
      }

      return () => { void supabase.removeChannel(channel); };
    };

    let cleanup: (() => void) | undefined;
    void start().then((fn) => { cleanup = fn; }).catch(() => onEndRef.current(0));
    return () => {
      alive = false;
      cleanup?.();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      pc.close();
      pcRef.current = null;
    };
  }, [accepted, callId, peerId, userId, initiator, video]);

  useEffect(() => {
    if (!accepted) return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [accepted]);

  const end = async () => {
    await supabase.from("call_signals").insert({ call_id: callId, sender_id: userId, recipient_id: peerId, signal_type: "hangup", payload: {} });
    onEnd(seconds);
  };

  if (!accepted) {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-black/90 p-6 text-white">
        <div className="text-center">
          <Avatar name={name} url={avatar} size={104} ring />
          <h2 className="mt-5 text-xl font-semibold">{name}</h2>
          <p className="mt-1 text-sm text-white/70">Incoming {video ? "video" : "voice"} call</p>
          <div className="mt-8 flex justify-center gap-4">
            <button onClick={() => onEndRef.current(0)} className="rounded-full bg-destructive px-6 py-3">Decline</button>
            <button onClick={() => setAccepted(true)} className="rounded-full bg-primary px-6 py-3">Accept</button>
          </div>
        </div>
      </div>
    );
  }

  const clock = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {video && <video ref={remoteRef} autoPlay playsInline className="absolute inset-0 h-full w-full object-cover" />}
      {!video && <div className="flex flex-1 flex-col items-center justify-center"><Avatar name={name} url={avatar} size={104} ring /><p className="mt-4 text-xl font-semibold text-white">{name}</p></div>}
      <div className="absolute left-0 right-0 top-0 flex justify-between bg-gradient-to-b from-black/70 to-transparent p-5 text-white">
        <div><p className="font-semibold">{name}</p><p className="text-xs opacity-70">{connected ? clock : "Connecting…"}</p></div>
        {video && <span className="rounded-full bg-black/40 px-3 py-1 text-xs">Live video</span>}
      </div>
      <div className="relative z-10 flex items-center justify-center gap-4 bg-gradient-to-t from-black/80 to-transparent pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-12">
        <button onClick={() => { streamRef.current?.getAudioTracks().forEach((t) => { t.enabled = muted; }); setMuted((m) => !m); }} aria-label={muted ? "Unmute" : "Mute"} className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15 text-white">{muted ? <MicOff /> : <Mic />}</button>
        <button onClick={() => void end()} aria-label="End call" className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600 text-white"><PhoneOff /></button>
        <button onClick={() => { streamRef.current?.getVideoTracks().forEach((t) => { t.enabled = !camOn; }); setCamOn((c) => !c); }} aria-label={camOn ? "Turn camera off" : "Turn camera on"} className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15 text-white">{camOn ? <Video /> : <VideoOff />}</button>
      </div>
    </div>
  );
}
