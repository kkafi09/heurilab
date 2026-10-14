import { useState, useRef, useEffect, useId } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  badge?: string;
}

export function Select({
  value,
  onChange,
  options,
  placeholder = "Pilih opsi...",
  disabled = false,
  className = "",
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const id = useId();

  const selectedIndex = options.findIndex((opt) => opt.value === value);
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : null;

  function toggleOpen() {
    if (disabled) return;
    setIsOpen((prev) => {
      const next = !prev;
      if (next) {
        setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
      }
      return next;
    });
  }

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Handle keyboard navigation (ArrowUp, ArrowDown, Enter, Escape)
  function handleTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;

    if (
      event.key === "ArrowDown" ||
      event.key === "ArrowUp" ||
      event.key === "Enter" ||
      event.key === " "
    ) {
      event.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
      } else if (event.key === "ArrowDown") {
        setHighlightedIndex((prev) => (prev < options.length - 1 ? prev + 1 : 0));
      } else if (event.key === "ArrowUp") {
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : options.length - 1));
      } else if (event.key === "Enter" || event.key === " ") {
        if (highlightedIndex >= 0 && highlightedIndex < options.length) {
          onChange(options[highlightedIndex]!.value);
          setIsOpen(false);
        }
      }
    } else if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      setIsOpen(false);
    }
  }

  return (
    <div ref={containerRef} className={`custom-select-container ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        className={`custom-select-trigger ${isOpen ? "open" : ""}`}
        onClick={toggleOpen}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
      >
        <span className={`trigger-text ${!selectedOption ? "placeholder" : ""}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown size={16} className={`chevron-icon ${isOpen ? "rotated" : ""}`} />
      </button>

      {isOpen && (
        <div ref={popoverRef} className="custom-select-popover" role="listbox" aria-labelledby={id}>
          {options.map((option, index) => {
            const isSelected = option.value === value;
            const isHighlighted = index === highlightedIndex;

            return (
              <div
                key={option.value}
                role="option"
                aria-selected={isSelected}
                tabIndex={-1}
                className={`custom-select-item ${isSelected ? "selected" : ""} ${
                  isHighlighted ? "highlighted" : ""
                }`}
                onMouseEnter={() => setHighlightedIndex(index)}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                  triggerRef.current?.focus();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onChange(option.value);
                    setIsOpen(false);
                    triggerRef.current?.focus();
                  }
                }}
              >
                <div className="select-item-text-group">
                  <div className="select-item-title-row">
                    <span className="select-item-label">{option.label}</span>
                    {option.badge && <span className="select-item-badge">{option.badge}</span>}
                  </div>
                  {option.description && (
                    <span className="select-item-description">{option.description}</span>
                  )}
                </div>
                {isSelected && <Check size={16} className="select-item-check" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
