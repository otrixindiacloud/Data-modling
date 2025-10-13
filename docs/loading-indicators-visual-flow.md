# Loading Indicators - Visual Flow Diagrams

## 1. Initial Page Load Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     User Opens /modeler                          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              ModelerPage Component Mounts                        │
│  • Triggers React Query for domains, sources, areas, models     │
│  • isPageLoading = true                                          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              🔄 LoadingOverlay (Full-Screen)                     │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                                                             │  │
│  │              ⭕ Loading spinner                             │  │
│  │         "Loading modeler workspace..."                     │  │
│  │                                                             │  │
│  └───────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              All Queries Complete                                │
│  • domains loaded                                                │
│  • sources loaded                                                │
│  • areas loaded                                                  │
│  • models loaded                                                 │
│  • isPageLoading = false                                         │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              ✅ Overlay Fades Out                                │
│              Modeler Interface Fully Loaded                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Layer Switching Flow

```
┌─────────────────────────────────────────────────────────────────┐
│        User Clicks "Logical" Layer Button                        │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              LayerNavigator Component                            │
│  • Dispatches "layerSwitchStart" event                           │
│  • Detail: { targetLayer: "logical" }                            │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              ModelerPage Event Listener                          │
│  • setIsLayerSwitching(true)                                     │
│  • setTargetLayer("logical")                                     │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│         🔄 LayerSwitchingIndicator Appears (Top Center)          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  ⭕ 📊  Switching to logical...                            │  │
│  │         Loading canvas data                                │  │
│  └───────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              setCurrentLayer("logical")                          │
│  • Updates Zustand store                                         │
│  • currentLayer = "logical"                                      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              React Query Detects Change                          │
│  • Query key changes:                                            │
│    ["/api/models", modelId, "canvas", "logical"]                 │
│  • Triggers refetch                                              │
│  • Canvas isLoading = true                                       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│         🔄 Canvas LoadingOverlay Appears                         │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                                                             │  │
│  │              ⭕ Loading logical layer...                    │  │
│  │                                                             │  │
│  └───────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              API Request to Server                               │
│  GET /api/models/:id/canvas?layer=logical                        │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              Server Responds with Data                           │
│  • Nodes with logical layer positions                            │
│  • Edges (relationships)                                         │
│  • Metadata                                                      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              Canvas Updates                                      │
│  • Renders logical layer nodes                                   │
│  • Applies positions from data_model_layer_objects               │
│  • isLoading = false                                             │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              ✅ Canvas LoadingOverlay Fades Out                  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              After 1 Second                                      │
│  • setTimeout completes                                          │
│  • setIsLayerSwitching(false)                                    │
│  • setTargetLayer(undefined)                                     │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│         ✅ LayerSwitchingIndicator Fades Out                     │
│              Layer Switch Complete                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Component Hierarchy

```
ModelerPage
│
├── LoadingOverlay (full-screen, page load)
│   └── Shows: "Loading modeler workspace..."
│
├── LayerSwitchingIndicator (top-center, transitions)
│   └── Shows: "Switching to [layer]..."
│
├── TopNavBar
│
└── Canvas
    │
    ├── LoadingOverlay (canvas area, data fetch)
    │   └── Shows: "Loading [layer] layer..."
    │
    └── ReactFlow
        ├── Nodes (data objects)
        └── Edges (relationships)
```

---

## 4. State Management

```
┌─────────────────────────────────────────────────────────────────┐
│                     ModelerPage State                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Page Loading:                                                   │
│  ├─ isLoadingDomains: boolean                                    │
│  ├─ isLoadingDataSources: boolean                                │
│  ├─ isLoadingDataAreas: boolean                                  │
│  ├─ isLoadingModels: boolean                                     │
│  └─ isPageLoading: boolean (computed)                            │
│                                                                   │
│  Layer Switching:                                                │
│  ├─ isLayerSwitching: boolean                                    │
│  └─ targetLayer: string | undefined                              │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     Canvas State                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Data Loading:                                                   │
│  ├─ isLoading: boolean (from React Query)                        │
│  └─ canvasData: object | null                                    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                   Zustand Store (Global)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ├─ currentLayer: ModelLayer                                     │
│  ├─ currentModel: DataModel | null                               │
│  └─ setCurrentLayer: (layer) => void                             │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Event Communication

