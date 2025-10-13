import React, { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  Controls,
  MiniMap,
  Background,
  Connection,
  NodeTypes,
  EdgeTypes,
  ReactFlowProvider,
  OnEdgesChange,
  EdgeChange,
} from "reactflow";
import "reactflow/dist/style.css";

import { MousePointer, Move, Link, GitBranch, Save, AlertCircle, CheckCircle, Plus, Trash2 } from "lucide-react";
import { useTouchPerformance, useDeviceCapabilities } from '@/hooks/useTouch';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useModelerStore } from "@/store/modelerStore";
import { DataModel } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import DataObjectNode from "./nodes/DataObjectNode";
import RelationshipEdge from "./edges/RelationshipEdge";
import OrthogonalRelationshipEdge from "./edges/OrthogonalRelationshipEdge";
import CanvasControls from "./CanvasControls";
import MiniMapControls from "./MiniMapControls";
import UndoRedoTimeline from "./UndoRedoTimeline";
import MiniMapLegend from "./MiniMapLegend";
import MiniMapOverlay from "./MiniMapOverlay";
import AISuggestionsPanel from "./AISuggestionsPanel";
import AttributeRelationshipModal from "./modals/AttributeRelationshipModal";
import EditRelationshipModal from "./modals/EditRelationshipModal";
import DataModelingToolbar from "./Canvas/DataModelingToolbar";
import RelationshipPreview from "./Canvas/RelationshipPreview";
import LayerNavigator from "./LayerNavigator";

import SearchFilterPanel from "./Canvas/SearchFilterPanel";
import AutoLayoutManager from "./Canvas/AutoLayoutManager";
import LoadingOverlay from "./LoadingOverlay";
import { updateDynamicColors } from "@/utils/colorUtils";
import type { ModelLayer, CanvasNode } from "@/types/modeler";

const isManyToManyRelationship = (type?: string | null): boolean =>
  type === "N:M" || type === "M:N";

const getRelationshipStrokeColor = (type?: string | null): string => {
  switch (type) {
    case "1:1":
      return "#10b981";
    case "1:N":
    case "N:1":
      return "#3b82f6";
    case "N:M":
    case "M:N":
      return "#8b5cf6";
    default:
      return "#8b5cf6";
  }
};

const buildRelationshipEdgeStyle = (type?: string | null, isAttribute = false) => ({
  stroke: getRelationshipStrokeColor(type),
  strokeWidth: 2,
  ...(isAttribute ? { strokeDasharray: "5,5" } : {}),
});

// Define nodeTypes outside component to avoid recreation warning
const nodeTypes: NodeTypes = {
  dataObject: DataObjectNode,
};

// Define custom edge types
const edgeTypes = {
  relationship: OrthogonalRelationshipEdge,
  step: OrthogonalRelationshipEdge, // Use orthogonal edge for step type (90-degree angles)
  smoothstep: OrthogonalRelationshipEdge, // Use orthogonal edge with visible draggable waypoints
};

