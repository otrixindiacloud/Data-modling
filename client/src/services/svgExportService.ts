import { DataModel, DataObject, Attribute, DataModelObjectRelationship } from '@shared/schema';

export interface SVGExportOptions {
  format: 'svg_vector' | 'svg_image';
  layer: 'all' | 'conceptual' | 'logical' | 'physical';
  includePrimaryKeys: boolean;
  includeForeignKeys: boolean;
  includeConstraints: boolean;
  includeMetadata: boolean;
  includeDescriptions: boolean;
  includeLegend: boolean;
  includeTitle: boolean;
  includeTimestamp: boolean;
  theme: 'light' | 'dark' | 'auto';
  style: 'minimal' | 'detailed' | 'professional';
  width?: number;
  height?: number;
  backgroundColor?: string;
  nodeColor?: string;
  edgeColor?: string;
  textColor?: string;
}

export interface ExportResult {
  success: boolean;
  data?: string | Blob;
  error?: string;
  filename?: string;
}

export class SVGExportService {
  async exportToSVG(
    model: DataModel,
    objects: DataObject[],
    attributes: Attribute[],
  relationships: DataModelObjectRelationship[],
    options: SVGExportOptions
  ): Promise<ExportResult> {
    try {
      // Try to capture the canvas first
      const canvasResult = await this.captureCanvas(options);
      if (canvasResult.success && canvasResult.data) {
        // Convert canvas to SVG string
        const svgString = this.canvasToSVG(canvasResult.data as unknown as HTMLCanvasElement);
        return this.generateSVGFromCanvas(svgString, model, options);
      }

      // Fallback to programmatic SVG generation
      return this.generateProgrammaticSVG(model, objects, attributes, relationships, options);
    } catch (error) {
      console.error('SVG export error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  private canvasToSVG(canvas: HTMLCanvasElement): string {
    // Convert canvas to SVG by creating a simple SVG wrapper
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', canvas.width.toString());
    svg.setAttribute('height', canvas.height.toString());
    svg.setAttribute('viewBox', `0 0 ${canvas.width} ${canvas.height}`);
    
    // Create an image element with the canvas data
    const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    image.setAttribute('width', canvas.width.toString());
    image.setAttribute('height', canvas.height.toString());
    image.setAttribute('href', canvas.toDataURL());
    
    svg.appendChild(image);
    return new XMLSerializer().serializeToString(svg);
  }

  private async captureCanvas(options: SVGExportOptions): Promise<ExportResult> {
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
        canvasElement = document.querySelector('[class*="react-flow"]') as HTMLElement;
      }

      if (!canvasElement) {
        return {
          success: false,
          error: 'Canvas not found'
        };
      }

      // For SVG, we need to get the actual SVG element
      const svgElement = canvasElement.querySelector('svg');
      if (svgElement) {
        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(svgElement);
        
        return {
          success: true,
          data: svgString
        };
      }

      return {
        success: false,
        error: 'SVG element not found in canvas'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Canvas capture failed'
      };
    }
  }

  private generateSVGFromCanvas(
    svgString: string,
    model: DataModel,
    options: SVGExportOptions
  ): ExportResult {
    try {
      // Parse the SVG string and enhance it
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
      const svgElement = svgDoc.querySelector('svg');
      
      if (!svgElement) {
        throw new Error('Invalid SVG content');
      }

      // Add metadata and styling
      this.enhanceSVG(svgElement, model, options);

      const enhancedSVG = new XMLSerializer().serializeToString(svgElement);
      const filename = `${model.name}_${options.format}_${new Date().toISOString().split('T')[0]}.svg`;
      
      return {
        success: true,
        data: enhancedSVG,
        filename
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'SVG enhancement failed'
      };
    }
  }

