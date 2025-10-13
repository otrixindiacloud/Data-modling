# Loading Indicators - Quick Reference

## Overview

Visual feedback for layer switching and page loading.

## Components

### 1. LoadingOverlay
**File**: `/client/src/components/LoadingOverlay.tsx`

**Usage**:
```tsx
<LoadingOverlay 
  message="Loading..."
  size="md"        // "sm" | "md" | "lg"
  fullScreen={false}
/>
```

**Props**:
- `message` (optional): Loading text
- `size` (optional): Spinner size - default `"md"`
- `fullScreen` (optional): Cover entire viewport - default `false`

### 2. LayerSwitchingIndicator
**File**: `/client/src/components/LayerSwitchingIndicator.tsx`

**Usage**:
```tsx
<LayerSwitchingIndicator 
  isVisible={true}
  targetLayer="logical"
/>
```

**Props**:
- `isVisible`: Show/hide indicator
- `targetLayer` (optional): Layer name to display

## Implementations

### Canvas Loading
**Location**: `Canvas.tsx`

Shows when fetching layer data:
```tsx
{isLoading && (
  <LoadingOverlay 
    message={`Loading ${currentLayer} layer...`}
    size="md"
  />
)}
```

### Page Loading
**Location**: `modeler.tsx`

Shows on initial page load:
```tsx
{isPageLoading && (
  <LoadingOverlay 
    message="Loading modeler workspace..."
    size="lg"
    fullScreen={true}
  />
)}
```

### Layer Switching
**Location**: `modeler.tsx`

Shows during layer transitions:
```tsx
<LayerSwitchingIndicator 
  isVisible={isLayerSwitching} 
  targetLayer={targetLayer}
/>
```

## Event Flow

### Triggering Layer Switch Indicator

1. **LayerNavigator** dispatches event:
```tsx
window.dispatchEvent(new CustomEvent("layerSwitchStart", {
  detail: { targetLayer: "logical" }
}));
```

2. **ModelerPage** listens and shows indicator:
```tsx
useEffect(() => {
  const handleLayerSwitchStart = (event: CustomEvent) => {
    setIsLayerSwitching(true);
    setTargetLayer(event.detail?.targetLayer);
  };
  
  window.addEventListener('layerSwitchStart', handleLayerSwitchStart);
  return () => window.removeEventListener('layerSwitchStart', handleLayerSwitchStart);
}, []);
```

3. **Auto-hide after 1 second**:
```tsx
useEffect(() => {
  if (isLayerSwitching) {
    const timer = setTimeout(() => {
      setIsLayerSwitching(false);
      setTargetLayer(undefined);
    }, 1000);
    return () => clearTimeout(timer);
  }
}, [currentLayer, isLayerSwitching]);
```

## Testing Checklist

- [ ] Initial page load shows loading overlay
- [ ] Layer switching shows indicator at top
- [ ] Canvas shows loading when fetching data
- [ ] Indicators auto-hide after loading completes
- [ ] No flickering or stuck indicators
- [ ] Mobile responsive
- [ ] Accessible (screen readers)

## Customization

### Change Loading Message
```tsx
<LoadingOverlay message="Custom loading message..." />
```

### Adjust Auto-hide Duration
```tsx
// In modeler.tsx, change timeout duration:
setTimeout(() => {
  setIsLayerSwitching(false);
}, 2000); // 2 seconds instead of 1
```

### Modify Styles
Edit component files directly:
- `LoadingOverlay.tsx` - backdrop, card, spinner
- `LayerSwitchingIndicator.tsx` - position, animation

## Troubleshooting

### Indicator Doesn't Show
- Check event is being dispatched
- Verify event listener is registered
- Ensure state updates correctly

### Indicator Doesn't Hide
- Check setTimeout is being called
- Verify cleanup function runs on unmount
- Ensure currentLayer dependency is correct

### Loading Overlay Blocks UI
- Set `fullScreen={false}` for non-blocking
- Use relative positioning instead of fixed

---

**Quick Access Files**:
- Components: `/client/src/components/LoadingOverlay.tsx`, `LayerSwitchingIndicator.tsx`
- Usage: `/client/src/pages/modeler.tsx`, `/client/src/components/Canvas.tsx`
- Docs: `/docs/loading-indicators-implementation.md`
