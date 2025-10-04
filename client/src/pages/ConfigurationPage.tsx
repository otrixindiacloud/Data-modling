import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Settings, Target, Edit, Trash2, ArrowLeft, Save, X, Server } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import ColorConfiguration from "@/components/ColorConfiguration";

export default function ConfigurationPage() {
  const [selectedTab, setSelectedTab] = useState("systems");
  const [editingDomain, setEditingDomain] = useState<any>(null);
  const [isAddingDomain, setIsAddingDomain] = useState(false);
  const [editingArea, setEditingArea] = useState<any>(null);
  const [isAddingArea, setIsAddingArea] = useState(false);
  const [selectedDomainForArea, setSelectedDomainForArea] = useState<any>(null);
  const [aiConfig, setAiConfig] = useState({
    openaiModel: "gpt-4o",
    temperature: 0.7,
    maxTokens: 1000,
    enableOpenai: true,
    confidenceThreshold: 0.7,
    maxSuggestions: 5,
    domainSuggestions: true,
    relationshipSuggestions: true,
    normalizationSuggestions: true,
    foreignKeyPatterns: "*_id, *_key, *_ref, fk_*",
    primaryKeyPatterns: "id, *_id, pk_*, key, uuid",
    datePatterns: "*_date, *_time, created_*, updated_*, modified_*",
    namePatterns: "*_name, title, label, description, *_desc",
    analysisTimeout: 30
  });
  const [connectionConfig, setConnectionConfig] = useState({
    maxConnections: 10,
    timeout: 5000,
    rateLimit: 100,
    retryAttempts: 3
  });
  const [settingsConfig, setSettingsConfig] = useState({
    autoSave: true,
    miniMap: true,
    saveInterval: 500,
    aiSuggestions: true,
    confidenceThreshold: 0.7
  });
  const [savingConfig, setSavingConfig] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location, setLocation] = useLocation();

  // Fetch existing domains
  const { data: domains = [] } = useQuery({
    queryKey: ["/api/domains"],
    queryFn: async () => {
      const response = await fetch("/api/domains");
      return response.json();
    }
  });

  const { data: dataAreas = [] } = useQuery({
    queryKey: ["/api/areas"],
    queryFn: async () => {
      const response = await fetch("/api/areas");
      return response.json();
    }
  });

  // Create/Update domain mutation
  const saveDomainMutation = useMutation({
    mutationFn: async (domain: any) => {
      const url = domain.id ? `/api/domains/${domain.id}` : "/api/domains";
      const method = domain.id ? "PUT" : "POST";
      
      console.log("Saving domain:", domain);
      
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: domain.name,
          description: domain.description,
          colorCode: domain.colorCode
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Domain save error:", errorData);
        
        if (response.status === 409) {
          throw new Error(errorData.details || "Domain name already exists. Please choose a different name.");
        } else if (response.status === 400) {
          throw new Error(errorData.details || errorData.message || "Invalid domain data");
        } else {
          throw new Error(errorData.message || `HTTP ${response.status}: Failed to save domain`);
        }
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/domains"] });
      setEditingDomain(null);
      setIsAddingDomain(false);
      toast({ title: "Domain saved successfully" });
    },
    onError: (error: any) => {
      console.error("Domain save mutation error:", error);
      toast({ 
        title: "Failed to save domain", 
        description: error.message || "Unknown error occurred",
        variant: "destructive" 
      });
    }
  });

  // Delete domain mutation
  const deleteDomainMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/domains/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete domain");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/domains"] });
      toast({ title: "Domain deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete domain", variant: "destructive" });
    }
  });

  const handleSaveDomain = (domain: any) => {
    saveDomainMutation.mutate(domain);
  };

  const handleDeleteDomain = (id: number) => {
    deleteDomainMutation.mutate(id);
  };

  const saveAreaMutation = useMutation({
    mutationFn: async (area: any) => {
      const url = area.id ? `/api/areas/${area.id}` : "/api/areas";
      const method = area.id ? "PATCH" : "POST";
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: area.name,
          description: area.description,
          colorCode: area.colorCode,
          domainId: area.domainId
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: Failed to save data area`);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/areas"] });
      setIsAddingArea(false);
      setEditingArea(null);
      setSelectedDomainForArea(null);
      toast({ title: "Data area saved successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save data area",
        description: error?.message || "Unknown error occurred",
        variant: "destructive"
      });
    }
  });

  const deleteAreaMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/areas/${id}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error("Failed to delete data area");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/areas"] });
      toast({ title: "Data area deleted successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete data area",
        description: error?.message || "Unknown error occurred",
        variant: "destructive"
      });
    }
  });

  const handleSaveArea = (area: any) => {
    saveAreaMutation.mutate(area);
  };

  const handleDeleteArea = (id: number) => {
    deleteAreaMutation.mutate(id);
  };

  const handleSaveAiConfig = async (category: string, config: any) => {
    setSavingConfig(category);
    try {
      const response = await fetch("/api/configurations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          key: category,
          value: config,
          description: `AI ${category} configuration`
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      toast({ title: `${category} settings saved successfully` });
    } catch (error) {
      console.error(`Failed to save ${category} settings:`, error);
      toast({ 
        title: `Failed to save ${category} settings`, 
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive" 
      });
    } finally {
      setSavingConfig(null);
    }
  };

  const handleSaveConnectionConfig = async (category: string, config: any) => {
    setSavingConfig(category);
    try {
      const response = await fetch("/api/configurations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          key: category,
          value: config,
          description: `Connection ${category} configuration`
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      toast({ title: `${category} settings saved successfully` });
    } catch (error) {
      console.error(`Failed to save ${category} settings:`, error);
      toast({ 
        title: `Failed to save ${category} settings`, 
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive" 
      });
    } finally {
      setSavingConfig(null);
    }
  };

  const handleSaveSettingsConfig = async (category: string, config: any) => {
    setSavingConfig(category);
    try {
      const response = await fetch("/api/configurations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          key: category,
          value: config,
          description: `Settings ${category} configuration`
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      toast({ title: `${category} settings saved successfully` });
    } catch (error) {
      console.error(`Failed to save ${category} settings:`, error);
      toast({ 
        title: `Failed to save ${category} settings`, 
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive" 
      });
    } finally {
      setSavingConfig(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/modeler")}
            className="mr-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
          </Button>
          <Settings className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Configuration</h1>
        </div>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="domains">Domains</TabsTrigger>
          <TabsTrigger value="colors">Colors</TabsTrigger>
          <TabsTrigger value="ai">AI Configuration</TabsTrigger>
          <TabsTrigger value="connections">Connections</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="domains" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Domain Configuration</h2>
            <Button onClick={() => setIsAddingDomain(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Domain
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {domains.map((domain: any) => {
              const domainAreas = dataAreas.filter((area: any) => area.domainId === domain.id);

              return (
                <Card key={domain.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2">
                      <Target className="h-5 w-5 text-purple-600" />
                      <CardTitle className="text-lg">{domain.name}</CardTitle>
                    </div>
                    <div className="flex space-x-1">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setEditingDomain(domain)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleDeleteDomain(domain.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm">
                    {domain.description || "No description available"}
                  </CardDescription>
                  <div className="mt-4 space-y-3 border-t pt-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-muted-foreground">Data Areas</span>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setSelectedDomainForArea(domain);
                          setEditingArea(null);
                          setIsAddingArea(true);
                        }}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Area
                      </Button>
                    </div>
                    {domainAreas.length ? (
                      <div className="space-y-2">
                        {domainAreas.map((area: any) => (
                          <div
                            key={area.id}
                            className="flex items-start justify-between rounded-md border border-dashed px-3 py-2"
                            style={{ borderColor: area.colorCode || "#d1d5db" }}
                          >
                            <div className="pr-2">
                              <p className="text-sm font-medium" style={{ color: area.colorCode || undefined }}>
                                {area.name}
                              </p>
                              {area.description && (
                                <p className="text-xs text-muted-foreground">{area.description}</p>
                              )}
                            </div>
                            <div className="flex items-center space-x-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setSelectedDomainForArea(domain);
                                  setEditingArea(area);
                                  setIsAddingArea(true);
                                }}
                                className="h-8 w-8"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteArea(area.id)}
                                className="h-8 w-8"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm italic text-muted-foreground">
                        No data areas yet. Add one to start organizing this domain.
                      </p>
                    )}
                  </div>
                </CardContent>
                </Card>
              );
            })}
          </div>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Domain Classification Rules</CardTitle>
              <CardDescription>Configure automatic domain classification patterns</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="hr-keywords">HR Domain Keywords</Label>
                  <Input id="hr-keywords" defaultValue="employee, staff, person, hire, payroll" />
                </div>
                <div>
                  <Label htmlFor="finance-keywords">Finance Domain Keywords</Label>
                  <Input id="finance-keywords" defaultValue="invoice, payment, transaction, account, budget" />
                </div>
                <div>
                  <Label htmlFor="sales-keywords">Sales Domain Keywords</Label>
                  <Input id="sales-keywords" defaultValue="customer, order, product, revenue, commission" />
                </div>
                <div>
                  <Label htmlFor="operations-keywords">Operations Domain Keywords</Label>
                  <Input id="operations-keywords" defaultValue="inventory, supply, logistics, warehouse, shipping" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="auto-classify">Enable automatic domain classification</Label>
                <input type="checkbox" id="auto-classify" defaultChecked />
              </div>
              <Button 
                onClick={() => {
                  const hrKeywords = (document.getElementById("hr-keywords") as HTMLInputElement)?.value || "";
                  const financeKeywords = (document.getElementById("finance-keywords") as HTMLInputElement)?.value || "";
                  const salesKeywords = (document.getElementById("sales-keywords") as HTMLInputElement)?.value || "";
                  const operationsKeywords = (document.getElementById("operations-keywords") as HTMLInputElement)?.value || "";
                  const autoClassify = (document.getElementById("auto-classify") as HTMLInputElement)?.checked || false;
                  
                  handleSaveSettingsConfig("domain-rules", {
                    hrKeywords,
                    financeKeywords,
                    salesKeywords,
                    operationsKeywords,
                    autoClassify
                  });
                }}
                disabled={savingConfig === "domain-rules"}
              >
                {savingConfig === "domain-rules" ? "Saving..." : "Save Domain Rules"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="colors" className="space-y-4">
          <ColorConfiguration />
        </TabsContent>

        <TabsContent value="ai" className="space-y-4">
          <h2 className="text-xl font-semibold">AI Configuration</h2>
          
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>OpenAI Configuration</CardTitle>
                <CardDescription>Configure OpenAI GPT integration for intelligent suggestions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="openai-model">Model Selection</Label>
                  <Select 
                    value={aiConfig.openaiModel} 
                    onValueChange={(value) => setAiConfig({ ...aiConfig, openaiModel: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gpt-4o">GPT-4o (Recommended)</SelectItem>
                      <SelectItem value="gpt-4">GPT-4</SelectItem>
                      <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="temperature">Temperature (Creativity)</Label>
                  <Input 
                    id="temperature" 
                    type="number" 
                    step="0.1" 
                    min="0" 
                    max="2" 
                    value={aiConfig.temperature}
                    onChange={(e) => setAiConfig({ ...aiConfig, temperature: parseFloat(e.target.value) })}
                  />
                </div>
                <div>
                  <Label htmlFor="max-tokens">Max Tokens</Label>
                  <Input 
                    id="max-tokens" 
                    type="number" 
                    value={aiConfig.maxTokens}
                    onChange={(e) => setAiConfig({ ...aiConfig, maxTokens: parseInt(e.target.value) })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="enable-openai">Enable OpenAI Integration</Label>
                  <input 
                    type="checkbox" 
                    id="enable-openai" 
                    checked={aiConfig.enableOpenai}
                    onChange={(e) => setAiConfig({ ...aiConfig, enableOpenai: e.target.checked })}
                  />
                </div>
                <Button 
                  onClick={() => handleSaveAiConfig("openai", {
                    model: aiConfig.openaiModel,
                    temperature: aiConfig.temperature,
                    maxTokens: aiConfig.maxTokens,
                    enabled: aiConfig.enableOpenai
                  })}
                  disabled={savingConfig === "openai"}
                >
                  {savingConfig === "openai" ? "Saving..." : "Save OpenAI Settings"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>AI Suggestion Settings</CardTitle>
                <CardDescription>Configure AI-powered suggestions and thresholds</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="confidence-threshold">Minimum Confidence Threshold</Label>
                  <Input 
                    id="confidence-threshold" 
                    type="number" 
                    step="0.1" 
                    min="0" 
                    max="1" 
                    value={aiConfig.confidenceThreshold}
                    onChange={(e) => setAiConfig({ ...aiConfig, confidenceThreshold: parseFloat(e.target.value) })}
                  />
                </div>
                <div>
                  <Label htmlFor="max-suggestions">Maximum Suggestions per Request</Label>
                  <Input 
                    id="max-suggestions" 
                    type="number" 
                    min="1" 
                    max="20" 
                    value={aiConfig.maxSuggestions}
                    onChange={(e) => setAiConfig({ ...aiConfig, maxSuggestions: parseInt(e.target.value) })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="domain-suggestions">Enable Domain Suggestions</Label>
                  <input 
                    type="checkbox" 
                    id="domain-suggestions" 
                    checked={aiConfig.domainSuggestions}
                    onChange={(e) => setAiConfig({ ...aiConfig, domainSuggestions: e.target.checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="relationship-suggestions">Enable Relationship Suggestions</Label>
                  <input 
                    type="checkbox" 
                    id="relationship-suggestions" 
                    checked={aiConfig.relationshipSuggestions}
                    onChange={(e) => setAiConfig({ ...aiConfig, relationshipSuggestions: e.target.checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="normalization-suggestions">Enable Normalization Suggestions</Label>
                  <input 
                    type="checkbox" 
                    id="normalization-suggestions" 
                    checked={aiConfig.normalizationSuggestions}
                    onChange={(e) => setAiConfig({ ...aiConfig, normalizationSuggestions: e.target.checked })}
                  />
                </div>
                <Button 
                  onClick={() => handleSaveAiConfig("suggestions", {
                    confidenceThreshold: aiConfig.confidenceThreshold,
                    maxSuggestions: aiConfig.maxSuggestions,
                    domainSuggestions: aiConfig.domainSuggestions,
                    relationshipSuggestions: aiConfig.relationshipSuggestions,
                    normalizationSuggestions: aiConfig.normalizationSuggestions
                  })}
                  disabled={savingConfig === "suggestions"}
                >
                  {savingConfig === "suggestions" ? "Saving..." : "Save Suggestion Settings"}
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>AI Analysis Patterns</CardTitle>
              <CardDescription>Configure business logic patterns for AI analysis</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="foreign-key-patterns">Foreign Key Patterns</Label>
                  <Textarea 
                    id="foreign-key-patterns" 
                    value={aiConfig.foreignKeyPatterns}
                    onChange={(e) => setAiConfig({ ...aiConfig, foreignKeyPatterns: e.target.value })}
                    placeholder="Enter patterns separated by commas" 
                  />
                </div>
                <div>
                  <Label htmlFor="primary-key-patterns">Primary Key Patterns</Label>
                  <Textarea 
                    id="primary-key-patterns" 
                    value={aiConfig.primaryKeyPatterns}
                    onChange={(e) => setAiConfig({ ...aiConfig, primaryKeyPatterns: e.target.value })}
                    placeholder="Enter patterns separated by commas" 
                  />
                </div>
                <div>
                  <Label htmlFor="date-patterns">Date Field Patterns</Label>
                  <Textarea 
                    id="date-patterns" 
                    value={aiConfig.datePatterns}
                    onChange={(e) => setAiConfig({ ...aiConfig, datePatterns: e.target.value })}
                    placeholder="Enter patterns separated by commas" 
                  />
                </div>
                <div>
                  <Label htmlFor="name-patterns">Name Field Patterns</Label>
                  <Textarea 
                    id="name-patterns" 
                    value={aiConfig.namePatterns}
                    onChange={(e) => setAiConfig({ ...aiConfig, namePatterns: e.target.value })}
                    placeholder="Enter patterns separated by commas" 
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="analysis-timeout">Analysis Timeout (seconds)</Label>
                <Input 
                  id="analysis-timeout" 
                  type="number" 
                  min="5" 
                  max="120" 
                  value={aiConfig.analysisTimeout}
                  onChange={(e) => setAiConfig({ ...aiConfig, analysisTimeout: parseInt(e.target.value) })}
                />
              </div>
              <Button 
                onClick={() => handleSaveAiConfig("patterns", {
                  foreignKeyPatterns: aiConfig.foreignKeyPatterns,
                  primaryKeyPatterns: aiConfig.primaryKeyPatterns,
                  datePatterns: aiConfig.datePatterns,
                  namePatterns: aiConfig.namePatterns,
                  analysisTimeout: aiConfig.analysisTimeout
                })}
                disabled={savingConfig === "patterns"}
              >
                {savingConfig === "patterns" ? "Saving..." : "Save Analysis Patterns"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="connections" className="space-y-4">
          <h2 className="text-xl font-semibold">Connection Settings</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Database Connections</CardTitle>
                <CardDescription>Configure database connection pools and timeouts</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="max-connections">Max Connections</Label>
                    <Input 
                      id="max-connections" 
                      type="number" 
                      value={connectionConfig.maxConnections}
                      onChange={(e) => setConnectionConfig({ ...connectionConfig, maxConnections: parseInt(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="timeout">Connection Timeout (ms)</Label>
                    <Input 
                      id="timeout" 
                      type="number" 
                      value={connectionConfig.timeout}
                      onChange={(e) => setConnectionConfig({ ...connectionConfig, timeout: parseInt(e.target.value) })}
                    />
                  </div>
                </div>
                <Button 
                  onClick={() => handleSaveConnectionConfig("database", {
                    maxConnections: connectionConfig.maxConnections,
                    timeout: connectionConfig.timeout
                  })}
                  disabled={savingConfig === "database"}
                >
                  {savingConfig === "database" ? "Saving..." : "Save Connection Settings"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>API Settings</CardTitle>
                <CardDescription>Configure API rate limits and authentication</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="rate-limit">Rate Limit (req/min)</Label>
                    <Input 
                      id="rate-limit" 
                      type="number" 
                      value={connectionConfig.rateLimit}
                      onChange={(e) => setConnectionConfig({ ...connectionConfig, rateLimit: parseInt(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="retry-attempts">Retry Attempts</Label>
                    <Input 
                      id="retry-attempts" 
                      type="number" 
                      value={connectionConfig.retryAttempts}
                      onChange={(e) => setConnectionConfig({ ...connectionConfig, retryAttempts: parseInt(e.target.value) })}
                    />
                  </div>
                </div>
                <Button 
                  onClick={() => handleSaveConnectionConfig("api", {
                    rateLimit: connectionConfig.rateLimit,
                    retryAttempts: connectionConfig.retryAttempts
                  })}
                  disabled={savingConfig === "api"}
                >
                  {savingConfig === "api" ? "Saving..." : "Save API Settings"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <h2 className="text-xl font-semibold">Application Settings</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Canvas Settings</CardTitle>
                <CardDescription>Configure canvas behavior and appearance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="auto-save">Auto-save positions</Label>
                  <input 
                    type="checkbox" 
                    id="auto-save" 
                    checked={settingsConfig.autoSave}
                    onChange={(e) => setSettingsConfig({ ...settingsConfig, autoSave: e.target.checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="mini-map">Show mini-map by default</Label>
                  <input 
                    type="checkbox" 
                    id="mini-map" 
                    checked={settingsConfig.miniMap}
                    onChange={(e) => setSettingsConfig({ ...settingsConfig, miniMap: e.target.checked })}
                  />
                </div>
                <div>
                  <Label htmlFor="save-interval">Auto-save interval (ms)</Label>
                  <Input 
                    id="save-interval" 
                    type="number" 
                    value={settingsConfig.saveInterval}
                    onChange={(e) => setSettingsConfig({ ...settingsConfig, saveInterval: parseInt(e.target.value) })}
                  />
                </div>
                <Button 
                  onClick={() => handleSaveSettingsConfig("canvas", {
                    autoSave: settingsConfig.autoSave,
                    miniMap: settingsConfig.miniMap,
                    saveInterval: settingsConfig.saveInterval
                  })}
                  disabled={savingConfig === "canvas"}
                >
                  {savingConfig === "canvas" ? "Saving..." : "Save Canvas Settings"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>AI Settings</CardTitle>
                <CardDescription>Configure AI-powered suggestions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="ai-suggestions">Enable AI suggestions</Label>
                  <input 
                    type="checkbox" 
                    id="ai-suggestions" 
                    checked={settingsConfig.aiSuggestions}
                    onChange={(e) => setSettingsConfig({ ...settingsConfig, aiSuggestions: e.target.checked })}
                  />
                </div>
                <div>
                  <Label htmlFor="confidence-threshold">Confidence threshold</Label>
                  <Input 
                    id="confidence-threshold" 
                    type="number" 
                    step="0.1" 
                    min="0" 
                    max="1" 
                    value={settingsConfig.confidenceThreshold}
                    onChange={(e) => setSettingsConfig({ ...settingsConfig, confidenceThreshold: parseFloat(e.target.value) })}
                  />
                </div>
                <Button 
                  onClick={() => handleSaveSettingsConfig("ai", {
                    aiSuggestions: settingsConfig.aiSuggestions,
                    confidenceThreshold: settingsConfig.confidenceThreshold
                  })}
                  disabled={savingConfig === "ai"}
                >
                  {savingConfig === "ai" ? "Saving..." : "Save AI Settings"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {selectedDomainForArea && (
        <Dialog
          open={isAddingArea}
          onOpenChange={(open) => {
            if (!open) {
              setIsAddingArea(false);
              setEditingArea(null);
              setSelectedDomainForArea(null);
            }
          }}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingArea ? "Edit Data Area" : `Add Data Area to ${selectedDomainForArea.name}`}
              </DialogTitle>
              <DialogDescription>
                Maintain the functional breakdown within the {selectedDomainForArea.name} domain.
              </DialogDescription>
            </DialogHeader>
            <AreaForm
              key={editingArea?.id || "new"}
              domain={selectedDomainForArea}
              area={editingArea}
              isSaving={saveAreaMutation.isPending}
              onSave={(values) => {
                if (!selectedDomainForArea) return;
                handleSaveArea({
                  ...values,
                  domainId: selectedDomainForArea.id,
                  id: editingArea?.id
                });
              }}
              onCancel={() => {
                setIsAddingArea(false);
                setEditingArea(null);
                setSelectedDomainForArea(null);
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Add/Edit Domain Dialog */}
      <Dialog open={isAddingDomain || !!editingDomain} onOpenChange={(open) => {
        if (!open) {
          setIsAddingDomain(false);
          setEditingDomain(null);
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingDomain ? "Edit Domain" : "Add New Domain"}
            </DialogTitle>
            <DialogDescription>
              {editingDomain ? "Update the domain configuration." : "Add a new domain to your configuration."}
            </DialogDescription>
          </DialogHeader>
          <DomainForm
            domain={editingDomain}
            onSave={handleSaveDomain}
            onCancel={() => {
              setIsAddingDomain(false);
              setEditingDomain(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

type AreaFormValues = {
  name: string;
  description?: string;
  colorCode?: string;
};

function AreaForm({
  domain,
  area,
  onSave,
  onCancel,
  isSaving
}: {
  domain: any;
  area: any;
  onSave: (values: AreaFormValues) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [formData, setFormData] = useState<AreaFormValues>({
    name: area?.name || "",
    description: area?.description || "",
    colorCode: area?.colorCode || domain?.colorCode || "#10b981"
  });

  useEffect(() => {
    setFormData({
      name: area?.name || "",
      description: area?.description || "",
      colorCode: area?.colorCode || domain?.colorCode || "#10b981"
    });
  }, [area, domain]);

  if (!domain) {
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || formData.name.trim() === "") {
      alert("Data area name is required");
      return;
    }

    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-md bg-muted px-3 py-2 text-sm">
        <span className="font-medium">Domain</span>
        <div className="mt-1 flex items-center gap-2 text-sm">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: domain.colorCode || "#6366f1" }}
          />
          <span>{domain.name}</span>
        </div>
      </div>

      <div>
        <Label htmlFor="area-name">Area Name</Label>
        <Input
          id="area-name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
      </div>

      <div>
        <Label htmlFor="area-description">Description</Label>
        <Textarea
          id="area-description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Describe the scope of this data area"
        />
      </div>

      <div>
        <Label htmlFor="area-color">Color Code</Label>
        <Input
          id="area-color"
          type="color"
          value={formData.colorCode}
          onChange={(e) => setFormData({ ...formData, colorCode: e.target.value })}
        />
      </div>

      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
          <X className="h-4 w-4 mr-2" />
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving}>
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? "Saving..." : area ? "Update Area" : "Save Area"}
        </Button>
      </div>
    </form>
  );
}

function DomainForm({ 
  domain, 
  onSave, 
  onCancel 
}: { 
  domain: any;
  onSave: (domain: any) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState(
    domain || {
      name: "",
      description: "",
      colorCode: "#3b82f6"
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!formData.name || formData.name.trim() === "") {
      alert("Domain name is required");
      return;
    }
    
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="domain-name">Domain Name</Label>
        <Input
          id="domain-name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
      </div>

      <div>
        <Label htmlFor="domain-description">Description</Label>
        <Textarea
          id="domain-description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Describe this domain's purpose"
        />
      </div>

      <div>
        <Label htmlFor="domain-color">Color Code</Label>
        <Input
          id="domain-color"
          type="color"
          value={formData.colorCode}
          onChange={(e) => setFormData({ ...formData, colorCode: e.target.value })}
        />
      </div>

      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          <X className="h-4 w-4 mr-2" />
          Cancel
        </Button>
        <Button type="submit">
          <Save className="h-4 w-4 mr-2" />
          Save Domain
        </Button>
      </div>
    </form>
  );
}