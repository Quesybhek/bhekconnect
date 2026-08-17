import icon from "@/assets/bhek-icon.png";

export function BrandMark({
  size = 44,
  glow = false,
  className = "",
}: {
  size?: number;
  glow?: boolean;
  className?: string;
}) {
  return (
    <img
      src={icon}
      alt="BhekConnect logo"
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={`rounded-[26%] object-contain ${glow ? "brand-glow" : ""} ${className}`}
    />
  );
}

export function BrandFooter() {
  return (
    <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
      BhekConnect by <span className="text-foreground">Amponsah Abdul-Hakeem</span>
      <br />
      Bhek Network Global
    </p>
  );
}
