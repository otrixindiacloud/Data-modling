import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { ModelLayer, CanvasNode, CanvasEdge, AISuggestion, DataSourceConnection } from "@/types/modeler";
import { DataModel, DataObject, Attribute, Relationship, DataDomain, DataArea } from "@shared/schema";

interface HistoryEntry {
  id: string;
  timestamp: Date;
  action: 'node_moved' | 'node_added' | 'node_deleted' | 'edge_added' | 'edge_deleted' | 'initial';
  description: string;
  nodeCount: number;
  edgeCount: number;
  preview?: string;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

const findRootModel = (model: DataModel | null, models: DataModel[]): DataModel | null => {
  if (!model) return null;

  let current: DataModel | null = model;
  const visited = new Set<number>();

  while (current?.parentModelId) {
    if (visited.has(current.parentModelId)) {
      break;
    }

    visited.add(current.parentModelId);
    const parent = models.find((m) => m.id === current?.parentModelId) ?? null;
    if (!parent) {
      break;
    }
    current = parent;
  }

  return current ?? model;
};

const getModelFamily = (root: DataModel | null, models: DataModel[]): DataModel[] => {
  if (!root) return [];

  const family: DataModel[] = [];
  const visited = new Set<number>();
  const queue: DataModel[] = [root];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current.id)) continue;

    visited.add(current.id);
    family.push(current);

    const children = models.filter((model) => model.parentModelId === current.id);
    queue.push(...children);
  }

  return family;
};

const buildModelMap = (models: DataModel[]): Map<number, DataModel> => {
  return models.reduce((map, model) => {
    map.set(model.id, model);
    return map;
  }, new Map<number, DataModel>());
};

const resolveLayerModel = (
  layer: ModelLayer,
  currentModel: DataModel | null,
  family: DataModel[],
  modelMap: Map<number, DataModel>
): DataModel | null => {
  const candidates = family.filter((model) => model.layer === layer);
  if (candidates.length === 0) {
    return null;
  }

  if (currentModel) {
    const currentLineage = new Set<number>();
    let lineageNode: DataModel | null | undefined = currentModel;

    while (lineageNode) {
      if (currentLineage.has(lineageNode.id)) {
        break;
      }

      currentLineage.add(lineageNode.id);
      if (!lineageNode.parentModelId) {
        break;
      }
      lineageNode = modelMap.get(lineageNode.parentModelId) ?? null;
    }

    const branchMatch = candidates.find((candidate) => {
      let pointer: DataModel | null | undefined = candidate;
      while (pointer) {
        if (currentLineage.has(pointer.id)) {
          return true;
        }
        if (!pointer.parentModelId) {
          break;
        }
        pointer = modelMap.get(pointer.parentModelId) ?? null;
      }
      return false;
    });

    if (branchMatch) {
      return branchMatch;
    }
  }

  return candidates[0];
};

interface ModelerState {
  // Current model
  currentModel: DataModel | null;
  currentLayer: ModelLayer;
  allModels: DataModel[];
  
  // Canvas state
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  selectedNodeId: string | null;
  selectedObjectId: number | null; // Add this to match EnhancedPropertiesPanel expectations
  selectedEdgeId: string | null;
  selectedAttributeId: number | null;
  
  // Data
  domains: DataDomain[];
  dataAreas: DataArea[];
  dataSources: DataSourceConnection[];
  
  // UI state
  showExportModal: boolean;
  showAddSourceModal: boolean;
  aiSuggestions: AISuggestion[];
  
  // History for undo/redo
  history: HistoryEntry[];
  historyIndex: number;
  
  // Actions
  setCurrentModel: (model: DataModel | null) => void;
  setCurrentLayer: (layer: ModelLayer) => void;
  getCurrentLayerModel: () => DataModel | null;
  setAllModels: (models: DataModel[]) => void;
  requireModelBeforeAction: (message?: string) => boolean;
  
  // Canvas actions
  setNodes: (nodes: CanvasNode[]) => void;
  setEdges: (edges: CanvasEdge[]) => void;
  addNode: (node: CanvasNode) => void;
  updateNode: (nodeId: string, updates: Partial<CanvasNode>) => void;
  deleteNode: (nodeId: string) => void;
  addEdge: (edge: CanvasEdge) => void;
  updateEdge: (edgeId: string, updates: Partial<CanvasEdge>) => void;
  deleteEdge: (edgeId: string) => void;
  
