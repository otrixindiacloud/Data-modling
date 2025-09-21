import React, { useState } from "react";
import { ArrowLeft, Zap, Palette, Database, FileText, Monitor, Settings2 } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  ConfigCategoryCard,
  ConfigurationImportExport,
  ConfigurationTemplates
} from "@/components/ConfigurationComponents";
import ConfigurationStatus from "@/components/ConfigurationStatus";

const AI_FIELDS = [
  {
    key: "openai_model",
    label: "OpenAI Model",
    description: "Select the AI model for intelligent suggestions",
    type: "select" as const,
    options: [
      { value: "gpt-4o", label: "GPT-4o (Recommended)" },
      { value: "gpt-4", label: "GPT-4" },
      { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" }
    ]
  },
  {
    key: "temperature",
    label: "Temperature",
    description: "Controls AI creativity and randomness (0 = focused, 2 = creative)",
    type: "slider" as const,
    min: 0,
    max: 2,
    step: 0.1
  },
  {
    key: "max_tokens",
    label: "Max Tokens",
    description: "Maximum tokens for AI responses",
    type: "number" as const,
    min: 100,
    max: 4000,
    step: 100
  },
  {
    key: "confidence_threshold",
    label: "Confidence Threshold",
    description: "Minimum confidence level for AI suggestions",
    type: "slider" as const,
    min: 0,
    max: 1,
    step: 0.1
  },
  {
    key: "enable_suggestions",
    label: "Enable AI Suggestions",
    description: "Turn on/off AI-powered suggestions",
    type: "boolean" as const
  },
  {
    key: "enable_domain_suggestions",
    label: "Domain Suggestions",
    description: "Enable automatic domain classification",
    type: "boolean" as const
  },
  {
    key: "enable_relationship_suggestions",
    label: "Relationship Suggestions",
    description: "Enable AI relationship detection",
    type: "boolean" as const
  },
  {
    key: "enable_normalization_suggestions",
    label: "Normalization Suggestions",
    description: "Enable database normalization suggestions",
    type: "boolean" as const
  },
  {
    key: "max_suggestions",
    label: "Max Suggestions",
    description: "Maximum number of suggestions per request",
    type: "number" as const,
    min: 1,
    max: 20
  },
  {
    key: "analysis_timeout",
    label: "Analysis Timeout (seconds)",
    description: "Timeout for AI analysis operations",
    type: "number" as const,
    min: 5,
    max: 120
  }
];

const UI_FIELDS = [
  {
    key: "auto_save_interval",
    label: "Auto-save Interval (ms)",
    description: "How often to automatically save changes",
    type: "number" as const,
    min: 100,
    max: 5000,
    step: 100
  },
  {
    key: "enable_mini_map",
    label: "Enable Mini-map",
    description: "Show navigation mini-map in canvas",
    type: "boolean" as const
  },
  {
    key: "enable_auto_save",
    label: "Enable Auto-save",
    description: "Automatically save canvas changes",
    type: "boolean" as const
  },
  {
    key: "theme",
    label: "Theme",
    description: "Application color theme",
    type: "select" as const,
    options: [
      { value: "light", label: "Light" },
      { value: "dark", label: "Dark" },
      { value: "system", label: "System" }
    ]
  },
  {
    key: "canvas_zoom_sensitivity",
    label: "Zoom Sensitivity",
    description: "Canvas zoom sensitivity",
    type: "slider" as const,
    min: 0.1,
    max: 2,
    step: 0.1
  },
  {
    key: "show_grid",
    label: "Show Grid",
    description: "Display background grid on canvas",
    type: "boolean" as const
  },
  {
    key: "snap_to_grid",
    label: "Snap to Grid",
    description: "Snap objects to grid when moving",
    type: "boolean" as const
  },
  {
    key: "grid_size",
    label: "Grid Size",
    description: "Size of grid squares in pixels",
    type: "number" as const,
    min: 5,
    max: 50
  }
];

const EXPORT_FIELDS = [
  {
    key: "default_format",
    label: "Default Format",
    description: "Default export format for data models",
    type: "select" as const,
    options: [
      { value: "json", label: "JSON" },
      { value: "sql", label: "SQL DDL" },
      { value: "quicksql", label: "QuickSQL" },
      { value: "xml", label: "XML" }
    ]
  },
  {
    key: "include_comments",
    label: "Include Comments",
    description: "Add comments to exported files",
    type: "boolean" as const
  },
  {
    key: "include_constraints",
    label: "Include Constraints",
    description: "Export database constraints",
    type: "boolean" as const
  },
  {
    key: "include_indexes",
    label: "Include Indexes",
    description: "Export database indexes",
    type: "boolean" as const
  },
  {
    key: "compression_enabled",
    label: "Enable Compression",
    description: "Compress exported files",
    type: "boolean" as const
  },
  {
    key: "max_file_size_mb",
    label: "Max File Size (MB)",
    description: "Maximum size for exported files",
    type: "number" as const,
    min: 1,
    max: 100
  }
];

const CONNECTION_FIELDS = [
  {
    key: "max_connections",
    label: "Max Connections",
    description: "Maximum database connections",
    type: "number" as const,
    min: 1,
    max: 100
  },
  {
    key: "connection_timeout",
    label: "Connection Timeout (ms)",
    description: "Database connection timeout",
    type: "number" as const,
    min: 1000,
    max: 60000,
    step: 1000
  },
  {
    key: "retry_attempts",
    label: "Retry Attempts",
    description: "Number of retry attempts for failed operations",
    type: "number" as const,
    min: 1,
    max: 10
  },
  {
    key: "rate_limit_per_minute",
    label: "Rate Limit (/min)",
    description: "API rate limit per minute",
    type: "number" as const,
    min: 1,
    max: 1000
  },
  {
    key: "enable_connection_pooling",
    label: "Connection Pooling",
    description: "Enable database connection pooling",
    type: "boolean" as const
  }
];

export default function EnhancedConfigurationPage() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleConfigSave = (category: string, configs: Record<string, any>) => {
    toast({ 
      title: "Configuration saved",
      description: `${category.toUpperCase()} settings have been updated successfully`
    });
    setRefreshTrigger(prev => prev + 1);
  };

  const handleConfigError = (category: string, error: any) => {
    console.error(`Configuration error for ${category}:`, error);
    toast({
      title: "Configuration Error",
      description: `Failed to save ${category} settings. Please try again.`,
      variant: "destructive"
    });
  };

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/configuration")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Configuration
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Enhanced Configuration</h1>
            <p className="text-muted-foreground">
              Advanced configuration management with templates, validation, and import/export
            </p>
          </div>
        </div>
        <div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLocation("/")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Modeler
          </Button>
        </div>
      </div>

      {/* Management Tools */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ConfigurationImportExport 
          onImport={handleRefresh}
          onExport={handleRefresh}
        />
        <ConfigurationTemplates 
          onTemplateApplied={handleRefresh}
        />
      </div>

      {/* Configuration Categories */}
      <Tabs defaultValue="ai" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="ai">
            <Zap className="h-4 w-4 mr-2" />
            AI
          </TabsTrigger>
          <TabsTrigger value="ui">
            <Palette className="h-4 w-4 mr-2" />
            Interface
          </TabsTrigger>
          <TabsTrigger value="export">
            <FileText className="h-4 w-4 mr-2" />
            Export
          </TabsTrigger>
          <TabsTrigger value="connection">
            <Database className="h-4 w-4 mr-2" />
            Database
          </TabsTrigger>
          <TabsTrigger value="advanced">
            <Settings2 className="h-4 w-4 mr-2" />
            Advanced
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ai" key={`ai-${refreshTrigger}`}>
          <ConfigCategoryCard
            title="AI Configuration"
            description="Configure OpenAI GPT integration and AI-powered features"
            icon={<Zap className="h-5 w-5 text-blue-600" />}
            fields={AI_FIELDS}
            category="ai"
            onSave={handleConfigSave}
            onError={handleConfigError}
          />
        </TabsContent>

        <TabsContent value="ui" key={`ui-${refreshTrigger}`}>
          <ConfigCategoryCard
            title="User Interface"
            description="Customize the application interface and user experience"
            icon={<Palette className="h-5 w-5 text-purple-600" />}
            fields={UI_FIELDS}
            category="ui"
            onSave={handleConfigSave}
            onError={handleConfigError}
          />
        </TabsContent>

        <TabsContent value="export" key={`export-${refreshTrigger}`}>
          <ConfigCategoryCard
            title="Export Settings"
            description="Configure data export formats and options"
            icon={<FileText className="h-5 w-5 text-green-600" />}
            fields={EXPORT_FIELDS}
            category="export"
            onSave={handleConfigSave}
            onError={handleConfigError}
          />
        </TabsContent>

        <TabsContent value="connection" key={`connection-${refreshTrigger}`}>
          <ConfigCategoryCard
            title="Database Connections"
            description="Configure database connection settings and performance"
            icon={<Database className="h-5 w-5 text-orange-600" />}
            fields={CONNECTION_FIELDS}
            category="connection"
            onSave={handleConfigSave}
            onError={handleConfigError}
          />
        </TabsContent>

        <TabsContent value="advanced" className="space-y-6">
          <ConfigurationStatus />
        </TabsContent>
      </Tabs>
    </div>
  );
}