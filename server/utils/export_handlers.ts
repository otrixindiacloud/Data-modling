import type { DataModel, DataObject, Attribute, DataModelObjectRelationship } from "../../shared/schema";
import { exportService } from "../services/exportService";
import type { Storage } from "../storage";

/**
 * Export model data in various formats (JSON, SQL, etc.)
 */
export async function exportModelData(
  modelId: number,
  options: any,
  storage: Storage
): Promise<any> {
  console.log('Export request received:', { modelId, options });
  
  const model = await storage.getDataModel(modelId);
  if (!model) {
    console.log('Model not found:', modelId);
    throw new Error("Model not found");
  }
  
  console.log('Model found:', model.name);
  
  const objects = await storage.getDataObjectsByModel(modelId);
  const relationships = await storage.getDataModelObjectRelationshipsByModel(modelId);
  
  console.log('Data fetched:', { objects: objects.length, relationships: relationships.length });
  
  const allAttributes: any[] = [];
  for (const obj of objects) {
    const attrs = await storage.getAttributesByObject(obj.id);
    allAttributes.push(...attrs);
  }
  
  console.log('Attributes fetched:', allAttributes.length);
  
  const exportedData = await exportService.exportModel(
    model,
    objects,
    allAttributes,
    relationships,
    options
  );
  
  console.log('Export completed successfully');
  return exportedData;
}

/**
 * Generate SVG diagram for a data model
 */
export async function generateSVGDiagram(
  modelId: number,
  options: any,
  storage: Storage
): Promise<string> {
  const model = await storage.getDataModel(modelId);
  if (!model) {
    throw new Error("Model not found");
  }
  
  const objects = await storage.getDataObjectsByModel(modelId);
  const relationships = await storage.getDataModelObjectRelationshipsByModel(modelId);
  
  const allAttributes: any[] = [];
  for (const obj of objects) {
    const attrs = await storage.getAttributesByObject(obj.id);
    allAttributes.push(...attrs);
  }
  
  // Generate SVG
  const width = options.width || 800;
  const height = options.height || 600;
  const margin = 50;
  const nodeWidth = 200;
  const nodeHeight = 100;
  const nodeSpacing = 250;
  
  // Calculate layout
  const cols = Math.ceil(Math.sqrt(objects.length));
  const rows = Math.ceil(objects.length / cols);
  
  let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
  
  // Add background
  svg += `<rect width="100%" height="100%" fill="${options.theme === 'dark' ? '#1a1a1a' : '#ffffff'}"/>`;
  
  // Add title
  if (options.includeTitle) {
    svg += `<text x="${width / 2}" y="30" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="${options.theme === 'dark' ? '#ffffff' : '#2d3748'}">${model.name}</text>`;
  }
  
  // Add metadata
  if (options.includeMetadata) {
    svg += `<text x="20" y="${height - 20}" font-family="Arial, sans-serif" font-size="12" fill="${options.theme === 'dark' ? '#ffffff' : '#2d3748'}">Layer: ${options.layer || 'all'} | Generated: ${new Date().toLocaleString()}</text>`;
  }
  
  // Add objects
  objects.forEach((obj, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    const x = margin + col * nodeSpacing;
    const y = margin + 60 + row * (nodeHeight + 50);
    
    // Create node rectangle
    svg += `<rect x="${x}" y="${y}" width="${nodeWidth}" height="${nodeHeight}" fill="${options.theme === 'dark' ? '#2d2d2d' : '#f8f9fa'}" stroke="${options.theme === 'dark' ? '#4a5568' : '#2d3748'}" stroke-width="2" rx="5"/>`;
    
    // Add object name
    svg += `<text x="${x + nodeWidth / 2}" y="${y + 25}" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="${options.theme === 'dark' ? '#ffffff' : '#2d3748'}">${obj.name}</text>`;
    
    // Add attributes
    const objAttributes = allAttributes.filter(attr => attr.objectId === obj.id);
    objAttributes.slice(0, 3).forEach((attr, attrIndex) => {
      let attrName = attr.name;
      if (options.includePrimaryKeys && attr.isPrimaryKey) {
        attrName += ' (PK)';
      }
      if (options.includeForeignKeys && attr.isForeignKey) {
        attrName += ' (FK)';
      }
      
      svg += `<text x="${x + 10}" y="${y + 45 + attrIndex * 15}" font-family="Arial, sans-serif" font-size="10" fill="${options.theme === 'dark' ? '#ffffff' : '#2d3748'}">${attrName}</text>`;
    });
    
    if (objAttributes.length > 3) {
      svg += `<text x="${x + 10}" y="${y + 45 + 3 * 15}" font-family="Arial, sans-serif" font-size="10" fill="${options.theme === 'dark' ? '#ffffff' : '#2d3748'}">... and ${objAttributes.length - 3} more</text>`;
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
      svg += `<line x1="${sourceX}" y1="${sourceY}" x2="${targetX}" y2="${targetY}" stroke="${options.theme === 'dark' ? '#4a5568' : '#2d3748'}" stroke-width="2" marker-end="url(#arrowhead)"/>`;
      
      // Add relationship type
      const midX = (sourceX + targetX) / 2;
      const midY = (sourceY + targetY) / 2;
      svg += `<text x="${midX}" y="${midY}" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" fill="${options.theme === 'dark' ? '#ffffff' : '#2d3748'}">${rel.type}</text>`;
    }
  });
  
  // Add arrow marker
  svg += `<defs><marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="${options.theme === 'dark' ? '#4a5568' : '#2d3748'}"/></marker></defs>`;
  
  svg += '</svg>';
  
  return svg;
}
