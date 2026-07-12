interface Props {
  activeNear: boolean;
  onPickColor: (hex: string) => void;
}

/** Native color picker; reports a picked hex via onPickColor. */
function ColorPickerButtons({ activeNear, onPickColor }: Props) {
  return (
    <div className="flex items-center gap-1 border-l border-base-content/10 pl-1.5">
      <label
        title={activeNear ? "Change color match filter" : "Filter by a specific color"}
        className="flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full border border-base-content/20 text-base-content/60 transition-transform duration-100 hover:scale-125 hover:text-base-content focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="size-3.5"
        >
          <path d="M12 21a9 9 0 1 1 9-9c0 2-1.5 3-3 3h-2a2 2 0 0 0-2 2c0 .5.2 1 .5 1.4.3.4.5.9.5 1.4A2.2 2.2 0 0 1 12 21Z" />
          <circle cx="7.5" cy="10.5" r=".8" fill="currentColor" />
          <circle cx="12" cy="7.5" r=".8" fill="currentColor" />
          <circle cx="16.5" cy="10.5" r=".8" fill="currentColor" />
        </svg>
        <input
          type="color"
          aria-label="Pick a color to filter by"
          className="sr-only"
          onChange={(e) => onPickColor(e.target.value)}
        />
      </label>
    </div>
  );
}

export default ColorPickerButtons;
