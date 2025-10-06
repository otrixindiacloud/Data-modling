# IMMEDIATE TESTING STEPS - Auto-Save Debug

## 🔴 CRITICAL: Please Follow These Steps Exactly

### Step 1: Open Browser Console
1. Open your application in Chrome/Edge/Firefox
2. Press `F12` to open DevTools
3. Click on the **Console** tab
4. Clear any existing logs (click the 🚫 clear button)

### Step 2: Navigate to Modeler
1. Go to the modeler page
2. **Look for this log:**
   ```
   🎨 CanvasComponent MOUNTED/RENDERED
   ```
   - ✅ If you see this, the component is loading
   - ❌ If you DON'T see this, the component isn't rendering

### Step 3: Select a Model
1. Use the model picker dropdown to select a model
2. **Look for logs about canvas loading:**
   ```
   📥 Loading canvas data: X nodes, Y edges
   🔍 Node 0: { id, name, modelObjectId, objectId, position }
   ```

### Step 4: Test Node Movement
1. **Click and drag** any existing object on the canvas
2. **Move it** to a different position
3. **Release the mouse** (very important - must release!)
4. **IMMEDIATELY look at console** - you should see:
   ```
   🚨 handleNodesChange CALLED - TOP OF FUNCTION
   ```
   
   - ✅ **If you see this:** The handler IS being called - continue to Step 5
   - ❌ **If you DON'T see this:** The handler is NOT being called - see "Handler Not Called" section below

### Step 5: Check What Happens Next

If you saw the `🚨` log, look for the sequence:

```
🚨 handleNodesChange CALLED - TOP OF FUNCTION
🔄 handleNodesChange called: { changesCount: X, ... }
📍 Position changes detected: { count: X, ... }
💾 AUTO-SAVE: Starting position save process
⏰ Timeout fired, starting save...
📦 Current nodes count: X
✅ Valid nodes for save: X
📍 Position payload for node: { ... }
🎯 Saving positions: { ... }
🚀 savePositionsMutation called: { ... }
📡 Server response: { status: 200, ok: true }
✅ Save successful
✨ onSuccess called
```

**Where does it stop?** This tells us exactly what's failing.

## ❌ Problem: Handler Not Called

If you move an object and **DON'T see** `🚨 handleNodesChange CALLED`, this means:

1. **React Flow is not triggering the handler**
2. **OR the component is not using the correct handler**

### Debug This:
1. Check if you're in the correct page (modeler page)
2. Try dragging different objects
3. Try dragging vs clicking
4. Check if there are any **React errors** in console (red text)
5. Take a screenshot of the **entire console** and share it

## ✅ Problem: Handler Called But No Save

If you see `🚨` but the save doesn't complete, look for:

### A. No Position Changes Detected
```
📍 Position changes detected: { count: 0 }
```
**Fix:** Make sure you **release the drag**. If you're still holding the mouse, it won't trigger.

### B. No Valid Nodes
```
❌ No valid nodes to save!
```
**Fix:** Nodes are missing `modelObjectId`. Check the earlier logs:
```
🔍 Node X: { ..., modelObjectId: undefined, ... }
```

### C. No Model Selected
```
❌ Cannot save - missing requirements: { targetModelId: undefined }
```
**Fix:** Select a model from the dropdown first.

### D. Server Error
```
❌ Save failed: ...
```
**Fix:** Check server logs for the actual error.

## 📸 What to Share

Please share:
1. **Screenshot of the entire browser console** after moving an object
2. **The first log you see** when opening the page
3. **Any red errors** in the console
4. **Whether you see the** `🚨` **log or not**

This will tell me exactly what's happening!

## ⚡ Quick Test Script

Copy/paste this into the browser console after the page loads:

```javascript
console.log('=== MANUAL TEST START ===');
console.log('Current model:', window.__REACT_DEVTOOLS_GLOBAL_HOOK__ ? 'React loaded' : 'React NOT loaded');
console.log('=== Try moving an object now and watch for logs ===');
```

Then move an object and watch what happens.
