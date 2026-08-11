import { inkFor, initials } from "@/lib/photo";

export function Avatar({
  name,
  photo,
  size = 44,
  ring,
}: {
  name: string;
  photo?: string | null;
  size?: number;
  ring?: string;
}) {
  const style = {
    width: size,
    height: size,
    boxShadow: ring ? `0 0 0 2px var(--surface-raised), 0 0 0 3.5px ${ring}` : undefined,
  };

  if (photo) {
    return (
      // Data URLs from the guest's own camera roll: next/image would only add
      // a proxy hop for an image that is already 256px and inlined.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photo}
        alt={name}
        style={style}
        className="shrink-0 rounded-full object-cover"
      />
    );
  }

  return (
    <span
      aria-hidden
      style={{ ...style, background: inkFor(name) }}
      className="flex shrink-0 items-center justify-center rounded-full text-[0.8em] font-bold text-white"
    >
      {initials(name)}
    </span>
  );
}
