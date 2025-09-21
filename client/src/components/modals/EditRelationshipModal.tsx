import { useState } from "react";
import { Edge } from "reactflow";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface EditRelationshipModalProps {
  isOpen: boolean;
  onClose: () => void;
  edge: Edge | null;
  onUpdate: (relationshipType: "1:1" | "1:N" | "N:M") => void;
  onDelete: () => void;
}

export default function EditRelationshipModal({
  isOpen,
  onClose,
  edge,
  onUpdate,
  onDelete
}: EditRelationshipModalProps) {
  const [relationshipType, setRelationshipType] = useState<"1:1" | "1:N" | "N:M">(
    edge?.data?.relationshipType || "1:1"
  );
  const { toast } = useToast();

  const handleUpdate = () => {
    if (relationshipType !== edge?.data?.relationshipType) {
      onUpdate(relationshipType);
    }
    onClose();
  };

  const handleDelete = () => {
    if (window.confirm("Are you sure you want to delete this relationship?")) {
      onDelete();
      onClose();
      toast({
        title: "Relationship Deleted",
        description: "The relationship has been removed from the model."
      });
    }
  };

  if (!edge) return null;

  const isAttributeRelationship = edge.data?.isAttributeRelationship;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-96">
        <DialogHeader>
          <DialogTitle>
            Edit {isAttributeRelationship ? 'Attribute' : 'Object'} Relationship
          </DialogTitle>
          <DialogDescription>
            Modify the relationship type or remove this connection between data objects.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Connection Preview */}
          <div className="flex items-center justify-center gap-2 p-3 bg-muted rounded-lg">
            <Badge variant="outline">{edge.source}</Badge>
            <ArrowRight className="h-4 w-4" />
            <Badge variant="outline">{edge.target}</Badge>
          </div>

          {/* Current Type Display */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Current Type:</p>
            <Badge variant="secondary" className="mt-1">
              {edge.data?.relationshipType || 'Unknown'}
            </Badge>
          </div>

          {/* Relationship Type Selector */}
          <div className="space-y-2">
            <Label>New Relationship Type</Label>
            <Select value={relationshipType} onValueChange={(value) => setRelationshipType(value as "1:1" | "1:N" | "N:M")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1:1">One-to-One (1:1)</SelectItem>
                <SelectItem value="1:N">One-to-Many (1:N)</SelectItem>
                <SelectItem value="N:M">Many-to-Many (N:M)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Type Descriptions */}
          <div className="text-xs text-muted-foreground space-y-1">
            {relationshipType === "1:1" && (
              <p>• Each record in source relates to exactly one record in target</p>
            )}
            {relationshipType === "1:N" && (
              <p>• Each record in source can relate to multiple records in target</p>
            )}
            {relationshipType === "N:M" && (
              <p>• Records in both entities can relate to multiple records in the other</p>
            )}
          </div>
        </div>

        <DialogFooter className="flex justify-between">
          <Button 
            variant="destructive" 
            onClick={handleDelete}
            className="flex items-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleUpdate}>
              Update
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}