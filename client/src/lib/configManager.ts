import { Configuration } from "@shared/schema";
import { z } from "zod";

// Configuration validation schemas
export const aiConfigSchema = z.object({
  openai_model: z.enum(["gpt-4o", "gpt-4", "gpt-3.5-turbo"]),
  temperature: z.number().min(0).max(2),
  max_tokens: z.number().min(1).max(8000),
  confidence_threshold: z.number().min(0).max(1),
  enable_suggestions: z.boolean(),
  enable_domain_suggestions: z.boolean(),
  enable_relationship_suggestions: z.boolean(),
  enable_normalization_suggestions: z.boolean(),
  max_suggestions: z.number().min(1).max(20),
  analysis_timeout: z.number().min(5).max(120),
});

export const uiConfigSchema = z.object({
  auto_save_interval: z.number().min(100).max(5000),
  enable_mini_map: z.boolean(),
  enable_auto_save: z.boolean(),
  theme: z.enum(["light", "dark", "system"]),
  canvas_zoom_sensitivity: z.number().min(0.1).max(2),
  show_grid: z.boolean(),
  snap_to_grid: z.boolean(),
  grid_size: z.number().min(5).max(50),
});

export const exportConfigSchema = z.object({
  default_format: z.enum(["json", "sql", "quicksql", "xml"]),
  include_comments: z.boolean(),
  include_constraints: z.boolean(),
  include_indexes: z.boolean(),
  compression_enabled: z.boolean(),
  max_file_size_mb: z.number().min(1).max(100),
});

export const connectionConfigSchema = z.object({
  max_connections: z.number().min(1).max(100),
  connection_timeout: z.number().min(1000).max(60000),
  retry_attempts: z.number().min(1).max(10),
  rate_limit_per_minute: z.number().min(1).max(1000),
  enable_connection_pooling: z.boolean(),
});

// Configuration profiles for different environments
export type ConfigProfile = "development" | "staging" | "production";

export interface ConfigTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  configurations: Record<string, any>;
  tags: string[];
}

export class ConfigurationManager {
  private cache: Map<string, Configuration> = new Map();
  private profile: ConfigProfile = "development";

  constructor(profile: ConfigProfile = "development") {
    this.profile = profile;
  }

