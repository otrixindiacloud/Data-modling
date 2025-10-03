import { useMemo } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { SystemForm, SystemFormValues } from "@/components/SystemForm";
import { buildSystemRequestBody, mapSystemToFormValues } from "@/lib/systemFormHelpers";
import type { DataArea, DataDomain, System } from "@shared/schema";

interface RouteParams {
  params: {
    id: string;
  };
}

type SystemPageMode = "create" | "edit" | "view";

type SystemEditorPageProps = {
  mode: SystemPageMode;
  title: string;
  description: string;
  systemId?: number;
};

function useDomains() {
  return useQuery<DataDomain[], Error>({
    queryKey: ["/api/domains"],
    queryFn: async () => {
      const response = await fetch("/api/domains");
      if (!response.ok) {
        throw new Error(`Failed to fetch domains (status ${response.status})`);
      }
      return response.json();
    },
  });
}

function useDataAreas() {
  return useQuery<DataArea[], Error>({
    queryKey: ["/api/areas"],
    queryFn: async () => {
      const response = await fetch("/api/areas");
      if (!response.ok) {
        throw new Error(`Failed to fetch data areas (status ${response.status})`);
      }
      return response.json();
    },
  });
}

function SystemEditorPage({ mode, title, description, systemId }: SystemEditorPageProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const domainsQuery = useDomains();
  const areasQuery = useDataAreas();

  const systemQuery = useQuery<System, Error>({
    queryKey: ["/api/sources", systemId],
    queryFn: async () => {
      if (!systemId) {
        throw new Error("System id is required");
      }
      const response = await fetch(`/api/sources/${systemId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch system (status ${response.status})`);
      }
      return response.json();
    },
    enabled: mode !== "create" && typeof systemId === "number" && !Number.isNaN(systemId),
  });

  const mutation = useMutation({
    mutationFn: async (values: SystemFormValues) => {
  const payload = buildSystemRequestBody(values);
      const isEdit = mode === "edit" && systemId;
      const url = isEdit ? `/api/sources/${systemId}` : "/api/sources";
      const method = isEdit ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData?.message || `Failed to ${isEdit ? "update" : "create"} system`;
        throw new Error(message);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sources"] });
      if (systemId) {
        queryClient.invalidateQueries({ queryKey: ["/api/sources", systemId] });
      }
      toast({
        title: mode === "edit" ? "System updated" : "System created",
        description: "Changes were saved successfully.",
      });
      setLocation("/configuration");
    },
    onError: (error: Error) => {
      toast({
        title: mode === "edit" ? "Failed to update system" : "Failed to create system",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const isLoading =
    domainsQuery.isLoading ||
    areasQuery.isLoading ||
    (mode !== "create" && systemQuery.isLoading);

  const hasError =
    domainsQuery.isError ||
    areasQuery.isError ||
    (mode !== "create" && systemQuery.isError);

  const errorMessage = useMemo(() => {
    if (domainsQuery.error) return domainsQuery.error.message;
    if (areasQuery.error) return areasQuery.error.message;
    if (systemQuery.error) return systemQuery.error.message;
    return null;
  }, [domainsQuery.error, areasQuery.error, systemQuery.error]);

  const system =
    mode === "create"
      ? null
      : systemQuery.data
        ? mapSystemToFormValues(systemQuery.data)
        : null;

  const domains = domainsQuery.data ?? [];
  const dataAreas = areasQuery.data ?? [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/configuration")}
            className="mr-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
            Loading system details...
          </CardContent>
        </Card>
      ) : hasError ? (
        <Card>
          <CardHeader>
            <CardTitle>Unable to load system information</CardTitle>
            <CardDescription>{errorMessage ?? "An unexpected error occurred."}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation("/configuration")}>Return to Configuration</Button>
          </CardContent>
        </Card>
      ) : mode !== "create" && !system ? (
        <Card>
          <CardHeader>
            <CardTitle>System not found</CardTitle>
            <CardDescription>The requested system could not be located.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation("/configuration")}>Return to Configuration</Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <SystemForm
              system={system}
              domains={domains}
              dataAreas={dataAreas}
              mode={mode}
              onSubmit={(values) => mutation.mutate(values)}
              onCancel={() => setLocation("/configuration")}
              isSubmitting={mutation.isPending}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function ConfigurationSystemCreatePage() {
  return (
    <SystemEditorPage
      mode="create"
      title="Add New System"
      description="Register a new source or target system with associated domain and data areas."
    />
  );
}

export function ConfigurationSystemEditPage({ params }: RouteParams) {
  const systemId = Number(params.id);

  return (
    <SystemEditorPage
      mode="edit"
      systemId={Number.isFinite(systemId) ? systemId : undefined}
      title="Edit System"
      description="Update system metadata, connection details, and associated domain settings."
    />
  );
}

export function ConfigurationSystemViewPage({ params }: RouteParams) {
  const systemId = Number(params.id);

  return (
    <SystemEditorPage
      mode="view"
      systemId={Number.isFinite(systemId) ? systemId : undefined}
      title="System Details"
      description="Review system configuration and associated domain coverage."
    />
  );
}