  private generateProgrammaticSVG(
    model: DataModel,
    objects: DataObject[],
    attributes: Attribute[],
  relationships: DataModelObjectRelationship[],
    options: SVGExportOptions
  ): ExportResult {
    try {
      const width = options.width || 800;
      const height = options.height || 600;
      const margin = 50;
      const nodeWidth = 200;
      const nodeHeight = 100;
      const nodeSpacing = 250;

      // Calculate layout
      const cols = Math.ceil(Math.sqrt(objects.length));
      const rows = Math.ceil(objects.length / cols);

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', width.toString());
      svg.setAttribute('height', height.toString());
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

      // Add background
      const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      background.setAttribute('width', '100%');
      background.setAttribute('height', '100%');
      background.setAttribute('fill', this.getBackgroundColor(options));
      svg.appendChild(background);

      // Add title
      if (options.includeTitle) {
        const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        title.setAttribute('x', (width / 2).toString());
        title.setAttribute('y', '30');
        title.setAttribute('text-anchor', 'middle');
        title.setAttribute('font-family', 'Arial, sans-serif');
        title.setAttribute('font-size', '24');
        title.setAttribute('font-weight', 'bold');
        title.setAttribute('fill', this.getTextColor(options));
        title.textContent = model.name;
        svg.appendChild(title);
      }

      // Add metadata
      if (options.includeMetadata) {
        const metadata = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        metadata.setAttribute('x', '20');
        metadata.setAttribute('y', (height - 20).toString());
        metadata.setAttribute('font-family', 'Arial, sans-serif');
        metadata.setAttribute('font-size', '12');
        metadata.setAttribute('fill', this.getTextColor(options));
        metadata.textContent = `Layer: ${options.layer} | Generated: ${new Date().toLocaleString()}`;
        svg.appendChild(metadata);
      }

      // Add objects
      objects.forEach((obj, index) => {
        const row = Math.floor(index / cols);
        const col = index % cols;
        const x = margin + col * nodeSpacing;
        const y = margin + 60 + row * (nodeHeight + 50);

        // Create node rectangle
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', x.toString());
        rect.setAttribute('y', y.toString());
        rect.setAttribute('width', nodeWidth.toString());
        rect.setAttribute('height', nodeHeight.toString());
        rect.setAttribute('fill', this.getNodeColor(options));
        rect.setAttribute('stroke', this.getEdgeColor(options));
        rect.setAttribute('stroke-width', '2');
        rect.setAttribute('rx', '5');
        svg.appendChild(rect);

        // Add object name
        const nameText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        nameText.setAttribute('x', (x + nodeWidth / 2).toString());
        nameText.setAttribute('y', (y + 25).toString());
        nameText.setAttribute('text-anchor', 'middle');
        nameText.setAttribute('font-family', 'Arial, sans-serif');
        nameText.setAttribute('font-size', '14');
        nameText.setAttribute('font-weight', 'bold');
        nameText.setAttribute('fill', this.getTextColor(options));
        nameText.textContent = obj.name;
        svg.appendChild(nameText);

        // Add attributes
        const objAttributes = attributes.filter(attr => attr.objectId === obj.id);
        objAttributes.slice(0, 3).forEach((attr, attrIndex) => {
          const attrText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          attrText.setAttribute('x', (x + 10).toString());
          attrText.setAttribute('y', (y + 45 + attrIndex * 15).toString());
          attrText.setAttribute('font-family', 'Arial, sans-serif');
          attrText.setAttribute('font-size', '10');
          attrText.setAttribute('fill', this.getTextColor(options));
          
          let attrName = attr.name;
          if (options.includePrimaryKeys && attr.isPrimaryKey) {
            attrName += ' (PK)';
          }
          if (options.includeForeignKeys && attr.isForeignKey) {
            attrName += ' (FK)';
          }
          
          attrText.textContent = attrName;
          svg.appendChild(attrText);
        });

        if (objAttributes.length > 3) {
          const moreText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          moreText.setAttribute('x', (x + 10).toString());
          moreText.setAttribute('y', (y + 45 + 3 * 15).toString());
          moreText.setAttribute('font-family', 'Arial, sans-serif');
          moreText.setAttribute('font-size', '10');
          moreText.setAttribute('fill', this.getTextColor(options));
          moreText.textContent = `... and ${objAttributes.length - 3} more`;
          svg.appendChild(moreText);
        }
      });

      // Add relationships
      relationships.forEach(rel => {
        const sourceObj = objects.find(o => o.id === rel.sourceModelObjectId);
        const targetObj = objects.find(o => o.id === rel.targetModelObjectId);
        
        if (sourceObj && targetObj) {
          const sourceIndex = objects.indexOf(sourceObj);
          const targetIndex = objects.indexOf(targetObj);
          
          const sourceRow = Math.floor(sourceIndex / cols);
          const sourceCol = sourceIndex % cols;
          const targetRow = Math.floor(targetIndex / cols);
          const targetCol = targetIndex % cols;
          
          const sourceX = margin + sourceCol * nodeSpacing + nodeWidth / 2;
          const sourceY = margin + 60 + sourceRow * (nodeHeight + 50) + nodeHeight / 2;
          const targetX = margin + targetCol * nodeSpacing + nodeWidth / 2;
          const targetY = margin + 60 + targetRow * (nodeHeight + 50) + nodeHeight / 2;

          // Create line
          const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          line.setAttribute('x1', sourceX.toString());
          line.setAttribute('y1', sourceY.toString());
          line.setAttribute('x2', targetX.toString());
          line.setAttribute('y2', targetY.toString());
          line.setAttribute('stroke', this.getEdgeColor(options));
          line.setAttribute('stroke-width', '2');
          line.setAttribute('marker-end', 'url(#arrowhead)');
          svg.appendChild(line);

          // Add relationship type
          const midX = (sourceX + targetX) / 2;
          const midY = (sourceY + targetY) / 2;
          const relText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          relText.setAttribute('x', midX.toString());
          relText.setAttribute('y', midY.toString());
          relText.setAttribute('text-anchor', 'middle');
          relText.setAttribute('font-family', 'Arial, sans-serif');
          relText.setAttribute('font-size', '10');
          relText.setAttribute('fill', this.getTextColor(options));
          relText.textContent = rel.type;
          svg.appendChild(relText);
        }
      });

      // Add arrow marker
      const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
      marker.setAttribute('id', 'arrowhead');
      marker.setAttribute('markerWidth', '10');
      marker.setAttribute('markerHeight', '7');
      marker.setAttribute('refX', '9');
      marker.setAttribute('refY', '3.5');
      marker.setAttribute('orient', 'auto');
      
      const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      polygon.setAttribute('points', '0 0, 10 3.5, 0 7');
      polygon.setAttribute('fill', this.getEdgeColor(options));
      marker.appendChild(polygon);
      defs.appendChild(marker);
      svg.insertBefore(defs, svg.firstChild);

      const svgString = new XMLSerializer().serializeToString(svg);
      const filename = `${model.name}_${options.format}_${new Date().toISOString().split('T')[0]}.svg`;
      
      return {
        success: true,
        data: svgString,
        filename
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Programmatic SVG generation failed'
      };
    }
  }

