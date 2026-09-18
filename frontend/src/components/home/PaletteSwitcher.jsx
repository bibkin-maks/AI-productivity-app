import { PALETTES } from "./palettes";

// Floating picker for trying particle colour versions (dev builds, or ?palette= in the URL)
export default function PaletteSwitcher({ value, onChange }) {
  return (
    <div className="home-palette" role="group" aria-label="Particle colors">
      <span className="home-label !text-[11px] hidden sm:inline">Colors</span>
      {Object.entries(PALETTES).map(([key, palette]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          aria-pressed={value === key}
          title={palette.label}
          className="home-palette__option"
        >
          <span className="home-palette__swatch" aria-hidden="true">
            {palette.colors.map((c) => (
              <span key={c} style={{ background: c }} />
            ))}
          </span>
          <span className="home-palette__name">{palette.label}</span>
        </button>
      ))}
    </div>
  );
}
