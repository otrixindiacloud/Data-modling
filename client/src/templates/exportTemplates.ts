export interface ExportTemplate {
  id: string;
  name: string;
  description: string;
  format: 'pdf' | 'svg' | 'png';
  category: 'documentation' | 'presentation' | 'technical' | 'minimal';
  options: {
    pageSize?: 'A4' | 'A3' | 'Letter' | 'Legal';
    orientation?: 'portrait' | 'landscape';
    quality?: 'draft' | 'standard' | 'high';
    theme?: 'light' | 'dark' | 'auto';
    style?: 'minimal' | 'detailed' | 'professional';
    includeTitle?: boolean;
    includeMetadata?: boolean;
    includeDescriptions?: boolean;
    includeLegend?: boolean;
    includeTimestamp?: boolean;
    includePrimaryKeys?: boolean;
    includeForeignKeys?: boolean;
    includeConstraints?: boolean;
    watermark?: string;
    headerText?: string;
    footerText?: string;
  };
  preview?: string;
}

export const exportTemplates: ExportTemplate[] = [
  {
    id: 'professional-pdf',
    name: 'Professional PDF Report',
    description: 'Comprehensive PDF document with full metadata and professional styling',
    format: 'pdf',
    category: 'documentation',
    options: {
      pageSize: 'A4',
      orientation: 'portrait',
      quality: 'high',
      theme: 'light',
      style: 'professional',
      includeTitle: true,
      includeMetadata: true,
      includeDescriptions: true,
      includeLegend: true,
      includeTimestamp: true,
      includePrimaryKeys: true,
      includeForeignKeys: true,
      includeConstraints: true,
      headerText: 'Data Model Documentation',
      footerText: 'Confidential - Internal Use Only'
    }
  },
  {
    id: 'presentation-pdf',
    name: 'Presentation PDF',
    description: 'Clean PDF optimized for presentations and meetings',
    format: 'pdf',
    category: 'presentation',
    options: {
      pageSize: 'A4',
      orientation: 'landscape',
      quality: 'high',
      theme: 'light',
      style: 'minimal',
      includeTitle: true,
      includeMetadata: false,
      includeDescriptions: false,
      includeLegend: true,
      includeTimestamp: false,
      includePrimaryKeys: true,
      includeForeignKeys: true,
      includeConstraints: false,
      watermark: 'DRAFT'
    }
  },
  {
    id: 'technical-pdf',
    name: 'Technical Specification',
    description: 'Detailed technical PDF with all constraints and metadata',
    format: 'pdf',
    category: 'technical',
    options: {
      pageSize: 'A4',
      orientation: 'portrait',
      quality: 'standard',
      theme: 'light',
      style: 'detailed',
      includeTitle: true,
      includeMetadata: true,
      includeDescriptions: true,
      includeLegend: true,
      includeTimestamp: true,
      includePrimaryKeys: true,
      includeForeignKeys: true,
      includeConstraints: true,
      headerText: 'Technical Specification',
      footerText: 'Version 1.0'
    }
  },
  {
    id: 'minimal-pdf',
    name: 'Minimal PDF',
    description: 'Simple PDF with just the essential information',
    format: 'pdf',
    category: 'minimal',
    options: {
      pageSize: 'A4',
      orientation: 'portrait',
      quality: 'standard',
      theme: 'light',
      style: 'minimal',
      includeTitle: true,
      includeMetadata: false,
      includeDescriptions: false,
      includeLegend: false,
      includeTimestamp: false,
      includePrimaryKeys: true,
      includeForeignKeys: true,
      includeConstraints: false
    }
  },
  {
    id: 'vector-svg',
    name: 'Vector Diagram',
    description: 'Scalable SVG diagram perfect for documentation and web use',
    format: 'svg',
    category: 'documentation',
    options: {
      theme: 'light',
      style: 'professional',
      includeTitle: true,
      includeMetadata: true,
      includeDescriptions: false,
      includeLegend: true,
      includeTimestamp: true,
      includePrimaryKeys: true,
      includeForeignKeys: true,
      includeConstraints: false
    }
  },
  {
    id: 'dark-svg',
    name: 'Dark Theme SVG',
    description: 'Dark-themed SVG diagram for modern presentations',
    format: 'svg',
    category: 'presentation',
    options: {
      theme: 'dark',
      style: 'minimal',
      includeTitle: true,
      includeMetadata: false,
      includeDescriptions: false,
      includeLegend: false,
      includeTimestamp: false,
      includePrimaryKeys: true,
      includeForeignKeys: true,
      includeConstraints: false
    }
  },
  {
    id: 'technical-svg',
    name: 'Technical SVG',
    description: 'Detailed SVG with all technical information',
    format: 'svg',
    category: 'technical',
    options: {
      theme: 'light',
      style: 'detailed',
      includeTitle: true,
      includeMetadata: true,
      includeDescriptions: true,
      includeLegend: true,
      includeTimestamp: true,
      includePrimaryKeys: true,
      includeForeignKeys: true,
      includeConstraints: true
    }
  },
  {
    id: 'high-res-png',
    name: 'High Resolution PNG',
    description: 'High-quality PNG image for print and digital use',
    format: 'png',
    category: 'presentation',
    options: {
      quality: 'high',
      theme: 'light',
      style: 'professional',
      includeTitle: true,
      includeMetadata: false,
      includeDescriptions: false,
      includeLegend: true,
      includeTimestamp: false,
      includePrimaryKeys: true,
      includeForeignKeys: true,
      includeConstraints: false
    }
  }
];

export const getTemplateById = (id: string): ExportTemplate | undefined => {
  return exportTemplates.find(template => template.id === id);
};

export const getTemplatesByCategory = (category: string): ExportTemplate[] => {
  return exportTemplates.filter(template => template.category === category);
};

export const getTemplatesByFormat = (format: string): ExportTemplate[] => {
  return exportTemplates.filter(template => template.format === format);
};