  // Selection
  selectNode: (nodeId: string | null) => void;
  selectEdge: (edgeId: string | null) => void;
  selectAttribute: (attributeId: number | null) => void;
  selectObject: (objectId: number | null) => void;
  
  // Data actions
  setDomains: (domains: DataDomain[]) => void;
  setDataAreas: (areas: DataArea[]) => void;
  setDataSources: (sources: DataSourceConnection[]) => void;
  
  // UI actions
  setShowExportModal: (show: boolean) => void;
  setShowAddSourceModal: (show: boolean) => void;
  setAISuggestions: (suggestions: AISuggestion[]) => void;
  
  // History actions
  saveToHistory: (action: string, description: string, preview?: string) => void;
  undo: () => void;
  redo: () => void;
  clearHistory: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

export const useModelerStore = create<ModelerState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    currentModel: null,
    currentLayer: "conceptual",
  allModels: [],
    nodes: [],
    edges: [],
    selectedNodeId: null,
    selectedObjectId: null,
    selectedEdgeId: null,
    selectedAttributeId: null,
    domains: [],
    dataAreas: [],
    dataSources: [],
    showExportModal: false,
    showAddSourceModal: false,
    aiSuggestions: [],
    history: [],
    historyIndex: -1,

    // Model actions
    setCurrentModel: (model) =>
      set((state) => {
        if (!model) {
          return { currentModel: null };
        }

        const models = state.allModels || [];
        if (models.length === 0) {
          return {
            currentModel: model,
            currentLayer: (model.layer as ModelLayer | undefined) ?? state.currentLayer,
          };
        }

        const modelMap = buildModelMap(models);
        const rootModel = findRootModel(model, models) ?? model;
        const family = getModelFamily(rootModel, models);

        const preferredLayer = state.currentLayer;
        const preferredModel = resolveLayerModel(preferredLayer, model, family, modelMap);

        if (preferredModel) {
          return {
            currentModel: preferredModel,
            currentLayer: preferredModel.layer as ModelLayer,
          };
        }

        return {
          currentModel: model,
          currentLayer: (model.layer as ModelLayer | undefined) ?? state.currentLayer,
        };
      }),
    setCurrentLayer: (layer) =>
      set((state) => {
        const models = state.allModels || [];
        const modelMap = buildModelMap(models);
        const rootModel = findRootModel(state.currentModel, models) ?? state.currentModel;
        const family = getModelFamily(rootModel, models);
        const targetModel = resolveLayerModel(layer, state.currentModel, family, modelMap) ?? rootModel ?? state.currentModel;
        const resolvedLayer = (targetModel?.layer as ModelLayer | undefined) ?? layer;

        return {
          currentLayer: resolvedLayer,
          currentModel: targetModel ?? null,
        };
      }),
    setAllModels: (models) => {
      if (typeof window !== "undefined") {
        (window as any).__allModels = models;
      }
      set({ allModels: models });
    },
    requireModelBeforeAction: (message = "Select a data model to continue") => {
      const state = get();
      if (!state.currentModel) {
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("modelRequired", {
              detail: { message },
            })
          );
        }
        return false;
      }
      return true;
    },
    getCurrentLayerModel: () => {
      const state = get();
      if (!state.currentModel) return null;

      const models = state.allModels || [];
      const modelMap = buildModelMap(models);
      const rootModel = findRootModel(state.currentModel, models) ?? state.currentModel;
      const familyModels = getModelFamily(rootModel, models);

      return (
        resolveLayerModel(state.currentLayer, state.currentModel, familyModels, modelMap) ??
        rootModel ??
        state.currentModel
      );
    },

    // Canvas actions
    setNodes: (nodes) => set({ nodes }),
    setEdges: (edges) => set({ edges }),
    
    addNode: (node) =>
      set((state) => {
        const newState = { nodes: [...state.nodes, node] };
        return newState;
      }),

    updateNode: (nodeId, updates) =>
      set((state) => ({
        nodes: state.nodes.map((node) =>
          node.id === nodeId ? { ...node, ...updates } : node
        ),
      })),

    deleteNode: (nodeId) =>
      set((state) => ({
        nodes: state.nodes.filter((node) => node.id !== nodeId),
        edges: state.edges.filter(
          (edge) => edge.source !== nodeId && edge.target !== nodeId
        ),
        selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId,
      })),

    addEdge: (edge) =>
      set((state) => ({
        edges: [...state.edges, edge],
      })),

    updateEdge: (edgeId, updates) =>
      set((state) => ({
        edges: state.edges.map((edge) =>
          edge.id === edgeId ? { ...edge, ...updates } : edge
        ),
      })),

    deleteEdge: (edgeId) =>
      set((state) => ({
        edges: state.edges.filter((edge) => edge.id !== edgeId),
        selectedEdgeId: state.selectedEdgeId === edgeId ? null : state.selectedEdgeId,
      })),

    // Selection actions
    selectNode: (nodeId) =>
      set((state) => { 
        // When selecting a node, also set selectedObjectId by extracting from nodes data
        const selectedNode = state.nodes.find(n => n.id === nodeId);
        const objectId = selectedNode?.data?.objectId || null;
        return { 
          selectedNodeId: nodeId, 
          selectedObjectId: objectId,
          selectedEdgeId: null, 
          selectedAttributeId: null 
        };
      }),

    selectEdge: (edgeId) =>
      set({ selectedEdgeId: edgeId, selectedNodeId: null, selectedAttributeId: null }),

    selectAttribute: (attributeId) =>
      set({ selectedAttributeId: attributeId, selectedNodeId: null, selectedEdgeId: null }),

    selectObject: (objectId) =>
      set({ selectedObjectId: objectId, selectedNodeId: null, selectedEdgeId: null, selectedAttributeId: null }),

    // Data actions
    setDomains: (domains) => set({ domains }),
    setDataAreas: (areas) => set({ dataAreas: areas }),
    setDataSources: (sources) => set({ dataSources: sources }),

    // UI actions
    setShowExportModal: (show) => set({ showExportModal: show }),
    setShowAddSourceModal: (show) => set({ showAddSourceModal: show }),
    setAISuggestions: (suggestions) => set({ aiSuggestions: suggestions }),

    // History actions
    saveToHistory: (action, description, preview) =>
      set((state) => {
        const historyEntry: HistoryEntry = {
          id: `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date(),
          action: action as any,
          description,
          nodeCount: state.nodes.length,
          edgeCount: state.edges.length,
          preview,
          nodes: [...state.nodes],
          edges: [...state.edges],
        };
        
        // Remove any future history if we're not at the end
        const newHistory = state.history.slice(0, state.historyIndex + 1);
        newHistory.push(historyEntry);
        
        // Limit history size
        const maxHistorySize = 50;
        if (newHistory.length > maxHistorySize) {
          newHistory.shift();
        }
        
        const newIndex = newHistory.length - 1;
        
        return {
          history: newHistory,
          historyIndex: newIndex,
        };
      }),

    undo: () =>
      set((state) => {
        if (state.historyIndex > 0) {
          const previousState = state.history[state.historyIndex - 1];
          const newIndex = state.historyIndex - 1;
          return {
            nodes: [...previousState.nodes],
            edges: [...previousState.edges],
            historyIndex: newIndex,
          };
        }
        return state;
      }),

    redo: () =>
      set((state) => {
        if (state.historyIndex < state.history.length - 1) {
          const nextState = state.history[state.historyIndex + 1];
          const newIndex = state.historyIndex + 1;
          return {
            nodes: [...nextState.nodes],
            edges: [...nextState.edges],
            historyIndex: newIndex,
          };
        }
        return state;
      }),

    // Clear history when switching models or loading new data
    clearHistory: () =>
      set({
        history: [],
        historyIndex: -1,
      }),

    // Computed getters for undo/redo state
    canUndo: () => {
      const state = get();
      return state.historyIndex > 0;
    },

    canRedo: () => {
      const state = get();
      return state.historyIndex < state.history.length - 1;
    },
  }))
);
