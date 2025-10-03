import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ChevronDown,
  ChevronRight,
  Building2,
  Database,
  Settings,
  Zap,
  Users,
  Package,
  Truck,
  Shield,
  BarChart3,
  Wrench,
  Lightbulb,
  Target,
  Info,
  Sparkles,
  TrendingUp,
  Clock3,
  Save,
  Plus,
  Trash2,
  Loader2
} from "lucide-react";
import { ResponsiveContainer, Treemap, Tooltip as RechartsTooltip, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from "recharts";
import type { TooltipProps } from "recharts";
import { colord } from "colord";
import { useToast } from "@/hooks/use-toast";

interface BusinessCapability {
  id: number;
  name: string;
  code: string;
  description?: string;
  level: number;
  parentId?: number;
  sortOrder: number;
  colorCode: string;
  icon?: string;
  isStandard: boolean;
  maturityLevel?: string;
  criticality: string;
  children?: BusinessCapability[];
}

interface CapabilityMappings {
  domains: Array<{
    id: number;
    mappingType: string;
    importance: string;
    description?: string;
    domain: {
      id: number;
      name: string;
      description?: string;
      colorCode: string;
    };
  }>;
  dataAreas: Array<{
    id: number;
    mappingType: string;
    importance: string;
    description?: string;
    dataArea: {
      id: number;
      name: string;
      description?: string;
      colorCode: string;
    };
  }>;
  systems: Array<{
    id: number;
    mappingType: string;
    systemRole: string;
    coverage: string;
    description?: string;
    system: {
      id: number;
      name: string;
      category: string;
      type: string;
      description?: string;
      colorCode: string;
    };
  }>;
}

interface DataDomainSummary {
  id: number;
  name: string;
  description?: string;
  colorCode: string;
}

interface DataAreaSummary {
  id: number;
  name: string;
  description?: string;
  colorCode: string;
  domainId: number;
}

interface SystemSummary {
  id: number;
  name: string;
  category: string;
  type?: string;
  colorCode: string;
  description?: string;
}

type RoadmapHorizon = "now" | "next" | "later";

interface CapabilityMetric {
  id: number;
  capability: BusinessCapability;
  level: number;
  rootId: number;
  maturityScore: number;
  priorityScore: number;
  readinessPercent: number;
  horizon: RoadmapHorizon;
  criticalityWeight: number;
}

interface CapabilityTreemapNode {
  name: string;
  value: number;
  fill: string;
  capabilityId: number;
  children?: CapabilityTreemapNode[];
}

interface InfographicColumnSection {
  capability: BusinessCapability;
  background: string;
  borderColor: string;
  accentColor: string;
  tertiary: BusinessCapability[];
}

interface InfographicColumnData {
  root: BusinessCapability;
  baseColor: string;
  headerColor: string;
  chipColor: string;
  softBackground: string;
  sections: InfographicColumnSection[];
}

const fallbackInfographicColors = [
  "#2563eb",
  "#0ea5e9",
  "#10b981",
  "#f97316",
  "#a855f7",
  "#14b8a6",
  "#f59e0b",
  "#ec4899",
];

const maturityScoreMap: Record<string, number> = {
  optimizing: 5,
  managed: 4,
  defined: 3,
  developing: 2,
  basic: 1
};

const criticalityWeightMap: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1
};

const roadmapLabels: Record<RoadmapHorizon, string> = {
  now: "Invest Now (0-12 months)",
  next: "Plan Next (12-24 months)",
  later: "Monitor (24+ months)"
};

const roadmapDescriptions: Record<RoadmapHorizon, string> = {
  now: "High urgency capabilities with critical impact that need immediate investment and transformation.",
  next: "Important capabilities that should be strengthened in the next planning cycle.",
  later: "Stable or lower priority capabilities to monitor and optimize over time."
};

const iconMap: Record<string, React.ReactNode> = {
  production: <Settings className="h-4 w-4" />,
  quality: <Shield className="h-4 w-4" />,
  supply_chain: <Truck className="h-4 w-4" />,
  engineering: <Wrench className="h-4 w-4" />,
  planning: <Target className="h-4 w-4" />,
  innovation: <Lightbulb className="h-4 w-4" />,
  operations: <Zap className="h-4 w-4" />,
  human_resources: <Users className="h-4 w-4" />,
  finance: <BarChart3 className="h-4 w-4" />,
  sales: <Package className="h-4 w-4" />,
  building: <Building2 className="h-4 w-4" />,
  database: <Database className="h-4 w-4" />,
};

