# Loading Indicators - Testing Guide

## Prerequisites

- Application running on `http://localhost:5000`
- Browser with DevTools open
- At least one data model with objects created

## Test Suite

### Test 1: Initial Page Load

**Steps**:
1. Open browser in incognito/private mode
2. Navigate to `http://localhost:5000/modeler`
3. Observe loading behavior

**Expected Results**:
- ✅ Full-screen loading overlay appears immediately
- ✅ Shows "Loading modeler workspace..." message
- ✅ Spinner is animated (rotating)
- ✅ Backdrop has blur effect
- ✅ Overlay disappears once data loads (1-3 seconds)
- ✅ Page becomes interactive after overlay disappears

**Success Criteria**:
- No blank screen during load
- Smooth fade-out transition
- All queries complete before overlay hides

---

### Test 2: Layer Switching - Normal Speed

**Steps**:
1. Ensure you're on a model with objects in Conceptual layer
2. Click the "Logical" layer button in LayerNavigator
3. Observe the loading indicators

**Expected Results**:
- ✅ "Switching to logical..." indicator appears at top-center
- ✅ Indicator shows layer name and "Loading canvas data" subtitle
- ✅ Canvas shows loading overlay: "Loading logical layer..."
- ✅ Both indicators appear simultaneously
- ✅ Canvas updates with logical layer data
- ✅ Layer switching indicator fades out after ~1 second
- ✅ Canvas loading overlay disappears when data loads

**Success Criteria**:
- Clear visual feedback during transition
- No UI freezing
- Smooth animations
- Proper stacking order (indicators on top)

---

### Test 3: Rapid Layer Switching

**Steps**:
1. Quickly switch between layers multiple times:
   - Conceptual → Logical → Physical → Conceptual
2. Do this rapidly (within 2-3 seconds)
3. Observe behavior

**Expected Results**:
- ✅ Each switch triggers the indicator
- ✅ Indicators update to show current target layer
- ✅ No "stuck" indicators
- ✅ Final layer loads correctly
- ✅ UI remains responsive

**Success Criteria**:
- No race conditions
- Indicators clear properly
- Latest layer switch wins
- No JavaScript errors in console

---

### Test 4: Layer Switching with No Data

**Steps**:
1. Switch to a layer that has no objects
2. Observe loading behavior

**Expected Results**:
- ✅ Loading indicators still appear
- ✅ Canvas shows empty state after loading
- ✅ Indicators disappear normally
- ✅ No error messages

**Success Criteria**:
- Handles empty state gracefully
- Loading UX consistent with data present

---

### Test 5: Mobile Responsive - Initial Load

**Device**: Mobile phone or Chrome DevTools mobile emulation

**Steps**:
1. Resize browser to mobile width (< 768px)
2. Hard refresh the page (Ctrl+Shift+R)
3. Observe loading overlay

**Expected Results**:
- ✅ Loading overlay fits screen properly
- ✅ Text is readable on small screen
- ✅ Spinner is appropriately sized
- ✅ No horizontal scrolling during load

**Success Criteria**:
- Responsive design works correctly
- Touch-friendly sizes
- Proper mobile viewport handling

---

### Test 6: Mobile Responsive - Layer Switching

**Device**: Mobile phone or Chrome DevTools mobile emulation

**Steps**:
1. In mobile view, open a model
2. Switch layers using mobile layer controls
3. Observe indicators

**Expected Results**:
- ✅ Layer switching indicator visible at top
- ✅ Doesn't overlap with mobile controls
- ✅ Canvas loading overlay covers canvas area
- ✅ Touch interactions remain possible after loading

**Success Criteria**:
- Mobile-specific layout respected
- No UI overlap issues
- Touch targets remain accessible

---

### Test 7: Performance - Multiple Objects

**Setup**: Model with 20+ objects

**Steps**:
1. Open model with many objects
2. Switch to different layer
3. Measure loading time

**Expected Results**:
- ✅ Loading indicators appear immediately (<100ms)
- ✅ Data loads within reasonable time (1-5 seconds)
- ✅ UI remains responsive during load
- ✅ No memory leaks or performance degradation

**Success Criteria**:
- Consistent performance with many objects
- No UI blocking
- Browser remains responsive

---

### Test 8: Browser Refresh During Layer Switch

**Steps**:
1. Click a layer button
2. Immediately refresh the page (F5)
3. Observe behavior

