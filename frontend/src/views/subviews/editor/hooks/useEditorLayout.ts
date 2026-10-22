import { useState, useRef } from 'react';
import {
  TREE_WIDTH_STORAGE_KEY,
  TREE_COLLAPSED_STORAGE_KEY,
  DEFAULT_TREE_WIDTH,
} from '../types';

export function useEditorLayout() {
  const [isTreeCollapsed, setIsTreeCollapsed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(TREE_COLLAPSED_STORAGE_KEY);
      return saved === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleTreeCollapse = () => {
    setIsTreeCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(TREE_COLLAPSED_STORAGE_KEY, String(next));
      } catch {}
      return next;
    });
  };

  const [treeWidth, setTreeWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(TREE_WIDTH_STORAGE_KEY);
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 150 && parsed <= 700) {
          return parsed;
        }
      }
    } catch {}
    return DEFAULT_TREE_WIDTH;
  });

  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(DEFAULT_TREE_WIDTH);

  const handleStartResize = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = treeWidth;

    document.body.classList.add('is-resizing');

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const deltaX = moveEvent.clientX - startXRef.current;
      const newWidth = Math.max(150, Math.min(700, startWidthRef.current + deltaX));
      setTreeWidth(newWidth);
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      document.body.classList.remove('is-resizing');

      const deltaX = upEvent.clientX - startXRef.current;
      const finalWidth = Math.max(150, Math.min(700, startWidthRef.current + deltaX));
      setTreeWidth(finalWidth);
      try {
        localStorage.setItem(TREE_WIDTH_STORAGE_KEY, String(finalWidth));
      } catch {}

      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return {
    isTreeCollapsed,
    handleToggleTreeCollapse,
    treeWidth,
    handleStartResize,
  };
}