  private enhanceSVG(svgElement: SVGElement, model: DataModel, options: SVGExportOptions): void {
    // Add title
    if (options.includeTitle) {
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      title.setAttribute('x', '50%');
      title.setAttribute('y', '30');
      title.setAttribute('text-anchor', 'middle');
      title.setAttribute('font-family', 'Arial, sans-serif');
      title.setAttribute('font-size', '24');
      title.setAttribute('font-weight', 'bold');
      title.setAttribute('fill', this.getTextColor(options));
      title.textContent = model.name;
      svgElement.insertBefore(title, svgElement.firstChild);
    }

    // Add metadata
    if (options.includeMetadata) {
      const metadata = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      metadata.setAttribute('x', '20');
      metadata.setAttribute('y', '95%');
      metadata.setAttribute('font-family', 'Arial, sans-serif');
      metadata.setAttribute('font-size', '12');
      metadata.setAttribute('fill', this.getTextColor(options));
      metadata.textContent = `Layer: ${options.layer} | Generated: ${new Date().toLocaleString()}`;
      svgElement.appendChild(metadata);
    }

    // Apply theme colors
    this.applyTheme(svgElement, options);
  }

  private applyTheme(svgElement: SVGElement, options: SVGExportOptions): void {
    const elements = svgElement.querySelectorAll('*');
    elements.forEach(element => {
      if (element.tagName === 'rect' && element.getAttribute('class')?.includes('node')) {
        element.setAttribute('fill', this.getNodeColor(options));
        element.setAttribute('stroke', this.getEdgeColor(options));
      } else if (element.tagName === 'path' || element.tagName === 'line') {
        element.setAttribute('stroke', this.getEdgeColor(options));
      } else if (element.tagName === 'text') {
        element.setAttribute('fill', this.getTextColor(options));
      }
    });
  }

  private getBackgroundColor(options: SVGExportOptions): string {
    switch (options.theme) {
      case 'dark': return '#1a1a1a';
      case 'light': return '#ffffff';
      default: return '#ffffff';
    }
  }

  private getNodeColor(options: SVGExportOptions): string {
    switch (options.theme) {
      case 'dark': return '#2d2d2d';
      case 'light': return '#f8f9fa';
      default: return '#f8f9fa';
    }
  }

  private getEdgeColor(options: SVGExportOptions): string {
    switch (options.theme) {
      case 'dark': return '#4a5568';
      case 'light': return '#2d3748';
      default: return '#2d3748';
    }
  }

  private getTextColor(options: SVGExportOptions): string {
    switch (options.theme) {
      case 'dark': return '#ffffff';
      case 'light': return '#2d3748';
      default: return '#2d3748';
    }
  }

  async downloadFile(result: ExportResult): Promise<void> {
    if (!result.success || !result.data) {
      throw new Error(result.error || 'No data to download');
    }

    const blob = new Blob([result.data], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = result.filename || 'export.svg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

export const svgExportService = new SVGExportService();
