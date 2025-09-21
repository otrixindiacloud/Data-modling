import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { DataModel, DataObject, Attribute, Relationship } from '@shared/schema';

export interface PDFExportOptions {
  format: 'pdf' | 'png';
  layer: 'all' | 'conceptual' | 'logical' | 'physical';
  includePrimaryKeys: boolean;
  includeForeignKeys: boolean;
  includeConstraints: boolean;
  includeMetadata: boolean;
  includeDescriptions: boolean;
  includeLegend: boolean;
  includeTitle: boolean;
  includeTimestamp: boolean;
  pageSize: 'A4' | 'A3' | 'Letter' | 'Legal';
  orientation: 'portrait' | 'landscape';
  quality: 'draft' | 'standard' | 'high';
  theme: 'light' | 'dark' | 'auto';
  style: 'minimal' | 'detailed' | 'professional';
  watermark?: string;
  headerText?: string;
  footerText?: string;
}

export interface ExportResult {
  success: boolean;
  data?: Blob | string;
  error?: string;
  filename?: string;
}

export class PDFExportService {
  async exportToPDF(
    model: DataModel,
    objects: DataObject[],
    attributes: Attribute[],
    relationships: Relationship[],
    options: PDFExportOptions
  ): Promise<ExportResult> {
    try {
      console.log('Starting PDF export...', { model: model.name, format: options.format });
      
      // For PNG format, try canvas capture first
      if (options.format === 'png') {
        const canvasResult = await this.captureCanvas(options);
        if (canvasResult.success && canvasResult.data) {
          return this.generatePDFFromCanvas(canvasResult.data as unknown as HTMLCanvasElement, model, options);
        }
      }

      // For PDF format or if canvas capture fails, use programmatic generation
      console.log('Using programmatic PDF generation...');
      return this.generateProgrammaticPDF(model, objects, attributes, relationships, options);
    } catch (error) {
      console.error('PDF export error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  private async captureCanvas(options: PDFExportOptions): Promise<ExportResult> {
    try {
      console.log('Attempting to capture canvas for PDF export...');
      
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
        console.error('Canvas not found for PDF export');
        return {
          success: false,
          error: 'Canvas not found. Please ensure the model is loaded and visible.'
        };
      }

      console.log('Canvas found, capturing with html2canvas...');
      const scale = this.getScaleForQuality(options.quality);
      const canvas = await html2canvas(canvasElement, {
        backgroundColor: options.theme === 'dark' ? '#1a1a1a' : '#ffffff',
        scale,
        useCORS: true,
        allowTaint: true,
        logging: true, // Enable logging for debugging
        width: canvasElement.scrollWidth,
        height: canvasElement.scrollHeight
      });

      console.log('Canvas captured successfully:', canvas.width, 'x', canvas.height);
      return {
        success: true,
        data: canvas as unknown as Blob
      };
    } catch (error) {
      console.error('Canvas capture failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Canvas capture failed'
      };
    }
  }

  private generatePDFFromCanvas(
    canvas: HTMLCanvasElement,
    model: DataModel,
    options: PDFExportOptions
  ): ExportResult {
    try {
      console.log('Generating PDF from canvas...');
      const pdf = new jsPDF({
        orientation: options.orientation,
        unit: 'mm',
        format: (options.pageSize || 'A4').toLowerCase()
      });

      // Add header if specified
      if (options.headerText) {
        pdf.setFontSize(12);
        pdf.text(options.headerText, 20, 20);
      }

      // Add title if specified
      if (options.includeTitle) {
        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        pdf.text(model.name, 20, options.headerText ? 35 : 25);
        pdf.setFont('helvetica', 'normal');
      }

      // Calculate image dimensions
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      const availableWidth = pageWidth - (margin * 2);
      const availableHeight = pageHeight - (margin * 2) - (options.headerText ? 40 : 30);

      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const scaleX = availableWidth / imgWidth;
      const scaleY = availableHeight / imgHeight;
      const scale = Math.min(scaleX, scaleY);

      const scaledWidth = imgWidth * scale;
      const scaledHeight = imgHeight * scale;

      // Center the image
      const x = margin + (availableWidth - scaledWidth) / 2;
      const y = margin + (options.headerText ? 40 : 30) + (availableHeight - scaledHeight) / 2;

      pdf.addImage(
        canvas.toDataURL('image/png'),
        'PNG',
        x,
        y,
        scaledWidth,
        scaledHeight
      );

      // Add watermark if specified
      if (options.watermark) {
        pdf.setFontSize(8);
        pdf.setTextColor(200, 200, 200);
        pdf.text(options.watermark, pageWidth - 50, pageHeight - 10);
        pdf.setTextColor(0, 0, 0);
      }

      // Add footer if specified
      if (options.footerText) {
        pdf.setFontSize(10);
        pdf.text(options.footerText, 20, pageHeight - 10);
      }

      // Add timestamp if specified
      if (options.includeTimestamp) {
        pdf.setFontSize(8);
        pdf.text(
          `Generated: ${new Date().toLocaleString()}`,
          pageWidth - 50,
          pageHeight - 5
        );
      }

      const filename = `${model.name}_${options.format}_${new Date().toISOString().split('T')[0]}.pdf`;
      
      console.log('PDF generated successfully:', filename);
      return {
        success: true,
        data: pdf.output('blob'),
        filename
      };
    } catch (error) {
      console.error('PDF generation from canvas failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'PDF generation failed'
      };
    }
  }

  private generateProgrammaticPDF(
    model: DataModel,
    objects: DataObject[],
    attributes: Attribute[],
    relationships: Relationship[],
    options: PDFExportOptions
  ): ExportResult {
    try {
      console.log('Generating programmatic PDF...', {
        objectsCount: objects.length,
        attributesCount: attributes.length,
        relationshipsCount: relationships.length
      });
      
      const pdf = new jsPDF({
        orientation: options.orientation,
        unit: 'mm',
        format: (options.pageSize || 'A4').toLowerCase()
      });

      let yPosition = 20;

      // Add header
      if (options.headerText) {
        pdf.setFontSize(12);
        pdf.text(options.headerText, 20, yPosition);
        yPosition += 15;
      }

      // Add title
      if (options.includeTitle) {
        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        pdf.text(model.name, 20, yPosition);
        pdf.setFont('helvetica', 'normal');
        yPosition += 15;
      }

      // Add metadata
      if (options.includeMetadata) {
        pdf.setFontSize(10);
        pdf.text(`Layer: ${options.layer}`, 20, yPosition);
        yPosition += 5;
        pdf.text(`Created: ${new Date(model.createdAt).toLocaleDateString()}`, 20, yPosition);
        yPosition += 5;
        pdf.text(`Updated: ${new Date(model.updatedAt).toLocaleDateString()}`, 20, yPosition);
        yPosition += 10;
      }

      // Add objects
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Data Objects', 20, yPosition);
      pdf.setFont('helvetica', 'normal');
      yPosition += 10;

      if (objects.length === 0) {
        pdf.setFontSize(10);
        pdf.text('No data objects found. This might be because:', 20, yPosition);
        yPosition += 8;
        pdf.text('• The model is empty', 25, yPosition);
        yPosition += 6;
        pdf.text('• There was an error fetching model data', 25, yPosition);
        yPosition += 6;
        pdf.text('• The model is not properly loaded', 25, yPosition);
        yPosition += 15;
      } else {
        for (const obj of objects) {
        if (yPosition > 250) {
          pdf.addPage();
          yPosition = 20;
        }

        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.text(obj.name, 25, yPosition);
        pdf.setFont('helvetica', 'normal');
        yPosition += 8;

        if (options.includeDescriptions && obj.description) {
          pdf.setFontSize(10);
          pdf.text(obj.description, 30, yPosition);
          yPosition += 6;
        }

        // Add attributes
        const objAttributes = attributes.filter(attr => attr.objectId === obj.id);
        for (const attr of objAttributes) {
          if (yPosition > 250) {
            pdf.addPage();
            yPosition = 20;
          }

          let attrText = `  • ${attr.name}`;
          if (options.includePrimaryKeys && attr.isPrimaryKey) {
            attrText += ' (PK)';
          }
          if (options.includeForeignKeys && attr.isForeignKey) {
            attrText += ' (FK)';
          }
          if (!attr.nullable) {
            attrText += ' (NOT NULL)';
          }

          pdf.setFontSize(9);
          pdf.text(attrText, 30, yPosition);
          yPosition += 5;
        }

        yPosition += 5;
      }
      }

      // Add relationships
      if (relationships.length > 0) {
        if (yPosition > 200) {
          pdf.addPage();
          yPosition = 20;
        }

        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Relationships', 20, yPosition);
        pdf.setFont('helvetica', 'normal');
        yPosition += 10;

        for (const rel of relationships) {
          if (yPosition > 250) {
            pdf.addPage();
            yPosition = 20;
          }

          const sourceObj = objects.find(o => o.id === rel.sourceModelObjectId);
          const targetObj = objects.find(o => o.id === rel.targetModelObjectId);
          
          if (sourceObj && targetObj) {
            pdf.setFontSize(10);
            pdf.text(`${sourceObj.name} → ${targetObj.name} (${rel.type})`, 25, yPosition);
            yPosition += 6;
          }
        }
      }

      // Add watermark
      if (options.watermark) {
        pdf.setFontSize(8);
        pdf.setTextColor(200, 200, 200);
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        pdf.text(options.watermark, pageWidth - 50, pageHeight - 10);
        pdf.setTextColor(0, 0, 0);
      }

      // Add footer
      if (options.footerText) {
        const pageHeight = pdf.internal.pageSize.getHeight();
        pdf.setFontSize(10);
        pdf.text(options.footerText, 20, pageHeight - 10);
      }

      // Add timestamp
      if (options.includeTimestamp) {
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        pdf.setFontSize(8);
        pdf.text(
          `Generated: ${new Date().toLocaleString()}`,
          pageWidth - 50,
          pageHeight - 5
        );
      }

      const filename = `${model.name}_${options.format}_${new Date().toISOString().split('T')[0]}.pdf`;
      
      console.log('Programmatic PDF generated successfully:', filename);
      return {
        success: true,
        data: pdf.output('blob'),
        filename
      };
    } catch (error) {
      console.error('Programmatic PDF generation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Programmatic PDF generation failed'
      };
    }
  }

  private getScaleForQuality(quality: string): number {
    switch (quality) {
      case 'draft': return 1;
      case 'standard': return 2;
      case 'high': return 3;
      default: return 2;
    }
  }

  async downloadFile(result: ExportResult): Promise<void> {
    if (!result.success || !result.data) {
      throw new Error(result.error || 'No data to download');
    }

    const blob = result.data instanceof Blob ? result.data : new Blob([result.data]);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = result.filename || 'export.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

export const pdfExportService = new PDFExportService();
