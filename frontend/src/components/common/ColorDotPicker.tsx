import React, { useState, useRef, useEffect, useCallback } from "react";
import ReactDOM from "react-dom";
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

function isLightColor(hex: string): boolean {
  const clean = hex.replace("#", "");
  if (clean.length !== 6 && clean.length !== 3) return false;
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const r = parseInt(full.substring(0, 2), 16) || 0;
  const g = parseInt(full.substring(2, 4), 16) || 0;
  const b = parseInt(full.substring(4, 6), 16) || 0;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62;
}

function formatHex(val: string): string {
  let h = val.trim();
  if (!h.startsWith("#")) h = "#" + h;
  return h;
}

function isValidHex(val: string): boolean {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(formatHex(val));
}

export const ColorDotPicker: React.FC<ColorDotPickerProps> = ({
  color,
  onChange,
  size = 14,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [customHex, setCustomHex] = useState(color);
  const [position, setPosition] = useState<{
    top: number;
    left: number;
    isDropup: boolean;
  }>({ top: 0, left: 0, isDropup: false });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popoverWidth = 224;
    const popoverHeight = 176;
    const margin = 8;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;

    // Se o espaço abaixo for insuficiente para o popover e houver mais espaço acima, abre para cima
    const isDropup =
      spaceBelow < popoverHeight + margin + 12 && spaceAbove > spaceBelow;

    let top = isDropup
      ? rect.top - margin - popoverHeight
      : rect.bottom + margin;

    // Limites de segurança verticais da janela
    if (top < 12) top = 12;
    if (top + popoverHeight > viewportHeight - 12) {
      top = Math.max(12, viewportHeight - popoverHeight - 12);
    }

    // Alinhamento horizontal: tenta posicionar alinhado à esquerda do gatilho
    let left = rect.left;
    // Se estourar a borda direita da viewport, alinha para dentro
    if (left + popoverWidth > viewportWidth - 16) {
      left = Math.max(
        16,
        Math.min(rect.right - popoverWidth, viewportWidth - popoverWidth - 16),
      );
    }
    if (left < 16) {
      left = 16;
    }

    setPosition({ top, left, isDropup });
  }, []);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOpen) {
      setCustomHex(color);
      updatePosition();
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  const handleApplyCustomHex = () => {
    if (isValidHex(customHex)) {
      const formatted = formatHex(customHex).toLowerCase();
      onChange(formatted);
      setIsOpen(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    updatePosition();

    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setIsOpen(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    const handleScrollOrResize = () => {
      updatePosition();
    };

    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isOpen, updatePosition]);

  return (
    <div className="ui-color-picker">
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        title={`Cor: ${color}. Clique para escolher.`}
        className={`ui-color-dot-btn ${
          isOpen ? "ui-color-dot-btn--active" : ""
        }`}
        style={{
          width: size,
          height: size,
          backgroundColor: color,
        }}
        aria-expanded={isOpen}
      />

      {isOpen &&
        typeof document !== "undefined" &&
        ReactDOM.createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label="Paleta de cores"
            onClick={(e) => e.stopPropagation()}
            className="ui-color-picker-popover"
            style={{
              top: `${position.top}px`,
              left: `${position.left}px`,
            }}
          >
            {/* Header: Pré-visualização + Código Hex + Botão Aplicar */}
            <div className="ui-color-picker-header">
              <div className="ui-color-picker-preview-group">
                <span
                  className="ui-color-picker-preview"
                  style={{
                    backgroundColor: isValidHex(customHex)
                      ? formatHex(customHex)
                      : color,
                  }}
                  title="Pré-visualização da cor"
                />
                <input
                  type="text"
                  className="ui-color-picker-hex-input"
                  value={customHex}
                  maxLength={7}
                  placeholder="#HEX"
                  onChange={(e) => setCustomHex(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleApplyCustomHex();
                    }
                  }}
                  title="Código Hexadecimal da cor"
                />
              </div>
              <button
                type="button"
                className="ui-color-picker-apply-btn"
                onClick={handleApplyCustomHex}
                disabled={!isValidHex(customHex)}
                title="Aplicar cor hexadecimal"
              >
                OK
              </button>
            </div>

            {/* Label de seção da paleta */}
            <div
              style={{
                fontSize: "9.5px",
                fontWeight: 700,
                color: "var(--color-outline, #64748b)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                padding: "0 2px",
              }}
            >
              Paleta Harmonizada
            </div>

            {/* Grid com 8 colunas de matizes x 4 variações verticais */}
            <div className="ui-color-picker-grid">
              {RAINBOW_28_HUES.map((hueGroup) => (
                <div key={hueGroup.name} className="ui-stack ui-stack--xs">
                  {hueGroup.colors.map((hex) => {
                    const isSelected =
                      color.toLowerCase() === hex.toLowerCase();
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
                        aria-label={`${hueGroup.name} ${hex}`}
                      >
                        {isSelected && (
                          <Check
                            size={10}
                            style={{
                              color: isLightColor(hex) ? "#0f172a" : "#ffffff",
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
          </div>,
          document.body,
        )}
    </div>
  );
};
