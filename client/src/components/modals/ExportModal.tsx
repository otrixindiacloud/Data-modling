import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useModelerStore } from "@/store/modelerStore";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Download, Settings, FileText, Image, FileImage, Palette } from "lucide-react";
import { pdfExportService } from "@/services/pdfExportService";
import { svgExportService } from "@/services/svgExportService";
import TemplateSelector from "@/components/export/TemplateSelector";
import { type ExportTemplate } from "@/templates/exportTemplates";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export default function ExportModal() {
  const { showExportModal, setShowExportModal, currentModel } = useModelerStore();
  const { toast } = useToast();
  
  const [options, setOptions] = useState({
    format: "json" as "json" | "sql_ddl" | "quicksql" | "png" | "pdf" | "svg" | "pdf_report" | "pdf_diagram" | "csv" | "md" | "yaml" | "excel",
    layer: "all" as "all" | "conceptual" | "logical" | "physical",
    includePrimaryKeys: true,
    includeForeignKeys: true,
    includeConstraints: true,
    includeMetadata: true,
    includeDescriptions: true,
    includeLegend: true,
    includeTitle: true,
    includeTimestamp: true,
    pageSize: "A4" as "A4" | "A3" | "Letter" | "Legal",
    orientation: "portrait" as "portrait" | "landscape",
    quality: "standard" as "draft" | "standard" | "high",
    theme: "light" as "light" | "dark" | "auto",
    style: "professional" as "minimal" | "detailed" | "professional",
    watermark: "",
    headerText: "",
    footerText: ""
  });
  
  const [exportResult, setExportResult] = useState<string>("");
  const [isExporting, setIsExporting] = useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);

  const mutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/export", data),
    onSuccess: async (response: Response) => {
      const data = await response.json();
      setExportResult(data.data);
      toast({
        title: "Success",
        description: "Model exported successfully"
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to export model",
        variant: "destructive"
      });
    }
  });

  const handleExport = async () => {
    if (!currentModel) {
      toast({
        title: "Error",
        description: "No model selected",
        variant: "destructive"
      });
      return;
    }
    
    console.log('Starting export...', { 
      model: currentModel.name, 
      format: options.format, 
      options 
    });
    
    setIsExporting(true);
    
    try {
        // Handle different export formats
        if (["png", "pdf", "svg"].includes(options.format)) {
          console.log('Using client-side export...');
          await handleClientSideExport();
    } else {
          console.log('Using server-side export...');
          // Handle text-based exports (JSON, SQL, etc.)
      mutation.mutate({
        modelId: currentModel.id,
        options
      });
        }
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Error",
        description: `Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleClientSideExport = async () => {
    if (!currentModel) {
      throw new Error("No model selected");
    }

    // Fetch model data
    let modelData;
    try {
      modelData = await fetchModelData();
    } catch (error) {
      console.warn("Failed to fetch model data, using fallback:", error);
      // Create fallback data structure
      modelData = {
        objects: [],
        attributes: [],
        relationships: []
      };
    }

    if (!modelData) {
      throw new Error("Failed to fetch model data");
    }

    let result;
    
    if (options.format === "svg") {
      result = await svgExportService.exportToSVG(
        currentModel,
        modelData.objects,
        modelData.attributes,
        modelData.relationships,
        {
          format: "svg_vector",
          layer: options.layer,
          includePrimaryKeys: options.includePrimaryKeys,
          includeForeignKeys: options.includeForeignKeys,
          includeConstraints: options.includeConstraints,
          includeMetadata: options.includeMetadata,
          includeDescriptions: options.includeDescriptions,
          includeLegend: options.includeLegend,
          includeTitle: options.includeTitle,
          includeTimestamp: options.includeTimestamp,
          theme: options.theme,
          style: options.style
        }
      );
    } else {
      result = await pdfExportService.exportToPDF(
        currentModel,
        modelData.objects,
        modelData.attributes,
        modelData.relationships,
        {
          format: options.format as "pdf" | "png",
          layer: options.layer,
          includePrimaryKeys: options.includePrimaryKeys,
          includeForeignKeys: options.includeForeignKeys,
          includeConstraints: options.includeConstraints,
          includeMetadata: options.includeMetadata,
          includeDescriptions: options.includeDescriptions,
          includeLegend: options.includeLegend,
          includeTitle: options.includeTitle,
          includeTimestamp: options.includeTimestamp,
          pageSize: options.pageSize,
          orientation: options.orientation,
          quality: options.quality,
          theme: options.theme,
          style: options.style,
          watermark: options.watermark,
          headerText: options.headerText,
          footerText: options.footerText
        }
      );
    }

    if (result.success) {
      if (options.format === "svg") {
        await svgExportService.downloadFile(result);
      } else {
        await pdfExportService.downloadFile(result);
      }
      toast({
        title: "Success",
        description: `${options.format.toUpperCase()} exported successfully`
      });
    } else {
      throw new Error(result.error || 'Export failed');
    }
  };


  const fetchModelData = async () => {
    if (!currentModel) return null;

    try {
      console.log('Fetching model data for model:', currentModel.id);
      
      const [objectsRes, relationshipsRes] = await Promise.all([
        fetch(`/api/models/${currentModel.id}/objects`),
        fetch(`/api/models/${currentModel.id}/relationships`)
      ]);

      if (!objectsRes.ok) {
        throw new Error(`Failed to fetch objects: ${objectsRes.status}`);
      }
      if (!relationshipsRes.ok) {
        throw new Error(`Failed to fetch relationships: ${relationshipsRes.status}`);
      }

      const [objects, relationships] = await Promise.all([
        objectsRes.json(),
        relationshipsRes.json()
      ]);

      // Fetch attributes for all objects
      const allAttributes = [];
      for (const obj of objects) {
        try {
          const attrsRes = await fetch(`/api/objects/${obj.id}/attributes`);
          if (attrsRes.ok) {
            const attrs = await attrsRes.json();
            allAttributes.push(...attrs);
          }
        } catch (error) {
          console.warn(`Failed to fetch attributes for object ${obj.id}:`, error);
        }
      }

      console.log('Model data fetched successfully:', {
        objects: objects.length,
        attributes: allAttributes.length,
        relationships: relationships.length
      });

      return { objects, attributes: allAttributes, relationships };
    } catch (error) {
      console.error("Failed to fetch model data:", error);
      throw error; // Re-throw to be caught by the calling function
    }
  };

  const handleImageExport = async () => {
    try {
      // Try multiple selectors to find the canvas
      let canvasElement = document.querySelector('.react-flow') as HTMLElement;
      
      if (!canvasElement) {
        canvasElement = document.querySelector('[data-testid="react-flow"]') as HTMLElement;
      }
      
      if (!canvasElement) {
        canvasElement = document.querySelector('.react-flow__renderer') as HTMLElement;
      }
      
      if (!canvasElement) {
        // Try to find any element with react-flow classes
        canvasElement = document.querySelector('[class*="react-flow"]') as HTMLElement;
      }

      if (!canvasElement) {
        // Try to find the main content area as a last resort
        canvasElement = document.querySelector('main') as HTMLElement;
      }

      if (!canvasElement) {
        // Try to find the body as absolute last resort
        canvasElement = document.body;
      }

      if (!canvasElement) {
        toast({
          title: "Error",
          description: "Canvas not found. Please ensure the model is loaded and visible.",
          variant: "destructive"
        });
        return;
      }

      console.log("Found canvas element:", canvasElement);
      console.log("Canvas dimensions:", {
        width: canvasElement.offsetWidth,
        height: canvasElement.offsetHeight,
        scrollWidth: canvasElement.scrollWidth,
        scrollHeight: canvasElement.scrollHeight
      });

      if (options.format === "png") {
        const canvas = await html2canvas(canvasElement, {
          backgroundColor: '#ffffff',
          scale: 2,
          useCORS: true,
          allowTaint: true,
          logging: false
        });
        
        const link = document.createElement('a');
        link.download = `${currentModel?.name || "model"}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        
        toast({
          title: "Success",
          description: "PNG exported successfully"
        });
        
      } else if (options.format === "pdf") {
        const canvas = await html2canvas(canvasElement, {
          backgroundColor: '#ffffff',
          scale: 2,
          useCORS: true,
          allowTaint: true,
          logging: false
        });
        
        // Calculate PDF dimensions
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;
        
        // Use A4 dimensions as base, but scale to fit content
        const pdfWidth = 210; // A4 width in mm
        const pdfHeight = 297; // A4 height in mm
        
        // Calculate scaling to fit image in PDF
        const scaleX = pdfWidth / imgWidth;
        const scaleY = pdfHeight / imgHeight;
        const scale = Math.min(scaleX, scaleY);
        
        const scaledWidth = imgWidth * scale;
        const scaledHeight = imgHeight * scale;
        
        const pdf = new jsPDF({
          orientation: imgWidth > imgHeight ? 'landscape' : 'portrait',
          unit: 'mm',
          format: 'a4'
        });
        
        // Center the image on the page
        const x = (pdfWidth - scaledWidth) / 2;
        const y = (pdfHeight - scaledHeight) / 2;
        
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', x, y, scaledWidth, scaledHeight);
        pdf.save(`${currentModel?.name || "model"}.pdf`);
        
        toast({
          title: "Success",
          description: "PDF exported successfully"
        });
        
      } else if (options.format === "svg") {
        // For SVG, we need to export the actual SVG content
        const svgElement = canvasElement.querySelector('svg');
        if (svgElement) {
          const serializer = new XMLSerializer();
          const svgString = serializer.serializeToString(svgElement);
          const blob = new Blob([svgString], { type: 'image/svg+xml' });
          const url = URL.createObjectURL(blob);
          
          const link = document.createElement('a');
          link.download = `${currentModel?.name || "model"}.svg`;
          link.href = url;
          link.click();
          
          URL.revokeObjectURL(url);
          
          toast({
            title: "Success",
            description: "SVG exported successfully"
          });
        } else {
          toast({
            title: "Error",
            description: "SVG element not found in canvas",
            variant: "destructive"
          });
        }
      }
      
    } catch (error) {
      console.error("Export error:", error);
      setIsExporting(false);
      toast({
        title: "Error",
        description: `Failed to export ${options.format.toUpperCase()}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      });
    }
  };

  const handleDownload = () => {
    const blob = new Blob([exportResult], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    
    let extension: string = options.format;
    if (options.format === "sql_ddl") extension = "sql";
    else if (options.format === "quicksql") extension = "sql";
    else if (options.format === "csv") extension = "csv";
    else if (options.format === "excel") extension = "xlsx";
    else if (options.format === "md") extension = "md";
    else if (options.format === "yaml") extension = "yaml";
    
    a.href = url;
    a.download = `${currentModel?.name || "model"}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const resetModal = () => {
    setExportResult("");
    setIsExporting(false);
    setShowTemplateSelector(false);
    setShowExportModal(false);
  };

  const handleTemplateSelect = (template: ExportTemplate) => {
    setOptions(prev => ({
      ...prev,
      format: template.format as any,
      ...template.options
    }));
    setShowTemplateSelector(false);
  };


  // Debug function to test API endpoints
  const testAPIEndpoints = async () => {
    if (!currentModel) {
      console.log("No model selected for API test");
      return;
    }

    console.log("Testing API endpoints for model:", currentModel.id);
    
    try {
      // Test objects endpoint
      const objectsRes = await fetch(`/api/models/${currentModel.id}/objects`);
      console.log("Objects endpoint status:", objectsRes.status);
      if (objectsRes.ok) {
        const objects = await objectsRes.json();
        console.log("Objects fetched:", objects.length);
      }

      // Test relationships endpoint
      const relationshipsRes = await fetch(`/api/models/${currentModel.id}/relationships`);
      console.log("Relationships endpoint status:", relationshipsRes.status);
      if (relationshipsRes.ok) {
        const relationships = await relationshipsRes.json();
        console.log("Relationships fetched:", relationships.length);
      }

    } catch (error) {
      console.error("API test failed:", error);
    }
  };

  return (
    <Dialog open={showExportModal} onOpenChange={resetModal}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Export Model</DialogTitle>
          <DialogDescription>
            Export your data model in various formats for documentation or implementation.
          </DialogDescription>
        </DialogHeader>
        
        {!exportResult ? (
          showTemplateSelector ? (
            <TemplateSelector 
              onSelectTemplate={handleTemplateSelect}
              onClose={() => setShowTemplateSelector(false)}
            />
          ) : (
          <div className="space-y-4">
              <div className="flex items-center justify-between">
              <Label htmlFor="format">Export Format</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowTemplateSelector(true)}
                  className="flex items-center space-x-2"
                >
                  <Palette className="w-4 h-4" />
                  <span>Use Template</span>
                </Button>
              </div>
              
              <Select value={options.format} onValueChange={(value: any) => setOptions({ ...options, format: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="json">
                    <div className="flex items-center">
                      <FileText className="w-4 h-4 mr-2" />
                      JSON
                    </div>
                  </SelectItem>
                  <SelectItem value="sql_ddl">
                    <div className="flex items-center">
                      <FileText className="w-4 h-4 mr-2" />
                      SQL DDL
                    </div>
                  </SelectItem>
                  <SelectItem value="quicksql">
                    <div className="flex items-center">
                      <FileText className="w-4 h-4 mr-2" />
                      QuickSQL (Oracle)
                    </div>
                  </SelectItem>
                  <SelectItem value="png">
                    <div className="flex items-center">
                      <Image className="w-4 h-4 mr-2" />
                      PNG Image
                    </div>
                  </SelectItem>
                  <SelectItem value="pdf">
                    <div className="flex items-center">
                      <FileImage className="w-4 h-4 mr-2" />
                      PDF Document
                    </div>
                  </SelectItem>
                  <SelectItem value="svg">
                    <div className="flex items-center">
                      <Image className="w-4 h-4 mr-2" />
                      SVG Vector
                    </div>
                  </SelectItem>
                  <SelectItem value="csv">
                    <div className="flex items-center">
                      <FileText className="w-4 h-4 mr-2" />
                      CSV Spreadsheet
                    </div>
                  </SelectItem>
                  <SelectItem value="excel">
                    <div className="flex items-center">
                      <FileText className="w-4 h-4 mr-2" />
                      Excel Workbook
                    </div>
                  </SelectItem>
                  <SelectItem value="md">
                    <div className="flex items-center">
                      <FileText className="w-4 h-4 mr-2" />
                      Markdown Documentation
                    </div>
                  </SelectItem>
                  <SelectItem value="yaml">
                    <div className="flex items-center">
                      <FileText className="w-4 h-4 mr-2" />
                      YAML Data
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>

            
            {/* Hide text-based options for image formats */}
            {!["png", "pdf", "svg"].includes(options.format) && (
              <>
                <div>
                  <Label htmlFor="layer">Layer</Label>
                  <Select value={options.layer} onValueChange={(value: any) => setOptions({ ...options, layer: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Layers</SelectItem>
                      <SelectItem value="conceptual">Conceptual Only</SelectItem>
                      <SelectItem value="logical">Logical Only</SelectItem>
                      <SelectItem value="physical">Physical Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-3">
                  <Label>Options</Label>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="primaryKeys"
                      checked={options.includePrimaryKeys}
                      onCheckedChange={(checked) => setOptions({ ...options, includePrimaryKeys: !!checked })}
                    />
                    <Label htmlFor="primaryKeys">Include Primary Keys</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="foreignKeys"
                      checked={options.includeForeignKeys}
                      onCheckedChange={(checked) => setOptions({ ...options, includeForeignKeys: !!checked })}
                    />
                    <Label htmlFor="foreignKeys">Include Foreign Keys</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="constraints"
                      checked={options.includeConstraints}
                      onCheckedChange={(checked) => setOptions({ ...options, includeConstraints: !!checked })}
                    />
                    <Label htmlFor="constraints">Include Constraints</Label>
                  </div>
                </div>
              </>
            )}
            
            {/* Advanced options for PDF and SVG exports */}
            {["png", "pdf", "svg", "pdf_report", "pdf_diagram"].includes(options.format) && (
              <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Settings className="w-4 h-4" />
                  <Label className="font-semibold">Advanced Options</Label>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="pageSize">Page Size</Label>
                    <Select value={options.pageSize} onValueChange={(value: any) => setOptions({ ...options, pageSize: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A4">A4</SelectItem>
                        <SelectItem value="A3">A3</SelectItem>
                        <SelectItem value="Letter">Letter</SelectItem>
                        <SelectItem value="Legal">Legal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="orientation">Orientation</Label>
                    <Select value={options.orientation} onValueChange={(value: any) => setOptions({ ...options, orientation: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="portrait">Portrait</SelectItem>
                        <SelectItem value="landscape">Landscape</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="quality">Quality</Label>
                    <Select value={options.quality} onValueChange={(value: any) => setOptions({ ...options, quality: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="theme">Theme</Label>
                    <Select value={options.theme} onValueChange={(value: any) => setOptions({ ...options, theme: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                        <SelectItem value="auto">Auto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <Label>Content Options</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="includeTitle"
                        checked={options.includeTitle}
                        onCheckedChange={(checked) => setOptions({ ...options, includeTitle: !!checked })}
                      />
                      <Label htmlFor="includeTitle" className="text-sm">Include Title</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="includeLegend"
                        checked={options.includeLegend}
                        onCheckedChange={(checked) => setOptions({ ...options, includeLegend: !!checked })}
                      />
                      <Label htmlFor="includeLegend" className="text-sm">Include Legend</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="includeMetadata"
                        checked={options.includeMetadata}
                        onCheckedChange={(checked) => setOptions({ ...options, includeMetadata: !!checked })}
                      />
                      <Label htmlFor="includeMetadata" className="text-sm">Include Metadata</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="includeTimestamp"
                        checked={options.includeTimestamp}
                        onCheckedChange={(checked) => setOptions({ ...options, includeTimestamp: !!checked })}
                      />
                      <Label htmlFor="includeTimestamp" className="text-sm">Include Timestamp</Label>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <Label htmlFor="watermark">Watermark (optional)</Label>
                  <Input
                    id="watermark"
                    value={options.watermark}
                    onChange={(e) => setOptions({ ...options, watermark: e.target.value })}
                    placeholder="Enter watermark text"
                  />
                </div>
                
                <div className="space-y-3">
                  <Label htmlFor="headerText">Header Text (optional)</Label>
                  <Input
                    id="headerText"
                    value={options.headerText}
                    onChange={(e) => setOptions({ ...options, headerText: e.target.value })}
                    placeholder="Enter header text"
                  />
                </div>
                
                <div className="space-y-3">
                  <Label htmlFor="footerText">Footer Text (optional)</Label>
                  <Input
                    id="footerText"
                    value={options.footerText}
                    onChange={(e) => setOptions({ ...options, footerText: e.target.value })}
                    placeholder="Enter footer text"
                  />
                </div>
              </div>
            )}
            
            <div className="flex justify-between">
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={testAPIEndpoints}
                className="text-xs"
              >
                Test API
              </Button>
              <div className="flex space-x-2">
              <Button type="button" variant="outline" onClick={resetModal}>
                Cancel
              </Button>
                <Button onClick={handleExport} disabled={mutation.isPending || isExporting}>
                  {mutation.isPending || isExporting ? "Exporting..." : "Export"}
              </Button>
              </div>
            </div>
          </div>
          )
        ) : (
          <div className="space-y-4">
            <div>
              <Label>Export Result</Label>
              <Textarea
                value={exportResult}
                readOnly
                className="h-64 font-mono text-sm"
              />
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={resetModal}>
                Close
              </Button>
              <Button onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}