import React, { useState, useRef, useEffect, useId, useMemo } from 'react';
import ReactDOM from 'react-dom';

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  icon?: string;
  badge?: string;
  badgeType?: 'primary' | 'success' | 'warning' | 'neutral' | 'info';
  disabled?: boolean;
}

export interface SelectDropdownProps {
  id?: string;
  value: string;
  options: Array<SelectOption | string>;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  fullWidth?: boolean;
  variant?: 'form' | 'pill' | 'compact';
  className?: string;
  style?: React.CSSProperties;
  leadingIcon?: string;
  emptyText?: string;
}

export const SelectDropdown: React.FC<SelectDropdownProps> = ({
  id,
  value,
  options,
  onChange,
  placeholder = 'Selecione uma opção...',
  disabled = false,
  searchable,
  searchPlaceholder = 'Buscar opções...',
  fullWidth = true,
  variant = 'form',
  className = '',
  style,
  leadingIcon,
  emptyText = 'Nenhuma opção encontrada',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    left: number;
    width: number;
    isDropup: boolean;
    maxHeight: number;
  }>({
    top: 0,
    left: 0,
    width: 240,
    isDropup: false,
    maxHeight: 280,
  });

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const autoId = useId();
  const selectId = id || autoId;

  // Normalize options to SelectOption objects
  const normalizedOptions: SelectOption[] = useMemo(() => {
    return options.map((opt) => {
      if (typeof opt === 'string') {
        return { value: opt, label: opt };
      }
      return opt;
    });
  }, [options]);

  // Active selected option
  const selectedOption = useMemo(() => {
    return normalizedOptions.find((opt) => opt.value === value) || null;
  }, [normalizedOptions, value]);

  // Filtered options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return normalizedOptions;
    const lower = searchTerm.toLowerCase();
    return normalizedOptions.filter(
      (opt) =>
        opt.label.toLowerCase().includes(lower) ||
        opt.value.toLowerCase().includes(lower) ||
        (opt.description && opt.description.toLowerCase().includes(lower))
    );
  }, [normalizedOptions, searchTerm]);

  // Determine if search box should be active (explicit searchable prop or > 6 items)
  const isSearchActive = searchable !== undefined ? searchable : normalizedOptions.length > 6;

  // Calculate and update absolute viewport position for Portal
  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const margin = 6;
    const menuEstimatedHeight = 280;
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;

    const isDropup = spaceBelow < menuEstimatedHeight && spaceAbove > spaceBelow;
    const targetWidth = Math.max(rect.width, 240);

    let left = rect.left;
    // Prevent right overflow
    if (left + targetWidth > viewportWidth - 16) {
      left = Math.max(16, viewportWidth - targetWidth - 16);
    }

    let top = 0;
    let availableHeight = 280;

    if (isDropup) {
      top = rect.top - margin;
      availableHeight = Math.min(280, Math.max(120, spaceAbove - 16));
    } else {
      top = rect.bottom + margin;
      availableHeight = Math.min(280, Math.max(120, spaceBelow - 16));
    }

    setMenuPosition({
      top,
      left,
      width: targetWidth,
      isDropup,
      maxHeight: availableHeight,
    });
  };

  // Open & reposition
  const handleOpen = () => {
    if (disabled) return;
    updatePosition();
    setIsOpen(true);
    setSearchTerm('');
    setFocusedIndex(-1);
  };

  const handleClose = () => {
    setIsOpen(false);
    setSearchTerm('');
    setFocusedIndex(-1);
  };

  const handleToggle = () => {
    if (isOpen) {
      handleClose();
    } else {
      handleOpen();
    }
  };

  // Focus search input when open
  useEffect(() => {
    if (isOpen) {
      if (isSearchActive && searchInputRef.current) {
        setTimeout(() => searchInputRef.current?.focus(), 40);
      }
    }
  }, [isOpen, isSearchActive]);

  // Global listeners for outside click, resize and scroll
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      handleClose();
    };

    const handleScrollOrResize = () => {
      updatePosition();
    };

    document.addEventListener('mousedown', handleOutsideClick, true);
    document.addEventListener('touchstart', handleOutsideClick, true);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick, true);
      document.removeEventListener('touchstart', handleOutsideClick, true);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        handleOpen();
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      handleClose();
      triggerRef.current?.focus();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : 0));
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((prev) => (prev > 0 ? prev - 1 : filteredOptions.length - 1));
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (focusedIndex >= 0 && focusedIndex < filteredOptions.length) {
        const item = filteredOptions[focusedIndex];
        if (item && !item.disabled) {
          onChange(item.value);
          handleClose();
          triggerRef.current?.focus();
        }
      }
    }
  };

  const handleSelect = (item: SelectOption) => {
    if (item.disabled) return;
    onChange(item.value);
    handleClose();
    triggerRef.current?.focus();
  };

  // Get current active icon
  const activeIcon = selectedOption?.icon || leadingIcon;

  return (
    <div
      className={`select-dropdown-container ${fullWidth ? 'full-width' : ''} ${variant} ${isOpen ? 'open' : ''} ${className}`}
      style={style}
    >
      <button
        ref={triggerRef}
        id={selectId}
        type="button"
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        className={`select-dropdown-trigger ${variant} ${isOpen ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
      >
        <div className="select-dropdown-trigger-content">
          {activeIcon && (
            <span className="material-symbols-outlined select-dropdown-icon">
              {activeIcon}
            </span>
          )}
          <span className={`select-dropdown-value ${!selectedOption ? 'placeholder' : ''}`}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.badge && (
            <span className={`select-dropdown-badge badge-${selectedOption.badgeType || 'primary'}`}>
              {selectedOption.badge}
            </span>
          )}
        </div>

        <span className={`material-symbols-outlined select-dropdown-arrow ${isOpen ? 'open' : ''}`}>
          expand_more
        </span>
      </button>

      {/* Floating Menu rendered through React Portal to avoid clipping */}
      {isOpen &&
        ReactDOM.createPortal(
          <div
            ref={menuRef}
            className={`select-dropdown-portal-menu ${menuPosition.isDropup ? 'dropup' : 'dropdown'}`}
            style={{
              position: 'fixed',
              top: menuPosition.isDropup ? 'auto' : `${menuPosition.top}px`,
              bottom: menuPosition.isDropup ? `${window.innerHeight - menuPosition.top}px` : 'auto',
              left: `${menuPosition.left}px`,
              width: `${menuPosition.width}px`,
              maxHeight: `${menuPosition.maxHeight}px`,
              zIndex: 99999,
            }}
            onKeyDown={handleKeyDown}
          >
            {isSearchActive && (
              <div className="select-dropdown-search">
                <span className="material-symbols-outlined search-icon">search</span>
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder={searchPlaceholder}
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setFocusedIndex(0);
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
                {searchTerm && (
                  <button
                    type="button"
                    className="clear-search-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSearchTerm('');
                      searchInputRef.current?.focus();
                    }}
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                )}
              </div>
            )}

            <div className="select-dropdown-list" role="listbox">
              {filteredOptions.length === 0 ? (
                <div className="select-dropdown-empty">
                  <span className="material-symbols-outlined empty-icon">search_off</span>
                  <span>{emptyText}</span>
                </div>
              ) : (
                filteredOptions.map((opt, index) => {
                  const isSelected = opt.value === value;
                  const isFocused = index === focusedIndex;

                  return (
                    <div
                      key={opt.value}
                      role="option"
                      aria-selected={isSelected}
                      className={`select-dropdown-item ${isSelected ? 'selected' : ''} ${isFocused ? 'focused' : ''} ${opt.disabled ? 'disabled' : ''}`}
                      onClick={() => handleSelect(opt)}
                      onMouseEnter={() => setFocusedIndex(index)}
                    >
                      <div className="select-dropdown-item-main">
                        {opt.icon && (
                          <span className="material-symbols-outlined item-icon">
                            {opt.icon}
                          </span>
                        )}
                        <div className="select-dropdown-item-text">
                          <span className="item-label">{opt.label}</span>
                          {opt.description && (
                            <span className="item-description">{opt.description}</span>
                          )}
                        </div>
                      </div>

                      <div className="select-dropdown-item-end">
                        {opt.badge && (
                          <span className={`select-dropdown-badge badge-${opt.badgeType || 'primary'}`}>
                            {opt.badge}
                          </span>
                        )}
                        {isSelected && (
                          <span className="material-symbols-outlined check-icon">
                            check
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
