
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
  ReactFlowProvider,
} from "reactflow";
import "reactflow/dist/style.css";
import { MousePointer, Move, Link, GitBranch, Save, AlertCircle, CheckCircle, Plus, Trash2 } from "lucide-react";
import { useTouchPerformance, useDeviceCapabilities } from '@/hooks/useTouch';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useModelerStore } from "@/store/modelerStore";
import { useToast } from "@/hooks/use-toast";
import DataObjectNode from "./nodes/DataObjectNode";
import CanvasControls from "./CanvasControls";
import MiniMapControls from "./MiniMapControls";
import UndoRedoTimeline from "./UndoRedoTimeline";
import MiniMapLegend from "./MiniMapLegend";
import MiniMapOverlay from "./MiniMapOverlay";
import AISuggestionsPanel from "./AISuggestionsPanel";
import AttributeRelationshipModal from "./modals/AttributeRelationshipModal";
import EditRelationshipModal from "./modals/EditRelationshipModal";
import AddDataObjectModal from "./modals/AddDataObjectModal";
import DataModelingToolbar from "./Canvas/DataModelingToolbar";
import RelationshipPreview from "./Canvas/RelationshipPreview";
import LayerNavigator from "./LayerNavigator";

import SearchFilterPanel from "./Canvas/SearchFilterPanel";
import AutoLayoutManager from "./Canvas/AutoLayoutManager";
import { updateDynamicColors } from "@/utils/colorUtils";