  // Get configuration with caching
  async getConfiguration(category: string, key: string): Promise<Configuration | null> {
    const cacheKey = `${category}.${key}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    try {
      const response = await fetch(`/api/config/${category}/${key}`);
      if (!response.ok) return null;
      
      const config = await response.json();
      this.cache.set(cacheKey, config);
      return config;
    } catch (error) {
      console.error(`Failed to get configuration ${category}.${key}:`, error);
      return null;
    }
  }

  // Get all configurations for a category
  async getCategoryConfigurations(category: string): Promise<Record<string, any>> {
    try {
      const response = await fetch(`/api/config/${category}`);
      if (!response.ok) return {};
      
      const configs = await response.json();
      const result: Record<string, any> = {};
      
      configs.forEach((config: Configuration) => {
        result[config.key] = config.value;
        this.cache.set(`${category}.${config.key}`, config);
      });
      
      return result;
    } catch (error) {
      console.error(`Failed to get configurations for category ${category}:`, error);
      return {};
    }
  }

  // Set configuration with validation
  async setConfiguration(category: string, key: string, value: any, description?: string): Promise<boolean> {
    try {
      // Validate configuration based on category
      this.validateConfiguration(category, key, value);

      const response = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          key,
          value,
          description: description || `${category} ${key} configuration`
        })
      });

      if (response.ok) {
        const config = await response.json();
        this.cache.set(`${category}.${key}`, config);
        
        // Emit configuration change event
        this.emitConfigChange(category, key, value);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`Failed to set configuration ${category}.${key}:`, error);
      return false;
    }
  }

  // Batch set configurations
  async setConfigurations(category: string, configs: Record<string, any>): Promise<boolean> {
    try {
      const configurations = Object.entries(configs).map(([key, value]) => ({
        category,
        key,
        value,
        description: `${category} ${key} configuration`
      }));

      const response = await fetch("/api/config/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configurations })
      });

      if (response.ok) {
        // Update cache
        Object.entries(configs).forEach(([key, value]) => {
          this.cache.set(`${category}.${key}`, { category, key, value } as Configuration);
          this.emitConfigChange(category, key, value);
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error(`Failed to set configurations for category ${category}:`, error);
      return false;
    }
  }

  // Validate configuration values
  private validateConfiguration(category: string, key: string, value: any): void {
    let schema;
    
    switch (category) {
      case "ai":
        schema = aiConfigSchema;
        break;
      case "ui":
        schema = uiConfigSchema;
        break;
      case "export":
        schema = exportConfigSchema;
        break;
      case "connection":
        schema = connectionConfigSchema;
        break;
      default:
        return; // No validation for unknown categories
    }

    try {
      const configToValidate = { [key]: value };
      schema.parse(configToValidate);
    } catch (error: any) {
      console.warn(`Configuration validation warning for ${category}.${key}:`, error.message);
      // Don't throw error, just log warning to allow flexibility
    }
  }

  // Export configuration as JSON
  async exportConfiguration(categories?: string[]): Promise<any> {
    const exportData: any = {
      profile: this.profile,
      timestamp: new Date().toISOString(),
      version: "1.0",
      configurations: {}
    };

    const categoriesToExport = categories || ["ai", "ui", "export", "connection"];
    
    for (const category of categoriesToExport) {
      exportData.configurations[category] = await this.getCategoryConfigurations(category);
    }

    return exportData;
  }

  // Import configuration from JSON
  async importConfiguration(data: any): Promise<boolean> {
    try {
      if (!data.configurations) {
        throw new Error("Invalid configuration data format");
      }

      const promises: Promise<boolean>[] = [];
      
      for (const [category, configs] of Object.entries(data.configurations)) {
        if (typeof configs === "object" && configs !== null) {
          promises.push(this.setConfigurations(category, configs as Record<string, any>));
        }
      }

      const results = await Promise.all(promises);
      return results.every(result => result);
    } catch (error) {
      console.error("Failed to import configuration:", error);
      return false;
    }
  }

  // Reset configuration to defaults
  async resetToDefaults(category: string): Promise<boolean> {
    const defaults = this.getDefaultConfiguration(category);
    return await this.setConfigurations(category, defaults);
  }

  // Get default configuration for a category
  private getDefaultConfiguration(category: string): Record<string, any> {
    switch (category) {
      case "ai":
        return {
          openai_model: "gpt-4o",
          temperature: 0.7,
          max_tokens: 1000,
          confidence_threshold: 0.7,
          enable_suggestions: true,
          enable_domain_suggestions: true,
          enable_relationship_suggestions: true,
          enable_normalization_suggestions: true,
          max_suggestions: 5,
          analysis_timeout: 30,
        };
      case "ui":
        return {
          auto_save_interval: 500,
          enable_mini_map: true,
          enable_auto_save: true,
          theme: "system",
          canvas_zoom_sensitivity: 1.0,
          show_grid: false,
          snap_to_grid: false,
          grid_size: 20,
        };
      case "export":
        return {
          default_format: "json",
          include_comments: true,
          include_constraints: true,
          include_indexes: true,
          compression_enabled: false,
          max_file_size_mb: 10,
        };
      case "connection":
        return {
          max_connections: 10,
          connection_timeout: 5000,
          retry_attempts: 3,
          rate_limit_per_minute: 100,
          enable_connection_pooling: true,
        };
      default:
        return {};
    }
  }

  // Emit configuration change events
  private emitConfigChange(category: string, key: string, value: any): void {
    const event = new CustomEvent("configurationChanged", {
      detail: { category, key, value }
    });
    window.dispatchEvent(event);
  }

  // Listen for configuration changes
  onConfigurationChange(callback: (category: string, key: string, value: any) => void): () => void {
    const handler = (event: CustomEvent) => {
      const { category, key, value } = event.detail;
      callback(category, key, value);
    };

    window.addEventListener("configurationChanged", handler as EventListener);
    
    return () => {
      window.removeEventListener("configurationChanged", handler as EventListener);
    };
  }

  // Clear cache
  clearCache(): void {
    this.cache.clear();
  }

  // Get configuration templates
  getConfigurationTemplates(): ConfigTemplate[] {
    return [
      {
        id: "enterprise-ai",
        name: "Enterprise AI Setup",
        description: "Optimized AI configuration for enterprise environments",
        category: "ai",
        configurations: {
          openai_model: "gpt-4o",
          temperature: 0.5,
          max_tokens: 2000,
          confidence_threshold: 0.8,
          enable_suggestions: true,
          max_suggestions: 10,
          analysis_timeout: 60
        },
        tags: ["enterprise", "ai", "production"]
      },
      {
        id: "development-ui",
        name: "Development UI",
        description: "UI configuration optimized for development work",
        category: "ui",
        configurations: {
          auto_save_interval: 200,
          enable_mini_map: true,
          show_grid: true,
          snap_to_grid: true,
          grid_size: 10
        },
        tags: ["development", "ui", "grid"]
      },
      {
        id: "production-export",
        name: "Production Export",
        description: "Export settings for production deployments",
        category: "export",
        configurations: {
          default_format: "sql",
          include_comments: false,
          include_constraints: true,
          include_indexes: true,
          compression_enabled: true,
          max_file_size_mb: 50
        },
        tags: ["production", "export", "sql"]
      }
    ];
  }

  // Apply configuration template
  async applyTemplate(templateId: string): Promise<boolean> {
    const template = this.getConfigurationTemplates().find(t => t.id === templateId);
    if (!template) return false;

    return await this.setConfigurations(template.category, template.configurations);
  }
}

// Singleton instance
export const configManager = new ConfigurationManager();

// Configuration hooks for React components will be defined in a separate hook file