import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Plus, Layers3, Database, MapPin, ArrowRight, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import TopNavBar from "@/components/TopNavBar";
import AddDataModelModal from "@/components/modals/AddDataModelModal";
import { ModelingAgentPanel } from "@/components/ModelingAgentPanel";
import { useModelerStore } from "@/store/modelerStore";
import type { DataModel, DataDomain, DataArea, System } from "@shared/schema";
import type { ModelLayer } from "@/types/modeler";

interface ModelGroup {
  dataModelId: number;
  flow?: DataModel;
  conceptual?: DataModel;
  logical?: DataModel;
  physical?: DataModel;
  layers: DataModel[];
}

const fetchJson = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  const data = await response.json();
  return data as T;
};

export default function DataModelsListPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAgentPanelOpen, setIsAgentPanelOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { setCurrentModel } = useModelerStore();

  const {
    data: models = [],
    isLoading: modelsLoading,
    isError: modelsError,
    refetch: refetchModels,
  } = useQuery<DataModel[]>({
    queryKey: ["/api/models"],
    queryFn: () => fetchJson<DataModel[]>("/api/models"),
    staleTime: 30_000,
  });

  const { data: domains = [] } = useQuery<DataDomain[]>({
    queryKey: ["/api/domains"],
    queryFn: () => fetchJson<DataDomain[]>("/api/domains"),
    staleTime: 300_000,
  });

  const { data: dataAreas = [] } = useQuery<DataArea[]>({
    queryKey: ["/api/areas"],
    queryFn: () => fetchJson<DataArea[]>("/api/areas"),
    staleTime: 300_000,
  });

  const { data: systems = [] } = useQuery<System[]>({
    queryKey: ["/api/systems"],
    queryFn: () => fetchJson<System[]>("/api/systems"),
    staleTime: 300_000,
  });

  const domainMap = useMemo(() => {
    return new Map(domains.map((domain) => [domain.id, domain.name]));
  }, [domains]);

  const areaMap = useMemo(() => {
    return new Map(dataAreas.map((area) => [area.id, area.name]));
  }, [dataAreas]);

  const systemMap = useMemo(() => {
    return new Map(systems.map((system) => [system.id, system.name]));
  }, [systems]);

  const groupedModels = useMemo<ModelGroup[]>(() => {
    if (!Array.isArray(models)) return [];

    const typedModels = models as DataModel[];
    const groups = new Map<number, ModelGroup>();

    typedModels.forEach((model) => {
      const key = model.dataModelId ?? model.id;
      let group = groups.get(key);

      if (!group) {
        group = {
          dataModelId: key,
          layers: [],
        };
        groups.set(key, group);
      }

      group.layers.push(model);

      switch (model.layer) {
        case "flow":
          group.flow = model;
          break;
        case "conceptual":
          group.conceptual = model;
          break;
        case "logical":
          group.logical = model;
          break;
        case "physical":
          group.physical = model;
          break;
        default:
          break;
      }
    });

    return Array.from(groups.values()).filter((group) => group.conceptual || group.flow);
  }, [models]);

  const filteredGroups = useMemo(() => {
    if (!searchTerm) return groupedModels;
    const normalized = searchTerm.toLowerCase();
    return groupedModels.filter((group) => {
      const anchor = group.conceptual ?? group.flow;
      if (!anchor) return false;
      const domainName = anchor.domainId ? domainMap.get(anchor.domainId)?.toLowerCase() : "";
      const areaName = anchor.dataAreaId ? areaMap.get(anchor.dataAreaId)?.toLowerCase() : "";
      const systemName = anchor.targetSystemId ? systemMap.get(anchor.targetSystemId)?.toLowerCase() : "";
      return (
        anchor.name.toLowerCase().includes(normalized) ||
        (domainName && domainName.includes(normalized)) ||
        (areaName && areaName.includes(normalized)) ||
        (systemName && systemName.includes(normalized))
      );
    });
  }, [groupedModels, searchTerm, domainMap, areaMap, systemMap]);

  const handleViewDetails = (model: DataModel) => {
    setCurrentModel(model);

    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.setItem("modeler:pendingLayer", model.layer as ModelLayer);
        window.sessionStorage.setItem("modeler:pendingModelId", model.id.toString());
      } catch (error) {
        console.warn("Failed to persist conceptual layer before navigation", error);
      }
    }

    setLocation(`/modeler/${model.id}`);
  };

  const handleLayerNavigation = (layerModel: DataModel, layerKey: ModelLayer, conceptualId: number) => {
    setCurrentModel(layerModel);

    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.setItem("modeler:pendingLayer", layerKey);
        window.sessionStorage.setItem("modeler:pendingModelId", layerModel.id.toString());
      } catch (error) {
        console.warn("Failed to persist pending layer before navigation", error);
      }
    }

    setLocation(`/modeler/${conceptualId}`);
  };

  const handleCreateModel = () => {
    setIsAddModalOpen(false);
    setIsAgentPanelOpen(true);
  };

  const handleManualCreate = () => {
    setIsAgentPanelOpen(false);
    setIsAddModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-muted/20 flex flex-col">
      <TopNavBar />
      <div className="flex-1 w-full">
        <div className="max-w-6xl mx-auto px-2 sm:px-2 lg:px-4 py-8 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div className="space-y-2">
            <Badge variant="outline" className="w-fit bg-primary/5 text-primary border-primary/20 text-xs">
              Data Modeling
            </Badge>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Data Models</h1>
              <p className="text-muted-foreground text-sm sm:text-base mt-2 max-w-2xl">
                Browse all conceptual data models in your workspace. Create new modeling workspaces or open existing ones to continue refinement across conceptual, logical, and physical layers.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Layers3 className="h-4 w-4" />
                <span>Layer-aware navigation</span>
              </div>
              <div className="flex items-center gap-1">
                <Database className="h-4 w-4" />
                <span>Connected systems overview</span>
              </div>
              <div className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                <span>Domain &amp; data area context</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 self-start lg:self-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchModels()}
              disabled={modelsLoading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={cn("h-4 w-4", modelsLoading && "animate-spin")} />
              Refresh
            </Button>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={handleManualCreate} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Manual Model
              </Button>
              <Button onClick={handleCreateModel} className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                AI-Assisted Model
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search by model name, domain, area, or target system"
            className="sm:max-w-sm"
          />
          <div className="text-sm text-muted-foreground">
            {filteredGroups.length} model{filteredGroups.length === 1 ? "" : "s"} found
          </div>
        </div>

  {modelsError && (
          <Card className="border-destructive/40 bg-destructive/10 text-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">Failed to load data models</CardTitle>
              <CardDescription className="text-destructive/80">
                There was a problem fetching the data models list. Please try refreshing.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="destructive" onClick={() => refetchModels()} className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {modelsLoading ? (
          <div className="grid gap-6 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Card key={index} className="border-border/60">
                <CardHeader className="space-y-3">
                  <Skeleton className="h-6 w-1/2" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/3" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-11/12" />
                  <div className="flex gap-3">
                    <Skeleton className="h-9 w-24" />
                    <Skeleton className="h-9 w-28" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredGroups.length === 0 ? (
          <Card className="border-dashed border-primary/30 bg-primary/5">
            <CardHeader>
              <CardTitle>No data models yet</CardTitle>
              <CardDescription>
                Create your first conceptual model to begin defining logical and physical representations.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={handleManualCreate} className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Manual model
                </Button>
                <Button onClick={handleCreateModel} className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  AI-assisted model
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            {filteredGroups.map((group) => {
              const { flow, conceptual, logical, physical } = group;
              const primary = conceptual ?? flow;

              if (!primary) {
                return null;
              }

              const conceptualId = conceptual?.id ?? primary.id;

              const associatedLayers: Array<{ label: string; layerKey: ModelLayer; model?: DataModel }>
                = [
                  { label: "Flow", layerKey: "flow", model: flow },
                  { label: "Conceptual", layerKey: "conceptual", model: conceptual },
                  { label: "Logical", layerKey: "logical", model: logical },
                  { label: "Physical", layerKey: "physical", model: physical },
                ];

              return (
                <Card key={`${group.dataModelId}-${primary.id}`} className="relative overflow-hidden border-border/70 hover:shadow-lg transition-shadow duration-200">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />
                  <CardHeader className="relative space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <CardTitle className="text-xl font-semibold text-foreground">
                          {primary.name}
                        </CardTitle>
                        <CardDescription className="text-sm text-muted-foreground">
                          {conceptual
                            ? `Conceptual model created ${new Date(conceptual.createdAt).toLocaleDateString()}`
                            : `Flow model created ${new Date(flow!.createdAt).toLocaleDateString()}`}
                        </CardDescription>
                      </div>
                      <Badge variant="outline" className="bg-background/60 text-xs uppercase tracking-wide">
                        {conceptual ? "Conceptual" : "Flow"}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                      {primary.domainId && (
                        <span className="flex items-center gap-1">
                          <Layers3 className="h-4 w-4 text-primary" />
                          {domainMap.get(primary.domainId) ?? "Domain"}
                        </span>
                      )}
                      {primary.dataAreaId && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-4 w-4 text-primary" />
                          {areaMap.get(primary.dataAreaId) ?? "Data Area"}
                        </span>
                      )}
                      {primary.targetSystemId && (
                        <span className="flex items-center gap-1">
                          <Database className="h-4 w-4 text-primary" />
                          {systemMap.get(primary.targetSystemId) ?? "Target System"}
                        </span>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="relative space-y-4">
                    <div className="rounded-lg border border-border/60 bg-background/70 p-4 space-y-3">
                      <div className="font-medium text-sm text-foreground/80">Associated layers</div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {associatedLayers.map(({ label, layerKey, model }) => (
                          <LayerBadge
                            key={`${group.dataModelId}-${layerKey}`}
                            label={label}
                            layerKey={layerKey}
                            model={model}
                            onNavigate={model
                              ? (layerModel, layer) =>
                                  handleLayerNavigation(layerModel, layer, conceptualId)
                              : undefined}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="text-xs text-muted-foreground">
                        Updated {new Date(primary.updatedAt).toLocaleString()}
                      </div>
                      <Button onClick={() => handleViewDetails(primary)} className="flex items-center gap-2">
                        View details
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
        </div>
      </div>

      <AddDataModelModal open={isAddModalOpen} onOpenChange={setIsAddModalOpen} />
      {isAgentPanelOpen ? (
        <ModelingAgentPanel open={isAgentPanelOpen} onOpenChange={setIsAgentPanelOpen} />
      ) : null}
    </div>
  );
}

interface LayerBadgeProps {
  label: string;
  layerKey: ModelLayer;
  model?: DataModel;
  onNavigate?: (model: DataModel, layer: ModelLayer) => void;
}

function LayerBadge({ label, layerKey, model, onNavigate }: LayerBadgeProps) {
  if (!model) {
    return (
      <div className="flex items-center justify-between rounded-md border border-dashed border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        <span>{label} layer</span>
        <Badge variant="outline" className="bg-background text-muted-foreground">
          Not created
        </Badge>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onNavigate?.(model, layerKey)}
      className="group flex items-center justify-between rounded-md border border-border/60 bg-background px-3 py-2 text-xs text-muted-foreground transition hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <div className="space-y-1 text-left">
        <div className="flex items-center gap-1 font-medium text-foreground/90">
          {label} layer
          <ArrowRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground/80">
          {model.name || `Model ${model.id}`}
        </div>
        <div className="text-[10px] text-muted-foreground/70">ID: {model.id}</div>
      </div>
      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
        Open
      </Badge>
    </button>
  );
}
