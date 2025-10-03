import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Plus, Layers3, Database, MapPin, ArrowRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import TopNavBar from "@/components/TopNavBar";
import AddDataModelModal from "@/components/modals/AddDataModelModal";
import { useModelerStore } from "@/store/modelerStore";
import type { DataModel, DataDomain, DataArea, System } from "@shared/schema";

interface ModelGroup {
  conceptual: DataModel;
  children: DataModel[];
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

    const modelsWithChildren = new Map<number, ModelGroup>();

    models.forEach((model) => {
      if (!modelsWithChildren.has(model.id)) {
        modelsWithChildren.set(model.id, { conceptual: model, children: [] });
      }
    });

    models.forEach((model) => {
      if (model.parentModelId) {
        const parent = modelsWithChildren.get(model.parentModelId);
        if (parent) {
          parent.children.push(model);
        }
      }
    });

    return Array.from(modelsWithChildren.values()).filter(
      (group) => group.conceptual.layer === "conceptual" && !group.conceptual.parentModelId,
    );
  }, [models]);

  const filteredGroups = useMemo(() => {
    if (!searchTerm) return groupedModels;
    const normalized = searchTerm.toLowerCase();
    return groupedModels.filter((group) => {
      const conceptual = group.conceptual;
      const domainName = conceptual.domainId ? domainMap.get(conceptual.domainId)?.toLowerCase() : "";
      const areaName = conceptual.dataAreaId ? areaMap.get(conceptual.dataAreaId)?.toLowerCase() : "";
      const systemName = conceptual.targetSystemId ? systemMap.get(conceptual.targetSystemId)?.toLowerCase() : "";
      return (
        conceptual.name.toLowerCase().includes(normalized) ||
        (domainName && domainName.includes(normalized)) ||
        (areaName && areaName.includes(normalized)) ||
        (systemName && systemName.includes(normalized))
      );
    });
  }, [groupedModels, searchTerm, domainMap, areaMap, systemMap]);

  const handleViewDetails = (model: DataModel) => {
    setCurrentModel(model);
    setLocation(`/modeler/${model.id}`);
  };

  const handleCreateModel = () => {
    setIsAddModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-muted/20 flex flex-col">
      <TopNavBar />
      <div className="flex-1 w-full">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
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
            <Button onClick={handleCreateModel} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              New Data Model
            </Button>
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
              <Button onClick={handleCreateModel} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Create data model
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {filteredGroups.map((group) => {
              const { conceptual, children } = group;
              const logicalLayer = children.find((model) => model.layer === "logical");
              const physicalLayer = children.find((model) => model.layer === "physical");

              return (
                <Card key={conceptual.id} className="relative overflow-hidden border-border/70 hover:shadow-lg transition-shadow duration-200">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />
                  <CardHeader className="relative space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <CardTitle className="text-xl font-semibold text-foreground">
                          {conceptual.name}
                        </CardTitle>
                        <CardDescription className="text-sm text-muted-foreground">
                          Conceptual model created {new Date(conceptual.createdAt).toLocaleDateString()}
                        </CardDescription>
                      </div>
                      <Badge variant="outline" className="bg-background/60 text-xs uppercase tracking-wide">
                        Conceptual
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                      {conceptual.domainId && (
                        <span className="flex items-center gap-1">
                          <Layers3 className="h-4 w-4 text-primary" />
                          {domainMap.get(conceptual.domainId) ?? "Domain"}
                        </span>
                      )}
                      {conceptual.dataAreaId && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-4 w-4 text-primary" />
                          {areaMap.get(conceptual.dataAreaId) ?? "Data Area"}
                        </span>
                      )}
                      {conceptual.targetSystemId && (
                        <span className="flex items-center gap-1">
                          <Database className="h-4 w-4 text-primary" />
                          {systemMap.get(conceptual.targetSystemId) ?? "Target System"}
                        </span>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="relative space-y-4">
                    <div className="rounded-lg border border-border/60 bg-background/70 p-4 space-y-3">
                      <div className="font-medium text-sm text-foreground/80">Associated layers</div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <LayerBadge label="Logical" model={logicalLayer} />
                        <LayerBadge label="Physical" model={physicalLayer} />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="text-xs text-muted-foreground">
                        Updated {new Date(conceptual.updatedAt).toLocaleString()}
                      </div>
                      <Button onClick={() => handleViewDetails(conceptual)} className="flex items-center gap-2">
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
    </div>
  );
}

interface LayerBadgeProps {
  label: string;
  model?: DataModel;
}

function LayerBadge({ label, model }: LayerBadgeProps) {
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
    <div className="flex items-center justify-between rounded-md border border-border/60 bg-background px-3 py-2 text-xs text-muted-foreground">
      <div className="space-y-1">
        <div className="font-medium text-foreground/90">{label} layer</div>
        <div>ID: {model.id}</div>
      </div>
      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
        Ready
      </Badge>
    </div>
  );
}
