import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Languages, Check, ChevronDown } from 'lucide-react';
import { SUPPORTED_LANGUAGES, type LanguageOption } from '../../i18n/config';

interface LanguageSwitcherProps {
  variant?: 'default' | 'subtle' | 'compact';
  className?: string;
  style?: React.CSSProperties;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  variant = 'default',
  className = '',
  style = {},
}) => {
  const { i18n, t } = useTranslation('common');
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentLangCode = i18n.resolvedLanguage || i18n.language || 'pt-BR';
  const currentLang =
    SUPPORTED_LANGUAGES.find(
      (l) => l.code.toLowerCase() === currentLangCode.toLowerCase()
    ) || SUPPORTED_LANGUAGES[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (lang: LanguageOption) => {
    i18n.changeLanguage(lang.code);
    setIsOpen(false);
  };

  const isSubtle = variant === 'subtle' || variant === 'compact';

  return (
    <div
      ref={dropdownRef}
      id="ui-language-switcher"
      className={`language-switcher-container ${className}`}
      style={{
        position: 'relative',
        display: 'inline-block',
        ...style,
      }}
    >
      <button
        type="button"
        id="btn-language-switcher"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label={t('selectLanguage')}
        title={t('selectLanguage')}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: isSubtle ? '6px 10px' : '7px 12px',
          borderRadius: 'var(--radius-md, 8px)',
          border: isSubtle
            ? '1px solid var(--color-outline-variant, rgba(255, 255, 255, 0.1))'
            : '1px solid var(--color-outline-variant, rgba(255, 255, 255, 0.15))',
          background: isSubtle
            ? 'var(--color-surface-container, rgba(255, 255, 255, 0.04))'
            : 'var(--color-surface-container-high, rgba(255, 255, 255, 0.08))',
          color: 'var(--color-on-surface, #e2e8f0)',
          fontSize: '12.5px',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          outline: 'none',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background =
            'var(--color-surface-container-highest, rgba(255, 255, 255, 0.12))';
          e.currentTarget.style.borderColor =
            'var(--color-primary, #3b82f6)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = isSubtle
            ? 'var(--color-surface-container, rgba(255, 255, 255, 0.04))'
            : 'var(--color-surface-container-high, rgba(255, 255, 255, 0.08))';
          e.currentTarget.style.borderColor =
            'var(--color-outline-variant, rgba(255, 255, 255, 0.15))';
        }}
      >
        <Languages size={15} style={{ color: 'var(--color-primary, #3b82f6)' }} />
        <span style={{ fontSize: '12px' }}>
          {currentLang.flag ? `${currentLang.flag} ` : ''}
          {currentLang.nativeLabel}
        </span>
        <ChevronDown
          size={13}
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.15s ease',
            color: 'var(--color-outline, #94a3b8)',
          }}
        />
      </button>

      {isOpen && (
        <div
          id="language-switcher-dropdown"
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            zIndex: 1000,
            minWidth: '170px',
            background: 'var(--color-surface-container-high, #1e2230)',
            borderRadius: 'var(--radius-md, 8px)',
            border: '1px solid var(--color-outline-variant, rgba(255, 255, 255, 0.15))',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
            padding: '4px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            animation: 'fadeIn 0.15s ease-out',
          }}
        >
          {SUPPORTED_LANGUAGES.map((lang) => {
            const isSelected =
              lang.code.toLowerCase() === currentLang.code.toLowerCase();
            return (
              <button
                key={lang.code}
                type="button"
                role="menuitem"
                onClick={() => handleSelect(lang)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm, 6px)',
                  border: 'none',
                  background: isSelected
                    ? 'rgba(var(--color-primary-rgb, 59, 130, 246), 0.15)'
                    : 'transparent',
                  color: isSelected
                    ? 'var(--color-primary, #3b82f6)'
                    : 'var(--color-on-surface, #e2e8f0)',
                  fontSize: '12.5px',
                  fontWeight: isSelected ? 700 : 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.12s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background =
                      'var(--color-surface-container-highest, rgba(255, 255, 255, 0.08))';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '14px' }}>{lang.flag}</span>
                  <span>{lang.label}</span>
                </div>
                {isSelected && <Check size={14} style={{ color: 'var(--color-primary, #3b82f6)' }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
