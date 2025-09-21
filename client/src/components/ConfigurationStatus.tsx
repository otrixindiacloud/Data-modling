import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Activity,
  Database,
  Zap,
  Settings,
  TrendingUp
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
  performance: {
    responseTime: number;
    memoryUsage: number;
    uptime: number;
  };
  configuration: {
    totalConfigs: number;
    modifiedToday: number;
    errors: number;
  };
  ai: {
    requestsToday: number;
    averageConfidence: number;
    successRate: number;
  };
}

export default function ConfigurationStatus() {
  const [statuses, setStatuses] = useState<ConfigStatus[]>([]);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);

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
      // Simulate system metrics - in a real app, these would come from monitoring APIs
      const mockMetrics: SystemMetrics = {
        performance: {
          responseTime: Math.floor(Math.random() * 100) + 50, // 50-150ms
          memoryUsage: Math.floor(Math.random() * 30) + 40, // 40-70%
          uptime: Date.now() - (Math.random() * 86400000) // Random uptime within 24 hours
        },
        configuration: {
          totalConfigs: statuses.reduce((acc, s) => acc + Object.keys(s.details || {}).length, 0),
          modifiedToday: Math.floor(Math.random() * 5),
          errors: Math.floor(Math.random() * 2)
        },
        ai: {
          requestsToday: Math.floor(Math.random() * 50) + 10,
          averageConfidence: 0.7 + Math.random() * 0.2, // 0.7-0.9
          successRate: 0.85 + Math.random() * 0.1 // 85-95%
        }
      };

      setMetrics(mockMetrics);
    } catch (error) {
      console.error("Failed to load system metrics:", error);
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

  const formatUptime = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
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
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <Activity className="h-4 w-4 mr-2 text-blue-600" />
                Response Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.performance.responseTime}ms</div>
              <p className="text-xs text-muted-foreground">Average API response</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <Database className="h-4 w-4 mr-2 text-green-600" />
                Memory Usage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.performance.memoryUsage}%</div>
              <p className="text-xs text-muted-foreground">System memory utilization</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <Zap className="h-4 w-4 mr-2 text-purple-600" />
                AI Requests
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.ai.requestsToday}</div>
              <p className="text-xs text-muted-foreground">Today ({(metrics.ai.successRate * 100).toFixed(1)}% success)</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <TrendingUp className="h-4 w-4 mr-2 text-orange-600" />
                Uptime
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatUptime(metrics.performance.uptime)}</div>
              <p className="text-xs text-muted-foreground">System availability</p>
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
            <CardTitle>Configuration Health Score</CardTitle>
            <CardDescription>Overall system configuration assessment</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Overall Health</span>
                <div className="flex items-center space-x-2">
                  <div className="w-24 bg-muted rounded-full h-2">
                    <div 
                      className="bg-green-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Math.max(85, 100 - metrics.configuration.errors * 10)}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold text-green-600">
                    {Math.max(85, 100 - metrics.configuration.errors * 10)}%
                  </span>
                </div>
              </div>
              
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <span>Total Configurations:</span>
                  <span className="font-medium">{metrics.configuration.totalConfigs}</span>
                </div>
                <div className="flex justify-between">
                  <span>Modified Today:</span>
                  <span className="font-medium">{metrics.configuration.modifiedToday}</span>
                </div>
                <div className="flex justify-between">
                  <span>Configuration Errors:</span>
                  <span className={`font-medium ${metrics.configuration.errors > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {metrics.configuration.errors}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>AI Confidence:</span>
                  <span className="font-medium text-blue-600">
                    {(metrics.ai.averageConfidence * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}