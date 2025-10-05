import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Loader2, Download, ShieldAlert, AlertTriangle, CheckCircle2, Copy } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useModelerStore } from "@/store/modelerStore";
import type { DataModel } from "@shared/schema";
import type {
  ModelingAgentDiffEntry,
  ModelingAgentIssue,
  ModelingAgentRequestPayload,
  ModelingAgentResponse,
  ModelingAgentSeverity,
} from "@/types/modelingAgent";

interface ModelingAgentPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FormState {
  businessDescription: string;
  instructions: string;
  modelName: string;
  targetDatabase: string;
  sqlPlatforms: string;
  allowDrop: boolean;
  generateSql: boolean;
}

const createDefaultFormState = (): FormState => ({
  businessDescription:
    "Provide a business overview, key entities, and critical workflows that the data model should capture.",
  instructions:
    "Focus on consistent naming conventions, ensure each entity has primary keys, and propose relationships aligned with domain best practices.",
  modelName: "",
  targetDatabase: "",
  sqlPlatforms: "postgres",
  allowDrop: false,
  generateSql: true,
});

const severityConfig: Record<ModelingAgentSeverity, { label: string; badgeVariant: string }> = {
  info: { label: "Info", badgeVariant: "outline" },
  warning: { label: "Warning", badgeVariant: "secondary" },
  error: { label: "Error", badgeVariant: "destructive" },
};

const diffActionLabel: Record<ModelingAgentDiffEntry["action"], string> = {
  create_model_family: "Create model family",
  add_entity: "Add entity",
  update_entity: "Update entity",
  remove_entity: "Remove entity",
  add_attribute: "Add attribute",
  update_attribute: "Update attribute",
  remove_attribute: "Remove attribute",
  add_relationship: "Add relationship",
  update_relationship: "Update relationship",
  remove_relationship: "Remove relationship",
};

