import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { 
  Palette, 
  Wand2, 
  Copy, 
  Check, 
  Eye, 
  Shuffle, 
  Download, 
  Upload,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  ColorPalette,
  ColorTheme,
  ColorHarmony,
  PROFESSIONAL_THEMES,
  generatePaletteFromBase,
  generateColorHarmonies,
  analyzeColorAccessibility,
  generateThemeVariations,
  suggestColorsForDomain,
  exportThemeToCSS,
  generateEntityColors
} from '@/lib/colorPaletteGenerator';

interface SmartColorPaletteGeneratorProps {
  onThemeApply: (theme: ColorPalette) => void;
  currentDomains?: string[];
  currentSystems?: string[];
}

export default function SmartColorPaletteGenerator({ 
  onThemeApply, 
  currentDomains = [],
  currentSystems = []
}: SmartColorPaletteGeneratorProps) {
  const [selectedTheme, setSelectedTheme] = useState<ColorTheme>(PROFESSIONAL_THEMES[0]);
  const [customBaseColor, setCustomBaseColor] = useState('#2563eb');
  const [colorHarmonies, setColorHarmonies] = useState<ColorHarmony[]>([]);
  const [customPalette, setCustomPalette] = useState<ColorPalette | null>(null);
  const [copiedColor, setCopiedColor] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<'light' | 'dark'>('light');
  const [activeTab, setActiveTab] = useState('themes');
  const [selectedDomain, setSelectedDomain] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    setColorHarmonies(generateColorHarmonies(customBaseColor));
    setCustomPalette(generatePaletteFromBase(customBaseColor));
  }, [customBaseColor]);

  const handleColorCopy = async (color: string) => {
    try {
      await navigator.clipboard.writeText(color);
      setCopiedColor(color);
      setTimeout(() => setCopiedColor(null), 2000);
      toast({
        title: "Color Copied",
        description: `${color} copied to clipboard`
      });
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Could not copy color to clipboard",
        variant: "destructive"
      });
    }
  };

  const generateRandomTheme = () => {
    const randomColor = `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`;
    setCustomBaseColor(randomColor);
    toast({
      title: "Random Theme Generated",
      description: "Generated a new random color theme"
    });
  };

  const applyTheme = (palette: ColorPalette) => {
    onThemeApply(palette);
    toast({
      title: "Theme Applied",
      description: "Color theme has been applied to your data model"
    });
  };

  const generateDomainSuggestions = () => {
    if (!selectedDomain) return;
    const suggestions = suggestColorsForDomain(selectedDomain);
    if (suggestions.length > 0) {
      setSelectedTheme(suggestions[0]);
      toast({
        title: "Domain Colors Generated",
        description: `Generated optimized colors for ${selectedDomain}`
      });
    }
  };

  const exportTheme = () => {
    const currentPalette = customPalette || selectedTheme.palette;
    const cssVars = exportThemeToCSS(currentPalette);
    const fullCSS = `:root {\n${cssVars}\n}`;
    
    handleColorCopy(fullCSS);
    toast({
      title: "Theme Exported",
      description: "CSS variables copied to clipboard"
    });
  };

  const ColorSwatch = ({ 
    color, 
    label, 
    size = 'md' 
  }: { 
    color: string; 
    label: string; 
    size?: 'sm' | 'md' | 'lg' 
  }) => {
    const sizeClasses = {
      sm: 'w-8 h-8',
      md: 'w-12 h-12',
      lg: 'w-16 h-16'
    };

    return (
      <div className="flex flex-col items-center gap-2">
        <button
          onClick={() => handleColorCopy(color)}
          className={`${sizeClasses[size]} rounded-lg border-2 border-gray-200 hover:border-gray-300 transition-all duration-200 hover:scale-105 relative overflow-hidden group`}
          style={{ backgroundColor: color }}
        >
          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-opacity duration-200 flex items-center justify-center">
            {copiedColor === color ? (
              <Check className="w-4 h-4 text-white" />
            ) : (
              <Copy className="w-3 h-3 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
            )}
          </div>
        </button>
        <span className="text-xs font-medium text-gray-600">{label}</span>
        <code className="text-xs text-gray-500 font-mono">{color}</code>
      </div>
    );
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
          <Palette className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Smart Color Palette Generator</h1>
          <p className="text-gray-600">Create professional color themes for your data models</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="themes" className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Themes
          </TabsTrigger>
          <TabsTrigger value="custom" className="flex items-center gap-2">
            <Wand2 className="w-4 h-4" />
            Custom
          </TabsTrigger>
          <TabsTrigger value="harmonies" className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Harmonies
          </TabsTrigger>
          <TabsTrigger value="domain" className="flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Domain-Based
          </TabsTrigger>
        </TabsList>

        <TabsContent value="themes" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Professional Themes</CardTitle>
              <CardDescription>
                Pre-designed color themes optimized for data modeling applications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {PROFESSIONAL_THEMES.map((theme) => (
                  <Card 
                    key={theme.id} 
                    className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
                      selectedTheme.id === theme.id ? 'ring-2 ring-blue-500' : ''
                    }`}
                    onClick={() => setSelectedTheme(theme)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div 
                          className="w-8 h-8 rounded-full border-2 border-white shadow-sm"
                          style={{ backgroundColor: theme.baseColor }}
                        />
                        <div>
                          <h3 className="font-semibold text-sm">{theme.name}</h3>
                          <Badge variant="outline" className="text-xs">
                            {theme.category}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-xs text-gray-600 mb-3">{theme.description}</p>
                      <div className="flex gap-1">
                        {Object.entries(theme.palette).slice(0, 6).map(([key, color]) => (
                          <div
                            key={key}
                            className="w-6 h-6 rounded border border-gray-200"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              <div className="mt-6 flex justify-center">
                <Button 
                  onClick={() => applyTheme(selectedTheme.palette)}
                  className="flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  Apply Selected Theme
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="custom" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Custom Palette Generator</CardTitle>
              <CardDescription>
                Create a custom color palette from any base color
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label htmlFor="base-color">Base Color</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      id="base-color"
                      type="color"
                      value={customBaseColor}
                      onChange={(e) => setCustomBaseColor(e.target.value)}
                      className="w-16 h-10 p-1 border-2"
                    />
                    <Input
                      type="text"
                      value={customBaseColor}
                      onChange={(e) => setCustomBaseColor(e.target.value)}
                      placeholder="#2563eb"
                      className="flex-1"
                    />
                  </div>
                </div>
                <Button 
                  onClick={generateRandomTheme}
                  variant="outline"
                  className="flex items-center gap-2 mt-6"
                >
                  <Shuffle className="w-4 h-4" />
                  Random
                </Button>
              </div>

              {customPalette && (
                <div className="space-y-4">
                  <h3 className="font-semibold">Generated Palette</h3>
                  <div className="grid grid-cols-4 md:grid-cols-8 gap-4">
                    {Object.entries(customPalette).map(([key, color]) => (
                      <ColorSwatch
                        key={key}
                        color={color}
                        label={key.replace(/([A-Z])/g, ' $1').trim()}
                      />
                    ))}
                  </div>
                  
                  <div className="flex gap-2 mt-4">
                    <Button 
                      onClick={() => applyTheme(customPalette)}
                      className="flex items-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      Apply Custom Theme
                    </Button>
                    <Button 
                      onClick={exportTheme}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Export CSS
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="harmonies" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Color Harmonies</CardTitle>
              <CardDescription>
                Explore different color harmony rules based on color theory
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {colorHarmonies.map((harmony) => (
                  <div key={harmony.name} className="space-y-3">
                    <div>
                      <h3 className="font-semibold">{harmony.name}</h3>
                      <p className="text-sm text-gray-600">{harmony.description}</p>
                    </div>
                    <div className="flex gap-2">
                      {harmony.colors.map((color, index) => (
                        <ColorSwatch
                          key={index}
                          color={color}
                          label={`Color ${index + 1}`}
                          size="md"
                        />
                      ))}
                      <Button
                        onClick={() => {
                          const newPalette = generatePaletteFromBase(harmony.colors[0]);
                          setCustomPalette(newPalette);
                          setCustomBaseColor(harmony.colors[0]);
                        }}
                        variant="outline"
                        size="sm"
                        className="ml-2"
                      >
                        Use as Base
                      </Button>
                    </div>
                    <Separator />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="domain" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Domain-Based Colors</CardTitle>
              <CardDescription>
                Generate colors optimized for specific business domains
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <Label htmlFor="domain-select">Business Domain</Label>
                  <Select value={selectedDomain} onValueChange={setSelectedDomain}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a business domain" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="finance">Finance</SelectItem>
                      <SelectItem value="healthcare">Healthcare</SelectItem>
                      <SelectItem value="manufacturing">Manufacturing</SelectItem>
                      <SelectItem value="retail">Retail</SelectItem>
                      <SelectItem value="technology">Technology</SelectItem>
                      <SelectItem value="education">Education</SelectItem>
                      <SelectItem value="government">Government</SelectItem>
                      <SelectItem value="nonprofit">Non-Profit</SelectItem>
                      {currentDomains.map(domain => (
                        <SelectItem key={domain} value={domain.toLowerCase()}>
                          {domain}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  onClick={generateDomainSuggestions}
                  disabled={!selectedDomain}
                  className="flex items-center gap-2 mt-6"
                >
                  <Wand2 className="w-4 h-4" />
                  Generate
                </Button>
              </div>

              {selectedDomain && (
                <div className="mt-6">
                  <h3 className="font-semibold mb-4">Suggested Colors for {selectedDomain}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {suggestColorsForDomain(selectedDomain).map((theme, index) => (
                      <Card key={index} className="cursor-pointer hover:shadow-md transition-shadow duration-200">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3 mb-3">
                            <div 
                              className="w-8 h-8 rounded-full border-2 border-white shadow-sm"
                              style={{ backgroundColor: theme.baseColor }}
                            />
                            <div>
                              <h4 className="font-medium text-sm">{theme.name}</h4>
                            </div>
                          </div>
                          <div className="flex gap-1 mb-3">
                            {Object.values(theme.palette).slice(0, 6).map((color, colorIndex) => (
                              <div
                                key={colorIndex}
                                className="w-6 h-6 rounded border border-gray-200"
                                style={{ backgroundColor: color }}
                              />
                            ))}
                          </div>
                          <Button 
                            onClick={() => applyTheme(theme.palette)}
                            size="sm"
                            className="w-full"
                          >
                            Apply Theme
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}