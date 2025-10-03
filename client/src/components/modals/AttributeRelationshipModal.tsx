import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Key, ExternalLink } from "lucide-react";

interface AttributeRelationshipModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (relationshipData: {
    sourceAttributeId: number;
    targetAttributeId: number;
    type: "1:1" | "1:N" | "N:M";
  }) => void;
  sourceNode: {
    id: string;
    name: string;
    attributes: any[];
  };
  targetNode: {
    id: string;
    name: string;
    attributes: any[];
  };
  initialSourceAttributeId?: number;
  initialTargetAttributeId?: number;
}

export default function AttributeRelationshipModal({
  isOpen,
  onClose,
  onConfirm,
  sourceNode,
  targetNode,
  initialSourceAttributeId,
  initialTargetAttributeId
}: AttributeRelationshipModalProps) {
  const [sourceAttributeId, setSourceAttributeId] = useState<number | null>(null);
  const [targetAttributeId, setTargetAttributeId] = useState<number | null>(null);
  const [relationshipType, setRelationshipType] = useState<"1:1" | "1:N" | "N:M">("1:1");

  useEffect(() => {
    if (isOpen) {
      setSourceAttributeId(initialSourceAttributeId ?? null);
      setTargetAttributeId(initialTargetAttributeId ?? null);
    }
  }, [isOpen, initialSourceAttributeId, initialTargetAttributeId]);

  const handleConfirm = () => {
    if (sourceAttributeId && targetAttributeId) {
      onConfirm({
        sourceAttributeId,
        targetAttributeId,
        type: relationshipType
      });
      setSourceAttributeId(null);
      setTargetAttributeId(null);
      setRelationshipType("1:N");
      onClose();
    }
  };

  const handleCancel = () => {
    setSourceAttributeId(null);
    setTargetAttributeId(null);
    setRelationshipType("1:N");
    onClose();
  };

  const selectedSourceAttribute = sourceNode.attributes.find(attr => attr.id === sourceAttributeId);
  const selectedTargetAttribute = targetNode.attributes.find(attr => attr.id === targetAttributeId);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Attribute Relationship</DialogTitle>
          <DialogDescription>
            Define a relationship between attributes in the selected data objects.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Source and Target Objects */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">Source Object</Label>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="font-medium text-blue-900">{sourceNode.name}</div>
                <div className="text-xs text-blue-600">{sourceNode.attributes.length} attributes</div>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">Target Object</Label>
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="font-medium text-green-900">{targetNode.name}</div>
                <div className="text-xs text-green-600">{targetNode.attributes.length} attributes</div>
              </div>
            </div>
          </div>

          {/* Attribute Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="source-attribute">Source Attribute</Label>
              <Select
                value={sourceAttributeId !== null ? sourceAttributeId.toString() : undefined}
                onValueChange={(value) => setSourceAttributeId(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select source attribute" />
                </SelectTrigger>
                <SelectContent>
                  {sourceNode.attributes.map((attr) => (
                    <SelectItem key={attr.id} value={attr.id.toString()}>
                      <div className="flex items-center space-x-2">
                        {attr.isPrimaryKey && <Key className="h-3 w-3 text-yellow-500" />}
                        {attr.isForeignKey && <ExternalLink className="h-3 w-3 text-blue-500" />}
                        <span>{attr.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {attr.logicalType || attr.conceptualType}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="target-attribute">Target Attribute</Label>
              <Select
                value={targetAttributeId !== null ? targetAttributeId.toString() : undefined}
                onValueChange={(value) => setTargetAttributeId(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select target attribute" />
                </SelectTrigger>
                <SelectContent>
                  {targetNode.attributes.map((attr) => (
                    <SelectItem key={attr.id} value={attr.id.toString()}>
                      <div className="flex items-center space-x-2">
                        {attr.isPrimaryKey && <Key className="h-3 w-3 text-yellow-500" />}
                        {attr.isForeignKey && <ExternalLink className="h-3 w-3 text-blue-500" />}
                        <span>{attr.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {attr.logicalType || attr.conceptualType}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Relationship Type */}
          <div className="space-y-2">
            <Label htmlFor="relationship-type">Relationship Type</Label>
            <Select value={relationshipType} onValueChange={(value) => setRelationshipType(value as "1:1" | "1:N" | "N:M")}>
              <SelectTrigger>
                <SelectValue placeholder="Select relationship type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1:1">One-to-One (1:1)</SelectItem>
                <SelectItem value="1:N">One-to-Many (1:N)</SelectItem>
                <SelectItem value="N:M">Many-to-Many (N:M)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Preview */}
          {selectedSourceAttribute && selectedTargetAttribute && (
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-sm font-medium mb-2">Relationship Preview:</div>
              <div className="text-sm text-muted-foreground">
                <span className="font-medium">{sourceNode.name}.{selectedSourceAttribute.name}</span>
                <span className="mx-2">→</span>
                <span className="font-medium">{targetNode.name}.{selectedTargetAttribute.name}</span>
                <span className="ml-2">({relationshipType})</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={!sourceAttributeId || !targetAttributeId}
          >
            Create Relationship
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}