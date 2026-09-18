import { Check as CheckIcon } from "lucide-react";

export default function Check({ checked, onToggle, color, label, disabled }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className="app-check"
      style={color ? { "--check": color } : undefined}
    >
      {checked && <CheckIcon size={16} strokeWidth={3} aria-hidden="true" />}
    </button>
  );
}
