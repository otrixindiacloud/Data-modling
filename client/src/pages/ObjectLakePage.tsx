import { useEffect, useMemo, useState, type ComponentType } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Brush,
  Database,
  Filter,
  ChevronDown,
  ChevronUp,
  GitBranch,
  Grid3X3,
  Layers3,
  Link,
  ListChecks,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  Tag,
  ToggleLeft,
  ToggleRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  type ObjectLakeResponse,
  type ObjectLakeObject,
  type ObjectLakeAttribute,
  type ObjectLakeModelInstance,
  type ObjectLakeRelationship,
  type ObjectLakeProperty
} from "@/types/objectLake";
import type { DataDomain, DataArea, DataModel, System } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

function useDebouncedValue<T>(value: T, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

const PAGE_SIZE_OPTIONS = [25, 50, 100];
const LAYER_OPTIONS = ["conceptual", "logical", "physical"];
const RELATIONSHIP_OPTIONS = ["1:1", "1:N", "N:1", "N:M", "M:N"];

interface FilterState {
  search: string;
  domainId: string;
  dataAreaId: string;
  systemId: string;
  modelId: string;
  layer: string;
  objectType: string;
  hasAttributes: "all" | "with" | "without";
  relationshipType: string;
  includeHidden: boolean;
  page: number;
  pageSize: number;
  sortBy: "name" | "updatedAt" | "attributeCount" | "modelInstanceCount" | "relationshipCount";
  sortOrder: "asc" | "desc";
}

const INITIAL_FILTERS: FilterState = {
  search: "",
  domainId: "all",
  dataAreaId: "all",
  systemId: "all",
  modelId: "all",
  layer: "all",
  objectType: "all",
  hasAttributes: "all",
  relationshipType: "all",
  includeHidden: false,
  page: 1,
  pageSize: 50,
  sortBy: "name",
  sortOrder: "asc"
};

export default function ObjectLakePage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [selectedObjectId, setSelectedObjectId] = useState<number | null>(null);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(true);
  const debouncedSearch = useDebouncedValue(filters.search, 300);

  const domainsQuery = useQuery<DataDomain[]>({
    queryKey: ["/api/domains"],
    queryFn: async () => {
      const response = await fetch("/api/domains");
      if (!response.ok) throw new Error("Failed to load domains");
      return response.json();
    }
  });

  const areasQuery = useQuery<DataArea[]>({
    queryKey: ["/api/areas"],
    queryFn: async () => {
      const response = await fetch("/api/areas");
      if (!response.ok) throw new Error("Failed to load data areas");
      return response.json();
    }
  });

  const systemsQuery = useQuery<System[]>({
    queryKey: ["/api/systems"],
    queryFn: async () => {
      const response = await fetch("/api/systems");
      if (!response.ok) throw new Error("Failed to load systems");
      return response.json();
    }
  });

  const modelsQuery = useQuery<DataModel[]>({
    queryKey: ["/api/models"],
    queryFn: async () => {
      const response = await fetch("/api/models");
      if (!response.ok) throw new Error("Failed to load models");
      return response.json();
    }
  });

  const objectLakeQuery = useQuery<ObjectLakeResponse>({
    queryKey: [
      "/api/object-lake",
      {
        ...filters,
        search: debouncedSearch
      }
    ],
    queryFn: async ({ queryKey }) => {
      const [, queryFilters] = queryKey as [string, FilterState];
      const params = new URLSearchParams();

      if (queryFilters.search) params.set("search", queryFilters.search);
      if (queryFilters.domainId !== "all") params.set("domainId", queryFilters.domainId);
      if (queryFilters.dataAreaId !== "all") params.set("dataAreaId", queryFilters.dataAreaId);
      if (queryFilters.systemId !== "all") params.set("systemId", queryFilters.systemId);
      if (queryFilters.modelId !== "all") params.set("modelId", queryFilters.modelId);
      if (queryFilters.layer !== "all") params.set("layer", queryFilters.layer);
      if (queryFilters.objectType !== "all") params.set("objectType", queryFilters.objectType);
      if (queryFilters.relationshipType !== "all") params.set("relationshipType", queryFilters.relationshipType);
      if (queryFilters.hasAttributes === "with") params.set("hasAttributes", "true");
      if (queryFilters.hasAttributes === "without") params.set("hasAttributes", "false");
      if (queryFilters.includeHidden) params.set("includeHidden", "true");

      params.set("page", queryFilters.page.toString());
      params.set("pageSize", queryFilters.pageSize.toString());
      params.set("sortBy", queryFilters.sortBy);
      params.set("sortOrder", queryFilters.sortOrder);

      const response = await fetch(`/api/object-lake?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to load object lake data");
      }
      return response.json();
    },
    keepPreviousData: true
  });

  const objectTypeOptions = useMemo(() => {
    if (!objectLakeQuery.data?.objects) return [];
    const types = new Set<string>();
    objectLakeQuery.data.objects.forEach((object) => {
      if (object.objectType) {
        types.add(object.objectType);
      }
    });
    return Array.from(types).sort();
  }, [objectLakeQuery.data?.objects]);

  useEffect(() => {
    if (!objectLakeQuery.data?.objects?.length) {
      setSelectedObjectId(null);
      return;
    }

    if (selectedObjectId === null) {
      setSelectedObjectId(objectLakeQuery.data.objects[0].id);
      return;
    }

    const stillExists = objectLakeQuery.data.objects.some((obj) => obj.id === selectedObjectId);
    if (!stillExists) {
      setSelectedObjectId(objectLakeQuery.data.objects[0].id);
    }
  }, [objectLakeQuery.data?.objects, selectedObjectId]);

  const selectedObject = objectLakeQuery.data?.objects.find((obj) => obj.id === selectedObjectId) ?? null;

  const availableAreas = useMemo(() => {
    if (filters.domainId === "all") {
      return areasQuery.data ?? [];
    }
    const domainIdNum = Number(filters.domainId);
    return (areasQuery.data ?? []).filter((area) => area.domainId === domainIdNum);
  }, [areasQuery.data, filters.domainId]);

  const resetToFirstPage = () => {
    setFilters((prev) => ({ ...prev, page: 1 }));
  };

  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleRefresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/object-lake"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/objects"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/attributes"] })
    ]);
  };

  const totals = objectLakeQuery.data?.totals;
  const meta = objectLakeQuery.data?.meta;

  return (
    <div className="flex flex-1 flex-col bg-background text-foreground">
      <div className="border-b border-border bg-card/60 backdrop-blur px-6 py-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-blue-600 text-white shadow-md">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Object-Lake</h1>
              <p className="text-sm text-muted-foreground">Unified view of every data object across systems, models, and layers.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={objectLakeQuery.isFetching}
              className="gap-2"
            >
              <RefreshCw className={cn("h-4 w-4", objectLakeQuery.isFetching && "animate-spin")}/>
              Refresh
            </Button>
            <Select
              value={filters.sortBy}
              onValueChange={(value) => {
                updateFilter("sortBy", value as FilterState["sortBy"]);
                resetToFirstPage();
              }}
            >
              <SelectTrigger className="h-9 w-[180px] text-sm">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="updatedAt">Last Updated</SelectItem>
                <SelectItem value="attributeCount">Attribute Count</SelectItem>
                <SelectItem value="modelInstanceCount">Instance Count</SelectItem>
                <SelectItem value="relationshipCount">Relationship Count</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.sortOrder}
              onValueChange={(value) => {
                updateFilter("sortOrder", value as FilterState["sortOrder"]);
                resetToFirstPage();
              }}
            >
              <SelectTrigger className="h-9 w-[140px] text-sm">
                <SelectValue placeholder="Sort order" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asc">Ascending</SelectItem>
                <SelectItem value="desc">Descending</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.pageSize.toString()}
              onValueChange={(value) => {
                updateFilter("pageSize", Number(value));
                resetToFirstPage();
              }}
            >
              <SelectTrigger className="h-9 w-[140px] text-sm">
                <SelectValue placeholder="Page size" />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <SelectItem key={size} value={size.toString()}>{size} per page</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {totals && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Database} label="Objects" value={totals.objectCount} trendLabel="total objects" />
            <StatCard icon={ListChecks} label="Attributes" value={totals.attributeCount} trendLabel="tracked attributes" />
            <StatCard icon={Link} label="Relationships" value={totals.relationshipCount} trendLabel="connections" />
            <StatCard icon={Layers3} label="Model Instances" value={totals.modelInstanceCount} trendLabel="layer placements" />
          </div>
        )}
      </div>

      <div className="flex flex-1 min-h-0">
        <aside className="hidden w-full max-w-sm border-r border-border bg-muted/30 p-4 lg:block">
          <FilterPanel
            filters={filters}
            domains={domainsQuery.data ?? []}
            areas={availableAreas}
            systems={systemsQuery.data ?? []}
            models={modelsQuery.data ?? []}
            objectTypes={objectTypeOptions}
            onFilterChange={(key, value) => {
              updateFilter(key, value);
              if (key !== "page" && key !== "sortBy" && key !== "sortOrder" && key !== "pageSize") {
                resetToFirstPage();
              }
            }}
            isOpen={isFilterPanelOpen}
            onOpenChange={setIsFilterPanelOpen}
          />
        </aside>

        <div className="flex flex-1 flex-col lg:grid lg:grid-cols-[360px,1fr]">
          <div className="border-b border-border bg-card/40 p-4 lg:border-r lg:border-b-0">
            <div className="mb-3 flex items-center gap-2">
              <div className="relative w-full">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={filters.search}
                  onChange={(event) => updateFilter("search", event.target.value)}
                  placeholder="Search by name, system, or tag"
                  className="pl-8"
                />
              </div>
              <Button
                variant="secondary"
                size="icon"
                onClick={() => {
                  setFilters(INITIAL_FILTERS);
                  setSelectedObjectId(null);
                }}
                title="Clear filters"
              >
                <Filter className="h-4 w-4" />
              </Button>
            </div>

            <ScrollArea className="h-[calc(100vh-320px)] pr-2">
              {objectLakeQuery.isLoading ? (
                <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <p className="text-sm">Loading object inventory…</p>
                </div>
              ) : !objectLakeQuery.data?.objects.length ? (
                <div className="flex flex-col items-center justify-center gap-3 py-10 text-center text-muted-foreground">
                  <AlertTriangle className="h-6 w-6" />
                  <p className="text-sm font-medium">No objects match your filters.</p>
                  <p className="text-xs">Try adjusting filters or broadening your search.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {objectLakeQuery.data.objects.map((object) => (
                    <ObjectListItem
                      key={object.id}
                      object={object}
                      isActive={object.id === selectedObjectId}
                      onSelect={() => setSelectedObjectId(object.id)}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>

            {meta && (
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Page {meta.page} • Showing {objectLakeQuery.data?.objects.length ?? 0} of {totals?.objectCount ?? 0}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={meta.page <= 1 || objectLakeQuery.isFetching}
                    onClick={() => updateFilter("page", Math.max(1, filters.page - 1))}
                  >
                    Prev
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!meta.hasMore || objectLakeQuery.isFetching}
                    onClick={() => updateFilter("page", filters.page + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-1 flex-col min-h-0">
            {selectedObject ? (
              <ObjectDetailPanel object={selectedObject} />
            ) : (
              <div className="flex flex-1 items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Database className="mx-auto h-10 w-10 opacity-50" />
                  <p className="mt-3 text-sm font-medium">Select an object to explore its lineage and attributes.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface FilterPanelProps {
  filters: FilterState;
  domains: DataDomain[];
  areas: DataArea[];
  systems: System[];
  models: DataModel[];
  objectTypes: string[];
  onFilterChange: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

function FilterPanel({ filters, domains, areas, systems, models, objectTypes, onFilterChange, isOpen, onOpenChange }: FilterPanelProps) {
  const activeFilterCount = [
    filters.domainId !== "all",
    filters.dataAreaId !== "all",
    filters.systemId !== "all",
    filters.modelId !== "all",
    filters.layer !== "all",
    filters.objectType !== "all",
    filters.hasAttributes !== "all",
    filters.relationshipType !== "all",
    filters.includeHidden
  ].filter(Boolean).length;

  return (
    <Collapsible open={isOpen} onOpenChange={onOpenChange} className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label={isOpen ? "Collapse filters" : "Expand filters"}
            >
              {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <Filter className="h-4 w-4" />
            Filters
          </h3>
          {activeFilterCount > 0 && (
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
              {activeFilterCount} active
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => onFilterChange("includeHidden", !filters.includeHidden)}
        >
          {filters.includeHidden ? <ToggleRight className="mr-1 h-3.5 w-3.5" /> : <ToggleLeft className="mr-1 h-3.5 w-3.5" />}
          Hidden
        </Button>
      </div>

      <CollapsibleContent className="space-y-3">
        <div className="grid gap-3">
          <Select
            value={filters.domainId}
            onValueChange={(value) => onFilterChange("domainId", value)}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Domain" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Domains</SelectItem>
              {domains.map((domain) => (
                <SelectItem key={domain.id} value={domain.id.toString()}>{domain.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.dataAreaId}
            onValueChange={(value) => onFilterChange("dataAreaId", value)}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Data Area" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Data Areas</SelectItem>
              {areas.map((area) => (
                <SelectItem key={area.id} value={area.id.toString()}>{area.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.systemId}
            onValueChange={(value) => onFilterChange("systemId", value)}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="System" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Systems</SelectItem>
              {systems.map((system) => (
                <SelectItem key={system.id} value={system.id.toString()}>{system.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.modelId}
            onValueChange={(value) => onFilterChange("modelId", value)}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Model" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Models</SelectItem>
              {models.map((model) => (
                <SelectItem key={model.id} value={model.id.toString()}>{model.name} • {model.layer}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.layer}
            onValueChange={(value) => onFilterChange("layer", value)}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Layer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Layers</SelectItem>
              {LAYER_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>{option}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.objectType}
            onValueChange={(value) => onFilterChange("objectType", value)}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Object Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Object Types</SelectItem>
              {objectTypes.map((type) => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.hasAttributes}
            onValueChange={(value) => onFilterChange("hasAttributes", value as FilterState["hasAttributes"])}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Attribute filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Objects</SelectItem>
              <SelectItem value="with">With Attributes</SelectItem>
              <SelectItem value="without">Without Attributes</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.relationshipType}
            onValueChange={(value) => onFilterChange("relationshipType", value)}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Relationship" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Relationship Types</SelectItem>
              {RELATIONSHIP_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>{option}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center justify-between rounded-md border border-dashed border-border bg-background/60 p-3">
            <div>
              <p className="text-xs font-medium">Include hidden instances</p>
              <p className="text-[11px] text-muted-foreground">Show objects placed in hidden layers or drafts.</p>
            </div>
            <Switch
              checked={filters.includeHidden}
              onCheckedChange={(checked) => onFilterChange("includeHidden", checked)}
            />
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

interface ObjectListItemProps {
  object: ObjectLakeObject;
  isActive: boolean;
  onSelect: () => void;
}

function ObjectListItem({ object, isActive, onSelect }: ObjectListItemProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-lg border p-3 text-left shadow-sm transition-all",
        isActive ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/40 hover:bg-card/80"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold leading-tight">{object.name}</p>
            {object.objectType && (
              <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                {object.objectType}
              </Badge>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
            {object.domain?.name && (
              <Badge variant="secondary" className="text-[10px]">
                <Sparkles className="mr-1 h-3 w-3" />
                {object.domain.name}
              </Badge>
            )}
            {object.dataArea?.name && (
              <Badge variant="secondary" className="text-[10px]">
                <Grid3X3 className="mr-1 h-3 w-3" />
                {object.dataArea.name}
              </Badge>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <ListChecks className="h-3.5 w-3.5" />
              {object.stats.attributeCount} attrs
            </span>
            <span className="inline-flex items-center gap-1">
              <Link className="h-3.5 w-3.5" />
              {object.stats.relationshipCount} rels
            </span>
            <span className="inline-flex items-center gap-1">
              <Layers3 className="h-3.5 w-3.5" />
              {object.stats.modelInstanceCount} layers
            </span>
          </div>
        </div>
        <Badge variant="outline" className="text-[10px]">
          {object.updatedAt ? formatDistanceToNow(new Date(object.updatedAt), { addSuffix: true }) : "n/a"}
        </Badge>
      </div>
    </button>
  );
}

interface ObjectDetailPanelProps {
  object: ObjectLakeObject;
}

function ObjectDetailPanel({ object }: ObjectDetailPanelProps) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-border bg-card/60 px-5 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Badge variant="secondary" className="uppercase tracking-wide">
                #{object.id}
              </Badge>
              {object.baseModel?.name && (
                <span className="flex items-center gap-1 text-xs">
                  <Layers3 className="h-3 w-3" />
                  {object.baseModel.name} • {object.baseModel.layer}
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-3">
              <h2 className="text-lg font-semibold leading-tight">{object.name}</h2>
              {object.objectType && (
                <Badge variant="outline" className="uppercase tracking-wide">
                  {object.objectType}
                </Badge>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
              {object.sourceSystem?.name && (
                <span className="inline-flex items-center gap-1">
                  <Database className="h-3.5 w-3.5" />
                  Source: {object.sourceSystem.name}
                </span>
              )}
              {object.targetSystem?.name && (
                <span className="inline-flex items-center gap-1">
                  <Brush className="h-3.5 w-3.5" />
                  Target: {object.targetSystem.name}
                </span>
              )}
              {object.domain?.name && (
                <span className="inline-flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5" />
                  {object.domain.name}
                </span>
              )}
              {object.dataArea?.name && (
                <span className="inline-flex items-center gap-1">
                  <Grid3X3 className="h-3.5 w-3.5" />
                  {object.dataArea.name}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <QuickStat label="Attributes" value={object.stats.attributeCount} />
            <QuickStat label="Relationships" value={object.stats.relationshipCount} />
            <QuickStat label="Instances" value={object.stats.modelInstanceCount} />
          </div>
        </div>
        {object.description && (
          <p className="mt-3 max-w-3xl text-sm text-muted-foreground">{object.description}</p>
        )}
      </div>

      <Tabs defaultValue="details" className="flex flex-1 flex-col">
        <TabsList className="sticky top-0 z-10 grid grid-cols-4 rounded-none border-b border-border bg-background/80 px-5 py-2 text-xs">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="attributes">Attributes</TabsTrigger>
          <TabsTrigger value="relationships">Relationships</TabsTrigger>
          <TabsTrigger value="properties">Properties</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="flex-1 overflow-y-auto px-5 py-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Base characteristics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <DetailRow label="Domain" value={object.domain?.name ?? "—"} />
                <DetailRow label="Data area" value={object.dataArea?.name ?? "—"} />
                <DetailRow label="Source system" value={object.sourceSystem?.name ?? "—"} />
                <DetailRow label="Target system" value={object.targetSystem?.name ?? "—"} />
                <DetailRow label="Base model" value={object.baseModel ? `${object.baseModel.name} (${object.baseModel.layer})` : "—"} />
                <DetailRow label="Last updated" value={object.updatedAt ? formatDistanceToNow(new Date(object.updatedAt), { addSuffix: true }) : "—"} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Model placement</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {object.modelInstances.length === 0 ? (
                  <p className="text-muted-foreground">No model instances recorded yet.</p>
                ) : (
                  <div className="space-y-3">
                    {object.modelInstances.map((instance) => (
                      <div key={instance.id} className="rounded-md border border-border p-3">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-semibold">
                            {instance.model ? `${instance.model.name} • ${instance.model.layer}` : "Unmapped model"}
                          </span>
                          <Badge variant={instance.isVisible ? "default" : "outline"} className="text-[10px] uppercase">
                            {instance.isVisible ? "Visible" : "Hidden"}
                          </Badge>
                        </div>
                        <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Tag className="h-3 w-3" />
                            Target system: {instance.targetSystem?.name ?? "—"}
                          </div>
                          {instance.layerSpecificConfig && Object.keys(instance.layerSpecificConfig).length > 0 && (
                            <div className="flex items-start gap-1">
                              <Brush className="mt-0.5 h-3 w-3" />
                              <span>Layer overrides applied</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <GitBranch className="h-3 w-3" />
                            {instance.relationships.length} relationships • {instance.attributes.length} attribute overrides
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="attributes" className="flex-1 overflow-y-auto px-5 py-4">
          {object.attributes.length === 0 ? (
            <EmptyState icon={ListChecks} title="No attributes" description="This object has no documented attributes yet." />
          ) : (
            <div className="space-y-3">
              {object.attributes.map((attribute) => (
                <AttributeCard key={attribute.id} attribute={attribute} modelInstances={object.modelInstances} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="relationships" className="flex-1 overflow-y-auto px-5 py-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <RelationshipSection
              title="Global relationships"
              relationships={object.relationships.global}
              emptyMessage="No direct relationships recorded for this object."
            />
            <RelationshipSection
              title="Model specific"
              relationships={object.relationships.modelSpecific}
              emptyMessage="No layer-specific relationships recorded."
            />
          </div>
        </TabsContent>

        <TabsContent value="properties" className="flex-1 overflow-y-auto px-5 py-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <PropertySection title="Object properties" properties={object.properties} />
            <div className="space-y-3">
              {object.modelInstances.map((instance) => (
                <PropertySection
                  key={instance.id}
                  title={`${instance.model?.name ?? "Unknown model"} (${instance.model?.layer ?? "n/a"})`}
                  properties={instance.properties}
                />
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface AttributeCardProps {
  attribute: ObjectLakeAttribute;
  modelInstances: ObjectLakeModelInstance[];
}

function AttributeCard({ attribute, modelInstances }: AttributeCardProps) {
  const modelOverrides = useMemo(() => Object.values(attribute.metadataByModel ?? {}), [attribute.metadataByModel]);

  return (
    <Card className="border-border/80">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">
          {attribute.name}
          {attribute.isPrimaryKey && (
            <Badge variant="outline" className="ml-2 text-[10px] uppercase tracking-wide">PK</Badge>
          )}
          {attribute.isForeignKey && (
            <Badge variant="outline" className="ml-2 text-[10px] uppercase tracking-wide">FK</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-xs text-muted-foreground">
        <div className="grid grid-cols-2 gap-2">
          <DetailRow label="Data type" value={attribute.dataType ?? "—"} />
          <DetailRow label="Conceptual" value={attribute.conceptualType ?? "—"} />
          <DetailRow label="Logical" value={attribute.logicalType ?? "—"} />
          <DetailRow label="Physical" value={attribute.physicalType ?? "—"} />
          <DetailRow label="Length" value={attribute.length ?? "—"} />
          <DetailRow label="Precision" value={attribute.precision ?? "—"} />
          <DetailRow label="Scale" value={attribute.scale ?? "—"} />
          <DetailRow label="Order" value={attribute.orderIndex ?? "—"} />
        </div>
        {attribute.description && (
          <p className="text-[11px] text-foreground">{attribute.description}</p>
        )}
        {modelOverrides.length > 0 && (
          <div className="rounded-md border border-dashed border-border/70 bg-muted/40 p-2">
            <p className="mb-1 text-[11px] font-semibold text-foreground">Layer overrides</p>
            <div className="space-y-1">
              {modelInstances.map((instance) => {
                const override = attribute.metadataByModel?.[instance.model?.id ?? -1];
                if (!override) return null;
                return (
                  <div key={instance.id} className="grid grid-cols-[120px,1fr] text-[11px]">
                    <span className="font-medium text-foreground">{instance.model?.layer ?? "—"}</span>
                    <span className="text-muted-foreground">
                      {override.logicalType ?? override.conceptualType ?? override.physicalType ?? "Override applied"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface RelationshipSectionProps {
  title: string;
  relationships: ObjectLakeRelationship[];
  emptyMessage: string;
}

function RelationshipSection({ title, relationships, emptyMessage }: RelationshipSectionProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-xs text-muted-foreground">
        {relationships.length === 0 ? (
          <p>{emptyMessage}</p>
        ) : (
          relationships.map((relationship) => (
            <div key={`${relationship.id}-${relationship.layer ?? "global"}`} className="rounded-md border border-border/70 p-3">
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <Badge variant="outline" className="text-[10px] uppercase tracking-wide">{relationship.type}</Badge>
                <span className="inline-flex items-center gap-1">
                  <GitBranch className="h-3 w-3" />
                  Level: {relationship.relationshipLevel}
                </span>
                {relationship.layer && (
                  <span className="inline-flex items-center gap-1">
                    <Layers3 className="h-3 w-3" />
                    {relationship.layer}
                  </span>
                )}
              </div>
              {relationship.name && <p className="mt-2 font-medium text-foreground">{relationship.name}</p>}
              {relationship.description && (
                <p className="text-[11px] text-muted-foreground">{relationship.description}</p>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

interface PropertySectionProps {
  title: string;
  properties: ObjectLakeProperty[];
}

function PropertySection({ title, properties }: PropertySectionProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-xs text-muted-foreground">
        {properties.length === 0 ? (
          <p>No properties recorded.</p>
        ) : (
          properties.map((property) => (
            <div key={property.id} className="rounded-md border border-border/60 bg-muted/40 p-3">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-medium text-foreground">{property.propertyName}</span>
                {property.layer && (
                  <Badge variant="outline" className="text-[9px] uppercase tracking-wider">{property.layer}</Badge>
                )}
              </div>
              <pre className="mt-2 max-h-32 overflow-auto rounded bg-background/80 p-2 text-[10px] font-mono text-foreground/90">
                {JSON.stringify(property.propertyValue, null, 2)}
              </pre>
              {property.description && (
                <p className="mt-2 text-[10px] italic text-muted-foreground">{property.description}</p>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

interface StatCardProps {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: number;
  trendLabel?: string;
}

function StatCard({ icon: Icon, label, value, trendLabel }: StatCardProps) {
  return (
    <Card className="border-border/80">
      <CardContent className="flex items-center gap-3 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold">{value.toLocaleString()}</p>
          {trendLabel && <p className="text-[11px] text-muted-foreground">{trendLabel}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function QuickStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-background/80 px-3 py-2 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-4 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

interface EmptyStateProps {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
}

function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
      <Icon className="h-6 w-6" />
      <p className="font-medium">{title}</p>
      <p className="text-xs">{description}</p>
    </div>
  );
}
