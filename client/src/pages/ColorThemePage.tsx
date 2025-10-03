import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import SmartColorPaletteGenerator from '@/components/SmartColorPaletteGenerator';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Save, Eye, Download } from 'lucide-react';
import { Link } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { ColorPalette } from '@/lib/colorPaletteGenerator';

export default function ColorThemePage() {
  const [appliedTheme, setAppliedTheme] = useState<ColorPalette | null>(null);
  const { toast } = useToast();

  // Fetch current domains and systems for context-aware suggestions
  const { data: domains = [] } = useQuery({
    queryKey: ['/api/domains'],
  });

  const { data: sources = [] } = useQuery({
    queryKey: ['/api/sources'],
  });

  const handleThemeApply = (theme: ColorPalette) => {
    setAppliedTheme(theme);
    
    // Apply CSS custom properties to the document root
    const root = document.documentElement;
    Object.entries(theme).forEach(([key, value]) => {
      const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      root.style.setProperty(`--color-${cssKey}`, value);
    });

    toast({
      title: "Theme Applied Successfully",
      description: "Your custom color theme is now active across the application"
    });
  };

  const saveThemeConfiguration = () => {
    if (!appliedTheme) return;
    
    // In a real application, this would save to the database
    localStorage.setItem('user-color-theme', JSON.stringify(appliedTheme));
    
    toast({
      title: "Theme Saved",
      description: "Your color theme configuration has been saved"
    });
  };

  const previewWithCurrentModel = () => {
    // Navigate to modeler with theme applied
    window.location.href = '/modeler';
  };

  const domainNames = (domains as any[]).map((domain: any) => domain.name);
  const systemNames = (sources as any[]).map((source: any) => source.name);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-4">
            <Link href="/modeler">
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Color Theme Designer</h1>
              <p className="text-sm text-gray-600">Create and customize color themes for your data models</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {appliedTheme && (
              <>
                <Button 
                  onClick={previewWithCurrentModel}
                  variant="outline" 
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  Preview in Modeler
                </Button>
                <Button 
                  onClick={saveThemeConfiguration}
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Save Theme
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Theme Preview */}
      {appliedTheme && (
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="max-w-6xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div 
                    className="w-6 h-6 rounded-full border-2 border-white shadow-sm"
                    style={{ backgroundColor: appliedTheme.primary }}
                  />
                  Applied Theme Preview
                </CardTitle>
                <CardDescription>
                  This theme is now active. You can see how it looks in your data models.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(appliedTheme).slice(0, 8).map(([key, color]) => (
                    <div key={key} className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded border border-gray-200"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-sm text-gray-600">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="px-6 py-8">
        <SmartColorPaletteGenerator
          onThemeApply={handleThemeApply}
          currentDomains={domainNames}
          currentSystems={systemNames}
        />
      </div>

      {/* Feature Information */}
      <div className="bg-white border-t border-gray-200 px-6 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Smart Color Generation</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">
                  Generate harmonious color palettes using advanced color theory algorithms. 
                  Create professional themes that ensure visual consistency across your data models.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Domain-Specific Colors</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">
                  Get color suggestions optimized for specific business domains like finance, 
                  healthcare, and manufacturing. Colors are chosen based on industry standards and psychology.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Accessibility & Export</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">
                  All generated themes meet accessibility standards for contrast ratios. 
                  Export your themes as CSS variables for use in other applications.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}