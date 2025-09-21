import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  Settings2, Download, Upload, RotateCcw, Copy, Check, 
  Zap, Palette, Database, FileText, Monitor, Smartphone,
  Server, Cloud, Shield, AlertTriangle
} from "lucide-react";
import { configManager, ConfigTemplate } from "@/lib/configManager";

interface ConfigFieldProps {
  label: string;
  description?: string;
  value: any;
  onChange: (value: any) => void;
  type: "text" | "number" | "boolean" | "select" | "slider";
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
}

const ConfigField: React.FC<ConfigFieldProps> = ({
  label,
  description,
  value,
  onChange,
  type,
  options,
  min,
  max,
  step
}) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        {type === "boolean" && (
          <Switch
            checked={value}
            onCheckedChange={onChange}
          />
        )}
      </div>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
      {type === "text" && (
        <Input
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter ${label.toLowerCase()}`}
        />
      )}
      {type === "number" && (
        <Input
          type="number"
          value={value || ""}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          min={min}
          max={max}
          step={step}
          placeholder={`Enter ${label.toLowerCase()}`}
        />
      )}
      {type === "select" && options && (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {type === "slider" && (
        <div className="px-2">
          <Slider
            value={[value || min || 0]}
            onValueChange={(values) => onChange(values[0])}
            min={min || 0}
            max={max || 100}
            step={step || 1}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>{min || 0}</span>
            <span className="font-medium">{value || min || 0}</span>
            <span>{max || 100}</span>
          </div>
        </div>
      )}
    </div>
  );
};

interface ConfigCategoryCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  fields: any[];
  category: string;
  onSave: (category: string, configs: Record<string, any>) => void;
  onError?: (category: string, error: any) => void;
}

const ConfigCategoryCard: React.FC<ConfigCategoryCardProps> = ({
  title,
  description,
  icon,
  fields,
  category,
  onSave,
  onError
}) => {
  const [values, setValues] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    configManager.getCategoryConfigurations(category).then(configs => {
      setValues(configs);
      setLoading(false);
    });
  }, [category]);

  const handleValueChange = (key: string, value: any) => {
    setValues(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const success = await configManager.setConfigurations(category, values);
      if (success) {
        setHasChanges(false);
        onSave(category, values);
      } else {
        throw new Error("Failed to save configuration");
      }
    } catch (error) {
      console.error("Error saving configuration:", error);
      if (onError) {
        onError(category, error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    try {
      setLoading(true);
      const success = await configManager.resetToDefaults(category);
      if (success) {
        const defaultConfigs = await configManager.getCategoryConfigurations(category);
        setValues(defaultConfigs);
        setHasChanges(false);
        onSave(category, defaultConfigs);
      }
    } catch (error) {
      console.error("Error resetting configuration:", error);
      if (onError) {
        onError(category, error);
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            {icon}
            <CardTitle>{title}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-4 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {icon}
            <div>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
          </div>
          {hasChanges && (
            <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Unsaved
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {fields.map((field, index) => (
          <ConfigField
            key={index}
            label={field.label}
            description={field.description}
            value={values[field.key]}
            onChange={(value) => handleValueChange(field.key, value)}
            type={field.type}
            options={field.options}
            min={field.min}
            max={field.max}
            step={field.step}
          />
        ))}
        <div className="flex space-x-2 pt-4 border-t">
          <Button onClick={handleSave} disabled={!hasChanges}>
            <Check className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to Defaults
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

interface ConfigurationImportExportProps {
  onImport: () => void;
  onExport: () => void;
}

const ConfigurationImportExport: React.FC<ConfigurationImportExportProps> = ({ onImport, onExport }) => {
  const { toast } = useToast();

  const handleExport = async () => {
    try {
      const configData = await configManager.exportConfiguration();
      const blob = new Blob([JSON.stringify(configData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `configuration-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({ 
        title: "Configuration exported successfully",
        description: "Your configuration has been saved to your downloads folder"
      });
      onExport();
    } catch (error) {
      console.error("Export error:", error);
      toast({ 
        title: "Failed to export configuration", 
        description: "Please try again or check your browser settings",
        variant: "destructive" 
      });
    }
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        
        // Validate the configuration file structure
        if (!data.configurations || typeof data.configurations !== 'object') {
          throw new Error("Invalid configuration file format");
        }
        
        const success = await configManager.importConfiguration(data);
        
        if (success) {
          toast({ 
            title: "Configuration imported successfully",
            description: "Your settings have been updated"
          });
          onImport();
        } else {
          throw new Error("Failed to import configuration");
        }
      } catch (error: any) {
        console.error("Import error:", error);
        toast({ 
          title: "Failed to import configuration", 
          description: error.message || "Please check the file format and try again",
          variant: "destructive" 
        });
      }
    };
    reader.readAsText(file);
    
    // Reset the file input
    event.target.value = '';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Settings2 className="h-5 w-5" />
          <span>Configuration Management</span>
        </CardTitle>
        <CardDescription>
          Export current configuration or import from a backup file
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex space-x-4">
          <Button onClick={handleExport} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Configuration
          </Button>
          <div>
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
              id="config-import"
            />
            <Button asChild variant="outline">
              <label htmlFor="config-import" className="cursor-pointer">
                <Upload className="h-4 w-4 mr-2" />
                Import Configuration
              </label>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

interface ConfigurationTemplatesProps {
  onTemplateApplied: () => void;
}

const ConfigurationTemplates: React.FC<ConfigurationTemplatesProps> = ({ onTemplateApplied }) => {
  const { toast } = useToast();
  const templates = configManager.getConfigurationTemplates();

  const handleApplyTemplate = async (templateId: string) => {
    try {
      const success = await configManager.applyTemplate(templateId);
      if (success) {
        toast({ 
          title: "Template applied successfully",
          description: "Your configuration has been updated with the template settings"
        });
        onTemplateApplied();
      } else {
        throw new Error("Failed to apply template");
      }
    } catch (error: any) {
      console.error("Template application error:", error);
      toast({ 
        title: "Failed to apply template", 
        description: error.message || "Please try again",
        variant: "destructive" 
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Copy className="h-5 w-5" />
          <span>Configuration Templates</span>
        </CardTitle>
        <CardDescription>
          Quick setup using predefined configuration templates
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map(template => (
            <Card key={template.id} className="cursor-pointer hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{template.name}</CardTitle>
                <CardDescription className="text-sm">{template.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1 mb-3">
                  {template.tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <Button
                  size="sm"
                  onClick={() => handleApplyTemplate(template.id)}
                  className="w-full"
                >
                  Apply Template
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export {
  ConfigField,
  ConfigCategoryCard,
  ConfigurationImportExport,
  ConfigurationTemplates
};