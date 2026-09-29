import React, { useState, useRef, useEffect } from "react";
import { Check } from "lucide-react";

// 32 Cores Harmonizadas (8 Matizes x 4 Variações Verticais com o Centro na cor Base 500)
// Linha 0 (Topo): Tom Suave / Claro (250/300)
// Linha 1 (Centro): Cor Base Central (500)
// Linha 2 (Médio): Tom Vigoroso / Contraste (600)
// Linha 3 (Base): Tom Profundo / Escuro (800)
export const RAINBOW_28_HUES = [
  { name: "Vermelho", colors: ["#fca5a5", "#ef4444", "#dc2626", "#991b1b"] },
  { name: "Laranja", colors: ["#fed7aa", "#f97316", "#ea580c", "#9a3412"] },
  {
    name: "Âmbar/Amarelo",
    colors: ["#fef08a", "#eab308", "#ca8a04", "#854d0e"],
  },
  { name: "Verde", colors: ["#86efac", "#22c55e", "#16a34a", "#166534"] },
  { name: "Ciano", colors: ["#67e8f9", "#06b6d4", "#0891b2", "#155e75"] },
  { name: "Azul", colors: ["#93c5fd", "#3b82f6", "#2563eb", "#1e40af"] },
  { name: "Roxo", colors: ["#d8b4fe", "#a855f7", "#9333ea", "#6b21a8"] },
  { name: "Rosa", colors: ["#f472b6", "#ec4899", "#db2777", "#9d174d"] },
];

export interface ColorDotPickerProps {
  color: string;
  onChange: (hex: string) => void;
  size?: number;
}

export const ColorDotPicker: React.FC<ColorDotPickerProps> = ({
  color,
  onChange,
  size = 14,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleOutside);
    }
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [isOpen]);

  return (
    <div ref={containerRef} className="ui-color-picker">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        title={`Cor: ${color}. Clique para escolher.`}
        className="ui-color-dot-btn"
        style={{
          width: size,
          height: size,
          backgroundColor: color,
        }}
      />

      {isOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="ui-color-picker-popover"
        >
          <div className="ui-color-picker-grid">
            {RAINBOW_28_HUES.map((hueGroup) => (
              <div key={hueGroup.name} className="ui-stack ui-stack--xs">
                {hueGroup.colors.map((hex) => {
                  const isSelected = color.toLowerCase() === hex.toLowerCase();
                  return (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => {
                        onChange(hex);
                        setIsOpen(false);
                      }}
                      title={`${hueGroup.name}: ${hex}`}
                      className={`ui-color-swatch-btn ${
                        isSelected ? "ui-color-swatch-btn--selected" : ""
                      }`}
                      style={{ backgroundColor: hex }}
                    >
                      {isSelected && (
                        <Check
                          size={9}
                          style={{
                            color: [
                              "#fca5a5",
                              "#fdba74",
                              "#fde047",
                              "#86efac",
                              "#67e8f9",
                              "#93c5fd",
                              "#d8b4fe",
                            ].includes(hex)
                              ? "#000"
                              : "#fff",
                            strokeWidth: 3,
                          }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