export function ModelingAgentPanel({ open, onOpenChange }: ModelingAgentPanelProps) {
  const queryClient = useQueryClient();
  const currentModel = useModelerStore((state) => state.currentModel);
  const allModels = useModelerStore((state) => state.allModels);
  const [formState, setFormState] = useState<FormState>(() => createDefaultFormState());
  const [result, setResult] = useState<ModelingAgentResponse | null>(null);
  const [lastRunAt, setLastRunAt] = useState<Date | null>(null);

  const conceptualRootModel = useMemo(() => {
    if (!currentModel) return null;
    const modelMap = new Map<number, DataModel>();
    if (Array.isArray(allModels)) {
      for (const model of allModels as DataModel[]) {
        modelMap.set(model.id, model);
      }
    }

    let pointer: DataModel | null = currentModel as DataModel;
    const visited = new Set<number>();

    while (pointer?.parentModelId) {
      if (visited.has(pointer.parentModelId)) {
        break;
      }
      visited.add(pointer.parentModelId);
      const parent = modelMap.get(pointer.parentModelId);
      if (!parent) {
        break;
      }
      pointer = parent;
    }

    return pointer ?? currentModel;
  }, [currentModel, allModels]);

  const selectedRootId = conceptualRootModel?.layer === "conceptual" ? conceptualRootModel.id : conceptualRootModel?.parentModelId ?? null;
  const effectiveRootId = useMemo(() => {
    if (!conceptualRootModel) return undefined;
    if (conceptualRootModel.layer === "conceptual") {
      return conceptualRootModel.id;
    }
    // If the resolved model isn't conceptual, walk up one more time via allModels
    const modelMap = new Map<number, DataModel>();
    if (Array.isArray(allModels)) {
      for (const model of allModels as DataModel[]) {
        modelMap.set(model.id, model);
      }
    }
    let pointer: DataModel | undefined = conceptualRootModel;
    const visited = new Set<number>();
    while (pointer?.parentModelId) {
      if (visited.has(pointer.parentModelId)) break;
      visited.add(pointer.parentModelId);
      const parent = modelMap.get(pointer.parentModelId);
      if (!parent) break;
      pointer = parent;
      if (parent.layer === "conceptual") {
        return parent.id;
      }
    }
    return pointer?.layer === "conceptual" ? pointer.id : undefined;
  }, [conceptualRootModel, allModels]);

  useEffect(() => {
    if (!open) {
      setResult(null);
      setLastRunAt(null);
      setFormState(createDefaultFormState());
      return;
    }

    if (conceptualRootModel?.name) {
      setFormState((prev) => {
        if (prev.modelName) {
          return prev;
        }
        return {
          ...prev,
          modelName: conceptualRootModel.name ?? prev.modelName,
        };
      });
    }
  }, [open, conceptualRootModel?.name, conceptualRootModel?.id]);

  const isExistingModelFlow = Boolean(effectiveRootId);
  const requiresModelName = !isExistingModelFlow;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!isExistingModelFlow && !formState.modelName.trim()) {
        throw new Error("Provide a model name to create a new model family.");
      }

      if (!formState.businessDescription.trim()) {
        throw new Error("Business description is required for the modeling agent.");
      }

      if (!formState.instructions.trim()) {
        throw new Error("Instructions are required to guide the modeling agent.");
      }

      const payload: ModelingAgentRequestPayload = {
        businessDescription: formState.businessDescription.trim(),
        instructions: formState.instructions.trim(),
        allowDrop: formState.allowDrop,
        generateSql: formState.generateSql,
      };

      if (isExistingModelFlow && effectiveRootId) {
        payload.rootModelId = effectiveRootId;
      } else {
        payload.modelName = formState.modelName.trim();
      }

      if (formState.targetDatabase.trim()) {
        payload.targetDatabase = formState.targetDatabase.trim();
      }

      const sqlPlatforms = formState.sqlPlatforms
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
      if (sqlPlatforms.length > 0) {
        payload.sqlPlatforms = sqlPlatforms;
      }

      const response = await apiRequest("POST", "/api/ai/modeling-agent", payload);
      const data = (await response.json()) as ModelingAgentResponse;
      return data;
    },
    onSuccess: async (data) => {
      setResult(data);
      setLastRunAt(new Date());
      toast({
        title: "Modeling agent completed",
        description: "The workspace has been updated with the generated model changes.",
      });

      await queryClient.invalidateQueries({ queryKey: ["/api/models"], exact: false });
      if (effectiveRootId) {
        queryClient.invalidateQueries({ queryKey: ["/api/models", effectiveRootId], exact: false });
      }
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Failed to run modeling agent";
      toast({ title: "Modeling agent failed", description: message, variant: "destructive" });
    },
  });

  const handleInputChange = (field: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = event.target.value;
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleSwitchChange = (field: keyof FormState) => (checked: boolean) => {
    setFormState((prev) => ({ ...prev, [field]: checked }));
  };

  const handleCopy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: `${label} copied`, description: "Copied to clipboard." });
    } catch (error) {
      toast({ title: "Copy failed", description: "Unable to access clipboard", variant: "destructive" });
    }
  };

  const renderIssues = (issues: ModelingAgentIssue[]) => {
    if (!issues.length) {
      return (
        <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed p-6 text-sm text-muted-foreground">
          <CheckCircle2 className="h-6 w-6 text-green-500" />
          <p>No issues detected</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {issues.map((issue, index) => {
          const config = severityConfig[issue.severity];
          return (
            <Card key={`${issue.severity}-${index}`} className="border border-border/60">
              <CardHeader className="space-y-1 pb-2">
                <div className="flex items-center gap-2">
                  <Badge variant={config.badgeVariant}>{config.label}</Badge>
                  {issue.entity && <Badge variant="outline">{issue.entity}</Badge>}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{issue.message}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  const renderDiff = (diff: ModelingAgentDiffEntry[]) => {
    if (!diff.length) {
      return (
        <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed p-6 text-sm text-muted-foreground">
          <Sparkles className="h-6 w-6 text-primary" />
          <p>No structural changes were applied.</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {diff.map((entry, index) => (
          <Card key={`${entry.action}-${entry.target}-${index}`} className="border border-border/70">
            <CardHeader className="flex flex-col gap-2 pb-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Badge variant="outline">{diffActionLabel[entry.action]}</Badge>
                <Badge variant="secondary" className="capitalize">{entry.layer}</Badge>
                <Badge variant={entry.status === "applied" ? "default" : "outline"}>{entry.status}</Badge>
              </div>
              <CardTitle className="text-base font-semibold leading-tight">{entry.target}</CardTitle>
            </CardHeader>
            {entry.detail && (
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground">{entry.detail}</p>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    );
  };

  const renderEntityList = (title: string, entities: ModelingAgentResponse["conceptualModel"]["entities"]) => {
    if (!entities.length) {
      return (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          No entities returned.
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {entities.map((entity) => (
          <Card key={entity.name} className="border border-border">
            <CardHeader className="space-y-2 pb-2">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-lg font-semibold">{entity.name}</CardTitle>
                {"attributes" in entity && (
                  <Badge variant="outline">{entity.attributes.length} attributes</Badge>
                )}
              </div>
              {entity.description && (
                <p className="text-sm text-muted-foreground">{entity.description}</p>
              )}
            </CardHeader>
            <CardContent className="space-y-4 pt-0 text-sm">
              {"relationships" in entity && entity.relationships.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Relationships</h4>
                  <ul className="space-y-1">
                    {entity.relationships.map((rel, idx) => (
                      <li key={`${entity.name}-rel-${idx}`} className="rounded-md border border-border/60 p-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{rel.target}</span>
                          <Badge variant="outline">{rel.type}</Badge>
                        </div>
                        {rel.description && (
                          <p className="mt-2 text-xs text-muted-foreground">{rel.description}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {"attributes" in entity && entity.attributes.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Attributes</h4>
                  <div className="grid gap-2">
                    {entity.attributes.map((attribute) => (
                      <div
                        key={attribute.name}
                        className="rounded-md border border-border/60 p-2"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{attribute.name}</span>
                          {attribute.logicalType && <Badge variant="outline">{attribute.logicalType}</Badge>}
                          {attribute.isPrimaryKey && <Badge variant="secondary">PK</Badge>}
                          {attribute.isForeignKey && <Badge variant="outline">FK</Badge>}
                          {!attribute.nullable && <Badge variant="outline">Required</Badge>}
                        </div>
                        {attribute.description && (
                          <p className="mt-1 text-xs text-muted-foreground">{attribute.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const renderSql = (sql: Record<string, string>) => {
    const entries = Object.entries(sql);
    if (!entries.length) {
      return (
        <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed p-6 text-sm text-muted-foreground">
          <AlertTriangle className="h-6 w-6 text-orange-500" />
          <p>No SQL scripts were generated.</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {entries.map(([dialect, script]) => (
          <Card key={dialect} className="border border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold capitalize">{dialect}</CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleCopy(script, `${dialect.toUpperCase()} SQL`)}
                >
                  <Copy className="mr-2 h-3.5 w-3.5" />
                  Copy
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleDownloadSql(script, dialect)}
                >
                  <Download className="mr-2 h-3.5 w-3.5" />
                  Download
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <pre className="max-h-72 overflow-auto rounded border border-border bg-muted/20 p-4 text-sm">
                <code>{script}</code>
              </pre>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const handleDownloadSql = (script: string, dialect: string) => {
    const blob = new Blob([script], { type: "text/sql;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${dialect.toLowerCase()}-generated.sql`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-full max-w-6xl overflow-hidden">
        <DialogHeader className="space-y-2">
          <DialogTitle className="flex items-center gap-2 text-2xl font-semibold">
            <Sparkles className="h-5 w-5 text-primary" />
            Integrative AI Modeling Agent
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Generate or refine conceptual, logical, and physical models with AI assistance. The agent will apply
            validated changes directly to your workspace and surface diffs, issues, and SQL migrations.
          </DialogDescription>
        </DialogHeader>

        <Separator />

        <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <ScrollArea className="h-[70vh] rounded-md border bg-card/40 p-4">
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="businessDescription">Business context</Label>
                <Textarea
                  id="businessDescription"
                  value={formState.businessDescription}
                  onChange={handleInputChange("businessDescription")}
                  placeholder="Describe the business scenario, domain, and critical entities"
                  minRows={5}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="instructions">Modeling instructions</Label>
                <Textarea
                  id="instructions"
                  value={formState.instructions}
                  onChange={handleInputChange("instructions")}
                  placeholder="Specify modeling goals, constraints, naming standards, or migration wishes"
                  minRows={5}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="modelName">Model name</Label>
                <Input
                  id="modelName"
                  value={formState.modelName}
                  onChange={handleInputChange("modelName")}
                  placeholder={isExistingModelFlow ? "Using current model family" : "E.g. Customer Experience"}
                  disabled={isExistingModelFlow}
                  required={requiresModelName}
                />
                <p className="text-xs text-muted-foreground">
                  {isExistingModelFlow && conceptualRootModel
                    ? `Using conceptual model "${conceptualRootModel.name}" as the root.`
                    : "Provide a conceptual model name to create a new model family."}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="targetDatabase">Target database</Label>
                <Input
                  id="targetDatabase"
                  value={formState.targetDatabase}
                  onChange={handleInputChange("targetDatabase")}
                  placeholder="Optional target system or database (e.g. Snowflake)"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sqlPlatforms">SQL platforms</Label>
                <Input
                  id="sqlPlatforms"
                  value={formState.sqlPlatforms}
                  onChange={handleInputChange("sqlPlatforms")}
                  placeholder="Comma separated list (e.g. postgres, mysql)"
                />
              </div>

              <div className="space-y-4 rounded-md border border-border/70 bg-background/80 p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="generateSql" className="font-medium">
                      Generate SQL scripts
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Include vendor-specific migration scripts when the agent runs.
                    </p>
                  </div>
                  <Switch
                    id="generateSql"
                    checked={formState.generateSql}
                    onCheckedChange={handleSwitchChange("generateSql")}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="allowDrop" className="font-medium">
                      Allow destructive changes
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Permit the agent to drop entities or columns (use with caution).
                    </p>
                  </div>
                  <Switch
                    id="allowDrop"
                    checked={formState.allowDrop}
                    onCheckedChange={handleSwitchChange("allowDrop")}
                  />
                </div>
                {!formState.allowDrop && (
                  <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900">
                    <ShieldAlert className="mt-0.5 h-4 w-4" />
                    <p>
                      Destructive operations are disabled. The agent will favor additive migrations and mark removals as
                      suggestions only.
                    </p>
                  </div>
                )}
              </div>

              <Button
                type="button"
                className="w-full"
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending}
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Running modeling agent
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Run modeling agent
                  </>
                )}
              </Button>

              {lastRunAt && (
                <p className="text-center text-xs text-muted-foreground">
                  Last run {lastRunAt.toLocaleTimeString()} ({lastRunAt.toLocaleDateString()})
                </p>
              )}
            </div>
          </ScrollArea>

          <ScrollArea className="h-[70vh] rounded-md border bg-card/30 p-4">
            {!result ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-muted-foreground">
                <Sparkles className="h-8 w-8 text-primary/80" />
                <p className="text-sm font-medium">Run the modeling agent to see generated models, issues, and SQL.</p>
                <p className="text-xs text-muted-foreground">
                  The agent analyzes your current model family, applies proposed changes, and surfaces the diffs here.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <Tabs defaultValue="overview" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="conceptual">Conceptual</TabsTrigger>
                    <TabsTrigger value="logical">Logical</TabsTrigger>
                    <TabsTrigger value="physical">Physical</TabsTrigger>
                    <TabsTrigger value="issues">Issues</TabsTrigger>
                    <TabsTrigger value="diff">Diff</TabsTrigger>
                    <TabsTrigger value="sql">SQL</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview" className="mt-4 space-y-4">
                    <Card className="border border-border/70">
                      <CardHeader>
                        <CardTitle>Summary</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm leading-relaxed text-muted-foreground">{result.summary}</p>
                      </CardContent>
                    </Card>

                    <div className="grid gap-4 md:grid-cols-2">
                      <Card className="border border-border/60">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base font-semibold">Assumptions</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm text-muted-foreground">
                          {result.assumptions.length ? (
                            <ul className="list-disc space-y-1 pl-5">
                              {result.assumptions.map((item, index) => (
                                <li key={index}>{item}</li>
                              ))}
                            </ul>
                          ) : (
                            <p>No assumptions recorded.</p>
                          )}
                        </CardContent>
                      </Card>

                      <Card className="border border-border/60">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base font-semibold">Suggestions</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm text-muted-foreground">
                          {result.suggestions.length ? (
                            <ul className="list-disc space-y-1 pl-5">
                              {result.suggestions.map((item, index) => (
                                <li key={index}>{item}</li>
                              ))}
                            </ul>
                          ) : (
                            <p>No additional suggestions provided.</p>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>

                  <TabsContent value="conceptual" className="mt-4">
                    {renderEntityList("Conceptual", result.conceptualModel.entities)}
                  </TabsContent>

                  <TabsContent value="logical" className="mt-4">
                    {renderEntityList("Logical", result.logicalModel.entities)}
                  </TabsContent>

                  <TabsContent value="physical" className="mt-4">
                    {renderEntityList("Physical", result.physicalModel.entities)}
                  </TabsContent>

                  <TabsContent value="issues" className="mt-4">
                    {renderIssues(result.issues)}
                  </TabsContent>

                  <TabsContent value="diff" className="mt-4">
                    {renderDiff(result.diff)}
                  </TabsContent>

                  <TabsContent value="sql" className="mt-4">
                    {renderSql(result.sql)}
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ModelingAgentPanel;