function CanvasComponent() {
  // Initialize touch performance optimizations
  useTouchPerformance();
  const deviceCapabilities = useDeviceCapabilities();
  
  const { 
    nodes: storeNodes, 
    edges: storeEdges, 
    addEdge: storeAddEdge, 
    setNodes: setStoreNodes,
    setEdges: setStoreEdges,
    selectNode, 
    selectEdge, 
    selectObject,
    saveToHistory,
    currentModel,
    setCurrentModel,
    allModels,
    setAllModels,
    requireModelBeforeAction,
    currentLayer,
    getCurrentLayerModel: storeGetCurrentLayerModel,
    history,
    undo,
    redo,
    clearHistory,
    copyNodes,
    getCopiedNodes,
    clearCopiedNodes
  } = useModelerStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const nodesRef = useRef<Node[]>([]);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [showMiniMap, setShowMiniMap] = useState(true);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [connectionMode, setConnectionMode] = useState<'selection' | 'connection'>('selection');

  // Debug connection mode changes
  useEffect(() => {
    console.log("Connection mode changed to:", connectionMode);
  }, [connectionMode]);
  const [pendingConnection, setPendingConnection] = useState<{
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
  } | null>(null);
  const [showConnectionDialog, setShowConnectionDialog] = useState(false);
  const [relationshipType, setRelationshipType] = useState<'1:1' | '1:N' | 'N:M'>('1:N');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [showAISuggestions, setShowAISuggestions] = useState(false);
  const [showMobileGestures, setShowMobileGestures] = useState(false);
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [showAutoLayout, setShowAutoLayout] = useState(false);

  // Debug: Log save status changes
  useEffect(() => {
    console.log('🔔 ========== SAVE STATUS CHANGED ==========');
    console.log('🔔 New status:', saveStatus);
    console.log('🔔 Time:', new Date().toLocaleTimeString());
    console.log('🔔 Stack trace:', new Error().stack);
  }, [saveStatus]);

  // Broadcast save status changes to parent components
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("canvasSaveStatus", {
        detail: { status: saveStatus }
      }));
    }
  }, [saveStatus]);

  // New state for attribute relationship modal
  const [showAttributeRelationshipModal, setShowAttributeRelationshipModal] = useState(false);
  const [attributeConnection, setAttributeConnection] = useState<{
    sourceNode: any;
    targetNode: any;
    sourceHandle?: string;
    targetHandle?: string;
    sourceAttributeId?: number;
    targetAttributeId?: number;
  } | null>(null);
  
  // New state for editing existing relationships
  const [showEditRelationshipModal, setShowEditRelationshipModal] = useState(false);
  const [editingEdge, setEditingEdge] = useState<Edge | null>(null);
  const { fitView, zoomIn, zoomOut, getViewport, screenToFlowPosition } = useReactFlow();

  // Mutation for deleting objects
  const deleteObjectMutation = useMutation({
    mutationFn: async (objectId: number) => {
      const response = await fetch(`/api/objects/${objectId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete object: ${response.status}`);
      }
      
      // Handle 204 No Content response - no JSON to parse
      if (response.status === 204) {
        return null;
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Object Deleted",
        description: "The object has been removed from the model."
      });
      
      // Refresh canvas and objects list
      queryClient.invalidateQueries({ queryKey: ["/api/models", currentModel?.id, "canvas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/models", currentModel?.id, "objects"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete object. Please try again.",
        variant: "destructive"
      });
    }
  });

  type SavePositionsPayload = {
    positions: {
      modelObjectId?: number;
      objectId?: number;
      position: { x: number; y: number };
    }[];
    modelId: number;
    layer: ModelLayer;
  };

  const pendingSavePayloadRef = useRef<SavePositionsPayload | null>(null);
  const isSavePendingRef = useRef(false);

  const savePositionsMutation = useMutation({
    mutationFn: async ({ positions, modelId, layer }: SavePositionsPayload) => {
      const response = await fetch(`/api/models/${modelId}/canvas/positions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          positions,
          layer,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to save positions: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      return result;
    },
    onSuccess: (_, variables) => {
      setSaveStatus('saved');

      queryClient.setQueryData([
        "/api/models",
        variables.modelId,
        "canvas",
        variables.layer
      ], (existing: any) => {
        if (!existing || !Array.isArray(existing.nodes)) {
          return existing;
        }

        const updatedNodes = existing.nodes.map((node: any) => {
          const match = variables.positions.find((pos) => {
            const matchesModelObject = pos.modelObjectId != null && node?.data?.modelObjectId === pos.modelObjectId;
            const matchesObject = pos.objectId != null && node?.data?.objectId === pos.objectId;
            return matchesModelObject || matchesObject;
          });

          if (!match) {
            return node;
          }

          return {
            ...node,
            position: match.position,
          };
        });

        return {
          ...existing,
          nodes: updatedNodes,
        };
      });

      const queuedPayload = pendingSavePayloadRef.current;
      if (queuedPayload) {
        pendingSavePayloadRef.current = null;
        setTimeout(() => {
          setSaveStatus('saving');
          mutatePositions(queuedPayload);
        }, 0);
      } else {
        setTimeout(() => {
          if (!pendingSavePayloadRef.current && !isSavePendingRef.current) {
            setSaveStatus('idle');
          }
        }, 2000);
      }
    },
    onError: (error) => {
      console.error('Failed to save canvas positions:', error);
      setSaveStatus('error');
      // Clear error status after 5 seconds if nothing else is queued
      setTimeout(() => {
        if (!pendingSavePayloadRef.current && !isSavePendingRef.current) {
          setSaveStatus('idle');
        }
      }, 5000);
    }
  });

  useEffect(() => {
    isSavePendingRef.current = savePositionsMutation.isPending;
  }, [savePositionsMutation.isPending]);

  const mutatePositions = savePositionsMutation.mutate;

  // Mutation for saving relationships to database with enhanced error handling
  const saveRelationshipMutation = useMutation({
    mutationFn: async (relationshipData: { 
      sourceObjectId: number; 
      targetObjectId: number; 
      type: string; 
      modelId: number;
      sourceAttributeId?: number;
      targetAttributeId?: number;
      sourceHandle?: string | null;
      targetHandle?: string | null;
    }) => {
      setSaveStatus('saving'); // Show saving indicator
      
      const response = await fetch('/api/relationships', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(relationshipData),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to save relationship: ${response.status} ${errorText}`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000); // Clear after 2 seconds
      
      // Invalidate and refetch canvas data to ensure consistency
      queryClient.invalidateQueries({
        queryKey: ["/api/models", currentLayerModel?.id, "canvas", currentLayer]
      });
    },
    onError: (error) => {
      console.error('Failed to save relationship:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 5000);
    }
  });

  // nodeTypes are defined outside component to avoid recreation warning

  // Get all models to find the correct layer model
  const { data: allModelsQuery } = useQuery({
    queryKey: ["/api/models"],
  });

  useEffect(() => {
    if (Array.isArray(allModelsQuery)) {
      setAllModels(allModelsQuery as DataModel[]);
    }
  }, [allModelsQuery, setAllModels]);

  useEffect(() => {
    if (!currentModel && Array.isArray(allModels) && allModels.length > 0) {
      const modelsList = allModels as DataModel[];
      const conceptualModel = modelsList.find((model) =>
        model.layer === "conceptual" && (model.parentModelId === null || model.parentModelId === undefined)
      );

      setCurrentModel(conceptualModel ?? modelsList[0]);
    }
  }, [allModels, currentModel, setCurrentModel]);

  // Load systems, domains, and areas for color updates
  const { data: systems } = useQuery({
    queryKey: ["/api/sources"],
  });

  const { data: domains } = useQuery({
    queryKey: ["/api/domains"],
  });

  const { data: areas } = useQuery({
    queryKey: ["/api/areas"],
  });

  const currentLayerModel = useMemo(() => {
    if (!storeGetCurrentLayerModel) {
      return currentModel;
    }

    const resolved = storeGetCurrentLayerModel();

    if (!resolved && currentModel) {
      console.warn(`Layer model for ${currentLayer} not found, using current model`);
      return currentModel;
    }

    return resolved;
  }, [storeGetCurrentLayerModel, currentModel, currentLayer, allModels]);

  // Load canvas data when model or layer changes
  const { data: canvasData, isLoading } = useQuery({
    queryKey: ["/api/models", currentLayerModel?.id, "canvas", currentLayer],
    queryFn: async () => {
      if (!currentLayerModel?.id) return null;
      const response = await fetch(`/api/models/${currentLayerModel.id}/canvas?layer=${currentLayer}`);
      return response.json();
    },
    enabled: !!currentLayerModel?.id,
  });

  // Track loading state
  const [isDataLoading, setIsDataLoading] = useState(false);
  const wasLayerLoadingRef = useRef(false);

  // Update dynamic colors when systems, domains, or areas change
  useEffect(() => {
    if (systems && domains && areas) {
      updateDynamicColors(systems as any[], domains as any[], areas as any[]);
      // Force re-render of nodes to apply new colors
      setNodes(prevNodes => [...prevNodes]);
    }
  }, [systems, domains, areas, setNodes]);

  // Broadcast layer loading progress so parent components can show status indicators
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const currentlyLoading = isLoading || isDataLoading;

    if (currentlyLoading) {
      if (!wasLayerLoadingRef.current) {
        window.dispatchEvent(new CustomEvent("layerSwitchLoading", {
          detail: { layer: currentLayer }
        }));
      }
      wasLayerLoadingRef.current = true;
    } else if (wasLayerLoadingRef.current) {
      wasLayerLoadingRef.current = false;
      window.dispatchEvent(new CustomEvent("layerSwitchComplete", {
        detail: { layer: currentLayer }
      }));
    }
  }, [isLoading, isDataLoading, currentLayer]);

  // Update local state when canvas data loads and manage history properly
  useEffect(() => {
    if (canvasData && canvasData.nodes && canvasData.edges) {
      console.log('📥 Loading canvas data:', canvasData.nodes.length, 'nodes,', canvasData.edges.length, 'edges');
      
      // DEBUG: Check complete node structure
      canvasData.nodes.forEach((node: any, index: number) => {
        console.log(`🔍 Node ${index} FULL DATA:`, {
          id: node.id,
          type: node.type,
          position: node.position,
          data: {
            name: node.data?.name,
            domain: node.data?.domain,
            domainName: node.data?.domainName,
            dataArea: node.data?.dataArea,
            dataAreaName: node.data?.dataAreaName,
            sourceSystem: node.data?.sourceSystem,
            targetSystem: node.data?.targetSystem,
            modelObjectId: node.data?.modelObjectId,
            objectId: node.data?.objectId,
            attributes: node.data?.attributes?.length || 0,
            isNew: node.data?.isNew
          }
        });
        
        // DEBUG: Log attribute details to verify attributeId is present
        if (node.data?.attributes && node.data.attributes.length > 0) {
          console.log(`🔍 Node ${node.data.name} attributes:`, node.data.attributes.map((attr: any) => ({
            id: attr.id,
            attributeId: attr.attributeId,
            name: attr.name,
            handleId: `attr-${attr.attributeId || attr.id}`
          })));
        }
      });
      
      setIsDataLoading(true);
      
      // Clear history first to prevent conflicts with new data
      clearHistory();
      
      const processedNodes = canvasData.nodes;
      const processedEdges = (canvasData.edges ?? [])
        .filter((edge: any) => Boolean(edge))
        .map((edge: any) => {
          const edgeData = edge.data ?? {};
          const relationshipType = edgeData.relationshipType ?? edge.label ?? "1:N";
          const isAttributeRelationship = edgeData.isAttributeRelationship ?? (
            edgeData.sourceAttributeId != null && edgeData.targetAttributeId != null
          );

          const derivedSourceHandle = isAttributeRelationship && edgeData.sourceAttributeId
            ? `attr-${edgeData.sourceAttributeId}-source`
            : undefined;
          const derivedTargetHandle = isAttributeRelationship && edgeData.targetAttributeId
            ? `attr-${edgeData.targetAttributeId}-target`
            : undefined;

          // DEBUG: Log edge handle IDs
          console.log(`🔗 Processing edge ${edge.id}:`, {
            sourceNode: edge.source,
            targetNode: edge.target,
            isAttributeRelationship,
            sourceAttributeId: edgeData.sourceAttributeId,
            targetAttributeId: edgeData.targetAttributeId,
            derivedSourceHandle,
            derivedTargetHandle,
            finalSourceHandle: isAttributeRelationship ? edge.sourceHandle ?? derivedSourceHandle : edge.sourceHandle,
            finalTargetHandle: isAttributeRelationship ? edge.targetHandle ?? derivedTargetHandle : edge.targetHandle
          });

          return {
            ...edge,
            sourceHandle: isAttributeRelationship ? edge.sourceHandle ?? derivedSourceHandle : edge.sourceHandle,
            targetHandle: isAttributeRelationship ? edge.targetHandle ?? derivedTargetHandle : edge.targetHandle,
            animated: edge.animated ?? isManyToManyRelationship(relationshipType),
            style: edge.style ?? buildRelationshipEdgeStyle(relationshipType, isAttributeRelationship),
            labelStyle: edge.labelStyle ?? { fontSize: isAttributeRelationship ? 10 : 12, fontWeight: "bold" },
            data: {
              ...edgeData,
              relationshipType,
              sourceAttributeId: edgeData.sourceAttributeId ?? null,
              targetAttributeId: edgeData.targetAttributeId ?? null,
              relationshipLevel: edgeData.relationshipLevel ?? (isAttributeRelationship ? "attribute" : "object"),
              isAttributeRelationship,
            },
          };
        });

      setNodes(processedNodes);
      setEdges(processedEdges);
      
      // Sync nodes and edges to the store for PropertiesPanel
      setStoreNodes(processedNodes);
      setStoreEdges(processedEdges);
      
      // Initialize history with current state after data is loaded
      if (canvasData.nodes.length > 0) {
        setTimeout(() => {
          saveToHistory('initial', 'Initial canvas state', 
            `Loaded model with ${processedNodes.length} objects and ${processedEdges.length} relationships`);
          setIsDataLoading(false);
          
          // Fit view after data loads with some delay to ensure React Flow is ready
          setTimeout(() => {
            try {
              fitView({ padding: 0.1, includeHiddenNodes: false });
            } catch (err) {
              console.log('FitView not ready yet, will retry');
            }
          }, 100);
        }, 500); // Longer delay to ensure data is fully loaded
      } else {
        setIsDataLoading(false);
      }
    }
  }, [canvasData, setNodes, setEdges, setStoreNodes, setStoreEdges, fitView, saveToHistory, clearHistory]);

  // Clear history when model changes to prevent cross-model interference
  useEffect(() => {
    if (currentModel?.id) {
      clearHistory();
    }
  }, [currentModel?.id, clearHistory]);

  // Handle mobile touch drop events
  useEffect(() => {
    const handleTouchDrop = (event: CustomEvent) => {
      const { data, clientX, clientY, canvasX, canvasY } = event.detail;
      
      try {
        const dropData = JSON.parse(data);
        const { type } = dropData;
        
        if (type === 'data-object' && reactFlowWrapper.current) {
          const { object } = dropData;
          const position = screenToFlowPosition({
            x: canvasX,
            y: canvasY,
          });

          // Create a new node on the canvas
          const newNode = {
            id: object.id.toString(),
            type: 'dataObject',
            position,
            data: {
              name: object.name,
              objectId: object.id,
              domain: object.domainName || 'Uncategorized',
              dataArea: object.dataAreaName || 'General',
              attributes: object.attributes || [],
              sourceSystem: object.sourceSystem,
              targetSystem: object.targetSystem,
              isNew: object.isNew || false
            }
          };

          // Check if node already exists - improve detection
          const existingNodeInLocal = nodes.find((n: any) => n.id === newNode.id);
          const existingNodeInStore = storeNodes.find((n: any) => n.id === newNode.id);
          
          if (existingNodeInLocal || existingNodeInStore) {
            // Focus on existing node instead of showing error
            const existingNode = existingNodeInLocal || existingNodeInStore;
            if (existingNode) {
              selectNode(existingNode.id);
              setTimeout(() => {
                const nodeElement = document.querySelector(`[data-id="${existingNode.id}"]`);
                if (nodeElement) {
                  nodeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
              }, 100);
              
              toast({
                title: "Object Located",
                description: `${object.name} is already on the canvas. I've highlighted it for you.`,
              });
            }
            return;
          }

          // Ensure we have a current model selected
          if (!requireModelBeforeAction("Select a data model before adding objects to the canvas.")) {
            console.error('No current model selected when trying to add object:', object.name);
            return;
          }

          // Check if we have a valid layer model
          if (!currentLayerModel && currentModel) {
            console.warn('No current layer model found, falling back to current model:', {
              currentModel: currentModel?.id,
              currentLayer,
              objectName: object.name
            });
          }

          console.log('✓ Node added to canvas via touchDrop:', newNode.id);

          // Save to database - create data_model_object entry
          const targetModelId = object.layerModelId || currentLayerModel?.id || currentModel?.id;
          if (targetModelId) {
            console.log('Adding object to model:', {
              objectId: object.id,
              objectName: object.name,
              targetModelId,
              currentModel: currentModel?.id,
              currentLayerModel: currentLayerModel?.id,
              currentLayer
            });
            
            // Show saving indicator
            setSaveStatus('saving');
            
            fetch(`/api/models/${targetModelId}/objects`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                objectId: object.id,
                position: position,
                targetSystem: object.targetSystemId || null,
                isVisible: true,
                layerSpecificConfig: {
                  position: position,
                  layer: object.currentLayer || currentLayer
                }
              }),
            })
            .then(async response => {
              console.log('Response status:', response.status, 'OK:', response.ok);
              if (!response.ok) {
                if (response.status === 409) {
                  // Object already exists in model - this is not an error
                  console.log('Object already exists in model, continuing...');
                  return { success: true, alreadyExists: true };
                }
                // Get the actual error message from the response
                try {
                  const errorData = await response.json();
                  console.log('Error data:', errorData);
                  throw new Error(errorData.message || response.statusText);
                } catch (parseError) {
                  console.log('Parse error:', parseError);
                  throw new Error(response.statusText);
                }
              }
              return response.json();
            })
            .then((result) => {
              // Update node with modelObjectId from server response
              const nodeWithModelObjectId = {
                ...newNode,
                data: {
                  ...newNode.data,
                  modelObjectId: result?.id || result?.modelObjectId // Get the data_model_object.id
                }
              };
              
              // Add to local state with updated modelObjectId for immediate interaction
              setNodes((nds) => [...nds, nodeWithModelObjectId]);
              
              // Show saved status
              setSaveStatus('saved');
              setTimeout(() => setSaveStatus('idle'), 2000);
              
              // Invalidate canvas query to refresh data
              queryClient.invalidateQueries({
                queryKey: ["/api/models", targetModelId, "canvas", currentLayer]
              });
              
              // Save to history
              saveToHistory('object_added', `Added "${object.name}" to canvas`, 
                `Added object "${object.name}" to canvas via + button`);
              
              // Select the new object and update properties panel
              selectNode(newNode.id);
              
              // Force properties panel update
              window.dispatchEvent(new CustomEvent('objectSelected', {
                detail: { objectId: object.id, forceUpdate: true }
              }));
              
              if (result?.alreadyExists) {
                toast({
                  title: "✓ Object Already in Canvas",
                  description: `${object.name} is already displayed on the canvas.`
                });
              } else {
                toast({
                  title: "✓ Object Added Successfully",
                  description: `${object.name} has been added to the canvas.`
                });
              }
            })
            .catch(error => {
              // Show error status
              setSaveStatus('error');
              setTimeout(() => setSaveStatus('idle'), 5000);
              
              console.error('Failed to save object to database:', error);
              console.error('Error details:', {
                objectId: object.id,
                objectName: object.name,
                targetModelId,
                error: error.message,
                currentModel: currentModel?.id,
                currentLayerModel: currentLayerModel?.id,
                currentLayer
              });
              // Don't add to local state if database save failed
              toast({
                title: "Failed to Add Object",
                description: `Could not save ${object.name} to the database. ${error.message}`,
                variant: "destructive"
              });
            });
          } else {
            console.error('No current model to add object to');
            requireModelBeforeAction("Select a data model before adding objects to the canvas.");
            return;
          }
        } else if (type === 'data-area' && reactFlowWrapper.current) {
          const { area, objects } = dropData;
          
          if (!objects || objects.length === 0) {
            toast({
              title: "No Objects in Area",
              description: `The data area "${area.name}" contains no objects to add.`,
              variant: "default"
            });
            return;
          }

          const position = screenToFlowPosition({
            x: canvasX,
            y: canvasY,
          });

          // Create nodes for all objects in the data area
          const nodesToAdd = objects.map((obj: any, index: number) => ({
            id: obj.id.toString(),
            type: 'dataObject',
            position: {
              x: position.x + (index % 3) * 250, // Arrange in a grid pattern
              y: position.y + Math.floor(index / 3) * 200
            },
            data: {
              name: obj.name,
              objectId: obj.id,
              domain: obj.domainName || area.domainName || 'Uncategorized',
              dataArea: area.name || 'General',
              attributes: obj.attributes || [],
              sourceSystem: obj.sourceSystem,
              targetSystem: obj.targetSystem,
              isNew: obj.isNew || false
            }
          }));

          // Filter out nodes that already exist on canvas
          const existingNodeIds = new Set(nodes.map(n => n.id));
          const newNodes = nodesToAdd.filter((node: any) => !existingNodeIds.has(node.id));
          
          if (newNodes.length === 0) {
            toast({
              title: "Objects Already on Canvas",
              description: `All objects from "${area.name}" are already on the canvas.`,
              variant: "destructive"
            });
            return;
          }

          if (!requireModelBeforeAction("Select a data model before adding objects to the canvas.")) {
            console.error('No current model selected when trying to add data area:', area?.name);
            return;
          }

          // Add to local state first for immediate visual feedback
          setNodes((nds) => [...nds, ...newNodes]);

          // Save to database
          const targetModelId = currentLayerModel?.id || currentModel?.id;
          if (targetModelId) {
            // Show saving indicator
            setSaveStatus('saving');
            
            const savePromises = newNodes.map(async (node: any) => {
              const response = await fetch(`/api/models/${targetModelId}/objects`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  objectId: parseInt(node.id),
                  position: node.position,
                  targetSystem: node.data.targetSystem,
                  isVisible: true,
                  layerSpecificConfig: {
                    position: node.position,
                    layer: currentLayer
                  }
                }),
              });
              
              // Return both response and node for later processing
              return { response, nodeId: node.id };
            });

            Promise.all(savePromises)
            .then(async (results) => {
              const failedSaves = results.filter(r => !r.response.ok);
              if (failedSaves.length > 0) {
                throw new Error(`Failed to save ${failedSaves.length} objects`);
              }
              
              // Parse all responses to get modelObjectIds
              const parsedResults = await Promise.all(
                results.map(async (r) => ({
                  nodeId: r.nodeId,
                  data: await r.response.json()
                }))
              );
              
              // Update nodes with modelObjectIds from server
              setNodes((nds) => 
                nds.map((node) => {
                  const result = parsedResults.find((r) => r.nodeId === node.id);
                  if (result) {
                    return {
                      ...node,
                      data: {
                        ...node.data,
                        modelObjectId: result.data?.id || result.data?.modelObjectId
                      }
                    };
                  }
                  return node;
                })
              );
              
              // Show saved status
              setSaveStatus('saved');
              setTimeout(() => setSaveStatus('idle'), 2000);
              
              // Invalidate canvas query to refresh data
              queryClient.invalidateQueries({
                queryKey: ["/api/models", targetModelId, "canvas", currentLayer]
              });
              
              // Save to history
              saveToHistory('area_added', `Added data area "${area.name}" to canvas`, 
                `Touch-dragged data area "${area.name}" with ${newNodes.length} objects to canvas`);
              
              toast({
                title: "Data Area Added",
                description: `Added ${newNodes.length} objects from "${area.name}" to the canvas.`
              });
            })
            .catch(error => {
              // Show error status
              setSaveStatus('error');
              setTimeout(() => setSaveStatus('idle'), 5000);
              
              console.error('Failed to save objects to database:', error);
              // Remove failed objects from local state
              const failedNodeIds = newNodes.map((n: any) => n.id);
              setNodes((nds) => nds.filter((n: any) => !failedNodeIds.includes(n.id)));
              toast({
                title: "Failed to Add Objects",
                description: `Could not save objects from "${area.name}" to the database.`,
                variant: "destructive"
              });
            });
          } else {
            console.error('No current model to add objects to');
            const failedNodeIds = newNodes.map((n: any) => n.id);
            setNodes((nds) => nds.filter((n: any) => !failedNodeIds.includes(n.id)));
            requireModelBeforeAction("Select a data model before adding objects to the canvas.");
            return;
          }
        }
      } catch (error) {
        console.error('Failed to parse touch drop data:', error);
      }
    };

    if (reactFlowWrapper.current) {
      reactFlowWrapper.current.addEventListener('touchDrop', handleTouchDrop as EventListener);
    }

    return () => {
      if (reactFlowWrapper.current) {
        reactFlowWrapper.current.removeEventListener('touchDrop', handleTouchDrop as EventListener);
      }
    };
  }, [nodes, currentLayerModel, currentModel, currentLayer, setNodes, screenToFlowPosition, queryClient, saveToHistory, toast, requireModelBeforeAction]);

  // Handle Add Object - ONLY allowed in Conceptual layer
  const handleAddObject = useCallback(() => {
    if (currentLayer !== 'conceptual') {
      toast({
        title: "Layer Restriction",
        description: "Objects can only be added in the Conceptual layer. Logical and Physical objects are generated from Conceptual objects.",
        variant: "destructive",
      });
      return;
    }
    // Dispatch event for parent to handle
    window.dispatchEvent(new CustomEvent('openAddObjectModalConfirmed'));
  }, [currentLayer, toast]);

  // Handle paste nodes from clipboard
  const handlePasteNodes = useCallback(async (copiedNodes: CanvasNode[]) => {
    if (!requireModelBeforeAction("Select a data model before pasting objects.")) {
      return;
    }

    const targetModelId = currentLayerModel?.id || currentModel?.id;
    if (!targetModelId) {
      toast({
        title: "No Model Selected",
        description: "Please select a data model before pasting objects.",
        variant: "destructive"
      });
      return;
    }

    // Get viewport center for paste position
    const viewport = getViewport();
    const centerX = (window.innerWidth / 2 - viewport.x) / viewport.zoom;
    const centerY = (window.innerHeight / 2 - viewport.y) / viewport.zoom;

    // Calculate offset to paste nodes centered on viewport
    const bounds = copiedNodes.reduce((acc, node) => {
      return {
        minX: Math.min(acc.minX, node.position.x),
        minY: Math.min(acc.minY, node.position.y),
        maxX: Math.max(acc.maxX, node.position.x),
        maxY: Math.max(acc.maxY, node.position.y),
      };
    }, { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });

    const centerOffsetX = centerX - (bounds.minX + bounds.maxX) / 2;
    const centerOffsetY = centerY - (bounds.minY + bounds.maxY) / 2;

    // Create new nodes with new IDs and offset positions
    const newNodes = copiedNodes.map((node, index) => ({
      ...node,
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${index}`,
      position: {
        x: node.position.x + centerOffsetX + (index * 10), // Small offset for each node
        y: node.position.y + centerOffsetY + (index * 10),
      },
      selected: false,
      data: {
        ...node.data,
        // Remove modelObjectId so new entries will be created
        modelObjectId: undefined,
      }
    }));

    // Add nodes to canvas immediately
    setNodes((nds) => [...nds, ...newNodes]);

    // Save pasted nodes to the database
    try {
      const savePromises = newNodes.map(async (node) => {
        const position = {
          x: Math.round(node.position.x * 100) / 100,
          y: Math.round(node.position.y * 100) / 100
        };

        const response = await fetch(`/api/models/${targetModelId}/canvas/add-object`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            objectId: node.data.objectId,
            layerSpecificConfig: {
              position: position,
              layer: currentLayer
            }
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to save node ${node.data.name}`);
        }

        const result = await response.json();
        return { nodeId: node.id, modelObjectId: result.modelObjectId };
      });

      const results = await Promise.all(savePromises);

      // Update nodes with modelObjectIds from server
      setNodes((nds) =>
        nds.map((node) => {
          const result = results.find((r) => r.nodeId === node.id);
          if (result) {
            return {
              ...node,
              data: {
                ...node.data,
                modelObjectId: result.modelObjectId,
              }
            };
          }
          return node;
        })
      );

      // Save to history
      saveToHistory('node_added', `Pasted ${newNodes.length} node${newNodes.length > 1 ? 's' : ''}`,
        `Pasted ${newNodes.length} object${newNodes.length > 1 ? 's' : ''} to ${currentLayer} layer`);

      // Invalidate canvas query to refresh data
      queryClient.invalidateQueries({
        queryKey: ["/api/models", targetModelId, "canvas", currentLayer]
      });

      toast({
        title: "✓ Nodes Pasted Successfully",
        description: `${newNodes.length} node${newNodes.length > 1 ? 's' : ''} pasted to ${currentLayer} layer`,
      });
    } catch (error) {
      console.error('Failed to paste nodes:', error);
      // Remove nodes that failed to save
      const nodeIds = newNodes.map(n => n.id);
      setNodes((nds) => nds.filter(n => !nodeIds.includes(n.id)));
      toast({
        title: "Failed to Paste Nodes",
        description: "Could not save pasted nodes to the database.",
        variant: "destructive"
      });
    }
  }, [currentModel, currentLayerModel, currentLayer, getViewport, setNodes, saveToHistory, queryClient, toast, requireModelBeforeAction]);

  // Handle gesture events
  useEffect(() => {
    const handleOpenAddObjectModal = () => {
      handleAddObject();
    };

    window.addEventListener('openAddObjectModal', handleOpenAddObjectModal);

    return () => {
      window.removeEventListener('openAddObjectModal', handleOpenAddObjectModal);
    };
  }, [handleAddObject]);

  // Enhanced onNodesChange handler with robust position saving
  const savePositionsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const queuePositionSave = useCallback((_reason?: string) => {
    const modelId = currentLayerModel?.id || currentModel?.id;
    if (!modelId) {
      return;
    }

    if (savePositionsTimeoutRef.current) {
      clearTimeout(savePositionsTimeoutRef.current);
    }

    savePositionsTimeoutRef.current = setTimeout(() => {
      savePositionsTimeoutRef.current = null;
      const currentNodes = nodesRef.current;

      const validNodes = currentNodes.filter((node) => {
        const data = node.data || {};
        const hasId = (typeof data.modelObjectId === 'number' && data.modelObjectId > 0) ||
          (typeof data.objectId === 'number' && data.objectId > 0);

        return (
          hasId &&
          node.position &&
          typeof node.position.x === 'number' &&
          typeof node.position.y === 'number' &&
          !Number.isNaN(node.position.x) &&
          !Number.isNaN(node.position.y)
        );
      });

      if (validNodes.length === 0) {
        setSaveStatus('idle');
        return;
      }

      const positions = validNodes.map((node) => {
        const data = node.data || {};
        const payload: {
          modelObjectId?: number;
          objectId?: number;
          position: { x: number; y: number };
        } = {
          position: {
            x: Math.round(node.position.x * 100) / 100,
            y: Math.round(node.position.y * 100) / 100,
          },
        };

        if (typeof data.modelObjectId === 'number' && data.modelObjectId > 0) {
          payload.modelObjectId = data.modelObjectId;
        }

        if (typeof data.objectId === 'number' && data.objectId > 0) {
          payload.objectId = data.objectId;
        }

        return payload;
      });

      const payload: SavePositionsPayload = {
        positions,
        modelId,
        layer: currentLayer,
      };

      if (isSavePendingRef.current) {
        pendingSavePayloadRef.current = payload;
        return;
      }

      setSaveStatus('saving');
      mutatePositions(payload);
    }, 300);
  }, [currentLayer, currentLayerModel?.id, currentModel?.id, mutatePositions]);
  
  // Listen for manual save requests from properties panel
  useEffect(() => {
    const handleManualSave = () => {
      console.log('📢 Manual save requested from properties panel');
      queuePositionSave('manual_save_button');
    };

    window.addEventListener('manualCanvasSave', handleManualSave);
    return () => {
      window.removeEventListener('manualCanvasSave', handleManualSave);
    };
  }, [queuePositionSave]);
  
  const handleNodesChange = useCallback((changes: any[]) => {
    // Apply changes to local state first
    onNodesChange(changes);
    
    // Check if any position changes occurred (when dragging is complete)
    const positionChanges = changes.filter(change => {
      // ReactFlow position changes: dragging can be true, false, or undefined
      // We want to capture when dragging stops (dragging === false or undefined after a drag)
      const isPositionChange = change.type === 'position' && change.dragging !== true;
      
      return isPositionChange;
    });
    
    // Track history for position changes when dragging is complete
    if (positionChanges.length > 0 && currentModel?.id && !isDataLoading) {
      setTimeout(() => {
        setNodes(currentNodes => {
          setEdges(currentEdges => {
            // Only save to history if we have a valid model and nodes, and we're not loading data
            if (currentNodes.length > 0 && history.length > 0 && !isDataLoading) {
              saveToHistory('node_moved', `Moved ${positionChanges.length} object(s)`, 
                `Updated positions on canvas`);
            }
            return currentEdges;
          });
          return currentNodes;
        });
      }, 200); // Slightly longer delay to avoid conflicts
    }
    if (positionChanges.length > 0) {
      queuePositionSave('nodes_change');
    }
  }, [
    onNodesChange,
    queuePositionSave,
    currentModel?.id,
    currentLayerModel?.id,
    currentLayer,
    saveToHistory,
    setNodes,
    setEdges,
    isDataLoading,
    history.length,
    isDataLoading
  ]);

  // Cleanup timeout on unmount and force save if needed
  useEffect(() => {
    return () => {
      if (savePositionsTimeoutRef.current) {
        clearTimeout(savePositionsTimeoutRef.current);
        
        // Force save any pending changes before unmount using direct fetch
        const currentNodes = nodes;
        const validNodes = currentNodes.filter(node => 
          node.data && 
          typeof node.data.objectId === 'number' && 
          node.data.objectId > 0 &&
          node.position &&
          typeof node.position.x === 'number' &&
          typeof node.position.y === 'number' &&
          !isNaN(node.position.x) &&
          !isNaN(node.position.y)
        );
        
        if (validNodes.length > 0 && (currentLayerModel?.id || currentModel?.id)) {
          const positions = validNodes.map(node => ({
            objectId: node.data.objectId,
            position: {
              x: Math.round(node.position.x * 100) / 100,
              y: Math.round(node.position.y * 100) / 100
            }
          }));
          
          const targetModelId = currentLayerModel?.id || currentModel?.id;
          if (targetModelId) {
            // Note: sendBeacon doesn't support Authorization headers, so we use fetch with keepalive
            const data = JSON.stringify({ 
              positions,
              layer: currentLayer 
            });
            
            // Use fetch with keepalive instead of sendBeacon to support auth headers
            fetch(`/api/models/${targetModelId}/canvas/positions`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: data,
              keepalive: true
            }).catch(error => console.warn('Failed to save positions on unmount:', error));
          }
        }
      }
    };
  }, [nodes, currentLayerModel?.id, currentModel?.id, currentLayer]);

  // Auto-save when model or layer changes to prevent data loss
  useEffect(() => {
    if (savePositionsTimeoutRef.current) {
      clearTimeout(savePositionsTimeoutRef.current);
      
      // Force save current positions before switching
      setNodes(currentNodes => {
        const validNodes = currentNodes.filter(node => 
          node.data && 
          typeof node.data.objectId === 'number' && 
          node.data.objectId > 0 &&
          node.position &&
          typeof node.position.x === 'number' &&
          typeof node.position.y === 'number' &&
          !isNaN(node.position.x) &&
          !isNaN(node.position.y)
        );
        
        if (validNodes.length > 0 && (currentLayerModel?.id || currentModel?.id)) {
          const positions = validNodes.map(node => ({
            objectId: node.data.objectId,
            position: {
              x: Math.round(node.position.x * 100) / 100,
              y: Math.round(node.position.y * 100) / 100
            }
          }));
          
          // Use previous model/layer context for saving before switch
          const previousModelId = currentLayerModel?.id || currentModel?.id;
          if (previousModelId) {
            fetch(`/api/models/${previousModelId}/canvas/positions`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ 
                positions,
                layer: currentLayer 
              }),
            }).catch(error => console.warn('Failed to save positions on layer change:', error));
          }
        }
        
        return currentNodes;
      });
    }
  }, [currentModel?.id, currentLayer]);

  // Enhanced keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Undo/Redo
      if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if ((event.ctrlKey || event.metaKey) && (event.key === 'y' || (event.key === 'z' && event.shiftKey))) {
        event.preventDefault();
        redo();
      } 
      // Copy nodes
      else if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
        const selectedNodes = nodes.filter(node => node.selected);
        if (selectedNodes.length > 0) {
          event.preventDefault();
          const selectedNodeIds = selectedNodes.map(n => n.id);
          copyNodes(selectedNodeIds);
          toast({
            title: "Nodes Copied",
            description: `${selectedNodes.length} node${selectedNodes.length > 1 ? 's' : ''} copied to clipboard`,
          });
        }
      }
      // Paste nodes
      else if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
        const copiedNodes = getCopiedNodes();
        if (copiedNodes.length > 0) {
          event.preventDefault();
          handlePasteNodes(copiedNodes);
        }
      }
      // Search panel toggle
      else if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
        event.preventDefault();
        setShowSearchPanel(true);
      }
      // Toggle auto layout panel
      else if ((event.ctrlKey || event.metaKey) && event.key === 'l') {
        event.preventDefault();
        setShowAutoLayout(!showAutoLayout);
      }
      // Escape key to close search panel
      else if (event.key === 'Escape') {
        setShowSearchPanel(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, showAutoLayout, nodes, copyNodes, getCopiedNodes, handlePasteNodes, toast]);

  // Handle zoom events from TopNavBar
  useEffect(() => {
    const handleZoomIn = () => {
      zoomIn();
      setZoomLevel(getViewport().zoom);
    };

    const handleZoomOut = () => {
      zoomOut();
      setZoomLevel(getViewport().zoom);
    };

    const handleFitView = () => {
      fitView();
      setZoomLevel(getViewport().zoom);
    };

    window.addEventListener('canvasZoomIn', handleZoomIn);
    window.addEventListener('canvasZoomOut', handleZoomOut);
    window.addEventListener('canvasFitView', handleFitView);

    return () => {
      window.removeEventListener('canvasZoomIn', handleZoomIn);
      window.removeEventListener('canvasZoomOut', handleZoomOut);
      window.removeEventListener('canvasFitView', handleFitView);
    };
  }, [zoomIn, zoomOut, fitView, getViewport]);

  const onConnect = useCallback(
    (params: Connection) => {
      console.log("Connection attempt:", { params, connectionMode, currentLayer });
      if (!params.source || !params.target) return;
      
      // Check if this is an attribute-level connection (for logical/physical layers)
      const isAttributeConnection = params.sourceHandle?.startsWith('attr-') || params.targetHandle?.startsWith('attr-');
      
      if (currentLayer === 'logical' || currentLayer === 'physical') {
        // In logical/physical layers, only allow attribute-level connections
        if (!isAttributeConnection) {
          console.log("Object-level connections not allowed in logical/physical layers");
          return; // Block object-level connections
        }
        
        // Find the source and target nodes
        const sourceNode = nodes.find(n => n.id === params.source);
        const targetNode = nodes.find(n => n.id === params.target);

  const extractAttributeId = (handle?: string | null) => {
          if (!handle || !handle.startsWith('attr-')) return undefined;
          const match = handle.match(/^attr-(\d+)-/);
          return match ? parseInt(match[1], 10) : undefined;
        };

        const sourceAttributeId = extractAttributeId(params.sourceHandle);
        const targetAttributeId = extractAttributeId(params.targetHandle);
        
        if (sourceNode && targetNode) {
          setAttributeConnection({
            sourceNode: {
              id: sourceNode.id,
              name: sourceNode.data.name,
              attributes: sourceNode.data.attributes
            },
            targetNode: {
              id: targetNode.id,
              name: targetNode.data.name,
              attributes: targetNode.data.attributes
            },
            sourceHandle: params.sourceHandle || undefined,
            targetHandle: params.targetHandle || undefined,
            sourceAttributeId,
            targetAttributeId
          });
          setShowAttributeRelationshipModal(true);
        }
      } else if (currentLayer === 'conceptual') {
        // In conceptual layer, only allow object-level connections
        if (isAttributeConnection) {
          console.log("Attribute-level connections not allowed in conceptual layer");
          return; // Block attribute-level connections
        }
        
        // Store pending connection and show dialog for object-level relationship configuration
        setPendingConnection({
          source: params.source,
          target: params.target,
          sourceHandle: params.sourceHandle,
          targetHandle: params.targetHandle
        });
        setShowConnectionDialog(true);
      }
    },
    [nodes, currentLayer]
  );

  const createConnection = useCallback(() => {
    if (!pendingConnection || !currentModel?.id) return;
    
    const newEdge = {
      id: `edge-${pendingConnection.source}-${pendingConnection.target}-${Date.now()}`,
      source: pendingConnection.source,
      target: pendingConnection.target,
      sourceHandle: pendingConnection.sourceHandle || undefined,
      targetHandle: pendingConnection.targetHandle || undefined,
      type: "smoothstep",
      animated: isManyToManyRelationship(relationshipType),
      style: buildRelationshipEdgeStyle(relationshipType),
      label: relationshipType,
      labelStyle: { fontSize: 12, fontWeight: 'bold' },
      data: {
        relationshipType,
        dataObjectRelationshipId: null,
        isAttributeRelationship: false,
      },
    };
    
    // Add edge to local state first for immediate visual feedback
    setEdges((eds) => addEdge(newEdge, eds));
    storeAddEdge(newEdge);
    
    // Save to history with descriptive message (only if not loading data)
    if (!isDataLoading) {
      setTimeout(() => {
        saveToHistory('edge_added', `Added ${relationshipType} relationship`, 
          `Connected ${pendingConnection.source} to ${pendingConnection.target}`);
      }, 100);
    }

    // Get the actual objectId from the node data, not the node ID
    const sourceNode = nodes.find(n => n.id === pendingConnection.source);
    const targetNode = nodes.find(n => n.id === pendingConnection.target);
    
    if (!sourceNode?.data?.objectId || !targetNode?.data?.objectId) {
      console.error('Cannot create relationship: missing objectId in node data', {
        sourceNode: sourceNode?.data,
        targetNode: targetNode?.data
      });
      setPendingConnection(null);
      setShowConnectionDialog(false);
      return;
    }

    // Save relationship to database
    saveRelationshipMutation.mutate({
      sourceObjectId: sourceNode.data.objectId,
      targetObjectId: targetNode.data.objectId,
      type: relationshipType,
      modelId: currentLayerModel?.id || currentModel.id,
      sourceHandle: pendingConnection.sourceHandle ?? null,
      targetHandle: pendingConnection.targetHandle ?? null,
    }, {
      onSuccess: (data) => {
        // Update the edge with the actual relationship ID from the server
        if (data?.id) {
          setEdges((eds) => 
            eds.map((edge) => 
              edge.id === newEdge.id 
                ? {
                    ...edge,
                    data: {
                      ...edge.data,
                      relationshipId: data.id,
                      dataObjectRelationshipId: data.dataObjectRelationshipId ?? null,
                    }
                  }
                : edge
            )
          );
        }
      }
    });
    
    // Reset dialog state
    setPendingConnection(null);
    setShowConnectionDialog(false);
    setRelationshipType('1:N');
  }, [pendingConnection, relationshipType, storeAddEdge, saveToHistory, setEdges, currentModel?.id, currentLayerModel?.id, saveRelationshipMutation, nodes, isDataLoading]);

  const createAttributeRelationship = useCallback((relationshipData: {
    sourceAttributeId: number;
    targetAttributeId: number;
    type: "1:1" | "1:N" | "N:M";
  }) => {
    if (!attributeConnection || !currentModel?.id) return;
    
    const newEdge = {
      id: `attr-edge-${relationshipData.sourceAttributeId}-${relationshipData.targetAttributeId}-${Date.now()}`,
      source: attributeConnection.sourceNode.id,
      target: attributeConnection.targetNode.id,
      type: "smoothstep",
      animated: isManyToManyRelationship(relationshipData.type),
      sourceHandle: `attr-${relationshipData.sourceAttributeId}-source`,
      targetHandle: `attr-${relationshipData.targetAttributeId}-target`,
      style: buildRelationshipEdgeStyle(relationshipData.type, true),
      label: relationshipData.type,
      labelStyle: { fontSize: 10, fontWeight: 'bold' },
      data: {
        relationshipType: relationshipData.type,
        sourceAttributeId: relationshipData.sourceAttributeId,
        targetAttributeId: relationshipData.targetAttributeId,
        isAttributeRelationship: true,
        relationshipLevel: 'attribute' as const,
        dataObjectRelationshipId: null,
      },
    };
    
    // Add edge to local state first for immediate visual feedback
    setEdges((eds) => addEdge(newEdge, eds));
    storeAddEdge(newEdge);
    
    // Save to history with descriptive message
    if (!isDataLoading) {
      setTimeout(() => {
        saveToHistory('edge_added', `Added ${relationshipData.type} attribute relationship`, 
          `Connected attributes between ${attributeConnection.sourceNode.name} and ${attributeConnection.targetNode.name}`);
      }, 100);
    }

    // Get the actual objectId from the node data, not the node ID
    const sourceNode = nodes.find(n => n.id === attributeConnection.sourceNode.id);
    const targetNode = nodes.find(n => n.id === attributeConnection.targetNode.id);
    
    if (!sourceNode?.data?.objectId || !targetNode?.data?.objectId) {
      console.error('Cannot create attribute relationship: missing objectId in node data', {
        sourceNode: sourceNode?.data,
        targetNode: targetNode?.data
      });
      setAttributeConnection(null);
      setShowAttributeRelationshipModal(false);
      return;
    }

    // Save relationship to database with attribute details
    saveRelationshipMutation.mutate({
      sourceObjectId: sourceNode.data.objectId,
      targetObjectId: targetNode.data.objectId,
      type: relationshipData.type,
      modelId: currentLayerModel?.id || currentModel.id,
      sourceAttributeId: relationshipData.sourceAttributeId,
      targetAttributeId: relationshipData.targetAttributeId,
    }, {
      onSuccess: (data) => {
        // Update the edge with the actual relationship ID from the server
        if (data?.id) {
          setEdges((eds) => 
            eds.map((edge) => 
              edge.id === newEdge.id 
                ? {
                    ...edge,
                    data: {
                      ...edge.data,
                      relationshipId: data.id,
                      dataObjectRelationshipId: data.dataObjectRelationshipId ?? null,
                    }
                  }
                : edge
            )
          );
        }
      }
    });
    
    // Reset attribute connection state
    setAttributeConnection(null);
    setShowAttributeRelationshipModal(false);
  }, [attributeConnection, storeAddEdge, saveToHistory, setEdges, currentModel?.id, currentLayerModel?.id, saveRelationshipMutation, nodes, isDataLoading]);

  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.stopPropagation();
      
      // Clear previous selections
      selectNode(null);
      selectObject(null);
      
      // Set new selection with proper state sync
      setTimeout(() => {
        selectNode(node.id);
        
        // Extract object ID from node data and select corresponding object
        const objectId = node.data?.objectId;
        if (objectId) {
          selectObject(objectId);
        }
        
        // Force properties panel refresh
        window.dispatchEvent(new CustomEvent('nodeSelected', {
          detail: { nodeId: node.id, objectId, forceUpdate: true }
        }));
        
        console.log(`Canvas node selected: ${node.data?.name} (Node: ${node.id}, Object: ${objectId})`);
      }, 10);
    },
    [selectNode, selectObject]
  );

  const onEdgeClick = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      selectEdge(edge.id);
    },
    [selectEdge]
  );

  const onEdgeDoubleClick = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      event.stopPropagation();
      setEditingEdge(edge);
      setShowEditRelationshipModal(true);
    },
    []
  );

  const handleUpdateRelationship = useCallback(async (relationshipType: "1:1" | "1:N" | "N:M") => {
    if (!editingEdge) return;

    try {
      // Extract relationship ID from edge data if available
      const relationshipId = editingEdge.data?.relationshipId;
      
      if (relationshipId) {
        // Update in database first
        const response = await fetch(`/api/relationships/${relationshipId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: relationshipType,
          }),
        });
        
        if (!response.ok) {
          throw new Error('Failed to update relationship in database');
        }
      }

      // Update the edge in local state
      setEdges((eds) => 
        eds.map((edge) => 
          edge.id === editingEdge.id 
            ? {
                ...edge,
                label: relationshipType,
                animated: isManyToManyRelationship(relationshipType),
                style: buildRelationshipEdgeStyle(
                  relationshipType,
                  Boolean(edge.data?.isAttributeRelationship)
                ),
                data: {
                  ...edge.data,
                  relationshipType,
                }
              }
            : edge
        )
      );
      
      // Save to history
      saveToHistory('relationship_updated', `Updated relationship to ${relationshipType}`, 
        `Changed relationship type to ${relationshipType}`);
      
      // Invalidate canvas data to refresh
      if (currentLayerModel?.id) {
        queryClient.invalidateQueries({
          queryKey: ["/api/models", currentLayerModel.id, "canvas", currentLayer]
        });
      }

      toast({
        title: "Relationship Updated",
        description: `Relationship type changed to ${relationshipType}`,
      });
      
      setShowEditRelationshipModal(false);
      setEditingEdge(null);
      
    } catch (error) {
      console.error('Failed to update relationship:', error);
      toast({
        title: "Error",
        description: "Failed to update relationship. Please try again.",
        variant: "destructive"
      });
    }
  }, [editingEdge, setEdges, saveToHistory, currentLayerModel, currentLayer, queryClient, toast]);

  const handleDeleteRelationship = useCallback(async () => {
    if (!editingEdge) return;

    try {
      // Extract relationship ID from edge data if available
      const relationshipId = editingEdge.data?.relationshipId;
      
      if (relationshipId) {
        // Delete from database first
        const response = await fetch(`/api/relationships/${relationshipId}`, {
          method: 'DELETE',
        });
        
        if (!response.ok) {
          throw new Error('Failed to delete relationship from database');
        }
      }
      
      // Remove the edge from local state
      setEdges((eds) => eds.filter((edge) => edge.id !== editingEdge.id));

      // Clean up selection if this edge was selected
      selectEdge(null);
      
      // Save to history
      saveToHistory('relationship_deleted', 'Deleted relationship', 
        `Removed relationship between objects`);
      
      // Invalidate canvas data to refresh
      if (currentLayerModel?.id) {
        queryClient.invalidateQueries({
          queryKey: ["/api/models", currentLayerModel.id, "canvas", currentLayer]
        });
      }
      
      toast({
        title: "Relationship Deleted",
        description: "The relationship has been removed successfully.",
      });
      
    } catch (error) {
      console.error('Failed to delete relationship:', error);
      toast({
        title: "Error",
        description: "Failed to delete relationship. Please try again.",
        variant: "destructive"
      });
    } finally {
      setEditingEdge(null);
      setShowEditRelationshipModal(false);
    }
  }, [editingEdge, setEdges, selectEdge, saveToHistory, currentLayerModel, currentLayer, queryClient, toast]);

  // Enhanced onEdgesChange handler with auto-save for edge modifications
  const handleEdgesChange = useCallback(async (changes: any[]) => {
    onEdgesChange(changes);
    
    // Auto-save edge deletions to database
    const deletedEdges = changes.filter(change => change.type === 'remove');
    if (deletedEdges.length > 0 && currentModel?.id) {
      for (const change of deletedEdges) {
        try {
          // Find the edge to get its relationship ID
          const edge = edges.find(e => e.id === change.id);
          const relationshipId = edge?.data?.relationshipId;
          
          if (relationshipId) {
            // Delete from database
            const response = await fetch(`/api/relationships/${relationshipId}`, {
              method: 'DELETE',
            });
            
            if (response.ok) {
              // Save to history
              saveToHistory('relationship_deleted', 'Deleted relationship', 
                `Removed relationship between objects`);
              
              toast({
                title: "Relationship Deleted",
                description: "The relationship has been removed successfully.",
              });
            } else {
              console.error('Failed to delete relationship from database');
              toast({
                title: "Error",
                description: "Failed to delete relationship from database.",
                variant: "destructive"
              });
            }
          }
        } catch (error) {
          console.error('Error deleting relationship:', error);
        }
      }
      
      // Invalidate canvas data to refresh
      if (currentLayerModel?.id) {
        queryClient.invalidateQueries({
          queryKey: ["/api/models", currentLayerModel.id, "canvas", currentLayer]
        });
      }
    }
  }, [onEdgesChange, currentModel?.id, edges, saveToHistory, toast, currentLayerModel, currentLayer, queryClient]);

  // Handle edge reconnection (when user drags edge source/target to a different node)
  const onReconnect = useCallback(async (oldEdge: Edge, newConnection: Connection) => {
    if (!currentModel?.id) {
      toast({
        title: "Error",
        description: "Please select a model first.",
        variant: "destructive"
      });
      return;
    }

    try {
      const relationshipId = oldEdge.data?.relationshipId;
      
      if (!relationshipId) {
        console.error('Cannot reconnect edge: missing relationshipId');
        toast({
          title: "Error",
          description: "Cannot reconnect this relationship.",
          variant: "destructive"
        });
        return;
      }

      // Get the actual objectId from the node data for both source and target
      const sourceNode = nodes.find(n => n.id === newConnection.source);
      const targetNode = nodes.find(n => n.id === newConnection.target);
      
      if (!sourceNode?.data?.objectId || !targetNode?.data?.objectId) {
        console.error('Cannot reconnect relationship: missing objectId in node data');
        toast({
          title: "Error",
          description: "Invalid node data for reconnection.",
          variant: "destructive"
        });
        return;
      }

      // Update relationship in database
      const response = await fetch(`/api/relationships/${relationshipId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceModelObjectId: sourceNode.data.modelObjectId,
          targetModelObjectId: targetNode.data.modelObjectId,
          sourceHandle: newConnection.sourceHandle || null,
          targetHandle: newConnection.targetHandle || null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update relationship in database');
      }

      // Update edge in local state
      setEdges((eds) =>
        eds.map((edge) =>
          edge.id === oldEdge.id
            ? {
                ...edge,
                source: newConnection.source!,
                target: newConnection.target!,
                sourceHandle: newConnection.sourceHandle || undefined,
                targetHandle: newConnection.targetHandle || undefined,
              }
            : edge
        )
      );

      // Save to history
      saveToHistory('relationship_reconnected', 'Reconnected relationship', 
        `Changed relationship connection from ${oldEdge.source} → ${oldEdge.target} to ${newConnection.source} → ${newConnection.target}`);

      // Invalidate canvas data to refresh
      if (currentLayerModel?.id) {
        queryClient.invalidateQueries({
          queryKey: ["/api/models", currentLayerModel.id, "canvas", currentLayer]
        });
      }

      toast({
        title: "Relationship Reconnected",
        description: "The relationship has been updated successfully.",
      });

    } catch (error) {
      console.error('Failed to reconnect relationship:', error);
      toast({
        title: "Error",
        description: "Failed to reconnect relationship. Please try again.",
        variant: "destructive"
      });
    }
  }, [currentModel, nodes, setEdges, saveToHistory, currentLayerModel, currentLayer, queryClient, toast]);

  const onPaneClick = useCallback(() => {
    selectNode(null);
    selectEdge(null);
  }, [selectNode, selectEdge]);

  // Drag and drop handlers
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    
    // Add visual feedback for drop zone
    if (reactFlowWrapper.current) {
      reactFlowWrapper.current.classList.add('bg-blue-50', 'dark:bg-blue-950', 'border-2', 'border-blue-300', 'border-dashed');
    }
  }, []);

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    // Remove visual feedback
    if (reactFlowWrapper.current) {
      reactFlowWrapper.current.classList.remove('bg-blue-50', 'dark:bg-blue-950', 'border-2', 'border-blue-300', 'border-dashed');
    }

    try {
      const data = event.dataTransfer.getData('application/json');
      if (!data) {
        console.warn('No drag data available');
        return;
      }

      const dropData = JSON.parse(data);
      const { type } = dropData;
      
      if (!type) {
        console.warn('No type specified in drop data:', dropData);
        return;
      }
      
      if (type === 'data-object' && reactFlowWrapper.current) {
        const { object } = dropData;
        const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
        const position = screenToFlowPosition({
          x: event.clientX - reactFlowBounds.left,
          y: event.clientY - reactFlowBounds.top,
        });

        // Create a new node on the canvas
        const newNode = {
          id: object.id.toString(),
          type: 'dataObject',
          position,
          data: {
            name: object.name,
            objectId: object.id,
            domain: object.domainName || object.domain || 'Uncategorized',
            dataArea: object.dataAreaName || object.dataArea || null,
            attributes: object.attributes || [],
            sourceSystem: object.sourceSystem || null,
            targetSystem: object.targetSystem || null,
            isNew: object.isNew || false
          }
        };

        // Check if we have a current model selected
        if (!requireModelBeforeAction("Select a data model before adding objects to the canvas.")) {
          console.error('No current model selected when trying to add object:', object.name);
          return;
        }

        // Check if we have a valid layer model
        if (!currentLayerModel && currentModel) {
          console.warn('No current layer model found, falling back to current model:', {
            currentModel: currentModel?.id,
            currentLayer,
            objectName: object.name
          });
        }

        // Check if node already exists - improve detection
        const existingNodeInLocal = nodes.find(n => n.id === newNode.id);
        const existingNodeInStore = storeNodes.find(n => n.id === newNode.id);
        
        if (existingNodeInLocal || existingNodeInStore) {
          // Focus on existing node instead of showing error
          const existingNode = existingNodeInLocal || existingNodeInStore;
          if (existingNode) {
            selectNode(existingNode.id);
            setTimeout(() => {
              const nodeElement = document.querySelector(`[data-id="${existingNode.id}"]`);
              if (nodeElement) {
                nodeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }, 100);
            
            toast({
              title: "Object Located",
              description: `${object.name} is already on the canvas. I've highlighted it for you.`,
            });
          }
          return;
        }

        console.log('✓ Node added to canvas:', newNode.id);

        // Save to database - create data_model_object entry
        const targetModelId = object.layerModelId || currentLayerModel?.id || currentModel?.id;
        if (targetModelId) {
          console.log('Adding object to model:', {
            objectId: object.id,
            objectName: object.name,
            targetModelId,
            currentModel: currentModel?.id,
            currentLayerModel: currentLayerModel?.id,
            currentLayer
          });
          
          // Show saving indicator
          setSaveStatus('saving');
          
          fetch(`/api/models/${targetModelId}/objects`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              objectId: object.id,
              position: position,
              targetSystem: object.targetSystemId || null,
              isVisible: true,
              layerSpecificConfig: {
                position: position,
                layer: object.currentLayer || currentLayer
              }
            }),
          })
          .then(async response => {
            console.log('Response status:', response.status, 'OK:', response.ok);
            if (!response.ok) {
              if (response.status === 409) {
                // Object already exists in model - this is not an error
                console.log('Object already exists in model, continuing...');
                return { success: true, alreadyExists: true };
              }
              // Get the actual error message from the response
              try {
                const errorData = await response.json();
                console.log('Error data:', errorData);
                throw new Error(errorData.message || response.statusText);
              } catch (parseError) {
                console.log('Parse error:', parseError);
                throw new Error(response.statusText);
              }
            }
            return response.json();
          })
            .then((result) => {
              // Update node with modelObjectId from server response
              const nodeWithModelObjectId = {
                ...newNode,
                data: {
                  ...newNode.data,
                  modelObjectId: result?.id || result?.modelObjectId // Get the data_model_object.id
                }
              };
              
              // Add to local state with updated modelObjectId
              setNodes((nds) => [...nds, nodeWithModelObjectId]);
              
              // Show saved status
              setSaveStatus('saved');
              setTimeout(() => setSaveStatus('idle'), 2000);
              
              // Invalidate canvas query to refresh data
              queryClient.invalidateQueries({
                queryKey: ["/api/models", targetModelId, "canvas", currentLayer]
              });
              
              // Save to history
              saveToHistory('node_added', `Added ${object.name} to canvas`, 
                `Dragged ${object.name} from sidebar to canvas`);
              
              if (result?.alreadyExists) {
                toast({
                  title: "✓ Object Already in Canvas",
                  description: `${object.name} is already displayed on the canvas.`
                });
              } else {
                toast({
                  title: "✓ Object Added Successfully", 
                  description: `${object.name} has been added to the canvas. Click on it to edit properties.`
                });
              }
              
              // Auto-select the new node
              setTimeout(() => {
                selectNode(newNode.id);
              }, 200);
            })
          .catch(error => {
            console.error('Failed to save object to database:', error);
            console.error('Error details:', {
              objectId: object.id,
              objectName: object.name,
              targetModelId,
              error: error.message,
              currentModel: currentModel?.id,
              currentLayerModel: currentLayerModel?.id,
              currentLayer
            });
            
            // Show error status
            setSaveStatus('error');
            setTimeout(() => setSaveStatus('idle'), 5000);
            
            // Remove from local state if database save failed
            setNodes((nds) => nds.filter(n => n.id !== newNode.id));
            toast({
              title: "Failed to Add Object",
              description: `Could not save ${object.name} to the database. ${error.message}`,
              variant: "destructive"
            });
          });
        } else {
          console.error('No current model to add object to');
          setNodes((nds) => nds.filter(n => n.id !== newNode.id));
          requireModelBeforeAction("Select a data model before adding objects to the canvas.");
          return;
        }
      } else if (type === 'data-area' && reactFlowWrapper.current) {
        const { area, objects } = dropData;
        
        if (!objects || objects.length === 0) {
          toast({
            title: "No Objects in Area",
            description: `The data area "${area.name}" contains no objects to add.`,
            variant: "default"
          });
          return;
        }

        const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
        const basePosition = screenToFlowPosition({
          x: event.clientX - reactFlowBounds.left,
          y: event.clientY - reactFlowBounds.top,
        });

        // Create nodes for all objects in the data area
        const newNodes = objects.map((object: any, index: number) => ({
          id: object.id.toString(),
          type: 'dataObject',
          position: {
            x: basePosition.x + (index % 3) * 280, // Arrange in grid pattern
            y: basePosition.y + Math.floor(index / 3) * 200
          },
          data: {
            name: object.name,
            objectId: object.id,
            domain: object.domainName || area.domainName || 'Uncategorized',
            dataArea: area.name,
            attributes: object.attributes || [],
            sourceSystem: object.sourceSystem,
            targetSystem: object.targetSystem,
            isNew: object.isNew || false
          }
        }));

        // Filter out objects that already exist on canvas
        const existingIds = new Set(nodes.map(n => n.id));
        const nodesToAdd = newNodes.filter((node: any) => !existingIds.has(node.id));
        
        if (nodesToAdd.length === 0) {
          toast({
            title: "Objects Already on Canvas",
            description: `All objects from "${area.name}" are already on the canvas.`,
            variant: "destructive"
          });
          return;
        }

        if (!requireModelBeforeAction("Select a data model before adding objects to the canvas.")) {
          console.error('No current model selected when trying to add data area:', area?.name);
          return;
        }

        // Add to local state first for immediate visual feedback
        setNodes((nds) => [...nds, ...nodesToAdd]);

        // Save each object to database
        const targetModelId = currentLayerModel?.id || currentModel?.id;
        if (targetModelId) {
          // Show saving indicator
          setSaveStatus('saving');
          
          Promise.all(nodesToAdd.map(async (node: any) => {
            const objectId = node.data.objectId;
            const position = node.position;
            
            const response = await fetch(`/api/models/${targetModelId}/objects`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
                body: JSON.stringify({
                  objectId: objectId,
                  position: position,
                  targetSystem: node.data.targetSystem,
                  isVisible: true,
                  layerSpecificConfig: {
                    position: position,
                    layer: currentLayer
                  }
                }),
            });
            
            // Return both response and node for later processing
            return { response, nodeId: node.id };
          }))
          .then(async (results) => {
            // Check if all requests were successful
            const failedRequests = results.filter(r => !r.response.ok);
            if (failedRequests.length > 0) {
              throw new Error(`${failedRequests.length} objects failed to save`);
            }
            
            // Parse all responses to get modelObjectIds
            const parsedResults = await Promise.all(
              results.map(async (r) => ({
                nodeId: r.nodeId,
                data: await r.response.json()
              }))
            );
            
            // Update nodes with modelObjectIds from server
            setNodes((nds) => 
              nds.map((node) => {
                const result = parsedResults.find((r) => r.nodeId === node.id);
                if (result) {
                  return {
                    ...node,
                    data: {
                      ...node.data,
                      modelObjectId: result.data?.id || result.data?.modelObjectId
                    }
                  };
                }
                return node;
              })
            );
            
            // Show saved status
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 2000);
            
            // Invalidate canvas query to refresh data
            queryClient.invalidateQueries({
              queryKey: ["/api/models", targetModelId, "canvas", currentLayer]
            });
            
            // Save to history
            saveToHistory('area_added', `Added ${area.name} data area to canvas`, 
              `Dragged data area "${area.name}" with ${nodesToAdd.length} objects to canvas`);
            
            toast({
              title: "✓ Data Area Added Successfully",
              description: `Added ${nodesToAdd.length} objects from "${area.name}" to the canvas. Total objects: ${nodes.length + nodesToAdd.length}`
            });
          })
          .catch(error => {
            // Show error status
            setSaveStatus('error');
            setTimeout(() => setSaveStatus('idle'), 5000);
            
            console.error('Failed to save objects to database:', error);
            // Remove failed objects from local state
            const failedNodeIds = nodesToAdd.map((n: any) => n.id);
            setNodes((nds) => nds.filter((n: any) => !failedNodeIds.includes(n.id)));
            toast({
              title: "Failed to Add Objects",
              description: `Could not save objects from "${area.name}" to the database.`,
              variant: "destructive"
            });
          });
        } else {
          console.error('No current model to add objects to');
          const failedNodeIds = nodesToAdd.map((n: any) => n.id);
          setNodes((nds) => nds.filter((n: any) => !failedNodeIds.includes(n.id)));
          requireModelBeforeAction("Select a data model before adding objects to the canvas.");
          return;
        }
      }
    } catch (error) {
      console.error('Failed to parse drop data:', error);
    }
  }, [setNodes, screenToFlowPosition, saveToHistory, toast, requireModelBeforeAction]);

  // Node deletion handler
  const onNodeDelete = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    // Remove from local state first
    setNodes((nds) => nds.filter(n => n.id !== nodeId));
    setEdges((eds) => eds.filter(e => e.source !== nodeId && e.target !== nodeId));
    
    // Save to history
    setTimeout(() => {
      saveToHistory('node_deleted', `Deleted ${node.data.name}`, 
        `Removed ${node.data.name} from canvas`);
    }, 100);

    // Delete from database
    if (node.data.objectId) {
      deleteObjectMutation.mutate(node.data.objectId);
    }
  }, [nodes, setNodes, setEdges, saveToHistory, deleteObjectMutation]);

  // Keyboard handler for delete key and custom delete events
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if ((event.ctrlKey || event.metaKey) && (event.key === 'y' || (event.key === 'z' && event.shiftKey))) {
        event.preventDefault();
        redo();
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        const selectedNode = nodes.find(n => n.selected);
        if (selectedNode) {
          event.preventDefault();
          onNodeDelete(selectedNode.id);
        }
      }
    };

    const handleDeleteNode = (event: CustomEvent) => {
      const { objectId } = event.detail;
      const nodeToDelete = nodes.find(n => n.data.objectId === objectId);
      if (nodeToDelete) {
        onNodeDelete(nodeToDelete.id);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('delete-node', handleDeleteNode as EventListener);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('delete-node', handleDeleteNode as EventListener);
    };
  }, [undo, redo, nodes, onNodeDelete]);

  return (
    <main className="bg-background dark:bg-background relative w-full h-full flex flex-col" style={{ width: '100%', height: '100%', minHeight: '100%' }}>
      {/* Enhanced Data Modeling Toolbar */}
      <DataModelingToolbar
        connectionMode={connectionMode}
        setConnectionMode={setConnectionMode}
        saveStatus={saveStatus}
        currentLayer={currentLayer}
        onAddObject={handleAddObject}
        showAISuggestions={showAISuggestions}
        onToggleAISuggestions={() => setShowAISuggestions(!showAISuggestions)}
        onToggleSearch={() => setShowSearchPanel(true)}
        showAutoLayout={showAutoLayout}
        onToggleAutoLayout={() => setShowAutoLayout(!showAutoLayout)}
      />

      {/* Mobile Layer Switcher - visible only on small screens */}
      <div className="md:hidden bg-card border-b border-border px-4 py-2">
        <div className="flex items-center justify-center">
          <LayerNavigator />
        </div>
      </div>

      {/* React Flow Canvas - Fixed height to prevent warnings */}
      <div 
        className="flex-1 w-full relative group"
        ref={reactFlowWrapper}
        style={{ 
          width: '100%', 
          height: '100%',
          minHeight: '500px',
          overflow: 'hidden',
          position: 'relative'
        }}
        data-reactflow-wrapper
        onDragEnter={(e) => {
          e.preventDefault();
          e.currentTarget.classList.add('bg-blue-50', 'dark:bg-blue-950', 'border-2', 'border-blue-300', 'border-dashed');
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.currentTarget.classList.remove('bg-blue-50', 'dark:bg-blue-950', 'border-2', 'border-blue-300', 'border-dashed');
        }}
      >
        {/* Loading Overlay */}
        {isLoading && (
          <LoadingOverlay 
            message={`Loading ${currentLayer} layer...`}
            size="md"
          />
        )}
        
        <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={onConnect}
            onReconnect={onReconnect}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onEdgeDoubleClick={onEdgeDoubleClick}
            onPaneClick={onPaneClick}
            onDragOver={onDragOver}
            onDrop={onDrop}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            attributionPosition="bottom-left"
            connectionMode={connectionMode === 'connection' ? "loose" : "strict" as any}
            snapToGrid={true}
            snapGrid={[15, 15]}
            connectionLineType={"step" as any}
            connectionLineStyle={{
              strokeWidth: 3,
              stroke: '#3b82f6',
              strokeDasharray: '5,5',
            }}
            edgesFocusable={true}
            reconnectRadius={20}
            defaultEdgeOptions={{
              style: {
                strokeWidth: currentLayer === "conceptual" ? 3 : 2,
                stroke: currentLayer === "conceptual" ? "#3b82f6" : "#6b7280",
              },
              type: "step",
            }}
            className="w-full h-full bg-background dark:bg-background"
            style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
            proOptions={{ hideAttribution: false }}
          >
            <Controls position="bottom-right" />
          {showMiniMap && (
            <MiniMap
              position="bottom-right"
              style={{
                height: isMapExpanded ? 300 : 150,
                width: isMapExpanded ? 400 : 250,
                marginBottom: 100,
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                transition: 'all 0.2s ease-in-out',
              }}
              nodeColor={(node) => {
                // Color nodes based on their target system for better visibility
                const data = node.data;
                if (data?.isNew) return '#22c55e'; // Green for new items
                
                const targetSystem = data?.targetSystem;
                switch (targetSystem) {
                  case 'Data Lake': return '#3b82f6';
                  case 'Data Warehouse': return '#8b5cf6';
                  case 'Operational Database': return '#10b981';
                  case 'Analytics Platform': return '#f97316';
                  case 'Cloud Storage': return '#06b6d4';
                  case 'Real-time Stream': return '#ef4444';
                  default: return '#64748b';
                }
              }}
              nodeStrokeWidth={2}
              nodeBorderRadius={4}
              zoomable
              pannable
              ariaLabel="Mini-map navigation for data model"
            />
          )}
          <Background
            color="hsl(207, 90%, 54%)"
            gap={20}
            size={1}
            style={{ opacity: 0.1 }}
          />
          <CanvasControls
            onZoomIn={() => {
              zoomIn();
              setZoomLevel(getViewport().zoom);
            }}
            onZoomOut={() => {
              zoomOut();
              setZoomLevel(getViewport().zoom);
            }}
            onFitView={() => {
              fitView();
              setZoomLevel(getViewport().zoom);
            }}
            zoomLevel={zoomLevel}
          />
          
          <MiniMapControls
            onToggleMiniMap={() => setShowMiniMap(!showMiniMap)}
            showMiniMap={showMiniMap}
            onToggleExpanded={() => setIsMapExpanded(!isMapExpanded)}
            isExpanded={isMapExpanded}
          />
          
          <MiniMapLegend visible={showMiniMap && isMapExpanded} />
          
          {nodes.length > 5 && <MiniMapOverlay />}
          
          {/* Undo/Redo Timeline */}
          <div className="absolute bottom-4 left-4 z-10">
            <UndoRedoTimeline />
          </div>

          {/* Auto Layout Manager */}
          {showAutoLayout && nodes.length > 0 && (
            <AutoLayoutManager 
              nodes={nodes}
              edges={edges}
              setNodes={setNodes}
              onLayoutApplied={() => {
                // Save layout changes to history
                setTimeout(() => {
                  saveToHistory('layout_applied', 'Applied auto layout', 'Canvas layout reorganized');
                }, 300);
              }}
            />
          )}
        </ReactFlow>
      </div>

      {/* Search & Filter Panel */}
      <SearchFilterPanel 
        isVisible={showSearchPanel}
        onClose={() => setShowSearchPanel(false)}
      />

      {/* AI Suggestions Panel */}
      <div className="absolute top-20 right-4 z-10">
        <AISuggestionsPanel 
          isVisible={showAISuggestions}
          onToggleVisibility={() => setShowAISuggestions(!showAISuggestions)}
        />
      </div>

      {/* Connection Configuration Dialog */}
      <Dialog open={showConnectionDialog} onOpenChange={setShowConnectionDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create Relationship</DialogTitle>
            <DialogDescription>
              Configure the relationship between the selected data objects.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            
            <div className="space-y-2">
              <Label htmlFor="relationship-type">Relationship Type</Label>
              <Select value={relationshipType} onValueChange={(value: '1:1' | '1:N' | 'N:M') => setRelationshipType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1:1">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span>One-to-One (1:1)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="1:N">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span>One-to-Many (1:N)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="N:M">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                      <span>Many-to-Many (N:M)</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowConnectionDialog(false)}>
                Cancel
              </Button>
              <Button onClick={createConnection}>
                Create Relationship
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Attribute Relationship Modal for Logical/Physical Layers */}
      {attributeConnection && (
        <AttributeRelationshipModal
          isOpen={showAttributeRelationshipModal}
          onClose={() => {
            setShowAttributeRelationshipModal(false);
            setAttributeConnection(null);
          }}
          onConfirm={createAttributeRelationship}
          sourceNode={attributeConnection?.sourceNode}
          targetNode={attributeConnection?.targetNode}
          initialSourceAttributeId={attributeConnection?.sourceAttributeId}
          initialTargetAttributeId={attributeConnection?.targetAttributeId}
        />
      )}

      {/* Edit Relationship Modal */}
      <EditRelationshipModal
        isOpen={showEditRelationshipModal}
        onClose={() => {
          setShowEditRelationshipModal(false);
          setEditingEdge(null);
        }}
        edge={editingEdge}
        onUpdate={handleUpdateRelationship}
        onDelete={handleDeleteRelationship}
      />
    </main>
  );
}

export default function Canvas() {
  return (
    <ReactFlowProvider>
      <CanvasComponent />
    </ReactFlowProvider>
  );
}