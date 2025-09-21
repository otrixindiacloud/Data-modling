import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { exportTemplates, getTemplatesByCategory, getTemplatesByFormat, type ExportTemplate } from '@/templates/exportTemplates';
import { FileText, Image, Palette, Search, X } from 'lucide-react';

interface TemplateSelectorProps {
  onSelectTemplate: (template: ExportTemplate) => void;
  onClose: () => void;
}

export default function TemplateSelector({ onSelectTemplate, onClose }: TemplateSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedFormat, setSelectedFormat] = useState('all');

  const categories = [
    { value: 'all', label: 'All Categories' },
    { value: 'documentation', label: 'Documentation' },
    { value: 'presentation', label: 'Presentation' },
    { value: 'technical', label: 'Technical' },
    { value: 'minimal', label: 'Minimal' }
  ];

  const formats = [
    { value: 'all', label: 'All Formats' },
    { value: 'pdf', label: 'PDF' },
    { value: 'svg', label: 'SVG' },
    { value: 'png', label: 'PNG' }
  ];

  const filteredTemplates = exportTemplates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    const matchesFormat = selectedFormat === 'all' || template.format === selectedFormat;
    
    return matchesSearch && matchesCategory && matchesFormat;
  });

  const getFormatIcon = (format: string) => {
    switch (format) {
      case 'pdf':
        return <FileText className="w-4 h-4" />;
      case 'svg':
      case 'png':
        return <Image className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'documentation':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'presentation':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'technical':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'minimal':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Choose Export Template</h3>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search templates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="category">Category</Label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map(category => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="format">Format</Label>
            <Select value={selectedFormat} onValueChange={setSelectedFormat}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {formats.map(format => (
                  <SelectItem key={format.value} value={format.value}>
                    {format.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {filteredTemplates.map(template => (
          <Card 
            key={template.id} 
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => onSelectTemplate(template)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2">
                  {getFormatIcon(template.format)}
                  <CardTitle className="text-base">{template.name}</CardTitle>
                </div>
                <Badge className={getCategoryColor(template.category)}>
                  {template.category}
                </Badge>
              </div>
              <CardDescription className="text-sm">
                {template.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Format: {template.format.toUpperCase()}</span>
                  <span>Style: {template.options.style}</span>
                </div>
                
                <div className="flex flex-wrap gap-1">
                  {template.options.includeTitle && (
                    <Badge variant="outline" className="text-xs">Title</Badge>
                  )}
                  {template.options.includeMetadata && (
                    <Badge variant="outline" className="text-xs">Metadata</Badge>
                  )}
                  {template.options.includeDescriptions && (
                    <Badge variant="outline" className="text-xs">Descriptions</Badge>
                  )}
                  {template.options.includeLegend && (
                    <Badge variant="outline" className="text-xs">Legend</Badge>
                  )}
                  {template.options.includePrimaryKeys && (
                    <Badge variant="outline" className="text-xs">Primary Keys</Badge>
                  )}
                  {template.options.includeForeignKeys && (
                    <Badge variant="outline" className="text-xs">Foreign Keys</Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Palette className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No templates found matching your criteria.</p>
          <p className="text-sm">Try adjusting your search or filters.</p>
        </div>
      )}

      <div className="flex justify-end space-x-2 pt-4 border-t">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={() => onSelectTemplate(exportTemplates[0])}>
          Use Default Template
        </Button>
      </div>
    </div>
  );
}
