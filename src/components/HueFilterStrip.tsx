import { useImagesStore } from "../stores/images";
import { cn } from "../utils/cn";

/** 12 hue groups (30° buckets, group k centered at k*30°) + neutral (99). */
export const HUE_GROUPS: { value: number; label: string; color: string }[] = [
  ...Array.from({ length: 12 }, (_, k) => ({
    value: k,
    label: [
      "Red",
      "Orange",
      "Yellow",
      "Lime",
      "Green",
      "Teal",
      "Cyan",
      "Sky",
      "Blue",
      "Indigo",
      "Purple",
      "Pink",
    ][k],
    color: `hsl(${k * 30} 65% 45%)`,
  })),
  { value: 99, label: "Neutral", color: "hsl(0 0% 45%)" },
];

function HueFilterStrip() {
  const hueGroup = useImagesStore((s) => s.filters.hueGroup);

  const toggle = (value: number) => {
    const base = useImagesStore.getState().filters;
    useImagesStore.getState().setFilters({
      ...base,
      hueGroup: base.hueGroup === value ? null : value,
    });
    useImagesStore.getState().fetchPage(1);
  };

  return (
    <div
      className="flex items-center gap-1 px-1"
      role="group"
      aria-label="Filter by dominant color"
    >
      {HUE_GROUPS.map(({ value, label, color }) => {
        const selected = hueGroup === value;
        return (
          <button
            key={value}
            type="button"
            title={
              selected ? `Clear ${label.toLowerCase()} filter` : `Filter by ${label.toLowerCase()}`
            }
            aria-label={`Filter by ${label.toLowerCase()}`}
            aria-pressed={selected}
            onClick={() => toggle(value)}
            className={cn(
              "size-4 shrink-0 cursor-pointer rounded-full border border-base-content/20 transition-transform duration-100",
              "hover:scale-125 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary",
              selected && "scale-125 ring-2 ring-primary ring-offset-1 ring-offset-base-100",
            )}
            style={{ backgroundColor: color }}
          />
        );
      })}
    </div>
  );
}

export default HueFilterStrip;