// Define nodeTypes outside component to avoid recreation warning
const nodeTypes: NodeTypes = {
  dataObject: DataObjectNode,
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
    currentLayer,
    history,
    undo,
    redo,
    clearHistory
  } = useModelerStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [showMiniMap, setShowMiniMap] = useState(true);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [connectionMode, setConnectionMode] = useState<'selection' | 'connection'>('selection');
  const [pendingConnection, setPendingConnection] = useState<{ source: string; target: string } | null>(null);
  const [showConnectionDialog, setShowConnectionDialog] = useState(false);
  const [relationshipType, setRelationshipType] = useState<'1:1' | '1:N' | 'N:M'>('1:N');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [showAddObjectModal, setShowAddObjectModal] = useState(false);
  const [showAISuggestions, setShowAISuggestions] = useState(false);
  const [showMobileGestures, setShowMobileGestures] = useState(false);
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [showAutoLayout, setShowAutoLayout] = useState(true);
  
  // New state for attribute relationship modal
  const [showAttributeRelationshipModal, setShowAttributeRelationshipModal] = useState(false);
  const [attributeConnection, setAttributeConnection] = useState<{
    sourceNode: any;
    targetNode: any;
    sourceHandle?: string;
    targetHandle?: string;
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

  // Mutation for saving node positions with enhanced error handling
  const savePositionsMutation = useMutation({
    mutationFn: async (positions: { objectId: number, position: { x: number, y: number } }[]) => {
      const targetModelId = currentLayerModel?.id || currentModel?.id;
      if (!targetModelId) throw new Error("No current model");
      
      setSaveStatus('saving');
      
      const response = await fetch(`/api/models/${targetModelId}/canvas/positions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          positions,
          layer: currentLayer 
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to save positions: ${response.status} ${errorText}`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      setSaveStatus('saved');
      // Clear saved status after 2 seconds
      setTimeout(() => setSaveStatus('idle'), 2000);
      
      // Invalidate and refetch canvas data to ensure consistency
      queryClient.invalidateQueries({
        queryKey: ["/api/models", currentLayerModel?.id, "canvas", currentLayer]
      });
    },
    onError: (error) => {
      console.error('Failed to save positions:', error);
      setSaveStatus('error');
      // Clear error status after 5 seconds
      setTimeout(() => setSaveStatus('idle'), 5000);
    }
  });

  // Mutation for saving relationships to database with enhanced error handling
  const saveRelationshipMutation = useMutation({
    mutationFn: async (relationshipData: { 
      sourceObjectId: number; 
      targetObjectId: number; 
      type: string; 
      modelId: number;
      sourceAttributeId?: number;
      targetAttributeId?: number;
    }) => {
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
  const { data: allModels } = useQuery({
    queryKey: ["/api/models"],
  });

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

  // Find the specific model for current layer
  const getCurrentLayerModel = () => {
    if (!currentModel || !allModels) return null;
    
    // If current model is already the correct layer, return it
    if (currentModel.layer === currentLayer) {
      return currentModel;
    }
    
    // Find the model family (conceptual + logical + physical)
    const modelFamily = (allModels as any[]).filter((model: any) => 
      model.parentModelId === currentModel.id || model.id === currentModel.id
    );
    
    // Find the specific layer model
    const layerModel = modelFamily.find((m: any) => m.layer === currentLayer);
    
    if (layerModel) {
      return layerModel;
    }
    
    // Fallback to current model if layer model not found
    console.warn(`Layer model for ${currentLayer} not found, using current model`);
    return currentModel;
  };

  const currentLayerModel = getCurrentLayerModel();

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

  // Update dynamic colors when systems, domains, or areas change
  useEffect(() => {
    if (systems && domains && areas) {
      updateDynamicColors(systems as any[], domains as any[], areas as any[]);
      // Force re-render of nodes to apply new colors
      setNodes(prevNodes => [...prevNodes]);
    }
  }, [systems, domains, areas, setNodes]);

  // Update local state when canvas data loads and manage history properly
  useEffect(() => {
    if (canvasData && canvasData.nodes && canvasData.edges) {
      console.log('Loading canvas data:', canvasData.nodes.length, 'nodes,', canvasData.edges.length, 'edges');
      setIsDataLoading(true);
      
      // Clear history first to prevent conflicts with new data
      clearHistory();
      
      setNodes(canvasData.nodes);
      setEdges(canvasData.edges);
      
      // Sync nodes and edges to the store for PropertiesPanel
      setStoreNodes(canvasData.nodes);
      setStoreEdges(canvasData.edges);
      
      // Initialize history with current state after data is loaded
      if (canvasData.nodes.length > 0) {
        setTimeout(() => {
          saveToHistory('initial', 'Initial canvas state', 
            `Loaded model with ${canvasData.nodes.length} objects and ${canvasData.edges.length} relationships`);
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
          if (!currentModel) {
            toast({
              title: "No Active Model Selected",
              description: "Please select a data model before adding objects to the canvas.",
              variant: "destructive"
            });
            return;
          }

          // Add to local state first for immediate visual feedback
          setNodes((nds) => [...nds, newNode]);
          
          console.log('✓ Node added to canvas via touchDrop:', newNode.id);

          // Save to database - create data_model_object entry
          const targetModelId = object.layerModelId || currentLayerModel?.id || currentModel?.id;
          if (targetModelId) {
            fetch(`/api/models/${targetModelId}/objects`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                objectId: object.id,
                position: position,
                targetSystem: object.targetSystem,
                isVisible: true,
                layerSpecificConfig: {
                  position: position,
                  layer: object.currentLayer || currentLayer
                }
              }),
            })
            .then(response => {
              if (!response.ok) {
                throw new Error(`Failed to add object to model: ${response.statusText}`);
              }
              return response.json();
            })
            .then(() => {
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
              
              toast({
                title: "✓ Object Added Successfully",
                description: `${object.name} has been added to the canvas.`
              });
            })
            .catch(error => {
              console.error('Failed to save object to database:', error);
              // Remove from local state if database save failed
              setNodes((nds) => nds.filter(n => n.id !== newNode.id));
              toast({
                title: "Failed to Add Object",
                description: `Could not save ${object.name} to the database.`,
                variant: "destructive"
              });
            });
          } else {
            console.error('No current model to add object to');
            setNodes((nds) => nds.filter(n => n.id !== newNode.id));
            toast({
              title: "No Active Model",
              description: "Please select a model before adding objects.",
              variant: "destructive"
            });
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

          // Add to local state first for immediate visual feedback
          setNodes((nds) => [...nds, ...newNodes]);

          // Save to database
          const targetModelId = currentLayerModel?.id || currentModel?.id;
          if (targetModelId) {
            const savePromises = newNodes.map((node: any) => 
              fetch(`/api/models/${targetModelId}/objects`, {
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
              })
            );

            Promise.all(savePromises)
            .then(responses => {
              const failedSaves = responses.filter(res => !res.ok);
              if (failedSaves.length > 0) {
                throw new Error(`Failed to save ${failedSaves.length} objects`);
              }
              
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
            toast({
              title: "No Active Model",
              description: "Please select a model before adding objects.",
              variant: "destructive"
            });
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
  }, [nodes, currentLayerModel, currentModel, currentLayer, setNodes, screenToFlowPosition, queryClient, saveToHistory, toast]);

  // Handle gesture events
  useEffect(() => {
    const handleOpenAddObjectModal = () => {
      setShowAddObjectModal(true);
    };

    window.addEventListener('openAddObjectModal', handleOpenAddObjectModal);

    return () => {
      window.removeEventListener('openAddObjectModal', handleOpenAddObjectModal);
    };
  }, []);

  // Enhanced onNodesChange handler with robust position saving
  const savePositionsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const handleNodesChange = useCallback((changes: any[]) => {
    // Apply changes to local state first
    onNodesChange(changes);
    
    // Check if any position changes occurred (when dragging is complete)
    const positionChanges = changes.filter(change => 
      change.type === 'position' && 
      change.position && 
      !change.dragging && // Only save when dragging is complete
      change.id // Ensure we have a valid node ID
    );
    
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
    
    if (positionChanges.length > 0 && currentModel?.id) {
      // Clear existing timeout to debounce multiple rapid changes
      if (savePositionsTimeoutRef.current) {
        clearTimeout(savePositionsTimeoutRef.current);
      }
      
      // Debounce position saving to avoid excessive API calls
      savePositionsTimeoutRef.current = setTimeout(() => {
        setNodes(currentNodes => {
          // Filter out nodes without objectId and ensure data integrity
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
          
          if (validNodes.length === 0) return currentNodes;
          
          const positions = validNodes.map(node => ({
            objectId: node.data.objectId,
            position: {
              x: Math.round(node.position.x * 100) / 100, // Round to 2 decimal places
              y: Math.round(node.position.y * 100) / 100
            }
          }));
          
          // Only save if we have valid positions and current layer model exists
          if (positions.length > 0 && (currentLayerModel?.id || currentModel?.id)) {
            savePositionsMutation.mutate(positions);
          }
          
          return currentNodes;
        });
      }, 500); // Save after 500ms of no changes
    }
  }, [onNodesChange, savePositionsMutation, currentModel?.id, saveToHistory, setEdges]);

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
            // Use navigator.sendBeacon for reliable cleanup save
            const data = JSON.stringify({ 
              positions,
              layer: currentLayer 
            });
            
            navigator.sendBeacon?.(`/api/models/${targetModelId}/canvas/positions`, 
              new Blob([data], { type: 'application/json' })) ||
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
  }, [undo, redo, showAutoLayout]);

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
            targetHandle: params.targetHandle || undefined
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
          target: params.target
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
      type: "smoothstep",
      animated: relationshipType === 'N:M',
      style: {
        stroke: relationshipType === '1:1' ? '#10b981' : relationshipType === '1:N' ? '#3b82f6' : '#8b5cf6',
        strokeWidth: 2,
      },
      label: relationshipType,
      labelStyle: { fontSize: 12, fontWeight: 'bold' },
      data: {
        relationshipType,
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

    // Save relationship to database
    saveRelationshipMutation.mutate({
      sourceObjectId: parseInt(pendingConnection.source),
      targetObjectId: parseInt(pendingConnection.target),
      type: relationshipType,
      modelId: currentModel.id,
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
  }, [pendingConnection, relationshipType, storeAddEdge, saveToHistory, setEdges, currentModel?.id, saveRelationshipMutation]);

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
      animated: relationshipData.type === 'N:M',
      style: {
        stroke: relationshipData.type === '1:1' ? '#10b981' : relationshipData.type === '1:N' ? '#3b82f6' : '#8b5cf6',
        strokeWidth: 2,
        strokeDasharray: '5,5', // Dashed line to differentiate from object relationships
      },
      label: relationshipData.type,
      labelStyle: { fontSize: 10, fontWeight: 'bold' },
      data: {
        relationshipType: relationshipData.type,
        sourceAttributeId: relationshipData.sourceAttributeId,
        targetAttributeId: relationshipData.targetAttributeId,
        isAttributeRelationship: true,
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

    // Save relationship to database with attribute details
    saveRelationshipMutation.mutate({
      sourceObjectId: parseInt(attributeConnection.sourceNode.id),
      targetObjectId: parseInt(attributeConnection.targetNode.id),
      type: relationshipData.type,
      modelId: currentModel.id,
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
  }, [attributeConnection, storeAddEdge, saveToHistory, setEdges, currentModel?.id, saveRelationshipMutation]);

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
                animated: relationshipType === 'N:M',
                style: {
                  ...edge.style,
                  stroke: relationshipType === '1:1' ? '#10b981' : relationshipType === '1:N' ? '#3b82f6' : '#8b5cf6',
                },
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
            domain: object.domainName || 'Uncategorized',
            dataArea: object.dataAreaName || 'General',
            attributes: object.attributes || [],
            sourceSystem: object.sourceSystem,
            targetSystem: object.targetSystem,
            isNew: object.isNew || false
          }
        };

        // Check if we have a current model selected
        if (!currentModel) {
          toast({
            title: "No Active Model Selected",
            description: "Please select a data model before adding objects to the canvas.",
            variant: "destructive"
          });
          return;
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

        // Add to local state first for immediate visual feedback
        setNodes((nds) => [...nds, newNode]);
        
        console.log('✓ Node added to canvas:', newNode.id);

        // Save to database - create data_model_object entry
        const targetModelId = object.layerModelId || currentLayerModel?.id || currentModel?.id;
        if (targetModelId) {
          fetch(`/api/models/${targetModelId}/objects`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              objectId: object.id,
              position: position,
              targetSystem: object.targetSystem,
              isVisible: true,
              layerSpecificConfig: {
                position: position,
                layer: object.currentLayer || currentLayer
              }
            }),
          })
          .then(response => {
            if (!response.ok) {
              throw new Error(`Failed to add object to model: ${response.statusText}`);
            }
            return response.json();
          })
          .then(() => {
            // Invalidate canvas query to refresh data
            queryClient.invalidateQueries({
              queryKey: ["/api/models", targetModelId, "canvas", currentLayer]
            });
            
            // Save to history
            saveToHistory('node_added', `Added ${object.name} to canvas`, 
              `Dragged ${object.name} from sidebar to canvas`);
            
            toast({
              title: "✓ Object Added Successfully", 
              description: `${object.name} has been added to the canvas. Click on it to edit properties.`
            });
            
            // Auto-select the new node
            setTimeout(() => {
              selectNode(newNode.id);
            }, 200);
          })
          .catch(error => {
            console.error('Failed to save object to database:', error);
            // Remove from local state if database save failed
            setNodes((nds) => nds.filter(n => n.id !== newNode.id));
            toast({
              title: "Failed to Add Object",
              description: `Could not save ${object.name} to the database.`,
              variant: "destructive"
            });
          });
        } else {
          console.error('No current model to add object to');
          setNodes((nds) => nds.filter(n => n.id !== newNode.id));
          toast({
            title: "⚠️ No Active Model Selected",
            description: "Please select a model from the top navigation before adding objects. Current model: " + (currentModel?.name || "None"),
            variant: "destructive"
          });
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

        // Add to local state first for immediate visual feedback
        setNodes((nds) => [...nds, ...nodesToAdd]);

        // Save each object to database
        const targetModelId = currentLayerModel?.id || currentModel?.id;
        if (targetModelId) {
          Promise.all(nodesToAdd.map(async (node: any) => {
            const objectId = node.data.objectId;
            const position = node.position;
            
            return fetch(`/api/models/${targetModelId}/objects`, {
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
          }))
          .then(responses => {
            // Check if all requests were successful
            const failedRequests = responses.filter(response => !response.ok);
            if (failedRequests.length > 0) {
              throw new Error(`${failedRequests.length} objects failed to save`);
            }
            
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
          toast({
            title: "No Active Model",
            description: "Please select a model before adding objects.",
            variant: "destructive"
          });
        }
      }
    } catch (error) {
      console.error('Failed to parse drop data:', error);
    }
  }, [setNodes, screenToFlowPosition, saveToHistory, toast]);

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
        onSave={() => {
          setNodes((currentNodes) => {
            const validNodes = currentNodes.filter(node => 
              node.data && node.data.objectId && node.position
            );
            
            if (validNodes.length > 0 && currentModel?.id) {
              const positions = validNodes.map(node => ({
                objectId: node.data.objectId,
                position: node.position
              }));
              savePositionsMutation.mutate(positions);
            }
            
            return currentNodes;
          });
        }}
        currentLayer={currentLayer}
        onAddObject={() => setShowAddObjectModal(true)}
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
        <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onEdgeDoubleClick={onEdgeDoubleClick}
            onPaneClick={onPaneClick}
            onDragOver={onDragOver}
            onDrop={onDrop}
            nodeTypes={nodeTypes}
            fitView
            attributionPosition="bottom-left"
            connectionMode={"strict" as any}
            snapToGrid={true}
            snapGrid={[15, 15]}
            connectionLineType={"smoothstep" as any}
            connectionLineStyle={{
              strokeWidth: 3,
              stroke: '#3b82f6',
              strokeDasharray: '5,5',
            }}
            defaultEdgeOptions={{
              style: {
                strokeWidth: currentLayer === "conceptual" ? 3 : 2,
                stroke: currentLayer === "conceptual" ? "#3b82f6" : "#6b7280",
              },
              type: "smoothstep",
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

      {/* Add Data Object Modal */}
      <AddDataObjectModal
        open={showAddObjectModal}
        onOpenChange={setShowAddObjectModal}
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