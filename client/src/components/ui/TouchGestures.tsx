import React, { useState, useRef, useEffect, ReactNode } from 'react';

interface TouchGesturesProps {
  children: ReactNode;
  onTap?: (e: TouchEvent) => void;
  onDoubleTap?: (e: TouchEvent) => void;
  onLongPress?: (e: TouchEvent) => void;
  onSwipe?: (direction: 'left' | 'right' | 'up' | 'down', e: TouchEvent) => void;
  onPinch?: (scale: number, e: TouchEvent) => void;
  className?: string;
  longPressDelay?: number;
  swipeThreshold?: number;
  tapDelay?: number;
}

export function TouchGestures({
  children,
  onTap,
  onDoubleTap,
  onLongPress,
  onSwipe,
  onPinch,
  className = '',
  longPressDelay = 500,
  swipeThreshold = 50,
  tapDelay = 300
}: TouchGesturesProps) {
  const [touchStart, setTouchStart] = useState<{ x: number; y: number; time: number } | null>(null);
  const [lastTap, setLastTap] = useState<number>(0);
  const [isLongPress, setIsLongPress] = useState(false);
  const [touchCount, setTouchCount] = useState(0);
  const [initialDistance, setInitialDistance] = useState<number>(0);
  
  const longPressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const elementRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    const currentTime = Date.now();
    
    setTouchCount(e.touches.length);
    setTouchStart({
      x: touch.clientX,
      y: touch.clientY,
      time: currentTime
    });
    setIsLongPress(false);
    
    // Handle pinch gesture (two fingers)
    if (e.touches.length === 2 && onPinch) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) + 
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );
      setInitialDistance(distance);
    }
    
    // Start long press timer
    if (onLongPress) {
      longPressTimeoutRef.current = setTimeout(() => {
        setIsLongPress(true);
        // Vibrate if supported
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
        onLongPress(e.nativeEvent);
      }, longPressDelay);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStart) return;
    
    // Handle pinch gesture
    if (e.touches.length === 2 && onPinch && initialDistance > 0) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const currentDistance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) + 
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );
      const scale = currentDistance / initialDistance;
      onPinch(scale, e.nativeEvent);
      return;
    }
    
    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStart.x);
    const deltaY = Math.abs(touch.clientY - touchStart.y);
    
    // If user moves finger significantly, cancel long press
    if ((deltaX > 10 || deltaY > 10) && longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
      setIsLongPress(false);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
    
    if (!touchStart) return;
    
    const currentTime = Date.now();
    const timeDiff = currentTime - touchStart.time;
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStart.x;
    const deltaY = touch.clientY - touchStart.y;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);
    
    // Handle swipe gesture
    if (onSwipe && (absDeltaX > swipeThreshold || absDeltaY > swipeThreshold)) {
      if (absDeltaX > absDeltaY) {
        // Horizontal swipe
        onSwipe(deltaX > 0 ? 'right' : 'left', e.nativeEvent);
      } else {
        // Vertical swipe
        onSwipe(deltaY > 0 ? 'down' : 'up', e.nativeEvent);
      }
    }
    // Handle tap gestures (if not a swipe or long press)
    else if (!isLongPress && absDeltaX < 10 && absDeltaY < 10) {
      // Check for double tap
      if (onDoubleTap && currentTime - lastTap < tapDelay) {
        onDoubleTap(e.nativeEvent);
        setLastTap(0); // Reset to prevent triple tap
      } 
      // Single tap
      else if (onTap) {
        // Delay single tap to check for double tap
        setTimeout(() => {
          if (currentTime === lastTap) {
            onTap(e.nativeEvent);
          }
        }, tapDelay);
        setLastTap(currentTime);
      }
    }
    
    setTouchStart(null);
    setIsLongPress(false);
    setTouchCount(0);
    setInitialDistance(0);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (longPressTimeoutRef.current) {
        clearTimeout(longPressTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={elementRef}
      className={`touch-manipulation select-none ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        touchAction: 'pan-x pan-y',
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none'
      }}
    >
      {children}
    </div>
  );
}

// Enhanced button component with touch feedback
interface TouchButtonProps {
  children: ReactNode;
  onClick?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  className?: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export function TouchButton({
  children,
  onClick,
  onLongPress,
  disabled = false,
  className = '',
  variant = 'primary',
  size = 'md'
}: TouchButtonProps) {
  const [isPressed, setIsPressed] = useState(false);
  const [isLongPressed, setIsLongPressed] = useState(false);
  
  const getVariantClasses = () => {
    switch (variant) {
      case 'primary':
        return 'bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80';
      case 'secondary':
        return 'bg-secondary text-secondary-foreground hover:bg-secondary/80 active:bg-secondary/70';
      case 'outline':
        return 'border border-input bg-background hover:bg-accent hover:text-accent-foreground active:bg-accent/80';
      case 'ghost':
        return 'hover:bg-accent hover:text-accent-foreground active:bg-accent/80';
      default:
        return 'bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80';
    }
  };
  
  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'h-9 px-3 text-sm min-w-[44px]'; // Ensure minimum touch target
      case 'md':
        return 'h-10 px-4 py-2 min-w-[44px]';
      case 'lg':
        return 'h-11 px-8 min-w-[44px]';
      default:
        return 'h-10 px-4 py-2 min-w-[44px]';
    }
  };

  return (
    <TouchGestures
      className={`
        inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium 
        ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 
        focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none 
        disabled:opacity-50 cursor-pointer
        ${getVariantClasses()} 
        ${getSizeClasses()}
        ${isPressed ? 'scale-95 brightness-90' : ''}
        ${isLongPressed ? 'ring-2 ring-primary ring-offset-2' : ''}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
      onTap={() => !disabled && onClick?.()}
      onLongPress={() => !disabled && onLongPress?.()}
    >
      <div
        onTouchStart={() => setIsPressed(true)}
        onTouchEnd={() => setIsPressed(false)}
        onTouchCancel={() => setIsPressed(false)}
        className="w-full h-full flex items-center justify-center"
      >
        {children}
      </div>
    </TouchGestures>
  );
}

// Enhanced scroll area with momentum scrolling
interface TouchScrollAreaProps {
  children: ReactNode;
  className?: string;
  maxHeight?: string;
}

export function TouchScrollArea({ children, className = '', maxHeight = '400px' }: TouchScrollAreaProps) {
  return (
    <div
      className={`overflow-auto overscroll-contain ${className}`}
      style={{
        maxHeight,
        WebkitOverflowScrolling: 'touch',
        scrollBehavior: 'smooth'
      }}
    >
      {children}
    </div>
  );
}