```
LayerNavigator                ModelerPage                  Canvas
     │                            │                          │
     │                            │                          │
     │ User clicks layer button   │                          │
     ├────────────────────────────┼──────────────────────────┤
     │                            │                          │
     │ Dispatch "layerSwitchStart"│                          │
     ├───────────────────────────>│                          │
     │                            │                          │
     │                            │ Show LayerSwitchingIndicator
     │                            │                          │
     │ setCurrentLayer("logical") │                          │
     ├───────────────────────────>│                          │
     │                            │                          │
     │                            │ React Query refetch      │
     │                            ├─────────────────────────>│
     │                            │                          │
     │                            │                    Canvas.isLoading = true
     │                            │                          │
     │                            │                    Show LoadingOverlay
     │                            │                          │
     │                            │        Data arrives      │
     │                            │<─────────────────────────┤
     │                            │                          │
     │                            │                    Canvas.isLoading = false
     │                            │                          │
     │                            │                    Hide LoadingOverlay
     │                            │                          │
     │                      After 1 second                   │
     │                            │                          │
     │                      Hide LayerSwitchingIndicator     │
     │                            │                          │
```

---

## 6. Visual States

### State 1: Normal (No Loading)
```
┌─────────────────────────────────────────────────────┐
│              TopNavBar                              │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─────────┐  ┌──────────────────────┐  ┌────────┐│
│  │  Data   │  │      Canvas          │  │  Props ││
│  │ Explorer│  │   (Objects & Edges)  │  │  Panel ││
│  │         │  │                      │  │        ││
│  └─────────┘  └──────────────────────┘  └────────┘│
│                                                     │
└─────────────────────────────────────────────────────┘
```

### State 2: Page Loading
```
┌─────────────────────────────────────────────────────┐
│              TopNavBar                              │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ╔═══════════════════════════════════════════════╗ │
│  ║                                               ║ │
│  ║           [LOADING OVERLAY]                   ║ │
│  ║                                               ║ │
│  ║              ⭕ Spinning                       ║ │
│  ║       "Loading modeler workspace..."          ║ │
│  ║                                               ║ │
│  ║         [Backdrop blur effect]                ║ │
│  ║                                               ║ │
│  ╚═══════════════════════════════════════════════╝ │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### State 3: Layer Switching
```
┌─────────────────────────────────────────────────────┐
│              TopNavBar                              │
├─────────────────────────────────────────────────────┤
│         ┌─────────────────────────┐                 │
│         │ ⭕ 📊 Switching to      │  ← Toast Style  │
│         │ logical...              │                 │
│         │ Loading canvas data     │                 │
│         └─────────────────────────┘                 │
│                                                     │
│  ┌─────────┐  ┌──────────────────────┐  ┌────────┐│
│  │  Data   │  │  [Canvas Loading]    │  │  Props ││
│  │ Explorer│  │   ⭕ Loading         │  │  Panel ││
│  │         │  │   logical layer...   │  │        ││
│  └─────────┘  └──────────────────────┘  └────────┘│
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 7. Timeline Visualization

```
Time    Page Load    Layer Switch    Canvas Load
─────────────────────────────────────────────────
0ms     ████████     
100ms   ████████     
200ms   ████████     
300ms   ████████     
500ms   ████████     
1000ms  ████████     ████████        
1100ms  ⬜⬜⬜⬜     ████████        ████████
1200ms               ████████        ████████
1300ms               ████████        ████████
1500ms               ████████        ████████
2000ms               ⬜⬜⬜⬜        ⬜⬜⬜⬜

Legend:
████ = Indicator visible
⬜⬜ = Indicator hidden
```

---

## 8. Responsive Behavior

### Desktop (> 1280px)
```
┌────────────────────────────────────────────────────┐
│  [TopNavBar + Layer Buttons]                      │
├──────────┬─────────────────────────┬───────────────┤
│  Data    │    Canvas (main)        │  Properties  │
│ Explorer │    [Loading overlays    │    Panel     │
│  Panel   │     show here]          │              │
│          │                         │              │
└──────────┴─────────────────────────┴───────────────┘
```

### Tablet (768px - 1280px)
```
┌────────────────────────────────────────────────────┐
│  [TopNavBar + Layer Buttons]                      │
├──────────┬─────────────────────────────────────────┤
│  Data    │         Canvas (larger)                │
│ Explorer │    [Loading overlays show here]        │
│  Panel   │    [Properties in slide-out sheet]     │
│          │                                         │
└──────────┴─────────────────────────────────────────┘
```

### Mobile (< 768px)
```
┌────────────────────────────────────────────────────┐
│  [TopNavBar]                                       │
│  [Layer Selector (dropdown)]                       │
├────────────────────────────────────────────────────┤
│                                                    │
│          Canvas (full width)                       │
│      [Loading overlays show here]                  │
│                                                    │
│  [Data/Props in bottom sheets]                     │
└────────────────────────────────────────────────────┘
```

---

**Visual Guide Complete** 📊
