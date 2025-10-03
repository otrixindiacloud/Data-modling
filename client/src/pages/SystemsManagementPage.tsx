import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Database,
  Loader2,
  Plus,
  RefreshCw,
  Repeat,
  Server,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { SystemForm, SystemFormValues } from "@/components/SystemForm";
import { buildSystemRequestBody, mapSystemToFormValues } from "@/lib/systemFormHelpers";
import type { DataArea, DataDomain, DataModel, System } from "@shared/schema";

type SyncDirection = "source" | "target";

type SystemObjectSummary = {
  id: number;
  name: string;
  description: string | null;
  modelId: number;
  domainId: number | null;
  dataAreaId: number | null;
  sourceSystemId: number | null;
  targetSystemId: number | null;
  attributeCount: number;
  objectType?: string | null;
  model: {
    id: number;
    name: string;
    layer: string;
  } | null;
  systemAssociation: SyncDirection | null;
};

interface ConnectionTestResult {
  status: "success" | "error";
  message?: string;
  timestamp: number;
}

interface SyncSummary {
  created: number;
  updated: number;
  metadataCount: number;
}

export default function SystemsManagementPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [selectedSystemId, setSelectedSystemId] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [lastTestResult, setLastTestResult] = useState<ConnectionTestResult | null>(null);
  const [lastSyncSummary, setLastSyncSummary] = useState<SyncSummary | null>(null);
  const [syncModelId, setSyncModelId] = useState<number | null>(null);
  const [syncDirection, setSyncDirection] = useState<SyncDirection>("source");
  const [syncDomainChoice, setSyncDomainChoice] = useState<string>("inherit");
  const [syncAreaChoice, setSyncAreaChoice] = useState<string>("inherit");
  const [includeAttributes, setIncludeAttributes] = useState(true);

  const systemsQuery = useQuery<System[]>({
    queryKey: ["/api/systems"],
    queryFn: async () => {
      const response = await fetch("/api/systems");
      if (!response.ok) {
        throw new Error(`Failed to fetch systems (status ${response.status})`);
      }
      return response.json();
    },
  });

  const domainsQuery = useQuery<DataDomain[]>({
    queryKey: ["/api/domains"],
    queryFn: async () => {
      const response = await fetch("/api/domains");
      if (!response.ok) {
        throw new Error("Failed to fetch domains");
      }
      return response.json();
    },
  });

  const areasQuery = useQuery<DataArea[]>({
    queryKey: ["/api/areas"],
    queryFn: async () => {
      const response = await fetch("/api/areas");
      if (!response.ok) {
        throw new Error("Failed to fetch data areas");
      }
      return response.json();
    },
  });

  const modelsQuery = useQuery<DataModel[]>({
    queryKey: ["/api/models"],
    queryFn: async () => {
      const response = await fetch("/api/models");
      if (!response.ok) {
        throw new Error("Failed to fetch models");
      }
      return response.json();
    },
  });

  const systems = systemsQuery.data ?? [];
  const domains = domainsQuery.data ?? [];
  const areas = areasQuery.data ?? [];
  const models = modelsQuery.data ?? [];

  const selectedSystem = useMemo(() => {
    if (selectedSystemId === null) return null;
    return systems.find((system) => system.id === selectedSystemId) ?? null;
  }, [selectedSystemId, systems]);

  useEffect(() => {
    if (!isCreating && systems.length > 0) {
      if (selectedSystemId === null || !systems.some((system) => system.id === selectedSystemId)) {
        setSelectedSystemId(systems[0].id);
      }
    }
  }, [systems, selectedSystemId, isCreating]);

  useEffect(() => {
    if (!systems.length && !isCreating && !systemsQuery.isLoading) {
      setIsCreating(true);
      setSelectedSystemId(null);
    }
  }, [systems, isCreating, systemsQuery.isLoading]);

  useEffect(() => {
    if (models.length && syncModelId === null) {
      setSyncModelId(models[0].id);
    }
  }, [models, syncModelId]);

  useEffect(() => {
    if (selectedSystemId !== null) {
      setActiveTab("overview");
      setIsCreating(false);
    }
  }, [selectedSystemId]);

  useEffect(() => {
    if (syncDomainChoice !== "inherit") {
      const domainId = syncDomainChoice === "none" ? null : Number(syncDomainChoice);
      if (syncAreaChoice !== "inherit" && syncAreaChoice !== "none") {
        const selectedArea = areas.find((area) => area.id === Number(syncAreaChoice));
        if (selectedArea && domainId !== null && selectedArea.domainId !== domainId) {
          setSyncAreaChoice("inherit");
        }
      }
    }
  }, [syncDomainChoice, syncAreaChoice, areas]);

  const systemObjectsQuery = useQuery<SystemObjectSummary[]>({
    queryKey: ["/api/systems", selectedSystemId, "objects"],
    queryFn: async () => {
      const response = await fetch(`/api/systems/${selectedSystemId}/objects`);
      if (!response.ok) {
        throw new Error(`Failed to fetch system objects (status ${response.status})`);
      }
      return response.json();
    },
    enabled: !isCreating && typeof selectedSystemId === "number",
  });

  const createSystemMutation = useMutation({
    mutationFn: async (values: SystemFormValues) => {
      const payload = buildSystemRequestBody(values);
      const response = await fetch("/api/systems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message ?? "Failed to create system");
      }
      return (await response.json()) as System;
    },
    onSuccess: (system) => {
      queryClient.setQueryData<System[]>(["/api/systems"], (prev) =>
        prev ? [...prev, system] : [system],
      );
      setIsCreating(false);
      setSelectedSystemId(system.id);
      setActiveTab("overview");
      toast({ title: "System created", description: `${system.name} is now available.` });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create system",
        description: error?.message ?? "An unexpected error occurred",
        variant: "destructive",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/systems"] });
    },
  });

  const updateSystemMutation = useMutation({
    mutationFn: async (values: SystemFormValues) => {
      if (!selectedSystem) {
        throw new Error("Select a system to update");
      }
      const payload = buildSystemRequestBody(values);
      const response = await fetch(`/api/systems/${selectedSystem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message ?? "Failed to update system");
      }
      return (await response.json()) as System;
    },
    onSuccess: (system) => {
      queryClient.setQueryData<System[]>(["/api/systems"], (prev) =>
        prev ? prev.map((item) => (item.id === system.id ? system : item)) : [system],
      );
      toast({ title: "System updated", description: "Changes saved successfully." });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update system",
        description: error?.message ?? "An unexpected error occurred",
        variant: "destructive",
      });
    },
    onSettled: () => {
      if (selectedSystemId !== null) {
        queryClient.invalidateQueries({ queryKey: ["/api/systems", selectedSystemId, "objects"] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/systems"] });
    },
  });

  const deleteSystemMutation = useMutation({
    mutationFn: async (systemId: number) => {
      const response = await fetch(`/api/systems/${systemId}`, { method: "DELETE" });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message ?? "Failed to delete system");
      }
    },
    onSuccess: (_, systemId) => {
      queryClient.setQueryData<System[]>(["/api/systems"], (prev) =>
        prev ? prev.filter((system) => system.id !== systemId) : [],
      );
      toast({ title: "System removed", description: "The system has been deleted." });
      if (selectedSystemId === systemId) {
        setSelectedSystemId(null);
      }
      if (systems.length <= 1) {
        setIsCreating(true);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete system",
        description: error?.message ?? "An unexpected error occurred",
        variant: "destructive",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/systems"] });
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSystem) {
        throw new Error("Select a system to test");
      }
      const response = await fetch(`/api/systems/${selectedSystem.id}/test-connection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message ?? "Failed to test connection");
      }
      return (await response.json()) as { connected: boolean; message?: string };
    },
    onSuccess: (result) => {
      setLastTestResult({
        status: result.connected ? "success" : "error",
        message: result.message,
        timestamp: Date.now(),
      });
      toast({
        title: result.connected ? "Connection successful" : "Connection failed",
        description: result.message ?? undefined,
        variant: result.connected ? "default" : "destructive",
      });
    },
    onError: (error: any) => {
      setLastTestResult({ status: "error", message: error?.message, timestamp: Date.now() });
      toast({
        title: "Connection test failed",
        description: error?.message ?? "Unable to reach the system",
        variant: "destructive",
      });
    },
  });

  const syncObjectsMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSystem || !syncModelId) {
        throw new Error("Select a model before syncing");
      }
      const payload: Record<string, unknown> = {
        modelId: syncModelId,
        direction: syncDirection,
        includeAttributes,
      };

      if (syncDomainChoice === "none") {
        payload.domainId = null;
      } else if (syncDomainChoice !== "inherit") {
        payload.domainId = Number(syncDomainChoice);
      }

      if (syncAreaChoice === "none") {
        payload.dataAreaId = null;
      } else if (syncAreaChoice !== "inherit") {
        payload.dataAreaId = Number(syncAreaChoice);
      }

      const response = await fetch(`/api/systems/${selectedSystem.id}/sync-objects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message ?? "Failed to sync objects");
      }
      return (await response.json()) as {
        metadataCount: number;
        createdCount: number;
        updatedCount: number;
      };
    },
    onSuccess: (result) => {
      setLastSyncSummary({
        metadataCount: result.metadataCount,
        created: result.createdCount,
        updated: result.updatedCount,
      });
      toast({
        title: "Sync complete",
        description: `Processed ${result.metadataCount} objects (${result.createdCount} new, ${result.updatedCount} updated).`,
      });
      if (selectedSystemId !== null) {
        queryClient.invalidateQueries({ queryKey: ["/api/systems", selectedSystemId, "objects"] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/objects"] });
    },
    onError: (error: any) => {
      toast({
        title: "Sync failed",
        description: error?.message ?? "An unexpected error occurred",
        variant: "destructive",
      });
    },
  });

  const updateObjectMutation = useMutation({
    mutationFn: async ({
      objectId,
      domainId,
      dataAreaId,
    }: {
      objectId: number;
      domainId: number | null;
      dataAreaId: number | null;
    }) => {
      if (!selectedSystem) {
        throw new Error("Select a system to update objects");
      }
      const response = await fetch(`/api/systems/${selectedSystem.id}/objects/${objectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domainId, dataAreaId }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message ?? "Failed to update object");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Object updated", description: "Assignments saved." });
      if (selectedSystemId !== null) {
        queryClient.invalidateQueries({ queryKey: ["/api/systems", selectedSystemId, "objects"] });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update object",
        description: error?.message ?? "An unexpected error occurred",
        variant: "destructive",
      });
    },
  });

  const deleteObjectMutation = useMutation({
    mutationFn: async (objectId: number) => {
      if (!selectedSystem) {
        throw new Error("Select a system to update objects");
      }
      const response = await fetch(`/api/systems/${selectedSystem.id}/objects/${objectId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message ?? "Failed to remove object");
      }
    },
    onSuccess: () => {
      toast({ title: "Object removed", description: "The object has been deleted." });
      if (selectedSystemId !== null) {
        queryClient.invalidateQueries({ queryKey: ["/api/systems", selectedSystemId, "objects"] });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Failed to remove object",
        description: error?.message ?? "An unexpected error occurred",
        variant: "destructive",
      });
    },
  });

  const handleStartCreate = () => {
    setIsCreating(true);
    setSelectedSystemId(null);
    setActiveTab("overview");
    setLastTestResult(null);
    setLastSyncSummary(null);
  };

  const systemDefaults = useMemo(() => {
    if (!selectedSystem) return { domainId: undefined as number | undefined, areaIds: [] as number[] };
    const configuration = (selectedSystem.configuration ?? {}) as Record<string, unknown>;
    const domainId = typeof configuration.domainId === "number"
      ? configuration.domainId
      : Array.isArray(configuration.domainIds) && configuration.domainIds.length
        ? Number(configuration.domainIds[0])
        : undefined;
    const areaIds = Array.isArray(configuration.dataAreaIds)
      ? (configuration.dataAreaIds as unknown[])
          .map((value) => {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : null;
          })
          .filter((value): value is number => value !== null)
      : [];
    return { domainId, areaIds };
  }, [selectedSystem]);

  const availableSyncAreas = useMemo(() => {
    if (syncDomainChoice === "inherit") {
      if (systemDefaults.areaIds.length) {
        const allowedIds = new Set(systemDefaults.areaIds);
        return areas.filter((area) => allowedIds.has(area.id));
      }
      return areas;
    }
    if (syncDomainChoice === "none") {
      return areas;
    }
    const domainId = Number(syncDomainChoice);
    return areas.filter((area) => area.domainId === domainId);
  }, [areas, syncDomainChoice, systemDefaults.areaIds]);

  const systemObjects = systemObjectsQuery.data ?? [];
  const isObjectsLoading = systemObjectsQuery.isLoading || systemObjectsQuery.isFetching;

  const handleDeleteSystem = (system: System) => {
    if (deleteSystemMutation.isPending) return;
    const confirmed = window.confirm(`Delete system "${system.name}"? This action cannot be undone.`);
    if (!confirmed) return;
    deleteSystemMutation.mutate(system.id);
  };

  const handleObjectDomainChange = (object: SystemObjectSummary, value: string) => {
    if (updateObjectMutation.isPending) return;
    const domainId = value === "none" ? null : Number(value);
    updateObjectMutation.mutate({ objectId: object.id, domainId, dataAreaId: null });
  };

  const handleObjectAreaChange = (object: SystemObjectSummary, value: string) => {
    if (updateObjectMutation.isPending) return;
    const areaId = value === "none" ? null : Number(value);
    updateObjectMutation.mutate({ objectId: object.id, domainId: object.domainId ?? null, dataAreaId: areaId });
  };

  return (
    <div className="flex flex-1 flex-col bg-background min-h-0">
      <header className="border-b bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setLocation("/configuration")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">System Management</h1>
              <p className="text-sm text-muted-foreground">
                Manage source and target systems, validate connections, and synchronize objects.
              </p>
            </div>
          </div>
          <Button onClick={handleStartCreate} variant="outline" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            New System
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden w-80 border-r bg-muted/30 p-4 md:block">
          <div className="mb-3 flex items-center gap-2">
            <Server className="h-5 w-5 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Systems</h2>
          </div>
          <ScrollArea className="h-[calc(100vh-160px)] pr-2">
            {systemsQuery.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading systems...
              </div>
            ) : systems.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                No systems found. Create your first system to get started.
              </div>
            ) : (
              <div className="space-y-2">
                {systems.map((system) => {
                  const isActive = system.id === selectedSystemId;
                  return (
                    <button
                      key={system.id}
                      onClick={() => {
                        setSelectedSystemId(system.id);
                        setIsCreating(false);
                        setLastTestResult(null);
                        setLastSyncSummary(null);
                      }}
                      className={cn(
                        "w-full rounded-lg border p-3 text-left transition-all",
                        isActive
                          ? "border-primary/60 bg-primary/10 shadow-sm"
                          : "border-transparent hover:border-border hover:bg-card"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium text-sm line-clamp-1">{system.name}</div>
                        <Badge variant={isActive ? "default" : "secondary"} className="text-[10px] uppercase">
                          {system.type}
                        </Badge>
                      </div>
                      {system.description ? (
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{system.description}</p>
                      ) : null}
                      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>{system.category || "Uncategorized"}</span>
                        <span className="capitalize">{system.status || "unknown"}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </aside>

        <main className="flex-1 overflow-auto p-6">
          {isCreating ? (
            <Card className="max-w-4xl">
              <CardHeader>
                <CardTitle>Create new system</CardTitle>
                <CardDescription>Register a source or target system and define its domain associations.</CardDescription>
              </CardHeader>
              <CardContent>
                <SystemForm
                  system={null}
                  domains={domains}
                  dataAreas={areas}
                  mode="create"
                  onSubmit={(values) => createSystemMutation.mutate(values)}
                  onCancel={() => {
                    setIsCreating(false);
                    if (systems.length) {
                      setSelectedSystemId(systems[0].id);
                    }
                  }}
                  isSubmitting={createSystemMutation.isPending}
                />
              </CardContent>
            </Card>
          ) : selectedSystem ? (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="objects">Objects</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6">
                <Card>
                  <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <CardTitle>{selectedSystem.name}</CardTitle>
                      <CardDescription>
                        Update system metadata, connection details, and default domain assignments.
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="capitalize">
                        {selectedSystem.status || "disconnected"}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteSystem(selectedSystem)}
                        disabled={deleteSystemMutation.isPending}
                      >
                        {deleteSystemMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4 text-destructive" />
                        )}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <SystemForm
                      system={mapSystemToFormValues(selectedSystem)}
                      domains={domains}
                      dataAreas={areas}
                      mode="edit"
                      onSubmit={(values) => updateSystemMutation.mutate(values)}
                      onCancel={() => {
                        setSelectedSystemId(null);
                        setIsCreating(true);
                      }}
                      isSubmitting={updateSystemMutation.isPending}
                    />
                  </CardContent>
                </Card>

                <div className="grid gap-6 lg:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Connection health</CardTitle>
                      <CardDescription>Validate connectivity to ensure credentials and endpoints are up to date.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Button
                        onClick={() => testConnectionMutation.mutate()}
                        disabled={testConnectionMutation.isPending}
                        className="flex items-center gap-2"
                      >
                        {testConnectionMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Activity className="h-4 w-4" />
                        )}
                        Test connection
                      </Button>
                      {lastTestResult ? (
                        <div className={cn(
                          "rounded-md border p-3 text-sm",
                          lastTestResult.status === "success"
                            ? "border-green-500/30 bg-green-500/10 text-green-600"
                            : "border-destructive/30 bg-destructive/10 text-destructive"
                        )}>
                          <div className="flex items-center gap-2 font-medium">
                            {lastTestResult.status === "success" ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : (
                              <AlertTriangle className="h-4 w-4" />
                            )}
                            {lastTestResult.status === "success" ? "Connection looks healthy" : "Connection failed"}
                          </div>
                          {lastTestResult.message ? (
                            <p className="mt-2 text-xs opacity-80">{lastTestResult.message}</p>
                          ) : null}
                          <p className="mt-2 text-[11px] text-muted-foreground">
                            Tested {new Date(lastTestResult.timestamp).toLocaleString()}
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No test has been run yet. Use the button above to validate connectivity.
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Sync objects from {syncDirection === "source" ? "source" : "target"} system</CardTitle>
                      <CardDescription>
                        Pull metadata into a model and keep domain assignments aligned.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Target model
                          </label>
                          <Select
                            value={syncModelId ? String(syncModelId) : ""}
                            onValueChange={(value) => setSyncModelId(Number(value))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select model" />
                            </SelectTrigger>
                            <SelectContent>
                              {models.map((model) => (
                                <SelectItem key={model.id} value={String(model.id)}>
                                  {model.name} <span className="text-xs text-muted-foreground">({model.layer})</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Association
                          </label>
                          <Select value={syncDirection} onValueChange={(value: SyncDirection) => setSyncDirection(value)}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="source">Source system objects</SelectItem>
                              <SelectItem value="target">Target system objects</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Domain override
                          </label>
                          <Select value={syncDomainChoice} onValueChange={setSyncDomainChoice}>
                            <SelectTrigger>
                              <SelectValue placeholder="Use system default" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="inherit">
                                Use system default
                              </SelectItem>
                              <SelectItem value="none">Unassigned</SelectItem>
                              {domains.map((domain) => (
                                <SelectItem key={domain.id} value={String(domain.id)}>
                                  {domain.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {systemDefaults.domainId ? (
                            <p className="text-[11px] text-muted-foreground">
                              System default domain: {
                                domains.find((domain) => domain.id === systemDefaults.domainId)?.name || "Unknown"
                              }
                            </p>
                          ) : null}
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Data area override
                          </label>
                          <Select value={syncAreaChoice} onValueChange={setSyncAreaChoice}>
                            <SelectTrigger>
                              <SelectValue placeholder="Use system default" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="inherit">Use system default</SelectItem>
                              <SelectItem value="none">Unassigned</SelectItem>
                              {availableSyncAreas.map((area) => (
                                <SelectItem key={area.id} value={String(area.id)}>
                                  {area.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="include-attributes"
                          checked={includeAttributes}
                          onCheckedChange={(checked) => setIncludeAttributes(checked === true)}
                        />
                        <label htmlFor="include-attributes" className="text-sm text-muted-foreground">
                          Create and update attributes for each synced object
                        </label>
                      </div>

                      <div className="flex items-center gap-3">
                        <Button
                          onClick={() => syncObjectsMutation.mutate()}
                          disabled={syncObjectsMutation.isPending || !syncModelId}
                          className="flex items-center gap-2"
                        >
                          {syncObjectsMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                          Sync objects
                        </Button>
                        {lastSyncSummary ? (
                          <div className="text-xs text-muted-foreground">
                            Last sync processed {lastSyncSummary.metadataCount} objects
                            ({lastSyncSummary.created} new / {lastSyncSummary.updated} updated)
                          </div>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="objects">
                <Card>
                  <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <CardTitle>Objects linked to {selectedSystem.name}</CardTitle>
                      <CardDescription>
                        Manage domain and data area assignments or remove objects no longer needed.
                      </CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => systemObjectsQuery.refetch()}
                      disabled={systemObjectsQuery.isFetching}
                      className="flex items-center gap-2"
                    >
                      {systemObjectsQuery.isFetching ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Repeat className="h-4 w-4" />
                      )}
                      Refresh
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {isObjectsLoading ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> Loading objects...
                      </div>
                    ) : systemObjects.length === 0 ? (
                      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                        <p>No objects found for this system yet. Run a sync to pull metadata.</p>
                        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => syncObjectsMutation.mutate()}
                            disabled={!syncModelId || syncObjectsMutation.isPending}
                            className="flex items-center gap-2"
                          >
                            {syncObjectsMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4" />
                            )}
                            Run sync now
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setActiveTab("sync")}
                          >
                            Configure sync
                          </Button>
                        </div>
                        {!syncModelId ? (
                          <p className="mt-3 text-xs text-muted-foreground">
                            Create or select a data model first to enable syncing.
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full table-fixed border-separate border-spacing-y-2">
                          <thead className="text-left text-xs uppercase text-muted-foreground">
                            <tr>
                              <th className="w-48 px-3 py-2">Object</th>
                              <th className="w-32 px-3 py-2">Model</th>
                              <th className="w-24 px-3 py-2">Association</th>
                              <th className="w-40 px-3 py-2">Domain</th>
                              <th className="w-40 px-3 py-2">Data area</th>
                              <th className="w-24 px-3 py-2 text-center">Attributes</th>
                              <th className="w-20 px-3 py-2 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {systemObjects.map((object) => {
                              const domainValue = object.domainId ?? undefined;
                              const dataAreaValue = object.dataAreaId ?? undefined;
                              const filteredAreas = areas.filter((area) =>
                                domainValue ? area.domainId === domainValue : true,
                              );
                              return (
                                <tr key={object.id} className="rounded-lg bg-card">
                                  <td className="px-3 py-2 align-top">
                                    <div className="font-medium text-sm">{object.name}</div>
                                    {object.description ? (
                                      <p className="text-xs text-muted-foreground line-clamp-2">{object.description}</p>
                                    ) : null}
                                  </td>
                                  <td className="px-3 py-2 align-top text-sm text-muted-foreground">
                                    {object.model ? (
                                      <div>
                                        <div className="font-medium text-foreground">{object.model.name}</div>
                                        <div className="text-xs uppercase tracking-wide text-muted-foreground">
                                          {object.model.layer}
                                        </div>
                                      </div>
                                    ) : (
                                      <span>Unknown</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 align-top">
                                    <Badge variant="secondary" className="capitalize">
                                      {object.systemAssociation || "n/a"}
                                    </Badge>
                                  </td>
                                  <td className="px-3 py-2 align-top">
                                    <Select
                                      value={domainValue !== undefined ? String(domainValue) : "none"}
                                      onValueChange={(value) => handleObjectDomainChange(object, value)}
                                      disabled={updateObjectMutation.isPending}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Unassigned" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="none">Unassigned</SelectItem>
                                        {domains.map((domain) => (
                                          <SelectItem key={domain.id} value={String(domain.id)}>
                                            {domain.name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </td>
                                  <td className="px-3 py-2 align-top">
                                    <Select
                                      value={dataAreaValue !== undefined ? String(dataAreaValue) : "none"}
                                      onValueChange={(value) => handleObjectAreaChange(object, value)}
                                      disabled={updateObjectMutation.isPending || !object.domainId}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Unassigned" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="none">Unassigned</SelectItem>
                                        {filteredAreas.map((area) => (
                                          <SelectItem key={area.id} value={String(area.id)}>
                                            {area.name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </td>
                                  <td className="px-3 py-2 align-top text-center text-sm">
                                    <Badge variant="outline" className="flex items-center justify-center gap-1">
                                      <Database className="h-3 w-3" />
                                      {object.attributeCount}
                                    </Badge>
                                  </td>
                                  <td className="px-3 py-2 align-top text-right">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => {
                                        const confirmed = window.confirm(`Remove object "${object.name}"?`);
                                        if (!confirmed) return;
                                        deleteObjectMutation.mutate(object.id);
                                      }}
                                      disabled={deleteObjectMutation.isPending}
                                    >
                                      {deleteObjectMutation.isPending ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                      )}
                                    </Button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Select a system from the left or create a new one to get started.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
