import React, { useRef, useState, useEffect } from 'react';
import { Rect } from '../types';
import { clampRectToImage } from '../utils/geometry';

interface Props {
  rect: Rect;
  imageWidth: number;
  imageHeight: number;
  displayScale: number; // ratio of displayed pixels to natural pixels
  onChange: (newRect: Rect) => void;
}

type DragMode = 'move' | 'nw' | 'ne' | 'sw' | 'se' | null;

export const BoundingBoxOverlay: React.FC<Props> = ({ rect, imageWidth, imageHeight, displayScale, onChange }) => {
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [startRect, setStartRect] = useState<Rect>(rect);
  
  // Manual Input State
  const [isEditing, setIsEditing] = useState(false);
  const [tempWidth, setTempWidth] = useState(Math.round(rect.width).toString());
  const [tempHeight, setTempHeight] = useState(Math.round(rect.height).toString());

  // Sync temp values when rect changes externally or via drag
  useEffect(() => {
    if (!isEditing) {
      setTempWidth(Math.round(rect.width).toString());
      setTempHeight(Math.round(rect.height).toString());
    }
  }, [rect, isEditing]);

  const handlePointerDown = (e: React.PointerEvent, mode: DragMode) => {
    if (isEditing) return; // Don't drag while editing text
    e.preventDefault();
    e.stopPropagation();
    setDragMode(mode);
    setStartPos({ x: e.clientX, y: e.clientY });
    setStartRect(rect);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragMode) return;
    e.preventDefault();

    const deltaX = (e.clientX - startPos.x) / displayScale;
    const deltaY = (e.clientY - startPos.y) / displayScale;

    let newRect = { ...startRect };

    if (dragMode === 'move') {
      newRect.x += deltaX;
      newRect.y += deltaY;
    } else {
      if (dragMode.includes('w')) {
        newRect.x += deltaX;
        newRect.width -= deltaX;
      }
      if (dragMode.includes('e')) {
        newRect.width += deltaX;
      }
      if (dragMode.includes('n')) {
        newRect.y += deltaY;
        newRect.height -= deltaY;
      }
      if (dragMode.includes('s')) {
        newRect.height += deltaY;
      }
    }

    // Normalize rect (handle negative width/height flipping)
    if (newRect.width < 0) {
      newRect.x += newRect.width;
      newRect.width = Math.abs(newRect.width);
    }
    if (newRect.height < 0) {
      newRect.y += newRect.height;
      newRect.height = Math.abs(newRect.height);
    }

    // Clamp
    const clamped = clampRectToImage(newRect, imageWidth, imageHeight);
    onChange(clamped);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setDragMode(null);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const handleManualSubmit = () => {
    const w = parseInt(tempWidth);
    const h = parseInt(tempHeight);
    
    if (!isNaN(w) && !isNaN(h)) {
      const newRect = {
        ...rect,
        width: Math.max(1, w),
        height: Math.max(1, h)
      };
      const clamped = clampRectToImage(newRect, imageWidth, imageHeight);
      onChange(clamped);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleManualSubmit();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setTempWidth(Math.round(rect.width).toString());
      setTempHeight(Math.round(rect.height).toString());
    }
    // Tab behavior is native to browser, we don't need to prevent it.
  };

  const handleContainerBlur = (e: React.FocusEvent) => {
    // Check if the focus is still within the container (e.g. switching from Width to Height)
    if (!e.currentTarget.contains(e.relatedTarget)) {
      handleManualSubmit();
    }
  };

  // Convert logical rect (natural pixels) to CSS pixels
  const styleRect = {
    left: rect.x * displayScale,
    top: rect.y * displayScale,
    width: rect.width * displayScale,
    height: rect.height * displayScale,
  };

  return (
    <div 
      className="absolute inset-0 pointer-events-none overflow-hidden"
      onPointerUp={handlePointerUp}
      onPointerMove={handlePointerMove}
    >
      {/* The Box */}
      <div
        className={`absolute border-2 border-blue-500 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] pointer-events-auto group ${isEditing ? '' : 'cursor-move'}`}
        style={{
          transform: `translate(${styleRect.left}px, ${styleRect.top}px)`,
          width: styleRect.width,
          height: styleRect.height,
        }}
        onPointerDown={(e) => handlePointerDown(e, 'move')}
      >
        {/* Handles */}
        <div 
          className="absolute -top-2 -left-2 w-4 h-4 bg-white border border-blue-600 rounded-full cursor-nw-resize z-10"
          onPointerDown={(e) => handlePointerDown(e, 'nw')}
        />
        <div 
          className="absolute -top-2 -right-2 w-4 h-4 bg-white border border-blue-600 rounded-full cursor-ne-resize z-10"
          onPointerDown={(e) => handlePointerDown(e, 'ne')}
        />
        <div 
          className="absolute -bottom-2 -left-2 w-4 h-4 bg-white border border-blue-600 rounded-full cursor-sw-resize z-10"
          onPointerDown={(e) => handlePointerDown(e, 'sw')}
        />
        <div 
          className="absolute -bottom-2 -right-2 w-4 h-4 bg-white border border-blue-600 rounded-full cursor-se-resize z-10"
          onPointerDown={(e) => handlePointerDown(e, 'se')}
        />
        
        {/* Dimensions Label / Editor */}
        <div 
          className="absolute -top-10 left-0 bg-blue-600 text-white text-[11px] px-2 py-1.5 rounded shadow-lg pointer-events-auto whitespace-nowrap z-20 transition-all hover:bg-blue-700 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            if (!isEditing) setIsEditing(true);
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {isEditing ? (
            <div 
              className="flex items-center gap-1" 
              onClick={(e) => e.stopPropagation()}
              onBlur={handleContainerBlur}
            >
              <input 
                autoFocus
                type="text" 
                value={tempWidth}
                onChange={(e) => setTempWidth(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-10 bg-white text-blue-800 rounded px-1 outline-none font-bold text-center"
              />
              <span className="font-bold">x</span>
              <input 
                type="text" 
                value={tempHeight}
                onChange={(e) => setTempHeight(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-10 bg-white text-blue-800 rounded px-1 outline-none font-bold text-center"
              />
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <span className="font-bold">{Math.round(rect.width)} x {Math.round(rect.height)}</span>
              <span className="opacity-60 text-[10px] ml-1">
                 ({Math.round(rect.x)}, {Math.round(rect.y)})
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};