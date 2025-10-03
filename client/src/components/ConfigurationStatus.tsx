import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Activity,
  Settings,
  Layers,
  Database,
  Server
} from "lucide-react";
import { configManager } from "@/lib/configManager";

interface ConfigStatus {
  category: string;
  status: "healthy" | "warning" | "error";
  message: string;
  lastChecked: Date;
  details?: Record<string, any>;
}

interface SystemMetrics {
  generatedAt: string;
  configuration: {
    totalConfigs: number;
    modifiedToday: number;
    lastUpdated: string | null;
    categories: Array<{
      name: string;
      count: number;
      missingKeys: string[];
    }>;
    missingKeys: string[];
  };
  models: {
    total: number;
    conceptual: number;
    logical: number;
    physical: number;
  };
  objects: {
    total: number;
    attributes: number;
    relationships: number;
  };
  systems: {
    total: number;
    connected: number;
    disconnected: number;
    error: number;
  };
}

export default function ConfigurationStatus() {
  const [statuses, setStatuses] = useState<ConfigStatus[]>([]);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const statusCounts = React.useMemo(
    () =>
      statuses.reduce(
        (acc, status) => {
          if (status.status === "error") {
            acc.errors += 1;
          } else if (status.status === "warning") {
            acc.warnings += 1;
          } else {
            acc.healthy += 1;
          }
          return acc;
        },
        { healthy: 0, warnings: 0, errors: 0 }
      ),
    [statuses]
  );

  const missingKeyCount = metrics?.configuration.missingKeys.length ?? 0;

  const healthScore = React.useMemo(() => {
    const base = 100 - statusCounts.errors * 25 - statusCounts.warnings * 10 - missingKeyCount * 5;
    return Math.max(0, Math.min(100, base));
  }, [missingKeyCount, statusCounts.errors, statusCounts.warnings]);

  const lastMetricsRefresh = React.useMemo(() => {
    if (!metrics) return null;
    return new Date(metrics.generatedAt);
  }, [metrics]);

  useEffect(() => {
    loadConfigurationStatus();
    loadSystemMetrics();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      loadConfigurationStatus();
      loadSystemMetrics();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const loadConfigurationStatus = async () => {
    try {
      const statuses: ConfigStatus[] = [];

      // Check AI configuration
      try {
        const aiConfigs = await configManager.getCategoryConfigurations("ai");
        statuses.push({
          category: "AI",
          status: aiConfigs.enable_suggestions ? "healthy" : "warning",
          message: aiConfigs.enable_suggestions 
            ? `AI active with ${aiConfigs.openai_model || 'GPT-4o'} model`
            : "AI suggestions disabled",
          lastChecked: new Date(),
          details: aiConfigs
        });
      } catch (error) {
        statuses.push({
          category: "AI",
          status: "error",
          message: "Failed to load AI configuration",
          lastChecked: new Date(),
          details: {}
        });
      }

      // Check UI configuration
      try {
        const uiConfigs = await configManager.getCategoryConfigurations("ui");
        statuses.push({
          category: "UI",
          status: "healthy",
          message: `Auto-save ${uiConfigs.enable_auto_save ? 'enabled' : 'disabled'}, interval: ${uiConfigs.auto_save_interval || 500}ms`,
          lastChecked: new Date(),
          details: uiConfigs
        });
      } catch (error) {
        statuses.push({
          category: "UI",
          status: "error",
          message: "Failed to load UI configuration",
          lastChecked: new Date(),
          details: {}
        });
      }

      // Check database configuration
      try {
        const connectionConfigs = await configManager.getCategoryConfigurations("connection");
        statuses.push({
          category: "Database",
          status: connectionConfigs.enable_connection_pooling ? "healthy" : "warning",
          message: `${connectionConfigs.max_connections || 10} max connections, ${connectionConfigs.connection_timeout || 5000}ms timeout`,
          lastChecked: new Date(),
          details: connectionConfigs
        });
      } catch (error) {
        statuses.push({
          category: "Database",
          status: "error",
          message: "Failed to load database configuration",
          lastChecked: new Date(),
          details: {}
        });
      }

      // Check export configuration
      try {
        const exportConfigs = await configManager.getCategoryConfigurations("export");
        statuses.push({
          category: "Export",
          status: "healthy",
          message: `Default: ${exportConfigs.default_format || 'JSON'}, max size: ${exportConfigs.max_file_size_mb || 10}MB`,
          lastChecked: new Date(),
          details: exportConfigs
        });
      } catch (error) {
        statuses.push({
          category: "Export",
          status: "error",
          message: "Failed to load export configuration",
          lastChecked: new Date(),
          details: {}
        });
      }

      setStatuses(statuses);
    } catch (error) {
      console.error("Failed to load configuration status:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadSystemMetrics = async () => {
    try {
      const response = await fetch("/api/system-metrics");
      if (!response.ok) {
        throw new Error("Failed to load system metrics");
      }

      const data: SystemMetrics = await response.json();
      setMetrics(data);
    } catch (error) {
      console.error("Failed to load system metrics:", error);
      setMetrics(null);
    }
  };

  const getStatusIcon = (status: ConfigStatus['status']) => {
    switch (status) {
      case "healthy":
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case "error":
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Activity className="h-5 w-5 text-gray-600" />;
    }
  };

  const getStatusBadgeVariant = (status: ConfigStatus['status']) => {
    switch (status) {
      case "healthy":
        return "default";
      case "warning":
        return "secondary";
      case "error":
        return "destructive";
      default:
        return "outline";
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>System Status</CardTitle>
            <CardDescription>Loading configuration status...</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="animate-pulse space-y-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-4 bg-muted rounded" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* System Metrics Overview */}
      {metrics && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <Settings className="h-4 w-4 mr-2 text-blue-600" />
                Configuration Entries
              </CardTitle>
              <CardDescription className="text-xs">
                {metrics.configuration.lastUpdated
                  ? `Last updated ${new Date(metrics.configuration.lastUpdated).toLocaleString()}`
                  : "No updates recorded yet"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.configuration.totalConfigs}</div>
              <p className="text-xs text-muted-foreground">
                {metrics.configuration.modifiedToday} updated today
              </p>
              {metrics.configuration.categories.length > 0 && (
                <div className="mt-3 space-y-1">
                  {metrics.configuration.categories.slice(0, 3).map((category) => (
                    <div
                      key={category.name}
                      className="flex justify-between text-xs text-muted-foreground"
                    >
                      <span className="capitalize">{category.name}</span>
                      <span>{category.count}</span>
                    </div>
                  ))}
                  {metrics.configuration.categories.length > 3 && (
                    <div className="text-xs text-muted-foreground">
                      +{metrics.configuration.categories.length - 3} more categories
                    </div>
                  )}
                </div>
              )}
              {metrics.configuration.missingKeys.length > 0 ? (
                <div className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  <p className="font-medium">Missing required keys</p>
                  <ul className="mt-2 space-y-1 list-disc list-inside">
                    {metrics.configuration.missingKeys.slice(0, 4).map((key) => (
                      <li key={key}>{key}</li>
                    ))}
                  </ul>
                  {metrics.configuration.missingKeys.length > 4 && (
                    <p className="mt-1">+{metrics.configuration.missingKeys.length - 4} more</p>
                  )}
                </div>
              ) : (
                <p className="mt-3 text-xs text-green-600">All required keys are configured.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <Layers className="h-4 w-4 mr-2 text-indigo-600" />
                Data Models
              </CardTitle>
              <CardDescription className="text-xs">
                Layer distribution across the workspace
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.models.total}</div>
              <p className="text-xs text-muted-foreground">
                Conceptual: {metrics.models.conceptual} · Logical: {metrics.models.logical} · Physical: {metrics.models.physical}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <Database className="h-4 w-4 mr-2 text-green-600" />
                Data Objects
              </CardTitle>
              <CardDescription className="text-xs">
                Entities, attributes, and relationships
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.objects.total}</div>
              <p className="text-xs text-muted-foreground">
                {metrics.objects.attributes} attributes · {metrics.objects.relationships} relationships
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <Server className="h-4 w-4 mr-2 text-orange-600" />
                Systems
              </CardTitle>
              <CardDescription className="text-xs">
                Connection status across integrations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.systems.total}</div>
              <p className="text-xs text-muted-foreground">
                Connected: {metrics.systems.connected} · Disconnected: {metrics.systems.disconnected} · Errors: {metrics.systems.error}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Configuration Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center">
                <Settings className="h-5 w-5 mr-2" />
                Configuration Status
              </CardTitle>
              <CardDescription>
                Real-time status of system configurations and components
              </CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setLoading(true);
                loadConfigurationStatus();
                loadSystemMetrics();
              }}
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {statuses.map((status, index) => (
              <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(status.status)}
                  <div>
                    <div className="font-medium">{status.category}</div>
                    <div className="text-sm text-muted-foreground">{status.message}</div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant={getStatusBadgeVariant(status.status)}>
                    {status.status}
                  </Badge>
                  <div className="text-xs text-muted-foreground">
                    {status.lastChecked.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Configuration Health Score */}
      {metrics && (
        <Card>
          <CardHeader>
            <CardTitle>Configuration Health</CardTitle>
            <CardDescription>
              Status overview based on configuration completeness and system readiness
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Overall Health Score</span>
                <div className="flex items-center space-x-2">
                  <div className="w-32 bg-muted rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${
                        healthScore >= 80
                          ? "bg-green-600"
                          : healthScore >= 60
                          ? "bg-yellow-500"
                          : "bg-red-500"
                      }`}
                      style={{ width: `${healthScore}%` }}
                    />
                  </div>
                  <span
                    className={`text-sm font-bold ${
                      healthScore >= 80
                        ? "text-green-600"
                        : healthScore >= 60
                        ? "text-yellow-600"
                        : "text-red-600"
                    }`}
                  >
                    {healthScore}%
                  </span>
                </div>
              </div>

              <div className="grid gap-3 text-sm md:grid-cols-2">
                <div className="flex items-start justify-between rounded border bg-muted/30 p-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Status Breakdown</p>
                    <p className="text-sm font-medium">
                      {statusCounts.healthy} healthy · {statusCounts.warnings} warnings · {statusCounts.errors} errors
                    </p>
                  </div>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </div>

                <div className="flex items-start justify-between rounded border bg-muted/30 p-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Required Configuration Keys</p>
                    <p className="text-sm font-medium">
                      {missingKeyCount} missing · {metrics.configuration.totalConfigs} total
                    </p>
                  </div>
                  <Settings className="h-4 w-4 text-muted-foreground" />
                </div>

                <div className="flex items-start justify-between rounded border bg-muted/30 p-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Tracked Entities</p>
                    <p className="text-sm font-medium">
                      {metrics.objects.total} objects · {metrics.objects.attributes} attributes
                    </p>
                  </div>
                  <Database className="h-4 w-4 text-muted-foreground" />
                </div>

                <div className="flex items-start justify-between rounded border bg-muted/30 p-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Systems Health</p>
                    <p className="text-sm font-medium">
                      {metrics.systems.connected} connected · {metrics.systems.error} with errors
                    </p>
                  </div>
                  <Server className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>

              <div className="rounded border bg-muted/30 p-3 text-xs text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>Metrics generated</span>
                  <span>{lastMetricsRefresh?.toLocaleString() ?? "Unknown"}</span>
                </div>
                {lastMetricsRefresh && (
                  <div className="mt-1">
                    <span>Relative time: </span>
                    <span>
                      {new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(
                        Math.round((lastMetricsRefresh.getTime() - Date.now()) / 1000),
                        "second"
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}