const getCriticalityColor = (criticality: string) => {
  switch (criticality) {
    case 'critical': return 'bg-red-100 text-red-800 border-red-200';
    case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'low': return 'bg-green-100 text-green-800 border-green-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getMaturityColor = (maturityLevel?: string) => {
  switch (maturityLevel) {
    case 'optimizing': return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'managed': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'defined': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    case 'developing': return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'basic': return 'bg-gray-100 text-gray-800 border-gray-200';
    default: return 'bg-gray-50 text-gray-600 border-gray-100';
  }
};

interface CapabilityNodeProps {
  capability: BusinessCapability;
  selectedCapability?: BusinessCapability;
  onSelectCapability: (capability: BusinessCapability) => void;
  level: number;
}

const CapabilityNode: React.FC<CapabilityNodeProps> = ({ 
  capability, 
  selectedCapability, 
  onSelectCapability, 
  level 
}) => {
  const [isOpen, setIsOpen] = useState(level < 2); // Auto-expand first two levels
  const hasChildren = capability.children && capability.children.length > 0;
  const isSelected = selectedCapability?.id === capability.id;

  const icon = iconMap[capability.icon || 'building'] || iconMap.building;

  return (
    <div className="space-y-1" style={{ marginLeft: level * 16 }}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center space-x-2 group">
          {hasChildren && (
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                {isOpen ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
              </Button>
            </CollapsibleTrigger>
          )}
          {!hasChildren && <div className="w-6" />}
          
          <Button
            variant={isSelected ? "default" : "ghost"}
            size="sm"
            className={`flex-1 justify-start h-auto p-2 ${
              isSelected ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
            }`}
            onClick={() => onSelectCapability(capability)}
          >
            <div className="flex items-center space-x-2 w-full">
              <div style={{ color: capability.colorCode }}>
                {icon}
              </div>
              <div className="flex-1 text-left">
                <div className="font-medium text-sm">{capability.name}</div>
                {capability.description && (
                  <div className="text-xs text-muted-foreground">{capability.description}</div>
                )}
              </div>
              <div className="flex items-center space-x-1">
                <Badge variant="outline" className={getCriticalityColor(capability.criticality)}>
                  {capability.criticality}
                </Badge>
                {capability.maturityLevel && (
                  <Badge variant="outline" className={getMaturityColor(capability.maturityLevel)}>
                    {capability.maturityLevel}
                  </Badge>
                )}
              </div>
            </div>
          </Button>
        </div>
        
        {hasChildren && (
          <CollapsibleContent className="mt-1">
            {capability.children?.map((child) => (
              <CapabilityNode
                key={child.id}
                capability={child}
                selectedCapability={selectedCapability}
                onSelectCapability={onSelectCapability}
                level={level + 1}
              />
            ))}
          </CollapsibleContent>
        )}
      </Collapsible>
    </div>
  );
};

interface CapabilityMappingsDisplayProps {
  mappings: CapabilityMappings;
  onRemoveDomainMapping?: (id: number) => void;
  onRemoveDataAreaMapping?: (id: number) => void;
  onRemoveSystemMapping?: (id: number) => void;
}

const CapabilityMappingsDisplay: React.FC<CapabilityMappingsDisplayProps> = ({
  mappings,
  onRemoveDomainMapping,
  onRemoveDataAreaMapping,
  onRemoveSystemMapping,
}) => {
  return (
    <div className="space-y-4">
      {/* Data Domains */}
      <div>
        <h4 className="font-semibold mb-2 flex items-center">
          <Database className="h-4 w-4 mr-2" />
          Data Domains ({mappings.domains.length})
        </h4>
        <div className="space-y-2">
          {mappings.domains.map((mapping) => (
            <Card key={mapping.id} className="p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center space-x-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: mapping.domain.colorCode }}
                  />
                  <span className="font-medium">{mapping.domain.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline">{mapping.mappingType}</Badge>
                    <Badge variant="secondary">{mapping.importance}</Badge>
                  </div>
                  {onRemoveDomainMapping && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${mapping.domain.name} domain mapping`}
                      onClick={() => onRemoveDomainMapping(mapping.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              {mapping.domain.description && (
                <p className="text-sm text-muted-foreground mt-1">{mapping.domain.description}</p>
              )}
            </Card>
          ))}
        </div>
      </div>

      {/* Data Areas */}
      <div>
        <h4 className="font-semibold mb-2 flex items-center">
          <Package className="h-4 w-4 mr-2" />
          Data Areas ({mappings.dataAreas.length})
        </h4>
        <div className="space-y-2">
          {mappings.dataAreas.map((mapping) => (
            <Card key={mapping.id} className="p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center space-x-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: mapping.dataArea.colorCode }}
                  />
                  <span className="font-medium">{mapping.dataArea.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline">{mapping.mappingType}</Badge>
                    <Badge variant="secondary">{mapping.importance}</Badge>
                  </div>
                  {onRemoveDataAreaMapping && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${mapping.dataArea.name} data area mapping`}
                      onClick={() => onRemoveDataAreaMapping(mapping.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              {mapping.dataArea.description && (
                <p className="text-sm text-muted-foreground mt-1">{mapping.dataArea.description}</p>
              )}
            </Card>
          ))}
        </div>
      </div>

      {/* Systems */}
      <div>
        <h4 className="font-semibold mb-2 flex items-center">
          <Settings className="h-4 w-4 mr-2" />
          Systems ({mappings.systems.length})
        </h4>
        <div className="space-y-2">
          {mappings.systems.map((mapping) => (
            <Card key={mapping.id} className="p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: mapping.system.colorCode }}
                  />
                  <span className="font-medium">{mapping.system.name}</span>
                  <Badge variant="outline" className="text-xs">{mapping.system.category}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline">{mapping.mappingType}</Badge>
                    <Badge variant="secondary">{mapping.systemRole}</Badge>
                    <Badge variant="outline">{mapping.coverage}</Badge>
                  </div>
                  {onRemoveSystemMapping && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${mapping.system.name} system mapping`}
                      onClick={() => onRemoveSystemMapping(mapping.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              {mapping.system.description && (
                <p className="text-sm text-muted-foreground mt-1">{mapping.system.description}</p>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export const BusinessCapabilityMap: React.FC = () => {
  const [capabilityTree, setCapabilityTree] = useState<BusinessCapability[]>([]);
  const [selectedCapability, setSelectedCapability] = useState<BusinessCapability>();
  const [capabilityMappings, setCapabilityMappings] = useState<CapabilityMappings>({
    domains: [],
    dataAreas: [],
    systems: []
  });
  const [activeView, setActiveView] = useState<string>("infographic");
  const [loading, setLoading] = useState(true);
  const [domains, setDomains] = useState<DataDomainSummary[]>([]);
  const [dataAreas, setDataAreas] = useState<DataAreaSummary[]>([]);
  const [systems, setSystems] = useState<SystemSummary[]>([]);
  const [capabilityDetailTab, setCapabilityDetailTab] = useState<"insights" | "admin">("insights");
  const [isSavingCapability, setIsSavingCapability] = useState(false);
  const [isCreatingCapability, setIsCreatingCapability] = useState(false);
  const [isDeletingCapability, setIsDeletingCapability] = useState(false);
  const [isCreatingDomainMapping, setIsCreatingDomainMapping] = useState(false);
  const [isCreatingAreaMapping, setIsCreatingAreaMapping] = useState(false);
  const [isCreatingSystemMapping, setIsCreatingSystemMapping] = useState(false);
  const [editCapabilityForm, setEditCapabilityForm] = useState({
    name: "",
    code: "",
    description: "",
    maturityLevel: "",
    criticality: "medium",
    colorCode: "#6366f1",
    sortOrder: "",
    level: "",
  });
  const [newCapabilityForm, setNewCapabilityForm] = useState({
    name: "",
    code: "",
    description: "",
    maturityLevel: "developing",
    criticality: "medium",
    colorCode: "#6366f1",
    sortOrder: "",
    parentId: "",
    level: "",
  });
  const [domainMappingForm, setDomainMappingForm] = useState({
    domainId: "",
    mappingType: "primary",
    importance: "medium",
    description: "",
  });
  const [dataAreaMappingForm, setDataAreaMappingForm] = useState({
    domainId: "",
    dataAreaId: "",
    mappingType: "primary",
    importance: "medium",
    description: "",
  });
  const [systemMappingForm, setSystemMappingForm] = useState({
    systemId: "",
    mappingType: "enables",
    systemRole: "primary",
    coverage: "full",
    description: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchCapabilityTree();
    loadReferenceData();
  }, []);

  useEffect(() => {
    if (selectedCapability) {
      loadCapabilityMappings(selectedCapability.id);
    }
  }, [selectedCapability]);

  useEffect(() => {
    if (selectedCapability) {
      setCapabilityDetailTab("insights");
      setEditCapabilityForm({
        name: selectedCapability.name ?? "",
        code: selectedCapability.code ?? "",
        description: selectedCapability.description ?? "",
        maturityLevel: selectedCapability.maturityLevel ?? "",
        criticality: selectedCapability.criticality ?? "medium",
        colorCode: selectedCapability.colorCode ?? "#6366f1",
        sortOrder: selectedCapability.sortOrder ? String(selectedCapability.sortOrder) : "",
        level: selectedCapability.level ? String(selectedCapability.level) : "",
      });

      setNewCapabilityForm((prev) => ({
        ...prev,
        parentId: selectedCapability.id ? String(selectedCapability.id) : "",
        level: selectedCapability.level ? String(selectedCapability.level + 1) : "",
      }));
    } else {
      setEditCapabilityForm({
        name: "",
        code: "",
        description: "",
        maturityLevel: "",
        criticality: "medium",
        colorCode: "#6366f1",
        sortOrder: "",
        level: "",
      });
    }
  }, [selectedCapability]);

  const loadCapabilityMappings = async (capabilityId: number) => {
    try {
      const response = await fetch(`/api/capabilities/${capabilityId}/mappings`);
      if (!response.ok) throw new Error('Failed to load capability mappings');
      const mappings = await response.json();
      setCapabilityMappings(mappings);
    } catch (error) {
      console.error('Error loading capability mappings:', error);
      toast({
        title: "Error",
        description: "Failed to load capability mappings",
        variant: "destructive",
      });
    }
  };

  const loadReferenceData = async () => {
    try {
      const [domainsResponse, areasResponse, systemsResponse] = await Promise.all([
        fetch("/api/domains"),
        fetch("/api/areas"),
        fetch("/api/systems"),
      ]);

      if (!domainsResponse.ok) throw new Error("Failed to load data domains");
      if (!areasResponse.ok) throw new Error("Failed to load data areas");
      if (!systemsResponse.ok) throw new Error("Failed to load systems");

      const [domainsData, areasData, systemsData] = await Promise.all([
        domainsResponse.json(),
        areasResponse.json(),
        systemsResponse.json(),
      ]);

      setDomains(domainsData);
      setDataAreas(areasData);
      setSystems(systemsData);
    } catch (error) {
      console.error("Error loading reference data:", error);
      toast({
        title: "Error",
        description: "Failed to load supporting reference data",
        variant: "destructive",
      });
    }
  };

  const setSelectedCapabilityById = (capabilityId?: number | null, tree?: BusinessCapability[]) => {
    if (!capabilityId) {
      if (tree && tree.length > 0) {
        setSelectedCapability(tree[0]);
      }
      return;
    }

    const lookupTree = tree ?? capabilityTree;
    const findCapability = (nodes: BusinessCapability[]): BusinessCapability | undefined => {
      for (const node of nodes) {
        if (node.id === capabilityId) {
          return node;
        }
        if (node.children?.length) {
          const found = findCapability(node.children);
          if (found) return found;
        }
      }
      return undefined;
    };

    const found = findCapability(lookupTree);
    if (found) {
      setSelectedCapability(found);
    } else if (lookupTree.length > 0) {
      setSelectedCapability(lookupTree[0]);
    }
  };

  const handleEditCapabilityInputChange = <K extends keyof typeof editCapabilityForm>(
    field: K,
    value: (typeof editCapabilityForm)[K],
  ) => {
    setEditCapabilityForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleNewCapabilityInputChange = <K extends keyof typeof newCapabilityForm>(
    field: K,
    value: (typeof newCapabilityForm)[K],
  ) => {
    setNewCapabilityForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleDomainMappingInputChange = <K extends keyof typeof domainMappingForm>(
    field: K,
    value: (typeof domainMappingForm)[K],
  ) => {
    setDomainMappingForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleDataAreaMappingInputChange = <K extends keyof typeof dataAreaMappingForm>(
    field: K,
    value: (typeof dataAreaMappingForm)[K],
  ) => {
    setDataAreaMappingForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSystemMappingInputChange = <K extends keyof typeof systemMappingForm>(
    field: K,
    value: (typeof systemMappingForm)[K],
  ) => {
    setSystemMappingForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const fetchCapabilityTree = async (selectCapabilityId?: number) => {
    try {
      const response = await fetch('/api/capabilities/tree');
      if (!response.ok) throw new Error('Failed to load capability tree');
      const tree = await response.json();
      setCapabilityTree(tree);

      const preferredId = selectCapabilityId ?? selectedCapability?.id;
      if (preferredId) {
        setSelectedCapabilityById(preferredId, tree);
      } else if (!selectedCapability && tree.length > 0) {
        setSelectedCapability(tree[0]);
      }
    } catch (error) {
      console.error('Error loading capability tree:', error);
      toast({
        title: "Error",
        description: "Failed to load business capability map",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCapability = async () => {
    if (!selectedCapability) return;

    if (!editCapabilityForm.name.trim() || !editCapabilityForm.code.trim()) {
      toast({
        title: "Missing information",
        description: "Name and code are required to update a capability.",
        variant: "destructive",
      });
      return;
    }

    setIsSavingCapability(true);
    try {
      const payload = {
        name: editCapabilityForm.name.trim(),
        code: editCapabilityForm.code.trim(),
        description: editCapabilityForm.description.trim() || null,
        maturityLevel: editCapabilityForm.maturityLevel || null,
        criticality: editCapabilityForm.criticality,
        colorCode: editCapabilityForm.colorCode,
        sortOrder: editCapabilityForm.sortOrder ? Number(editCapabilityForm.sortOrder) : null,
        level: editCapabilityForm.level ? Number(editCapabilityForm.level) : selectedCapability.level,
      };

      const response = await fetch(`/api/capabilities/${selectedCapability.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to update capability");
      }

      const updated = await response.json();
      toast({
        title: "Capability updated",
        description: `${updated.name} has been saved successfully.`,
      });

  await fetchCapabilityTree(updated.id);
      await loadCapabilityMappings(updated.id);
    } catch (error) {
      console.error("Error updating capability:", error);
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Failed to save capability changes",
        variant: "destructive",
      });
    } finally {
      setIsSavingCapability(false);
    }
  };

  const handleCreateCapability = async () => {
    if (!newCapabilityForm.name.trim() || !newCapabilityForm.code.trim()) {
      toast({
        title: "Missing information",
        description: "Name and code are required to create a capability.",
        variant: "destructive",
      });
      return;
    }

    setIsCreatingCapability(true);
    try {
      const parentId = newCapabilityForm.parentId ? Number(newCapabilityForm.parentId) : null;
      const parentCapability = parentId ? capabilityMap.get(parentId) : undefined;
      const resolvedLevel = newCapabilityForm.level
        ? Number(newCapabilityForm.level)
        : parentCapability?.level
          ? parentCapability.level + 1
          : 1;

      const payload = {
        name: newCapabilityForm.name.trim(),
        code: newCapabilityForm.code.trim(),
        description: newCapabilityForm.description.trim() || null,
        maturityLevel: newCapabilityForm.maturityLevel || null,
        criticality: newCapabilityForm.criticality,
        colorCode: newCapabilityForm.colorCode,
        sortOrder: newCapabilityForm.sortOrder ? Number(newCapabilityForm.sortOrder) : null,
        parentId,
        level: resolvedLevel,
        isStandard: true,
      };

      const response = await fetch("/api/capabilities", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to create capability");
      }

      const created = await response.json();
      toast({
        title: "Capability created",
        description: `${created.name} has been added.`,
      });

      setNewCapabilityForm((prev) => ({
        ...prev,
        name: "",
        code: "",
        description: "",
        sortOrder: "",
      }));

  await fetchCapabilityTree(created.id);
    } catch (error) {
      console.error("Error creating capability:", error);
      toast({
        title: "Creation failed",
        description: error instanceof Error ? error.message : "Failed to create capability",
        variant: "destructive",
      });
    } finally {
      setIsCreatingCapability(false);
    }
  };

  const handleDeleteCapability = async () => {
    if (!selectedCapability) return;

    setIsDeletingCapability(true);
    try {
      const response = await fetch(`/api/capabilities/${selectedCapability.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to delete capability");
      }

      toast({
        title: "Capability deleted",
        description: `${selectedCapability.name} has been removed.`,
      });

      const parentId = selectedCapability.parentId;
      setSelectedCapability(undefined);
  await fetchCapabilityTree(parentId ?? undefined);
    } catch (error) {
      console.error("Error deleting capability:", error);
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Failed to delete capability",
        variant: "destructive",
      });
    } finally {
      setIsDeletingCapability(false);
    }
  };

  const handleAddDomainMapping = async () => {
    if (!selectedCapability) return;
    if (!domainMappingForm.domainId) {
      toast({
        title: "Select a domain",
        description: "Choose a data domain before adding the mapping.",
        variant: "destructive",
      });
      return;
    }

    setIsCreatingDomainMapping(true);
    try {
      const response = await fetch(`/api/capabilities/${selectedCapability.id}/domains/${domainMappingForm.domainId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mappingType: domainMappingForm.mappingType,
          importance: domainMappingForm.importance,
          description: domainMappingForm.description.trim() || null,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to add domain mapping");
      }

      toast({
        title: "Domain linked",
        description: "The domain has been associated with this capability.",
      });

      setDomainMappingForm({
        domainId: "",
        mappingType: "primary",
        importance: "medium",
        description: "",
      });

      await loadCapabilityMappings(selectedCapability.id);
    } catch (error) {
      console.error("Error creating domain mapping:", error);
      toast({
        title: "Mapping failed",
        description: error instanceof Error ? error.message : "Failed to add domain mapping",
        variant: "destructive",
      });
    } finally {
      setIsCreatingDomainMapping(false);
    }
  };

  const handleAddDataAreaMapping = async () => {
    if (!selectedCapability) return;
    if (!dataAreaMappingForm.dataAreaId) {
      toast({
        title: "Select a data area",
        description: "Choose a data area before adding the mapping.",
        variant: "destructive",
      });
      return;
    }

    setIsCreatingAreaMapping(true);
    try {
      const response = await fetch(`/api/capabilities/${selectedCapability.id}/data-areas/${dataAreaMappingForm.dataAreaId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mappingType: dataAreaMappingForm.mappingType,
          importance: dataAreaMappingForm.importance,
          description: dataAreaMappingForm.description.trim() || null,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to add data area mapping");
      }

      toast({
        title: "Data area linked",
        description: "The data area has been associated with this capability.",
      });

      setDataAreaMappingForm({
        domainId: "",
        dataAreaId: "",
        mappingType: "primary",
        importance: "medium",
        description: "",
      });

      await loadCapabilityMappings(selectedCapability.id);
    } catch (error) {
      console.error("Error creating data area mapping:", error);
      toast({
        title: "Mapping failed",
        description: error instanceof Error ? error.message : "Failed to add data area mapping",
        variant: "destructive",
      });
    } finally {
      setIsCreatingAreaMapping(false);
    }
  };

  const handleAddSystemMapping = async () => {
    if (!selectedCapability) return;
    if (!systemMappingForm.systemId) {
      toast({
        title: "Select a system",
        description: "Choose a system before adding the mapping.",
        variant: "destructive",
      });
      return;
    }

    setIsCreatingSystemMapping(true);
    try {
      const response = await fetch(`/api/capabilities/${selectedCapability.id}/systems/${systemMappingForm.systemId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mappingType: systemMappingForm.mappingType,
          systemRole: systemMappingForm.systemRole,
          coverage: systemMappingForm.coverage,
          description: systemMappingForm.description.trim() || null,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to add system mapping");
      }

      toast({
        title: "System linked",
        description: "The system has been associated with this capability.",
      });

      setSystemMappingForm({
        systemId: "",
        mappingType: "enables",
        systemRole: "primary",
        coverage: "full",
        description: "",
      });

      await loadCapabilityMappings(selectedCapability.id);
    } catch (error) {
      console.error("Error creating system mapping:", error);
      toast({
        title: "Mapping failed",
        description: error instanceof Error ? error.message : "Failed to add system mapping",
        variant: "destructive",
      });
    } finally {
      setIsCreatingSystemMapping(false);
    }
  };

  const handleRemoveDomainMapping = async (mappingId: number) => {
    if (!selectedCapability) return;

    try {
      const response = await fetch(`/api/capability-domain-mappings/${mappingId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to remove domain mapping");
      }

      toast({
        title: "Mapping removed",
        description: "The domain has been detached from the capability.",
      });

      await loadCapabilityMappings(selectedCapability.id);
    } catch (error) {
      console.error("Error removing domain mapping:", error);
      toast({
        title: "Removal failed",
        description: error instanceof Error ? error.message : "Failed to remove domain mapping",
        variant: "destructive",
      });
    }
  };

  const handleRemoveDataAreaMapping = async (mappingId: number) => {
    if (!selectedCapability) return;

    try {
      const response = await fetch(`/api/capability-data-area-mappings/${mappingId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to remove data area mapping");
      }

      toast({
        title: "Mapping removed",
        description: "The data area has been detached from the capability.",
      });

      await loadCapabilityMappings(selectedCapability.id);
    } catch (error) {
      console.error("Error removing data area mapping:", error);
      toast({
        title: "Removal failed",
        description: error instanceof Error ? error.message : "Failed to remove data area mapping",
        variant: "destructive",
      });
    }
  };

  const handleRemoveSystemMapping = async (mappingId: number) => {
    if (!selectedCapability) return;

    try {
      const response = await fetch(`/api/capability-system-mappings/${mappingId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to remove system mapping");
      }

      toast({
        title: "Mapping removed",
        description: "The system has been detached from the capability.",
      });

      await loadCapabilityMappings(selectedCapability.id);
    } catch (error) {
      console.error("Error removing system mapping:", error);
      toast({
        title: "Removal failed",
        description: error instanceof Error ? error.message : "Failed to remove system mapping",
        variant: "destructive",
      });
    }
  };

  const sortedDomains = useMemo(() => {
    return [...domains].sort((a, b) => a.name.localeCompare(b.name));
  }, [domains]);

  const sortedDataAreas = useMemo(() => {
    return [...dataAreas].sort((a, b) => a.name.localeCompare(b.name));
  }, [dataAreas]);

  const sortedSystems = useMemo(() => {
    return [...systems].sort((a, b) => a.name.localeCompare(b.name));
  }, [systems]);

  const availableDataAreas = useMemo(() => {
    if (!dataAreaMappingForm.domainId) {
      return sortedDataAreas;
    }
    return sortedDataAreas.filter((area) => String(area.domainId) === dataAreaMappingForm.domainId);
  }, [sortedDataAreas, dataAreaMappingForm.domainId]);

  const capabilityMap = useMemo(() => {
    const map = new Map<number, BusinessCapability>();
    const traverse = (nodes: BusinessCapability[]) => {
      nodes.forEach((node) => {
        map.set(node.id, node);
        if (node.children?.length) {
          traverse(node.children);
        }
      });
    };
    traverse(capabilityTree);
    return map;
  }, [capabilityTree]);

  const capabilityMetrics = useMemo(() => {
    const flatten = (nodes: BusinessCapability[], level = 1, rootId?: number): CapabilityMetric[] => {
      const metrics: CapabilityMetric[] = [];
      nodes.forEach((node) => {
        const maturityScore = maturityScoreMap[node.maturityLevel ?? "developing"] ?? 2;
        const criticalityWeight = criticalityWeightMap[node.criticality] ?? 2;
        const priorityScore = criticalityWeight * (6 - maturityScore);
        const readinessPercent = Math.round((maturityScore / 5) * 100);
        const horizon: RoadmapHorizon = (() => {
          const weightedGap = criticalityWeight * (6 - maturityScore);
          if (weightedGap >= 12) return "now";
          if (weightedGap >= 8) return "next";
          return "later";
        })();

        const currentRootId = level === 1 ? node.id : rootId ?? node.id;

        metrics.push({
          id: node.id,
          capability: node,
          level,
          rootId: currentRootId,
          maturityScore,
          priorityScore,
          readinessPercent,
          horizon,
          criticalityWeight,
        });

        if (node.children?.length) {
          metrics.push(...flatten(node.children, level + 1, currentRootId));
        }
      });
      return metrics;
    };

    return flatten(capabilityTree);
  }, [capabilityTree]);

  const metricsById = useMemo(() => {
    const map = new Map<number, CapabilityMetric>();
    capabilityMetrics.forEach((metric) => map.set(metric.id, metric));
    return map;
  }, [capabilityMetrics]);

  const summary = useMemo(() => {
    const total = capabilityMetrics.length;
    const averageMaturity = total
      ? capabilityMetrics.reduce((acc, metric) => acc + metric.maturityScore, 0) / total
      : 0;
    const highPriority = capabilityMetrics.filter((metric) => metric.priorityScore >= 10).length;
    const optimized = capabilityMetrics.filter((metric) => metric.maturityScore >= 4).length;
    const horizonCounts = capabilityMetrics.reduce(
      (acc, metric) => {
        acc[metric.horizon] = (acc[metric.horizon] ?? 0) + 1;
        return acc;
      },
      { now: 0, next: 0, later: 0 } as Record<RoadmapHorizon, number>
    );

    return {
      total,
      averageMaturity: Number(averageMaturity.toFixed(1)),
      highPriority,
      optimized,
      horizonCounts,
    };
  }, [capabilityMetrics]);

  const domainColumns = useMemo(() => capabilityTree.flatMap((root) => root.children ?? []), [capabilityTree]);
  const capabilityDomainCount = useMemo(() => domainColumns.length, [domainColumns]);

  const treemapData = useMemo(() => {
    const buildNodes = (nodes: BusinessCapability[]): CapabilityTreemapNode[] =>
      nodes.map((node) => {
        const metrics = metricsById.get(node.id);
        const readiness = metrics?.readinessPercent ?? 60;
        const baseColor = node.colorCode || "#6366f1";
        const fill = colord(baseColor)
          .lighten((100 - readiness) / 400)
          .desaturate((100 - readiness) / 350)
          .toHex();

        return {
          name: node.name,
          value: Math.max(metrics?.priorityScore ?? 1, 1),
          fill,
          capabilityId: node.id,
          children: node.children?.length ? buildNodes(node.children) : undefined,
        };
      });

    return buildNodes(capabilityTree);
  }, [capabilityTree, metricsById]);

  const radarData = useMemo(() => {
    if (!capabilityMetrics.length) return [];
    const maxPriority = Math.max(...capabilityMetrics.map((metric) => metric.priorityScore), 1);

    return capabilityTree.map((root) => {
      const metrics = capabilityMetrics.filter((metric) => metric.rootId === root.id);
      if (!metrics.length) {
        return { category: root.name, maturity: 0, priorityIndex: 0 };
      }

      const maturityAvg =
        metrics.reduce((acc, metric) => acc + metric.maturityScore, 0) / metrics.length;
      const priorityAvg =
        metrics.reduce((acc, metric) => acc + metric.priorityScore, 0) / metrics.length;

      return {
        category: root.name,
        maturity: Number(maturityAvg.toFixed(2)),
        priorityIndex: Number(((priorityAvg / maxPriority) * 5).toFixed(2)),
      };
    });
  }, [capabilityTree, capabilityMetrics]);

  const roadmap = useMemo(() => {
    const groups: Record<RoadmapHorizon, CapabilityMetric[]> = {
      now: [],
      next: [],
      later: [],
    };

    capabilityMetrics
      .filter((metric) => metric.level >= 2)
      .forEach((metric) => {
        groups[metric.horizon].push(metric);
      });

    (Object.keys(groups) as RoadmapHorizon[]).forEach((horizon) => {
      groups[horizon].sort((a, b) => b.priorityScore - a.priorityScore);
    });

    return groups;
  }, [capabilityMetrics]);

  const topOpportunities = useMemo(() => {
    return [...capabilityMetrics]
      .filter((metric) => metric.level >= 2)
      .sort((a, b) => b.priorityScore - a.priorityScore)
      .slice(0, 5);
  }, [capabilityMetrics]);

  const infographicColumns = useMemo(() => {
    return domainColumns.map((domain, index) => {
      const baseColor = domain.colorCode || fallbackInfographicColors[index % fallbackInfographicColors.length];
      const headerColor = colord(baseColor).saturate(0.1).darken(0.08).toHex();
      const chipColor = colord(baseColor).lighten(0.25).desaturate(0.2).alpha(0.2).toRgbString();
      const softBackground = colord(baseColor).lighten(0.6).desaturate(0.35).alpha(0.18).toRgbString();

      const sections: InfographicColumnSection[] = (domain.children ?? []).map((child, childIndex) => {
        const lightenAmount = Math.min(0.65, 0.38 + childIndex * 0.08);
        const background = colord(baseColor).lighten(lightenAmount).desaturate(0.15).toHex();
        const borderColor = colord(baseColor)
          .lighten(Math.max(0, lightenAmount - 0.12))
          .alpha(0.45)
          .toRgbString();
        const accentColor = colord(baseColor)
          .lighten(Math.min(0.22 + childIndex * 0.06, 0.45))
          .saturate(0.05)
          .toHex();

        return {
          capability: child,
          background,
          borderColor,
          accentColor,
          tertiary: child.children ?? [],
        };
      });

      return {
        root: domain,
        baseColor,
        headerColor,
        chipColor,
        softBackground,
        sections,
      } satisfies InfographicColumnData;
    });
  }, [domainColumns]);

  const selectedMetrics = selectedCapability
    ? metricsById.get(selectedCapability.id)
    : undefined;

  const handleSelectCapability = (capabilityId: number) => {
    const capability = capabilityMap.get(capabilityId);
    if (capability) {
      setSelectedCapability(capability);
    }
  };

  const renderTreemapTooltip = useMemo(
    () =>
      (props: TooltipProps<number, string>) => {
        if (!props.active || !props.payload?.length) return null;
        const payload = props.payload[0] as any;
        const capabilityId: number | undefined = payload?.payload?.capabilityId;
        if (!capabilityId) return null;
        const metrics = metricsById.get(capabilityId);
        const capability = capabilityMap.get(capabilityId);
        if (!metrics || !capability) return null;

        return (
          <div className="rounded-md border bg-background/95 p-3 shadow-lg">
            <p className="font-semibold text-sm">{capability.name}</p>
            <p className="text-xs text-muted-foreground">Priority score: {metrics.priorityScore.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">Maturity: {metrics.maturityScore.toFixed(1)} / 5</p>
            <p className="text-xs text-muted-foreground">Readiness: {metrics.readinessPercent}%</p>
            <p className="text-xs text-muted-foreground">Horizon: {roadmapLabels[metrics.horizon]}</p>
          </div>
        );
      },
    [capabilityMap, metricsById]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading business capability map...</p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row">
          <Card className="flex-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold flex items-center justify-between">
                <span>Business Capability Posture</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs text-xs">
                      Aggregated maturity and priority indicators across your manufacturing capability landscape.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <SummaryTile
                  title="Total Capabilities"
                  value={summary.total.toString()}
                  icon={<Building2 className="h-4 w-4" />}
                  description={`${summary.horizonCounts.now + summary.horizonCounts.next} require attention`}
                />
                <SummaryTile
                  title="Average Maturity"
                  value={`${summary.averageMaturity}/5`}
                  icon={<TrendingUp className="h-4 w-4" />}
                  description={`${summary.optimized} operating at managed level or above`}
                />
                <SummaryTile
                  title="High-Priority Gaps"
                  value={summary.highPriority.toString()}
                  icon={<Target className="h-4 w-4" />}
                  description={`${summary.horizonCounts.now} immediate, ${summary.horizonCounts.next} upcoming`}
                  tone="warning"
                />
                <SummaryTile
                  title="Roadmap Balance"
                  value={`${summary.horizonCounts.now}/${summary.horizonCounts.next}/${summary.horizonCounts.later}`}
                  icon={<Clock3 className="h-4 w-4" />}
                  description="Now / Next / Later initiatives"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4 2xl:flex-row">
          <div className="2xl:w-80 flex flex-col gap-4">
            <Card className="h-[520px]">
              <CardHeader className="pb-0">
                <CardTitle className="flex items-center">
                  <Building2 className="h-5 w-5 mr-2" />
                  Capability Hierarchy
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[460px]">
                  <div className="p-4 space-y-1">
                    {capabilityTree.map((capability) => (
                      <CapabilityNode
                        key={capability.id}
                        capability={capability}
                        selectedCapability={selectedCapability}
                        onSelectCapability={setSelectedCapability}
                        level={0}
                      />
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center text-sm font-semibold">
                  <Sparkles className="h-4 w-4 mr-2 text-amber-500" />
                  Top Investment Opportunities
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {topOpportunities.map((metric) => (
                  <button
                    key={metric.id}
                    onClick={() => handleSelectCapability(metric.id)}
                    className="w-full text-left rounded-md border p-3 transition hover:border-primary hover:bg-muted"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{metric.capability.name}</span>
                      <Badge variant="outline">{roadmapLabels[metric.horizon].split(" ")[0]}</Badge>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Maturity: {metric.maturityScore.toFixed(1)}/5</span>
                      <span>Priority: {metric.priorityScore.toFixed(1)}</span>
                    </div>
                  </button>
                ))}
                {!topOpportunities.length && (
                  <p className="text-xs text-muted-foreground">
                    Capabilities will appear here once data is available.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="flex-1 flex flex-col gap-4">
            <Card className="flex-1">
              <CardHeader className="pb-0">
                <CardTitle>Strategic Visualization</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <Tabs value={activeView} onValueChange={setActiveView}>
                  <TabsList className="hidden sm:flex mb-4">
                    <TabsTrigger value="infographic">Infographic</TabsTrigger>
                    <TabsTrigger value="treemap">Portfolio</TabsTrigger>
                    <TabsTrigger value="radar">Balance</TabsTrigger>
                    <TabsTrigger value="roadmap">Roadmap</TabsTrigger>
                  </TabsList>

                  <TabsList className="sm:hidden mb-4">
                    <TabsTrigger value="infographic">Infographic</TabsTrigger>
                    <TabsTrigger value="treemap">Portfolio</TabsTrigger>
                    <TabsTrigger value="radar">Balance</TabsTrigger>
                    <TabsTrigger value="roadmap">Roadmap</TabsTrigger>
                  </TabsList>

                  <TabsContent value="infographic">
                    <div className="space-y-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-muted-foreground">
                          Explore the full capability landscape in an infographic view inspired by LeanIX best practices.
                        </p>
                        <Badge variant="outline" className="w-fit">
                          {capabilityDomainCount} capability domains
                        </Badge>
                      </div>
                      <div className="overflow-x-auto pb-3">
                        <div className="min-w-[960px]">
                          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6">
                            {infographicColumns.map((column) => (
                              <InfographicColumn
                                key={column.root.id}
                                data={column}
                                onSelect={handleSelectCapability}
                                selectedCapabilityId={selectedCapability?.id}
                              />
                            ))}
                            {!infographicColumns.length && (
                              <div className="rounded-xl border bg-muted/40 p-6 text-sm text-muted-foreground">
                                Capability data is required to render the infographic view.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="treemap">
                    <div className="h-[420px]">
                      <ResponsiveContainer>
                        <Treemap
                          data={treemapData}
                          dataKey="value"
                          stroke="#fff"
                          fill="#8884d8"
                          onClick={(node) => {
                            const payload = node as any;
                            if (payload?.capabilityId) {
                              handleSelectCapability(payload.capabilityId);
                            }
                          }}
                        >
                          <RechartsTooltip content={renderTreemapTooltip} />
                        </Treemap>
                      </ResponsiveContainer>
                    </div>
                  </TabsContent>

                  <TabsContent value="radar">
                    <div className="h-[420px]">
                      <ResponsiveContainer>
                        <RadarChart data={radarData} outerRadius="80%">
                          <PolarGrid gridType="circle" stroke="#e2e8f0" />
                          <PolarAngleAxis dataKey="category" tick={{ fontSize: 11 }} />
                          <PolarRadiusAxis angle={30} domain={[0, 5]} tick={{ fontSize: 10 }} />
                          <Radar
                            name="Maturity"
                            dataKey="maturity"
                            stroke="#3b82f6"
                            fill="#3b82f6"
                            fillOpacity={0.35}
                          />
                          <Radar
                            name="Priority Pressure"
                            dataKey="priorityIndex"
                            stroke="#f97316"
                            fill="#f97316"
                            fillOpacity={0.25}
                          />
                          <RechartsTooltip />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </TabsContent>

                  <TabsContent value="roadmap">
                    <div className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-3">
                        {(Object.keys(roadmap) as RoadmapHorizon[]).map((horizonKey) => (
                          <Card key={horizonKey} className="border-dashed">
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm font-semibold">
                                {roadmapLabels[horizonKey]}
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 text-sm">
                              <p className="text-xs text-muted-foreground">
                                {roadmapDescriptions[horizonKey]}
                              </p>
                              <Separator />
                              <div className="space-y-2">
                                {roadmap[horizonKey].slice(0, 4).map((metric) => (
                                  <button
                                    key={metric.id}
                                    onClick={() => handleSelectCapability(metric.id)}
                                    className="w-full text-left rounded-md border p-2 text-xs transition hover:border-primary hover:bg-muted"
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="font-medium text-xs">{metric.capability.name}</span>
                                      <Badge variant="outline">{metric.priorityScore.toFixed(1)}</Badge>
                                    </div>
                                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                      <span>Maturity {metric.maturityScore.toFixed(1)}</span>
                                      <span>Readiness {metric.readinessPercent}%</span>
                                    </div>
                                  </button>
                                ))}
                                {roadmap[horizonKey].length > 4 && (
                                  <p className="text-[11px] text-muted-foreground">
                                    +{roadmap[horizonKey].length - 4} additional capabilities
                                  </p>
                                )}
                                {!roadmap[horizonKey].length && (
                                  <p className="text-[11px] text-muted-foreground">
                                    No capabilities tagged for this horizon yet.
                                  </p>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  {selectedCapability && iconMap[selectedCapability.icon || "building"]}
                  <span className="ml-2">
                    {selectedCapability ? selectedCapability.name : "Select a Capability"}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedCapability ? (
                  <Tabs
                    value={capabilityDetailTab}
                    onValueChange={(value) => setCapabilityDetailTab(value as "insights" | "admin")}
                    className="space-y-4"
                  >
                    <TabsList className="w-full justify-start">
                      <TabsTrigger value="insights">Insights</TabsTrigger>
                      <TabsTrigger value="admin">Administration</TabsTrigger>
                    </TabsList>

                    <TabsContent value="insights">
                      <div className="space-y-4">
                        <div>
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className={getCriticalityColor(selectedCapability.criticality)}>
                              {selectedCapability.criticality} criticality
                            </Badge>
                            {selectedCapability.maturityLevel && (
                              <Badge variant="outline" className={getMaturityColor(selectedCapability.maturityLevel)}>
                                {selectedCapability.maturityLevel}
                              </Badge>
                            )}
                            {selectedMetrics && (
                              <Badge variant="secondary">Priority {selectedMetrics.priorityScore.toFixed(1)}</Badge>
                            )}
                          </div>
                          {selectedCapability.description && (
                            <p className="text-sm leading-relaxed text-muted-foreground">
                              {selectedCapability.description}
                            </p>
                          )}
                        </div>

                        {selectedMetrics && (
                          <div className="grid gap-3 sm:grid-cols-3">
                            <DetailMetric
                              label="Readiness"
                              value={`${selectedMetrics.readinessPercent}%`}
                              helper="Alignment with target state"
                            />
                            <DetailMetric
                              label="Maturity"
                              value={`${selectedMetrics.maturityScore.toFixed(1)} / 5`}
                              helper="Capability maturity assessment"
                            />
                            <DetailMetric
                              label="Horizon"
                              value={roadmapLabels[selectedMetrics.horizon]}
                              helper="Recommended investment timing"
                            />
                          </div>
                        )}

                        <Separator />

                        <div>
                          <h4 className="mb-2 text-sm font-semibold">Data &amp; System Impact</h4>
                          <ScrollArea className="h-[260px] pr-2">
                            <CapabilityMappingsDisplay mappings={capabilityMappings} />
                          </ScrollArea>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="admin">
                      <div className="space-y-6">
                        <div className="space-y-4 rounded-lg border p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h4 className="text-sm font-semibold">Capability details</h4>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                onClick={handleSaveCapability}
                                disabled={isSavingCapability}
                              >
                                {isSavingCapability ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <Save className="mr-2 h-4 w-4" />
                                )}
                                Save changes
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={handleDeleteCapability}
                                disabled={isDeletingCapability}
                              >
                                {isDeletingCapability ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="mr-2 h-4 w-4" />
                                )}
                                Delete
                              </Button>
                            </div>
                          </div>

                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-1">
                              <Label htmlFor="capability-name">Name</Label>
                              <Input
                                id="capability-name"
                                value={editCapabilityForm.name}
                                onChange={(event) => handleEditCapabilityInputChange("name", event.target.value)}
                                placeholder="Capability name"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor="capability-code">Code</Label>
                              <Input
                                id="capability-code"
                                value={editCapabilityForm.code}
                                onChange={(event) => handleEditCapabilityInputChange("code", event.target.value)}
                                placeholder="e.g. PROD-001"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor="capability-level">Level</Label>
                              <Input
                                id="capability-level"
                                type="number"
                                value={editCapabilityForm.level}
                                onChange={(event) => handleEditCapabilityInputChange("level", event.target.value)}
                                min={1}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor="capability-sort-order">Sort order</Label>
                              <Input
                                id="capability-sort-order"
                                type="number"
                                value={editCapabilityForm.sortOrder}
                                onChange={(event) => handleEditCapabilityInputChange("sortOrder", event.target.value)}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor="capability-maturity">Maturity</Label>
                              <Select
                                value={editCapabilityForm.maturityLevel || "unset"}
                                onValueChange={(value) =>
                                  handleEditCapabilityInputChange("maturityLevel", value === "unset" ? "" : value)
                                }
                              >
                                <SelectTrigger id="capability-maturity">
                                  <SelectValue placeholder="Select maturity" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="unset">Not set</SelectItem>
                                  <SelectItem value="basic">Basic</SelectItem>
                                  <SelectItem value="developing">Developing</SelectItem>
                                  <SelectItem value="defined">Defined</SelectItem>
                                  <SelectItem value="managed">Managed</SelectItem>
                                  <SelectItem value="optimizing">Optimizing</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor="capability-criticality">Criticality</Label>
                              <Select
                                value={editCapabilityForm.criticality}
                                onValueChange={(value) => handleEditCapabilityInputChange("criticality", value)}
                              >
                                <SelectTrigger id="capability-criticality">
                                  <SelectValue placeholder="Select criticality" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="low">Low</SelectItem>
                                  <SelectItem value="medium">Medium</SelectItem>
                                  <SelectItem value="high">High</SelectItem>
                                  <SelectItem value="critical">Critical</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor="capability-color">Color</Label>
                              <Input
                                id="capability-color"
                                type="color"
                                value={editCapabilityForm.colorCode}
                                onChange={(event) => handleEditCapabilityInputChange("colorCode", event.target.value)}
                              />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <Label htmlFor="capability-description">Description</Label>
                            <Textarea
                              id="capability-description"
                              rows={4}
                              value={editCapabilityForm.description}
                              onChange={(event) => handleEditCapabilityInputChange("description", event.target.value)}
                              placeholder="Business context and expected outcomes"
                            />
                          </div>
                        </div>

                        <div className="space-y-4 rounded-lg border p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h4 className="text-sm font-semibold">Create child capability</h4>
                            <Button
                              size="sm"
                              onClick={handleCreateCapability}
                              disabled={isCreatingCapability}
                            >
                              {isCreatingCapability ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <Plus className="mr-2 h-4 w-4" />
                              )}
                              Add capability
                            </Button>
                          </div>

                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-1">
                              <Label htmlFor="new-parent">Parent capability</Label>
                              <Select
                                value={newCapabilityForm.parentId || "none"}
                                onValueChange={(value) =>
                                  setNewCapabilityForm((prev) => ({
                                    ...prev,
                                    parentId: value === "none" ? "" : value,
                                    level:
                                      value === "none"
                                        ? "1"
                                        : (() => {
                                            const parentCapability = capabilityMap.get(Number(value));
                                            return parentCapability ? String(parentCapability.level + 1) : prev.level;
                                          })(),
                                  }))
                                }
                              >
                                <SelectTrigger id="new-parent">
                                  <SelectValue placeholder="Select parent" />
                                </SelectTrigger>
                                <SelectContent className="max-h-64">
                                  <SelectItem value="none">No parent (root capability)</SelectItem>
                                  {capabilityMetrics.map((metric) => (
                                    <SelectItem key={metric.id} value={String(metric.capability.id)}>
                                      {`Level ${metric.level}: ${metric.capability.name}`}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor="new-level">Level</Label>
                              <Input
                                id="new-level"
                                type="number"
                                value={newCapabilityForm.level}
                                onChange={(event) => handleNewCapabilityInputChange("level", event.target.value)}
                                min={1}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor="new-name">Name</Label>
                              <Input
                                id="new-name"
                                value={newCapabilityForm.name}
                                onChange={(event) => handleNewCapabilityInputChange("name", event.target.value)}
                                placeholder="New capability name"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor="new-code">Code</Label>
                              <Input
                                id="new-code"
                                value={newCapabilityForm.code}
                                onChange={(event) => handleNewCapabilityInputChange("code", event.target.value)}
                                placeholder="Unique code"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor="new-sort-order">Sort order</Label>
                              <Input
                                id="new-sort-order"
                                type="number"
                                value={newCapabilityForm.sortOrder}
                                onChange={(event) => handleNewCapabilityInputChange("sortOrder", event.target.value)}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor="new-criticality">Criticality</Label>
                              <Select
                                value={newCapabilityForm.criticality}
                                onValueChange={(value) => handleNewCapabilityInputChange("criticality", value)}
                              >
                                <SelectTrigger id="new-criticality">
                                  <SelectValue placeholder="Select criticality" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="low">Low</SelectItem>
                                  <SelectItem value="medium">Medium</SelectItem>
                                  <SelectItem value="high">High</SelectItem>
                                  <SelectItem value="critical">Critical</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor="new-maturity">Maturity</Label>
                              <Select
                                value={newCapabilityForm.maturityLevel || "developing"}
                                onValueChange={(value) => handleNewCapabilityInputChange("maturityLevel", value)}
                              >
                                <SelectTrigger id="new-maturity">
                                  <SelectValue placeholder="Select maturity" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="basic">Basic</SelectItem>
                                  <SelectItem value="developing">Developing</SelectItem>
                                  <SelectItem value="defined">Defined</SelectItem>
                                  <SelectItem value="managed">Managed</SelectItem>
                                  <SelectItem value="optimizing">Optimizing</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor="new-color">Color</Label>
                              <Input
                                id="new-color"
                                type="color"
                                value={newCapabilityForm.colorCode}
                                onChange={(event) => handleNewCapabilityInputChange("colorCode", event.target.value)}
                              />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="new-description">Description</Label>
                            <Textarea
                              id="new-description"
                              rows={3}
                              value={newCapabilityForm.description}
                              onChange={(event) => handleNewCapabilityInputChange("description", event.target.value)}
                              placeholder="What value does this capability deliver?"
                            />
                          </div>
                        </div>

                        <div className="space-y-6 rounded-lg border p-4">
                          <div className="space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <h4 className="text-sm font-semibold">Link data domain</h4>
                              <Button
                                size="sm"
                                onClick={handleAddDomainMapping}
                                disabled={isCreatingDomainMapping}
                              >
                                {isCreatingDomainMapping ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <Plus className="mr-2 h-4 w-4" />
                                )}
                                Add domain
                              </Button>
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                              <div className="space-y-1">
                                <Label htmlFor="domain-select">Domain</Label>
                                <Select
                                  value={domainMappingForm.domainId}
                                  onValueChange={(value) => handleDomainMappingInputChange("domainId", value)}
                                >
                                  <SelectTrigger id="domain-select">
                                    <SelectValue placeholder="Select domain" />
                                  </SelectTrigger>
                                  <SelectContent className="max-h-64">
                                    {sortedDomains.map((domain) => (
                                      <SelectItem key={domain.id} value={String(domain.id)}>
                                        {domain.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1">
                                <Label htmlFor="domain-mapping-type">Relationship</Label>
                                <Select
                                  value={domainMappingForm.mappingType}
                                  onValueChange={(value) => handleDomainMappingInputChange("mappingType", value)}
                                >
                                  <SelectTrigger id="domain-mapping-type">
                                    <SelectValue placeholder="Select relationship" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="primary">Primary</SelectItem>
                                    <SelectItem value="secondary">Secondary</SelectItem>
                                    <SelectItem value="supporting">Supporting</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1">
                                <Label htmlFor="domain-importance">Importance</Label>
                                <Select
                                  value={domainMappingForm.importance}
                                  onValueChange={(value) => handleDomainMappingInputChange("importance", value)}
                                >
                                  <SelectTrigger id="domain-importance">
                                    <SelectValue placeholder="Select importance" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="low">Low</SelectItem>
                                    <SelectItem value="medium">Medium</SelectItem>
                                    <SelectItem value="high">High</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor="domain-description">Context</Label>
                              <Textarea
                                id="domain-description"
                                rows={3}
                                value={domainMappingForm.description}
                                onChange={(event) => handleDomainMappingInputChange("description", event.target.value)}
                                placeholder="What role does this domain play?"
                              />
                            </div>
                          </div>

                          <Separator />

                          <div className="space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <h4 className="text-sm font-semibold">Link data area</h4>
                              <Button
                                size="sm"
                                onClick={handleAddDataAreaMapping}
                                disabled={isCreatingAreaMapping}
                              >
                                {isCreatingAreaMapping ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <Plus className="mr-2 h-4 w-4" />
                                )}
                                Add data area
                              </Button>
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                              <div className="space-y-1">
                                <Label htmlFor="area-domain">Domain (optional)</Label>
                                <Select
                                  value={dataAreaMappingForm.domainId || "none"}
                                  onValueChange={(value) =>
                                    setDataAreaMappingForm((prev) => ({
                                      ...prev,
                                      domainId: value === "none" ? "" : value,
                                      dataAreaId: "",
                                    }))
                                  }
                                >
                                  <SelectTrigger id="area-domain">
                                    <SelectValue placeholder="Filter by domain" />
                                  </SelectTrigger>
                                  <SelectContent className="max-h-64">
                                    <SelectItem value="none">All domains</SelectItem>
                                    {sortedDomains.map((domain) => (
                                      <SelectItem key={domain.id} value={String(domain.id)}>
                                        {domain.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1">
                                <Label htmlFor="area-select">Data area</Label>
                                <Select
                                  value={dataAreaMappingForm.dataAreaId}
                                  onValueChange={(value) => handleDataAreaMappingInputChange("dataAreaId", value)}
                                >
                                  <SelectTrigger id="area-select">
                                    <SelectValue placeholder="Select data area" />
                                  </SelectTrigger>
                                  <SelectContent className="max-h-64">
                                    {availableDataAreas.map((area) => (
                                      <SelectItem key={area.id} value={String(area.id)}>
                                        {area.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1">
                                <Label htmlFor="area-mapping-type">Relationship</Label>
                                <Select
                                  value={dataAreaMappingForm.mappingType}
                                  onValueChange={(value) => handleDataAreaMappingInputChange("mappingType", value)}
                                >
                                  <SelectTrigger id="area-mapping-type">
                                    <SelectValue placeholder="Select relationship" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="primary">Primary</SelectItem>
                                    <SelectItem value="secondary">Secondary</SelectItem>
                                    <SelectItem value="supporting">Supporting</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1">
                                <Label htmlFor="area-importance">Importance</Label>
                                <Select
                                  value={dataAreaMappingForm.importance}
                                  onValueChange={(value) => handleDataAreaMappingInputChange("importance", value)}
                                >
                                  <SelectTrigger id="area-importance">
                                    <SelectValue placeholder="Select importance" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="low">Low</SelectItem>
                                    <SelectItem value="medium">Medium</SelectItem>
                                    <SelectItem value="high">High</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor="area-description">Context</Label>
                              <Textarea
                                id="area-description"
                                rows={3}
                                value={dataAreaMappingForm.description}
                                onChange={(event) => handleDataAreaMappingInputChange("description", event.target.value)}
                                placeholder="How does this data area support the capability?"
                              />
                            </div>
                          </div>

                          <Separator />

                          <div className="space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <h4 className="text-sm font-semibold">Link system</h4>
                              <Button
                                size="sm"
                                onClick={handleAddSystemMapping}
                                disabled={isCreatingSystemMapping}
                              >
                                {isCreatingSystemMapping ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <Plus className="mr-2 h-4 w-4" />
                                )}
                                Add system
                              </Button>
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                              <div className="space-y-1">
                                <Label htmlFor="system-select">System</Label>
                                <Select
                                  value={systemMappingForm.systemId}
                                  onValueChange={(value) => handleSystemMappingInputChange("systemId", value)}
                                >
                                  <SelectTrigger id="system-select">
                                    <SelectValue placeholder="Select system" />
                                  </SelectTrigger>
                                  <SelectContent className="max-h-64">
                                    {sortedSystems.map((system) => (
                                      <SelectItem key={system.id} value={String(system.id)}>
                                        {system.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1">
                                <Label htmlFor="system-mapping-type">Relationship</Label>
                                <Select
                                  value={systemMappingForm.mappingType}
                                  onValueChange={(value) => handleSystemMappingInputChange("mappingType", value)}
                                >
                                  <SelectTrigger id="system-mapping-type">
                                    <SelectValue placeholder="Select relationship" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="enables">Enables</SelectItem>
                                    <SelectItem value="supports">Supports</SelectItem>
                                    <SelectItem value="automates">Automates</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1">
                                <Label htmlFor="system-role">System role</Label>
                                <Select
                                  value={systemMappingForm.systemRole}
                                  onValueChange={(value) => handleSystemMappingInputChange("systemRole", value)}
                                >
                                  <SelectTrigger id="system-role">
                                    <SelectValue placeholder="Select role" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="primary">Primary</SelectItem>
                                    <SelectItem value="secondary">Secondary</SelectItem>
                                    <SelectItem value="supporting">Supporting</SelectItem>
                                    <SelectItem value="legacy">Legacy</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1">
                                <Label htmlFor="system-coverage">Coverage</Label>
                                <Select
                                  value={systemMappingForm.coverage}
                                  onValueChange={(value) => handleSystemMappingInputChange("coverage", value)}
                                >
                                  <SelectTrigger id="system-coverage">
                                    <SelectValue placeholder="Select coverage" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="full">Full</SelectItem>
                                    <SelectItem value="partial">Partial</SelectItem>
                                    <SelectItem value="minimal">Minimal</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor="system-description">Context</Label>
                              <Textarea
                                id="system-description"
                                rows={3}
                                value={systemMappingForm.description}
                                onChange={(event) => handleSystemMappingInputChange("description", event.target.value)}
                                placeholder="Describe the system's role for this capability"
                              />
                            </div>
                          </div>

                          <Separator />

                          <div className="space-y-3">
                            <h4 className="text-sm font-semibold">Current relationships</h4>
                            <ScrollArea className="h-[260px] pr-2">
                              <CapabilityMappingsDisplay
                                mappings={capabilityMappings}
                                onRemoveDomainMapping={handleRemoveDomainMapping}
                                onRemoveDataAreaMapping={handleRemoveDataAreaMapping}
                                onRemoveSystemMapping={handleRemoveSystemMapping}
                              />
                            </ScrollArea>
                          </div>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                ) : (
                  <p className="text-muted-foreground">
                    Select a capability from the hierarchy or visualization to explore supporting data domains, areas, and enabling systems.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};

interface SummaryTileProps {
  title: string;
  value: string;
  description: string;
  icon: React.ReactNode;
  tone?: "default" | "warning";
}

const SummaryTile: React.FC<SummaryTileProps> = ({ title, value, description, icon, tone = "default" }) => {
  const highlight =
    tone === "warning"
      ? "border-amber-200/60 bg-amber-50/60 text-amber-900"
      : "border-border bg-card";

  return (
    <div className={`rounded-xl border p-4 shadow-sm transition ${highlight}`}>
      <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
        <span>{title}</span>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground leading-snug">{description}</p>
    </div>
  );
};

interface DetailMetricProps {
  label: string;
  value: string;
  helper?: string;
}

const DetailMetric: React.FC<DetailMetricProps> = ({ label, value, helper }) => (
  <div className="rounded-lg border bg-muted/40 p-3">
    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
    <p className="mt-1 text-sm font-semibold leading-tight">{value}</p>
    {helper && <p className="mt-1 text-[11px] text-muted-foreground leading-snug">{helper}</p>}
  </div>
);

interface InfographicColumnProps {
  data: InfographicColumnData;
  onSelect: (id: number) => void;
  selectedCapabilityId?: number;
}

const InfographicColumn: React.FC<InfographicColumnProps> = ({ data, onSelect, selectedCapabilityId }) => {
  const rootSelected = selectedCapabilityId === data.root.id;
  const baseTone = colord(data.baseColor);
  const chipTextColor = baseTone.isDark()
    ? baseTone.lighten(0.6).toHex()
    : baseTone.darken(0.5).toHex();

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border bg-background/95 shadow-sm backdrop-blur">
      <button
        type="button"
        onClick={() => onSelect(data.root.id)}
        className={`flex flex-col gap-1 p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
          rootSelected ? "ring-2 ring-offset-2 ring-primary" : "hover:brightness-105"
        }`}
        style={{ background: data.headerColor, color: "white" }}
      >
        <span className="text-[10px] uppercase tracking-[0.3em] text-white/70">Capability Domain</span>
        <span className="text-base font-semibold leading-snug">{data.root.name}</span>
        {data.root.description && (
          <span className="text-xs text-white/80 leading-snug">{data.root.description}</span>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
          <span
            className="rounded-full px-2 py-0.5 font-medium"
            style={{ background: data.chipColor, color: chipTextColor }}
          >
            Level {data.root.level ?? 1}
          </span>
          {data.root.code && (
            <span
              className="rounded-full px-2 py-0.5 font-medium"
              style={{ background: data.chipColor, color: chipTextColor }}
            >
              {data.root.code}
            </span>
          )}
        </div>
      </button>

      <div className="flex flex-1 flex-col gap-3 p-3" style={{ background: data.softBackground }}>
        {data.sections.length ? (
          data.sections.map((section) => {
            const sectionSelected = selectedCapabilityId === section.capability.id;
            const accent = colord(section.accentColor);

            return (
              <div key={section.capability.id} className="space-y-2">
                <button
                  type="button"
                  onClick={() => onSelect(section.capability.id)}
                  className={`w-full rounded-xl border p-3 text-left shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                    sectionSelected ? "ring-2 ring-offset-2 ring-primary" : "hover:-translate-y-[1px] hover:shadow-md"
                  }`}
                  style={{
                    background: section.background,
                    borderColor: section.borderColor,
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold leading-snug text-slate-900">
                        {section.capability.name}
                      </p>
                      {section.capability.description && (
                        <p className="mt-1 text-xs leading-snug text-slate-700/80">
                          {section.capability.description}
                        </p>
                      )}
                    </div>
                    <Badge
                      variant="outline"
                      className="whitespace-nowrap text-[11px]"
                      style={{
                        background: accent.alpha(0.18).toRgbString(),
                        borderColor: accent.alpha(0.4).toRgbString(),
                        color: accent.darken(0.2).toHex(),
                      }}
                    >
                      {section.capability.code || "Sub-domain"}
                    </Badge>
                  </div>
                </button>

                {section.tertiary.length > 0 && (
                  <div className="ml-1 space-y-1">
                    {section.tertiary.map((tertiary) => {
                      const tertiarySelected = selectedCapabilityId === tertiary.id;
                      return (
                        <button
                          type="button"
                          key={tertiary.id}
                          onClick={() => onSelect(tertiary.id)}
                          className={`flex w-full items-start gap-2 rounded-lg px-2 py-1 text-left text-xs transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-1 ${
                            tertiarySelected ? "bg-primary/10 text-primary" : "hover:bg-white/70"
                          }`}
                        >
                          <span
                            className="mt-[5px] h-1.5 w-1.5 rounded-full"
                            style={{ background: section.accentColor }}
                          />
                          <span className="flex-1 leading-snug text-slate-700">{tertiary.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="rounded-xl border border-dashed border-border/70 bg-background/60 p-4 text-xs text-muted-foreground">
            No sub-capabilities captured yet for this domain.
          </div>
        )}
      </div>
    </div>
  );
};