**Expected Results**:
- ✅ Page reloads normally
- ✅ Initial page load indicator shows
- ✅ No "stuck" layer switching indicator
- ✅ Restores to last saved state

**Success Criteria**:
- Clean state reset on refresh
- No lingering indicators
- Proper initialization

---

### Test 9: Network Throttling

**Setup**: Chrome DevTools → Network → Throttling → Slow 3G

**Steps**:
1. Enable network throttling
2. Switch layers
3. Observe extended loading time

**Expected Results**:
- ✅ Loading indicators remain visible longer
- ✅ Indicators stay until data actually loads
- ✅ No timeout errors
- ✅ Proper completion even with slow network

**Success Criteria**:
- Handles slow connections gracefully
- Indicators don't disappear prematurely
- User informed of ongoing loading

---

### Test 10: Accessibility - Keyboard Navigation

**Steps**:
1. Navigate using Tab key only
2. Use keyboard to switch layers
3. Observe loading indicators

**Expected Results**:
- ✅ Loading indicators visible with keyboard nav
- ✅ Focus returns to correct element after load
- ✅ Screen reader announces loading state (if tested)
- ✅ No keyboard traps during loading

**Success Criteria**:
- Keyboard-accessible throughout
- Focus management correct
- No accessibility violations

---

## Browser Testing Matrix

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | Latest | ✅ |
| Firefox | Latest | ✅ |
| Safari | Latest | ✅ |
| Edge | Latest | ✅ |
| Mobile Safari | iOS 15+ | ✅ |
| Chrome Mobile | Android | ✅ |

---

## Console Checks

### Expected Logs

When switching layers, you should see:
```
🔍 Layer changed to: logical
📥 Loading canvas data: X nodes, Y edges
✅ Canvas data loaded successfully
```

### Should NOT See

❌ Errors about unmounted components  
❌ Memory leak warnings  
❌ Unhandled promise rejections  
❌ React key warnings  
❌ Race condition errors

---

## Visual Regression Checks

### Before Loading
- Empty or previous layer data visible

### During Loading
- Full-screen or overlay with spinner
- Backdrop blur effect visible
- Text clearly readable
- Spinner smoothly animated

### After Loading
- Indicators fade out smoothly
- No visual artifacts
- Data rendered correctly
- No layout shifts

---

## Edge Cases

### ✅ Covered
- Rapid layer switching
- Empty layers
- Large datasets
- Slow networks
- Browser refresh
- Mobile devices

### 🔄 To Monitor
- Multiple browser tabs open
- Background tab switching
- System sleep/wake
- Network disconnect/reconnect

---

## Debugging Tips

### Indicator Doesn't Show
1. Check browser console for errors
2. Verify event listener registered:
   ```javascript
   console.log('Event listeners:', window.getEventListeners);
   ```
3. Check React DevTools state

### Indicator Doesn't Hide
1. Check setTimeout is called
2. Verify cleanup on unmount
3. Check currentLayer dependency

### Performance Issues
1. Use React DevTools Profiler
2. Check Network tab for slow requests
3. Monitor memory usage in Performance tab

---

## Automated Testing (Future)

### Unit Tests
```typescript
describe('LoadingOverlay', () => {
  it('renders with message', () => {});
  it('shows correct size', () => {});
  it('handles fullScreen prop', () => {});
});

describe('LayerSwitchingIndicator', () => {
  it('shows when visible', () => {});
  it('hides when not visible', () => {});
  it('displays target layer', () => {});
});
```

### Integration Tests
```typescript
describe('Layer Switching', () => {
  it('shows indicator on layer switch', () => {});
  it('hides indicator after load', () => {});
  it('handles rapid switching', () => {});
});
```

---

## Sign-off Checklist

- [ ] All 10 manual tests pass
- [ ] No console errors
- [ ] Works on all target browsers
- [ ] Mobile responsive
- [ ] Accessibility verified
- [ ] Performance acceptable
- [ ] Documentation complete
- [ ] Code reviewed
- [ ] Ready for production

---

## Quick Test Command

**Fast verification** (recommended before each commit):
```bash
# 1. Start dev server
npm run dev

# 2. Open browser
$BROWSER http://localhost:5000/modeler

# 3. Quick checks:
#    - Refresh page → loading overlay shows
#    - Switch layers → indicators show
#    - Works on mobile view
```

---

**Testing Status**: Ready for QA 🧪
**Last Updated**: October 13, 2025
