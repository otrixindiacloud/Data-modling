import { useState, useEffect } from 'react';
import { useReactFlow } from 'reactflow';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Check, X, Info } from "lucide-react";

interface RelationshipPreviewProps {
  pendingConnection: {
    source: string;
    target: string;
  } | null;
  onConfirm: (type: '1:1' | '1:N' | 'N:M') => void;
  onCancel: () => void;
  currentLayer: string;
}

export default function RelationshipPreview({
  pendingConnection,
  onConfirm,
  onCancel,
  currentLayer
}: RelationshipPreviewProps) {
  const { getNode } = useReactFlow();
  const [selectedType, setSelectedType] = useState<'1:1' | '1:N' | 'N:M'>('1:N');
  const [autoDetectedType, setAutoDetectedType] = useState<'1:1' | '1:N' | 'N:M' | null>(null);

  useEffect(() => {
    if (pendingConnection) {
      const sourceNode = getNode(pendingConnection.source);
      const targetNode = getNode(pendingConnection.target);
      
      if (sourceNode && targetNode) {
        // Smart relationship type detection based on entity names and attributes
        const sourceName = sourceNode.data.name.toLowerCase();
        const targetName = targetNode.data.name.toLowerCase();
        
        // Detect common patterns
        let detectedType: '1:1' | '1:N' | 'N:M' = '1:N';
        
        // Check for many-to-many patterns
        if (
          (sourceName.includes('user') && targetName.includes('role')) ||
          (sourceName.includes('student') && targetName.includes('course')) ||
          (sourceName.includes('product') && targetName.includes('category')) ||
          (sourceName.includes('tag') || targetName.includes('tag'))
        ) {
          detectedType = 'N:M';
        }
        // Check for one-to-one patterns
        else if (
          (sourceName.includes('profile') || targetName.includes('profile')) ||
          (sourceName.includes('detail') || targetName.includes('detail')) ||
          (sourceName.includes('config') || targetName.includes('config'))
        ) {
          detectedType = '1:1';
        }
        
        setAutoDetectedType(detectedType);
        setSelectedType(detectedType);
      }
    }
  }, [pendingConnection, getNode]);

  if (!pendingConnection) return null;

  const sourceNode = getNode(pendingConnection.source);
  const targetNode = getNode(pendingConnection.target);

  if (!sourceNode || !targetNode) return null;

  const relationshipTypes = [
    {
      type: '1:1' as const,
      label: 'One-to-One',
      description: 'Each record in source relates to exactly one record in target',
      example: 'User ↔ Profile',
      icon: '1:1'
    },
    {
      type: '1:N' as const,
      label: 'One-to-Many',
      description: 'Each record in source can relate to multiple records in target',
      example: 'Department → Employees',
      icon: '1:∞'
    },
    {
      type: 'N:M' as const,
      label: 'Many-to-Many',
      description: 'Records in both entities can relate to multiple records in the other',
      example: 'Students ↔ Courses',
      icon: '∞:∞'
    }
  ];

  return (
    <div className="absolute inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center">
      <Card className="w-96 shadow-2xl border-2">
        <CardContent className="p-6">
          <div className="space-y-4">
            {/* Header */}
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">Define Relationship</h3>
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Badge variant="outline">{sourceNode.data.name}</Badge>
                <ArrowRight className="h-4 w-4" />
                <Badge variant="outline">{targetNode.data.name}</Badge>
              </div>
            </div>

            {/* Auto-detection hint */}
            {autoDetectedType && (
              <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <Info className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-blue-700 dark:text-blue-300">
                  Suggested: <strong>{relationshipTypes.find(t => t.type === autoDetectedType)?.label}</strong>
                </span>
              </div>
            )}

            {/* Relationship Type Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Relationship Type:</label>
              {relationshipTypes.map((type) => (
                <button
                  key={type.type}
                  onClick={() => setSelectedType(type.type)}
                  className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                    selectedType === type.type
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-sm font-bold">{type.icon}</span>
                        <span className="font-medium">{type.label}</span>
                        {autoDetectedType === type.type && (
                          <Badge variant="secondary" className="text-xs">Suggested</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mb-1">{type.description}</p>
                      <p className="text-xs text-primary font-medium">{type.example}</p>
                    </div>
                    {selectedType === type.type && (
                      <Check className="h-4 w-4 text-primary flex-shrink-0 mt-1" />
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Layer-specific information */}
            {currentLayer !== 'conceptual' && (
              <div className="p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  <strong>{currentLayer === 'logical' ? 'Logical' : 'Physical'} Layer:</strong> 
                  {currentLayer === 'logical' 
                    ? ' This will create foreign key references between attributes.'
                    : ' This will generate the actual database constraints and indexes.'
                  }
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={onCancel}
                className="flex-1"
              >
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
              <Button
                onClick={() => onConfirm(selectedType)}
                className="flex-1"
              >
                <Check className="h-4 w-4 mr-1" />
                Create Relationship
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}