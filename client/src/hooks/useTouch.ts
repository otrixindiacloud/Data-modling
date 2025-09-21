import { useState, useRef, useEffect, useCallback } from 'react';

interface TouchPosition {
  x: number;
  y: number;
  time: number;
}

interface UseTouchOptions {
  onTap?: (e: TouchEvent) => void;
  onDoubleTap?: (e: TouchEvent) => void;
  onLongPress?: (e: TouchEvent) => void;
  onSwipe?: (direction: 'left' | 'right' | 'up' | 'down', e: TouchEvent) => void;
  onPinch?: (scale: number, e: TouchEvent) => void;
  longPressDelay?: number;
  swipeThreshold?: number;
  tapDelay?: number;
}

export function useTouch({
  onTap,
  onDoubleTap,
  onLongPress,
  onSwipe,
  onPinch,
  longPressDelay = 500,
  swipeThreshold = 50,
  tapDelay = 300
}: UseTouchOptions = {}) {
  const [touchStart, setTouchStart] = useState<TouchPosition | null>(null);
  const [lastTap, setLastTap] = useState<number>(0);
  const [isLongPress, setIsLongPress] = useState(false);
  const [initialDistance, setInitialDistance] = useState<number>(0);
  
  const longPressTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    const currentTime = Date.now();
    
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
        onLongPress(e);
      }, longPressDelay);
    }
  }, [onLongPress, onPinch, longPressDelay]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
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
      onPinch(scale, e);
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
  }, [touchStart, onPinch, initialDistance]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
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
        onSwipe(deltaX > 0 ? 'right' : 'left', e);
      } else {
        // Vertical swipe
        onSwipe(deltaY > 0 ? 'down' : 'up', e);
      }
    }
    // Handle tap gestures (if not a swipe or long press)
    else if (!isLongPress && absDeltaX < 10 && absDeltaY < 10) {
      // Check for double tap
      if (onDoubleTap && currentTime - lastTap < tapDelay) {
        onDoubleTap(e);
        setLastTap(0); // Reset to prevent triple tap
      } 
      // Single tap
      else if (onTap) {
        // Delay single tap to check for double tap
        setTimeout(() => {
          if (currentTime === lastTap) {
            onTap(e);
          }
        }, tapDelay);
        setLastTap(currentTime);
      }
    }
    
    setTouchStart(null);
    setIsLongPress(false);
    setInitialDistance(0);
  }, [touchStart, isLongPress, lastTap, onSwipe, onDoubleTap, onTap, swipeThreshold, tapDelay]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (longPressTimeoutRef.current) {
        clearTimeout(longPressTimeoutRef.current);
      }
    };
  }, []);

  return {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    isLongPress,
    touchStart
  };
}

// Hook for detecting device capabilities
export function useDeviceCapabilities() {
  const [capabilities, setCapabilities] = useState({
    hasTouch: false,
    hasVibration: false,
    hasMotion: false,
    hasOrientation: false,
    pixelRatio: 1,
    screenSize: { width: 0, height: 0 }
  });

  useEffect(() => {
    const updateCapabilities = () => {
      setCapabilities({
        hasTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
        hasVibration: 'vibrate' in navigator,
        hasMotion: 'DeviceMotionEvent' in window,
        hasOrientation: 'DeviceOrientationEvent' in window,
        pixelRatio: window.devicePixelRatio || 1,
        screenSize: {
          width: window.innerWidth,
          height: window.innerHeight
        }
      });
    };

    updateCapabilities();
    window.addEventListener('resize', updateCapabilities);
    window.addEventListener('orientationchange', updateCapabilities);

    return () => {
      window.removeEventListener('resize', updateCapabilities);
      window.removeEventListener('orientationchange', updateCapabilities);
    };
  }, []);

  return capabilities;
}

// Hook for optimizing touch performance
export function useTouchPerformance() {
  useEffect(() => {
    // Improve touch responsiveness
    const style = document.createElement('style');
    style.textContent = `
      * {
        touch-action: manipulation;
      }
      
      .touch-manipulation {
        touch-action: manipulation;
      }
      
      .touch-pan-x {
        touch-action: pan-x;
      }
      
      .touch-pan-y {
        touch-action: pan-y;
      }
      
      .touch-pinch-zoom {
        touch-action: pinch-zoom;
      }
      
      .touch-none {
        touch-action: none;
      }
      
      /* Optimize scrolling on mobile */
      .smooth-scroll {
        -webkit-overflow-scrolling: touch;
        scroll-behavior: smooth;
      }
      
      /* Improve tap highlighting */
      .no-tap-highlight {
        -webkit-tap-highlight-color: transparent;
        -webkit-touch-callout: none;
        -webkit-user-select: none;
        -khtml-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
      }
      
      /* Better button touch targets */
      .touch-target {
        min-height: 44px;
        min-width: 44px;
      }
    `;
    
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);
}