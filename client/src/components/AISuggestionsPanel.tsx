import React, { useState, useEffect } from "react";
import { Lightbulb, Zap, ArrowRight, Check, X, ChevronDown, ChevronUp, RefreshCw, Eye, EyeOff, Loader2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useModelerStore } from "@/store/modelerStore";

interface RelationshipSuggestion {
  sourceObjectId: number;
  targetObjectId: number;
  type: "1:1" | "1:N" | "N:M";
  sourceAttributeName: string;
  targetAttributeName: string;
  confidence: number;
  reasoning: string;
}

interface DomainSuggestion {
  domain: string;
  dataArea: string;
  confidence: number;
  reasoning: string;
}

interface AISuggestionsPanelProps {
  isVisible: boolean;
  onToggleVisibility: () => void;
}

export default function AISuggestionsPanel({ isVisible, onToggleVisibility }: AISuggestionsPanelProps) {
  const { currentModel, nodes, currentLayer } = useModelerStore();
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [appliedSuggestions, setAppliedSuggestions] = useState<Set<string>>(new Set());
  const [relationshipSuggestions, setRelationshipSuggestions] = useState<RelationshipSuggestion[]>([]);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);

  // Manual fetch relationship suggestions mutation
  const fetchSuggestionsMutation = useMutation({
    mutationFn: async () => {
      if (!currentModel?.id) throw new Error("No current model");
      
      const response = await apiRequest('POST', '/api/ai/suggest-relationships', {
        modelId: currentModel.id,
        layer: currentLayer
      });
      return response.json() as Promise<RelationshipSuggestion[]>;
    },
    onSuccess: (data) => {
      setRelationshipSuggestions(data);
      setLastFetchTime(new Date());
    },
    onError: (error) => {
      console.error('Failed to fetch AI suggestions:', error);
    }
  });

  const handleFetchSuggestions = () => {
    if (currentModel?.id) {
      fetchSuggestionsMutation.mutate();
    }
  };

  // Apply relationship suggestion mutation
  const applyRelationshipMutation = useMutation({
    mutationFn: async (suggestion: RelationshipSuggestion) => {
      // For logical/physical layers, find attribute IDs based on names
      let sourceAttributeId = undefined;
      let targetAttributeId = undefined;
      
      if (currentLayer === 'logical' || currentLayer === 'physical') {
        const sourceNode = nodes.find(n => n.data.objectId === suggestion.sourceObjectId);
        const targetNode = nodes.find(n => n.data.objectId === suggestion.targetObjectId);
        
        if (sourceNode && targetNode) {
          const sourceAttr = sourceNode.data.attributes?.find((attr: any) => attr.name === suggestion.sourceAttributeName);
          const targetAttr = targetNode.data.attributes?.find((attr: any) => attr.name === suggestion.targetAttributeName);
          
          if (sourceAttr && targetAttr) {
            sourceAttributeId = sourceAttr.id;
            targetAttributeId = targetAttr.id;
          } else {
            // Log the issue for debugging
            console.error('Could not find attributes:', {
              sourceAttributeName: suggestion.sourceAttributeName,
              targetAttributeName: suggestion.targetAttributeName,
              sourceAttributes: sourceNode.data.attributes?.map((a: any) => a.name),
              targetAttributes: targetNode.data.attributes?.map((a: any) => a.name)
            });
            
            // For logical/physical layers, we MUST have attribute IDs
            // If we can't find them, don't create the relationship
            if (!sourceAttr || !targetAttr) {
              throw new Error(`Cannot create attribute-level relationship: Missing attributes ${suggestion.sourceAttributeName} or ${suggestion.targetAttributeName}`);
            }
          }
        } else {
          console.error('Could not find nodes:', {
            sourceObjectId: suggestion.sourceObjectId,
            targetObjectId: suggestion.targetObjectId,
            availableNodes: nodes.map(n => ({ id: n.id, objectId: n.data.objectId }))
          });
          throw new Error(`Cannot find nodes for relationship: ${suggestion.sourceObjectId} -> ${suggestion.targetObjectId}`);
        }
      }

      const relationshipData = {
        sourceObjectId: suggestion.sourceObjectId,
        targetObjectId: suggestion.targetObjectId,
        type: suggestion.type,
        modelId: currentModel!.id,
        ...(sourceAttributeId && { sourceAttributeId }),
        ...(targetAttributeId && { targetAttributeId })
      };

      console.log('Creating relationship with data:', relationshipData);
      
      const response = await apiRequest('POST', '/api/relationships', relationshipData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/models', currentModel!.id, 'canvas', currentLayer] });
    }
  });

  const handleApplySuggestion = (suggestion: RelationshipSuggestion) => {
    const suggestionKey = `${suggestion.sourceObjectId}-${suggestion.targetObjectId}-${suggestion.sourceAttributeName}-${suggestion.targetAttributeName}`;
    applyRelationshipMutation.mutate(suggestion);
    setAppliedSuggestions(prev => new Set(prev).add(suggestionKey));
  };

  const handleDismissSuggestion = (suggestion: RelationshipSuggestion) => {
    const suggestionKey = `${suggestion.sourceObjectId}-${suggestion.targetObjectId}-${suggestion.sourceAttributeName}-${suggestion.targetAttributeName}`;
    setAppliedSuggestions(prev => new Set(prev).add(suggestionKey));
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "bg-green-100 text-green-800";
    if (confidence >= 0.6) return "bg-yellow-100 text-yellow-800";
    return "bg-orange-100 text-orange-800";
  };

  const getObjectName = (objectId: number) => {
    const node = nodes.find(n => parseInt(n.id) === objectId);
    return node?.data?.name || `Object ${objectId}`;
  };

  if (!currentModel) {
    return (
      <Card className="w-80 h-fit">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center space-x-2 text-sm">
            <Lightbulb className="h-4 w-4" />
            <span>AI Suggestions</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const activeSuggestions = relationshipSuggestions?.filter(suggestion => {
    const suggestionKey = `${suggestion.sourceObjectId}-${suggestion.targetObjectId}-${suggestion.sourceAttributeName}-${suggestion.targetAttributeName}`;
    return !appliedSuggestions.has(suggestionKey);
  }) || [];

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed top-20 right-4 z-40 transition-all duration-300">
      {isMinimized ? (
        // Minimized state - just the icon
        <Button
          variant="outline"
          size="sm"
          className="h-12 w-12 p-0 bg-background border shadow-lg rounded-lg"
          onClick={() => setIsMinimized(false)}
          title="Show AI Recommendations"
        >
          <Lightbulb className="h-4 w-4 text-blue-500" />
          {activeSuggestions.length > 0 && (
            <Badge variant="secondary" className="absolute -top-2 -right-2 h-5 w-5 p-0 text-xs">
              {activeSuggestions.length}
            </Badge>
          )}
        </Button>
      ) : (
        // Full panel
        <Card className="w-80 max-h-[calc(100vh-100px)] bg-background shadow-lg">
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="flex items-center space-x-2 p-0 h-auto">
                    <CardTitle className="flex items-center space-x-2 text-sm">
                      <Lightbulb className="h-4 w-4" />
                      <span>AI Suggestions</span>
                      {activeSuggestions.length > 0 && (
                        <Badge variant="secondary" className="ml-2">
                          {activeSuggestions.length}
                        </Badge>
                      )}
                    </CardTitle>
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
                
                <div className="flex items-center space-x-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleFetchSuggestions}
                    disabled={fetchSuggestionsMutation.isPending || !currentModel}
                    className="h-6 px-2 text-xs"
                    title="Refresh suggestions"
                  >
                    {fetchSuggestionsMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsMinimized(true)}
                    className="h-6 w-6 p-0"
                    title="Minimize panel"
                  >
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={onToggleVisibility}
                    className="h-6 w-6 p-0"
                    title="Close panel"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              
              <CollapsibleContent>
                <CardDescription className="text-xs mt-2">
                  AI-powered relationship suggestions
                </CardDescription>
                {lastFetchTime && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Last updated: {lastFetchTime.toLocaleTimeString()}
                  </p>
                )}
              </CollapsibleContent>
            </CardHeader>
        
        <CollapsibleContent>
          <CardContent className="space-y-3">
          {activeSuggestions.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground">
              <Zap className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No new suggestions available</p>
              <p className="text-xs mt-1">Add more objects to get AI relationship suggestions</p>
            </div>
          ) : (
            activeSuggestions.map((suggestion, index) => {
              const suggestionKey = `${suggestion.sourceObjectId}-${suggestion.targetObjectId}-${suggestion.sourceAttributeName}-${suggestion.targetAttributeName}`;
              const isApplying = applyRelationshipMutation.isPending;
              
              return (
                <div key={suggestionKey} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <Badge variant="outline" className="text-xs">
                          {suggestion.type}
                        </Badge>
                        <Badge className={`text-xs ${getConfidenceColor(suggestion.confidence)}`}>
                          {Math.round(suggestion.confidence * 100)}%
                        </Badge>
                      </div>
                      
                      <div className="text-sm font-medium mb-1">
                        <span className="text-blue-600">{getObjectName(suggestion.sourceObjectId)}</span>
                        <ArrowRight className="h-3 w-3 inline mx-1" />
                        <span className="text-blue-600">{getObjectName(suggestion.targetObjectId)}</span>
                      </div>
                      
                      <div className="text-xs text-muted-foreground mb-2">
                        {suggestion.sourceAttributeName} → {suggestion.targetAttributeName}
                      </div>
                      
                      <p className="text-xs text-muted-foreground">
                        {suggestion.reasoning}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      variant="default"
                      className="flex-1 text-xs h-7"
                      onClick={() => handleApplySuggestion(suggestion)}
                      disabled={isApplying}
                    >
                      <Check className="h-3 w-3 mr-1" />
                      Apply
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7"
                      onClick={() => handleDismissSuggestion(suggestion)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </CollapsibleContent>
      </Collapsible>
    </Card>
      )}
    </div>
  );
}