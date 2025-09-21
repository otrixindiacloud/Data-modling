import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Palette, Save, RotateCcw, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface ColorItem {
  id: number;
  name: string;
  type: 'system' | 'domain' | 'area';
  colorCode: string;
  description?: string;
}

const DEFAULT_COLORS = {
  system: "#6366f1", // Indigo
  domain: "#3b82f6", // Blue
  area: "#10b981"    // Green
};

const PRESET_COLORS = [
  "#ef4444", // Red
  "#f97316", // Orange
  "#eab308", // Yellow
  "#22c55e", // Green
  "#06b6d4", // Cyan
  "#3b82f6", // Blue
  "#6366f1", // Indigo
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#6b7280", // Gray
  "#dc2626", // Dark Red
  "#ea580c", // Dark Orange
];

export default function ColorConfiguration() {
  const [previewMode, setPreviewMode] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch data sources (systems)
  const { data: dataSources = [] } = useQuery({
    queryKey: ["/api/sources"],
    queryFn: async () => {
      const response = await fetch("/api/sources");
      return response.json();
    }
  });

  // Fetch domains
  const { data: domains = [] } = useQuery({
    queryKey: ["/api/domains"],
    queryFn: async () => {
      const response = await fetch("/api/domains");
      return response.json();
    }
  });

  // Fetch areas grouped by domain
  const { data: areasByDomain = {} } = useQuery({
    queryKey: ["/api/domains", "areas-grouped"],
    queryFn: async () => {
      if (!(domains as any[]).length) return {};
      const areasByDomainMap: Record<number, any[]> = {};
      
      const areaPromises = (domains as any[]).map(async (domain: any) => {
        const response = await fetch(`/api/domains/${domain.id}/areas`);
        const areas = await response.json();
        areasByDomainMap[domain.id] = areas;
      });
      
      await Promise.all(areaPromises);
      return areasByDomainMap;
    },
    enabled: (domains as any[]).length > 0
  });

  // Update color mutation
  const updateColorMutation = useMutation({
    mutationFn: async ({ id, type, colorCode }: { id: number; type: string; colorCode: string }) => {
      const endpoint = type === 'system' ? `/api/sources/${id}` : 
                     type === 'domain' ? `/api/domains/${id}` : 
                     `/api/areas/${id}`;
      
      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ colorCode })
      });
      
      if (!response.ok) throw new Error('Failed to update color');
      return response.json();
    },
    onSuccess: (_, variables) => {
      if (variables.type === 'system') {
        queryClient.invalidateQueries({ queryKey: ["/api/sources"] });
      } else if (variables.type === 'domain') {
        queryClient.invalidateQueries({ queryKey: ["/api/domains"] });
      } else if (variables.type === 'area') {
        queryClient.invalidateQueries({ queryKey: ["/api/domains", "areas-grouped"] });
      }
      toast({ title: "Color updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update color", variant: "destructive" });
    }
  });

  // Reset colors mutation
  const resetColorsMutation = useMutation({
    mutationFn: async (type: 'system' | 'domain' | 'area') => {
      let items: any[] = [];
      
      if (type === 'system') {
        items = dataSources as any[];
      } else if (type === 'domain') {
        items = domains as any[];
      } else if (type === 'area') {
        // Flatten all areas from all domains
        items = Object.values(areasByDomain).flat();
      }
      
      const promises = items.map(async (item: any) => {
        const endpoint = type === 'system' ? `/api/sources/${item.id}` : 
                        type === 'domain' ? `/api/domains/${item.id}` : 
                        `/api/areas/${item.id}`;
        
        const response = await fetch(endpoint, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ colorCode: DEFAULT_COLORS[type] })
        });
        
        if (!response.ok) throw new Error('Failed to reset color');
        return response.json();
      });

      return Promise.all(promises);
    },
    onSuccess: (_, type) => {
      if (type === 'system') {
        queryClient.invalidateQueries({ queryKey: ["/api/sources"] });
      } else if (type === 'domain') {
        queryClient.invalidateQueries({ queryKey: ["/api/domains"] });
      } else if (type === 'area') {
        queryClient.invalidateQueries({ queryKey: ["/api/domains", "areas-grouped"] });
      }
      toast({ title: `All ${type} colors reset to default` });
    },
    onError: () => {
      toast({ title: "Failed to reset colors", variant: "destructive" });
    }
  });

  const handleColorChange = (id: number, type: 'system' | 'domain' | 'area', colorCode: string) => {
    updateColorMutation.mutate({ id, type, colorCode });
  };

  const handleResetColors = (type: 'system' | 'domain' | 'area') => {
    resetColorsMutation.mutate(type);
  };

  const ColorSection = ({ 
    title, 
    description, 
    items, 
    type 
  }: { 
    title: string; 
    description: string; 
    items: any[]; 
    type: 'system' | 'domain' | 'area' 
  }) => (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <Palette className="h-5 w-5" />
              <span>{title}</span>
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleResetColors(type)}
            disabled={resetColorsMutation.isPending}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to Default
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item: any) => (
            <div key={item.id} className="space-y-3 p-4 border rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">{item.name}</Label>
                  {item.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {item.description}
                    </p>
                  )}
                </div>
                <Badge 
                  variant="outline" 
                  style={{ 
                    backgroundColor: `${item.colorCode}20`,
                    borderColor: item.colorCode,
                    color: item.colorCode 
                  }}
                >
                  {type}
                </Badge>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor={`color-${item.id}`}>Color Code</Label>
                <div className="flex items-center space-x-2">
                  <Input
                    id={`color-${item.id}`}
                    type="color"
                    value={item.colorCode || DEFAULT_COLORS[type]}
                    onChange={(e) => handleColorChange(item.id, type, e.target.value)}
                    className="w-16 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={item.colorCode || DEFAULT_COLORS[type]}
                    onChange={(e) => handleColorChange(item.id, type, e.target.value)}
                    placeholder="#ffffff"
                    className="flex-1 font-mono text-sm"
                  />
                </div>
                
                {/* Preset colors */}
                <div className="flex flex-wrap gap-1 mt-2">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => handleColorChange(item.id, type, color)}
                      className="w-6 h-6 rounded border-2 border-gray-300 hover:border-gray-500 transition-colors"
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
              
              {/* Live preview */}
              {previewMode && (
                <div 
                  className="p-3 rounded text-white text-sm font-medium text-center"
                  style={{ backgroundColor: item.colorCode || DEFAULT_COLORS[type] }}
                >
                  {item.name}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Color Configuration</h2>
          <p className="text-muted-foreground">
            Customize color codes for systems, domains, and sub-domains to improve visual organization
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setPreviewMode(!previewMode)}
          className="flex items-center space-x-2"
        >
          {previewMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          <span>{previewMode ? 'Hide' : 'Show'} Preview</span>
        </Button>
      </div>

      <div className="space-y-6">
        <ColorSection
          title="System Colors"
          description="Configure colors for data sources and target systems"
          items={dataSources as any[]}
          type="system"
        />

        {/* Domains with Areas grouped */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center space-x-2">
                  <span>Domain & Area Colors</span>
                </CardTitle>
                <CardDescription>
                  Configure colors for business domains and their data areas
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleResetColors('domain')}
                className="flex items-center space-x-2"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Reset All</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {(domains as any[]).map((domain: any) => (
              <div key={domain.id} className="space-y-4 p-4 border rounded-lg">
                {/* Domain Color Configuration */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="font-medium text-lg">{domain.name}</Label>
                      {domain.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {domain.description}
                        </p>
                      )}
                    </div>
                    <Badge 
                      variant="outline" 
                      style={{ 
                        backgroundColor: `${domain.colorCode}20`,
                        borderColor: domain.colorCode,
                        color: domain.colorCode 
                      }}
                    >
                      Domain
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor={`domain-color-${domain.id}`}>Domain Color</Label>
                    <div className="flex items-center space-x-2">
                      <Input
                        id={`domain-color-${domain.id}`}
                        type="color"
                        value={domain.colorCode || DEFAULT_COLORS.domain}
                        onChange={(e) => handleColorChange(domain.id, 'domain', e.target.value)}
                        className="w-16 h-10 p-1 cursor-pointer"
                      />
                      <Input
                        value={domain.colorCode || DEFAULT_COLORS.domain}
                        onChange={(e) => handleColorChange(domain.id, 'domain', e.target.value)}
                        placeholder="#ffffff"
                        className="flex-1 font-mono text-sm"
                      />
                    </div>
                    
                    {/* Preset colors */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {PRESET_COLORS.map((color) => (
                        <button
                          key={color}
                          onClick={() => handleColorChange(domain.id, 'domain', color)}
                          className="w-6 h-6 rounded border-2 border-gray-300 hover:border-gray-500 transition-colors"
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Live preview for domain */}
                  {previewMode && (
                    <div 
                      className="p-3 rounded text-white text-sm font-medium text-center"
                      style={{ backgroundColor: domain.colorCode || DEFAULT_COLORS.domain }}
                    >
                      {domain.name}
                    </div>
                  )}
                </div>

                {/* Areas under this domain */}
                {areasByDomain[domain.id] && areasByDomain[domain.id].length > 0 && (
                  <div className="ml-4 space-y-3">
                    <div className="flex items-center space-x-2">
                      <div className="h-px bg-border flex-1"></div>
                      <Label className="text-sm text-muted-foreground">Data Areas</Label>
                      <div className="h-px bg-border flex-1"></div>
                    </div>
                    
                    <div className="grid gap-3 md:grid-cols-2">
                      {areasByDomain[domain.id].map((area: any) => (
                        <div key={area.id} className="space-y-3 p-3 border rounded-lg bg-muted/20">
                          <div className="flex items-center justify-between">
                            <div>
                              <Label className="font-medium">{area.name}</Label>
                              {area.description && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  {area.description}
                                </p>
                              )}
                            </div>
                            <Badge 
                              variant="outline" 
                              style={{ 
                                backgroundColor: `${area.colorCode}20`,
                                borderColor: area.colorCode,
                                color: area.colorCode 
                              }}
                            >
                              Area
                            </Badge>
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor={`area-color-${area.id}`}>Area Color</Label>
                            <div className="flex items-center space-x-2">
                              <Input
                                id={`area-color-${area.id}`}
                                type="color"
                                value={area.colorCode || DEFAULT_COLORS.area}
                                onChange={(e) => handleColorChange(area.id, 'area', e.target.value)}
                                className="w-12 h-8 p-1 cursor-pointer"
                              />
                              <Input
                                value={area.colorCode || DEFAULT_COLORS.area}
                                onChange={(e) => handleColorChange(area.id, 'area', e.target.value)}
                                placeholder="#ffffff"
                                className="flex-1 font-mono text-xs"
                              />
                            </div>
                            
                            {/* Preset colors for areas */}
                            <div className="flex flex-wrap gap-1 mt-2">
                              {PRESET_COLORS.map((color) => (
                                <button
                                  key={color}
                                  onClick={() => handleColorChange(area.id, 'area', color)}
                                  className="w-5 h-5 rounded border-2 border-gray-300 hover:border-gray-500 transition-colors"
                                  style={{ backgroundColor: color }}
                                  title={color}
                                />
                              ))}
                            </div>
                          </div>

                          {/* Live preview for area */}
                          {previewMode && (
                            <div 
                              className="p-2 rounded text-white text-xs font-medium text-center"
                              style={{ backgroundColor: area.colorCode || DEFAULT_COLORS.area }}
                            >
                              {area.name}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Color Usage Guidelines</CardTitle>
          <CardDescription>Best practices for color configuration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="font-medium mb-2">System Colors</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Use distinct colors for different system types</li>
                <li>• Consider using cooler colors (blues/greens) for sources</li>
                <li>• Use warmer colors (reds/oranges) for targets</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Domain Colors</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Use consistent color families for related domains</li>
                <li>• Ensure sufficient contrast for readability</li>
                <li>• Consider organizational color schemes</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}