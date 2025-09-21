import { Attribute, DataObject } from "@shared/schema";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface DomainSuggestion {
  domain: string;
  dataArea: string;
  confidence: number;
  reasoning: string;
}

export interface RelationshipSuggestion {
  sourceObjectId: number;
  targetObjectId: number;
  type: "1:1" | "1:N" | "N:M";
  sourceAttributeName: string;
  targetAttributeName: string;
  confidence: number;
  reasoning: string;
}

export interface TypeMappingSuggestion {
  conceptualType: string;
  logicalType: string;
  physicalType: string;
  reasoning: string;
}

export class AIEngine {
  // Enhanced domain classification with OpenAI
  async suggestDomainClassification(objectName: string, attributes: string[]): Promise<DomainSuggestion[]> {
    // Get rule-based suggestions first
    const ruleSuggestions = this.getRuleBasedDomainSuggestions(objectName, attributes);
    
    // Enhance with OpenAI analysis
    try {
      const aiSuggestions = await this.getOpenAIDomainSuggestions(objectName, attributes);
      return [...ruleSuggestions, ...aiSuggestions]
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 3); // Top 3 suggestions
    } catch (error: any) {
      console.warn("OpenAI domain analysis failed:", error?.message);
      return ruleSuggestions;
    }
  }

  private getRuleBasedDomainSuggestions(objectName: string, attributes: string[]): DomainSuggestion[] {
    const suggestions: DomainSuggestion[] = [];
    const lowerObjectName = objectName.toLowerCase();
    const lowerAttributes = attributes.map(attr => attr.toLowerCase());

    // HR Domain patterns
    if (this.matchesPatterns(lowerObjectName, ["employee", "person", "staff", "user", "worker"]) ||
        this.hasAttributePatterns(lowerAttributes, ["firstname", "lastname", "email", "phone", "hire"])) {
      suggestions.push({
        domain: "HR",
        dataArea: this.getHRDataArea(lowerObjectName, lowerAttributes),
        confidence: 0.85,
        reasoning: "Object name and attributes suggest human resources data"
      });
    }

    // Finance Domain patterns
    if (this.matchesPatterns(lowerObjectName, ["invoice", "payment", "transaction", "account", "budget"]) ||
        this.hasAttributePatterns(lowerAttributes, ["amount", "price", "cost", "balance", "currency"])) {
      suggestions.push({
        domain: "Finance",
        dataArea: "Accounting",
        confidence: 0.80,
        reasoning: "Financial indicators detected in object structure"
      });
    }

    // Operations Domain patterns
    if (this.matchesPatterns(lowerObjectName, ["project", "task", "order", "product", "inventory"]) ||
        this.hasAttributePatterns(lowerAttributes, ["status", "deadline", "priority", "quantity"])) {
      suggestions.push({
        domain: "Operations",
        dataArea: "Planning",
        confidence: 0.75,
        reasoning: "Operational data patterns identified"
      });
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  private async getOpenAIDomainSuggestions(objectName: string, attributes: string[]): Promise<DomainSuggestion[]> {
    const prompt = `Analyze this data object and suggest which business domain it belongs to.

Object Name: ${objectName}
Attributes: ${attributes.join(', ')}

Based on the object name and attributes, determine the most likely business domains this object belongs to.

Common domains include:
- HR (Human Resources)
- Finance (Financial Operations) 
- Operations (Operational Processes)
- Sales (Sales and Marketing)
- Customer (Customer Management)
- IT (Information Technology)
- Legal (Legal and Compliance)
- Supply Chain (Supply Chain Management)

Return suggestions in this JSON format:
{
  "domains": [
    {
      "domain": "domain name",
      "dataArea": "specific area within domain",
      "confidence": number (0.5-0.95),
      "reasoning": "detailed explanation"
    }
  ]
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system", 
          content: "You are a business domain expert. Classify data objects into appropriate business domains."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 800
    });

    const result = JSON.parse(response.choices[0].message.content || '{"domains": []}');
    
    return result.domains.map((domain: any) => ({
      domain: domain.domain,
      dataArea: domain.dataArea,
      confidence: Math.min(domain.confidence, 0.95), // Cap AI suggestions at 95%
      reasoning: `AI Analysis: ${domain.reasoning}`
    }));
  }

  // Enhanced AI-powered relationship inference with OpenAI integration
  async suggestRelationships(objects: DataObject[], allAttributes: Attribute[]): Promise<RelationshipSuggestion[]> {
    console.log("AI Engine: suggestRelationships called with", objects?.length || 0, "objects and", allAttributes?.length || 0, "attributes");
    
    if (!objects || !Array.isArray(objects)) {
      console.error("AI Engine: objects is not a valid array:", objects);
      return [];
    }
    
    if (!allAttributes || !Array.isArray(allAttributes)) {
      console.error("AI Engine: allAttributes is not a valid array:", allAttributes);
      return [];
    }
    
    const suggestions: RelationshipSuggestion[] = [];
    
    // 1. Rule-based relationship detection (fast)
    for (let i = 0; i < objects.length; i++) {
      for (let j = i + 1; j < objects.length; j++) {
        const obj1 = objects[i];
        const obj2 = objects[j];
        
        const obj1Attrs = allAttributes.filter(attr => attr.objectId === obj1.id);
        const obj2Attrs = allAttributes.filter(attr => attr.objectId === obj2.id);
        
        // Rule-based detection methods
        this.detectForeignKeyRelationships(obj1, obj2, obj1Attrs, obj2Attrs, suggestions);
        this.detectSemanticRelationships(obj1, obj2, obj1Attrs, obj2Attrs, suggestions);
        this.detectDomainPatterns(obj1, obj2, obj1Attrs, obj2Attrs, suggestions);
        this.detectManyToManyRelationships(obj1, obj2, objects, allAttributes, suggestions);
      }
    }

    // 2. OpenAI-powered intelligent analysis (for complex relationships)
    try {
      const aiSuggestions = await this.getOpenAIRelationshipSuggestions(objects, allAttributes);
      suggestions.push(...aiSuggestions);
    } catch (error: any) {
      console.warn("OpenAI analysis failed, using rule-based suggestions only:", error?.message);
    }
    
    // Remove duplicates and sort by confidence
    return this.deduplicateAndRankSuggestions(suggestions);
  }

  private async getOpenAIRelationshipSuggestions(objects: DataObject[], allAttributes: Attribute[]): Promise<RelationshipSuggestion[]> {
    // Prepare data for OpenAI analysis
    const dataModel = objects.map(obj => ({
      name: obj.name,
      id: obj.id,
      domain: obj.domainId,
      sourceSystem: obj.sourceSystemId,
      targetSystem: obj.targetSystemId,
      attributes: allAttributes
        .filter(attr => attr.objectId === obj.id)
        .map(attr => ({
          name: attr.name,
          type: attr.logicalType,
          isPrimaryKey: attr.isPrimaryKey,
          isForeignKey: attr.isForeignKey
        }))
    }));

    const prompt = `Analyze this data model and suggest intelligent relationships between objects.

Data Model:
${JSON.stringify(dataModel, null, 2)}

Please identify logical relationships between these data objects based on:
1. Business logic and domain understanding
2. Attribute naming patterns and types
3. Primary/foreign key relationships
4. Common enterprise data patterns

Return suggestions in this JSON format:
{
  "relationships": [
    {
      "sourceObjectId": number,
      "targetObjectId": number,
      "type": "1:1" | "1:N" | "N:M",
      "sourceAttributeName": "string",
      "targetAttributeName": "string", 
      "confidence": number (0.5-0.99),
      "reasoning": "detailed explanation"
    }
  ]
}

Focus on high-confidence relationships that make business sense.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are a data architecture expert. Analyze data models and suggest logical relationships with high accuracy."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 2000
    });

    const result = JSON.parse(response.choices[0].message.content || '{"relationships": []}');
    
    return result.relationships.map((rel: any) => ({
      sourceObjectId: rel.sourceObjectId,
      targetObjectId: rel.targetObjectId,
      type: rel.type,
      sourceAttributeName: rel.sourceAttributeName,
      targetAttributeName: rel.targetAttributeName,
      confidence: Math.min(rel.confidence, 0.99), // Cap at 99% for AI suggestions
      reasoning: `AI Analysis: ${rel.reasoning}`
    }));
  }
  
  private detectForeignKeyRelationships(obj1: DataObject, obj2: DataObject, obj1Attrs: Attribute[], obj2Attrs: Attribute[], suggestions: RelationshipSuggestion[]) {
    for (const attr1 of obj1Attrs) {
      for (const attr2 of obj2Attrs) {
        if (this.couldBeForeignKey(attr1, attr2, obj1, obj2)) {
          const confidence = this.calculateForeignKeyConfidence(attr1, attr2, obj1, obj2);
          suggestions.push({
            sourceObjectId: obj1.id,
            targetObjectId: obj2.id,
            type: "1:N",
            sourceAttributeName: attr1.name,
            targetAttributeName: attr2.name,
            confidence,
            reasoning: `${attr1.name} in ${obj1.name} appears to reference ${attr2.name} in ${obj2.name} (Foreign Key Pattern)`
          });
        }
      }
    }
  }
  
  private detectSemanticRelationships(obj1: DataObject, obj2: DataObject, obj1Attrs: Attribute[], obj2Attrs: Attribute[], suggestions: RelationshipSuggestion[]) {
    // Detect relationships based on object and attribute naming patterns
    const semanticPatterns = [
      { pattern: /(\w+)_id$/i, type: "reference" },
      { pattern: /(\w+)Id$/i, type: "reference" },
      { pattern: /(\w+)_key$/i, type: "reference" },
      { pattern: /parent_(\w+)/i, type: "hierarchy" },
      { pattern: /manager_(\w+)/i, type: "management" },
      { pattern: /owner_(\w+)/i, type: "ownership" }
    ];
    
    for (const attr1 of obj1Attrs) {
      if (!attr1.name) continue;
      
      for (const pattern of semanticPatterns) {
        const match = attr1.name.match(pattern.pattern);
        if (match) {
          const referencedEntityName = match[1];
          
          // Check if any object name matches the referenced entity
          if (obj2.name && referencedEntityName && 
              (obj2.name.toLowerCase().includes(referencedEntityName.toLowerCase()) || 
               referencedEntityName.toLowerCase().includes(obj2.name.toLowerCase()))) {
            
            // Find the most likely target attribute (usually ID or primary key)
            const targetAttr = obj2Attrs.find(attr => 
              attr.isPrimaryKey || 
              attr.name.toLowerCase().includes('id') ||
              attr.name.toLowerCase() === referencedEntityName.toLowerCase() + '_id'
            ) || obj2Attrs[0];
            
            if (targetAttr) {
              suggestions.push({
                sourceObjectId: obj1.id,
                targetObjectId: obj2.id,
                type: pattern.type === "hierarchy" ? "1:N" : "1:N",
                sourceAttributeName: attr1.name,
                targetAttributeName: targetAttr.name,
                confidence: 0.75,
                reasoning: `Semantic pattern detected: ${attr1.name} suggests ${pattern.type} relationship with ${obj2.name}`
              });
            }
          }
        }
      }
    }
  }
  
  private detectDomainPatterns(obj1: DataObject, obj2: DataObject, obj1Attrs: Attribute[], obj2Attrs: Attribute[], suggestions: RelationshipSuggestion[]) {
    // Domain-specific relationship patterns
    const domainPatterns = {
      hr: [
        { source: "employee", target: "department", type: "1:N", confidence: 0.9 },
        { source: "employee", target: "position", type: "1:N", confidence: 0.85 },
        { source: "employee", target: "manager", type: "1:N", confidence: 0.8 },
        { source: "salary", target: "employee", type: "1:N", confidence: 0.95 },
        { source: "benefits", target: "employee", type: "1:N", confidence: 0.8 },
        { source: "performance", target: "employee", type: "1:N", confidence: 0.9 }
      ],
      ecommerce: [
        { source: "order", target: "customer", type: "1:N", confidence: 0.95 },
        { source: "orderitem", target: "order", type: "1:N", confidence: 0.95 },
        { source: "orderitem", target: "product", type: "1:N", confidence: 0.9 },
        { source: "payment", target: "order", type: "1:1", confidence: 0.85 }
      ],
      finance: [
        { source: "transaction", target: "account", type: "1:N", confidence: 0.9 },
        { source: "invoice", target: "customer", type: "1:N", confidence: 0.9 },
        { source: "payment", target: "invoice", type: "1:N", confidence: 0.85 }
      ]
    };
    
    for (const [domain, patterns] of Object.entries(domainPatterns)) {
      for (const pattern of patterns) {
        if (obj1.name && obj2.name && 
            obj1.name.toLowerCase().includes(pattern.source) && 
            obj2.name.toLowerCase().includes(pattern.target)) {
          
          const sourceAttr = this.findBestReferenceAttribute(obj1Attrs, pattern.target);
          const targetAttr = this.findBestTargetAttribute(obj2Attrs);
          
          if (sourceAttr && targetAttr) {
            suggestions.push({
              sourceObjectId: obj1.id,
              targetObjectId: obj2.id,
              type: pattern.type as "1:1" | "1:N" | "N:M",
              sourceAttributeName: sourceAttr.name,
              targetAttributeName: targetAttr.name,
              confidence: pattern.confidence,
              reasoning: `Domain pattern (${domain}): ${pattern.source} typically relates to ${pattern.target}`
            });
          }
        }
      }
    }
  }
  
  private detectManyToManyRelationships(obj1: DataObject, obj2: DataObject, allObjects: DataObject[], allAttributes: Attribute[], suggestions: RelationshipSuggestion[]) {
    // Look for junction tables that might indicate M:N relationships
    const junctionTablePatterns = [
      new RegExp(`${obj1.name.toLowerCase()}_${obj2.name.toLowerCase()}`, 'i'),
      new RegExp(`${obj2.name.toLowerCase()}_${obj1.name.toLowerCase()}`, 'i'),
      new RegExp(`${obj1.name.toLowerCase()}${obj2.name.toLowerCase()}`, 'i'),
      new RegExp(`${obj2.name.toLowerCase()}${obj1.name.toLowerCase()}`, 'i')
    ];
    
    for (const junctionObj of allObjects) {
      if (junctionObj.id === obj1.id || junctionObj.id === obj2.id) continue;
      
      const isJunctionTable = junctionTablePatterns.some(pattern => 
        pattern.test(junctionObj.name)
      );
      
      if (isJunctionTable) {
        const junctionAttrs = allAttributes.filter(attr => attr.objectId === junctionObj.id);
        const hasRef1 = junctionAttrs.some(attr => 
          attr.name.toLowerCase().includes(obj1.name.toLowerCase())
        );
        const hasRef2 = junctionAttrs.some(attr => 
          attr.name.toLowerCase().includes(obj2.name.toLowerCase())
        );
        
        if (hasRef1 && hasRef2) {
          const obj1Attrs = allAttributes.filter(attr => attr.objectId === obj1.id);
          const obj2Attrs = allAttributes.filter(attr => attr.objectId === obj2.id);
          
          suggestions.push({
            sourceObjectId: obj1.id,
            targetObjectId: obj2.id,
            type: "N:M",
            sourceAttributeName: obj1Attrs.find((a: any) => a.isPrimaryKey)?.name || obj1Attrs[0]?.name || "id",
            targetAttributeName: obj2Attrs.find((a: any) => a.isPrimaryKey)?.name || obj2Attrs[0]?.name || "id",
            confidence: 0.8,
            reasoning: `Many-to-many relationship detected via junction table: ${junctionObj.name}`
          });
        }
      }
    }
  }
  
  private calculateForeignKeyConfidence(attr1: Attribute, attr2: Attribute, obj1: DataObject, obj2: DataObject): number {
    let confidence = 0.5;
    
    // Higher confidence for explicit FK naming
    if (attr1.name && obj2.name && attr1.name.toLowerCase().includes(obj2.name.toLowerCase())) confidence += 0.3;
    if (attr1.name && (attr1.name.toLowerCase().endsWith('_id') || attr1.name.toLowerCase().endsWith('id'))) confidence += 0.2;
    if (attr2.isPrimaryKey) confidence += 0.2;
    if (attr1.isForeignKey) confidence += 0.3;
    
    // Data type matching
    if (attr1.logicalType === attr2.logicalType) confidence += 0.1;
    
    return Math.min(confidence, 0.95);
  }
  
  private findBestReferenceAttribute(attributes: Attribute[], targetEntityName: string): Attribute | null {
    // Look for attributes that reference the target entity
    const candidates = attributes.filter(attr => 
      attr.name.toLowerCase().includes(targetEntityName.toLowerCase()) ||
      attr.isForeignKey ||
      attr.name.toLowerCase().endsWith('_id') ||
      attr.name.toLowerCase().endsWith('id')
    );
    
    return candidates.sort((a, b) => {
      let scoreA = 0, scoreB = 0;
      if (a.isForeignKey) scoreA += 3;
      if (b.isForeignKey) scoreB += 3;
      if (a.name.toLowerCase().includes(targetEntityName.toLowerCase())) scoreA += 2;
      if (b.name.toLowerCase().includes(targetEntityName.toLowerCase())) scoreB += 2;
      return scoreB - scoreA;
    })[0] || null;
  }
  
  private findBestTargetAttribute(attributes: Attribute[]): Attribute | null {
    // Prefer primary keys, then ID fields
    return attributes.find(attr => attr.isPrimaryKey) || 
           attributes.find(attr => attr.name.toLowerCase().includes('id')) ||
           attributes[0] || null;
  }
  
  private deduplicateAndRankSuggestions(suggestions: RelationshipSuggestion[]): RelationshipSuggestion[] {
    // Remove duplicates based on source/target object pairs AND attribute pairs
    const uniqueSuggestions = new Map<string, RelationshipSuggestion>();
    
    for (const suggestion of suggestions) {
      // Create a more specific key that includes attributes for better deduplication
      const key = `${suggestion.sourceObjectId}-${suggestion.targetObjectId}-${suggestion.sourceAttributeName}-${suggestion.targetAttributeName}`;
      const reverseKey = `${suggestion.targetObjectId}-${suggestion.sourceObjectId}-${suggestion.targetAttributeName}-${suggestion.sourceAttributeName}`;
      
      if (!uniqueSuggestions.has(key) && !uniqueSuggestions.has(reverseKey)) {
        uniqueSuggestions.set(key, suggestion);
      } else {
        // Keep the one with higher confidence
        const existing = uniqueSuggestions.get(key) || uniqueSuggestions.get(reverseKey);
        if (existing && suggestion.confidence > existing.confidence) {
          uniqueSuggestions.delete(key);
          uniqueSuggestions.delete(reverseKey);
          uniqueSuggestions.set(key, suggestion);
        }
      }
    }
    
    // Sort by confidence descending
    return Array.from(uniqueSuggestions.values())
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10); // Limit to top 10 suggestions
  }
  
  private couldBeForeignKey(attr1: Attribute, attr2: Attribute, obj1: DataObject, obj2: DataObject): boolean {
    // Check if attr1 could be a foreign key to attr2
    if (!attr1.name || !attr2.name || !obj2.name) return false;
    
    const attr1Lower = attr1.name.toLowerCase();
    const attr2Lower = attr2.name.toLowerCase();
    const obj2Lower = obj2.name.toLowerCase();
    
    // Direct name matching patterns
    const patterns = [
      `${obj2Lower}_id`,
      `${obj2Lower}id`,
      `${obj2Lower}_key`,
      attr2Lower
    ];
    
    return patterns.some(pattern => attr1Lower === pattern) ||
           (attr1.isForeignKey && attr2.isPrimaryKey) ||
           (attr1Lower.includes(obj2Lower) && attr1Lower.includes('id'));
  }

  // Enhanced AI-powered type mapping suggestions
  async suggestTypeMappings(conceptualType: string, attributeName?: string, context?: string): Promise<TypeMappingSuggestion[]> {
    // Rule-based mappings as fallback
    const ruleMappings: Record<string, TypeMappingSuggestion> = {
      "Text": {
        conceptualType: "Text",
        logicalType: "VARCHAR",
        physicalType: "VARCHAR(255)",
        reasoning: "Standard text field mapping"
      },
      "Number": {
        conceptualType: "Number",
        logicalType: "INTEGER",
        physicalType: "INT",
        reasoning: "Integer number type mapping"
      },
      "Date": {
        conceptualType: "Date",
        logicalType: "DATE",
        physicalType: "DATE",
        reasoning: "Date only field"
      },
      "Boolean": {
        conceptualType: "Boolean",
        logicalType: "BOOLEAN",
        physicalType: "TINYINT(1)",
        reasoning: "True/false flag field"
      },
      "Currency": {
        conceptualType: "Currency",
        logicalType: "DECIMAL",
        physicalType: "DECIMAL(15,2)",
        reasoning: "Monetary value with currency precision"
      },
      "Percentage": {
        conceptualType: "Percentage",
        logicalType: "DECIMAL",
        physicalType: "DECIMAL(5,2)",
        reasoning: "Percentage value (0-100)"
      },
      "Email": {
        conceptualType: "Email",
        logicalType: "VARCHAR",
        physicalType: "VARCHAR(255)",
        reasoning: "Email address field"
      },
      "Phone": {
        conceptualType: "Phone",
        logicalType: "VARCHAR",
        physicalType: "VARCHAR(20)",
        reasoning: "Phone number field"
      },
      "URL": {
        conceptualType: "URL",
        logicalType: "VARCHAR",
        physicalType: "VARCHAR(500)",
        reasoning: "URL/web address field"
      },
      "Image": {
        conceptualType: "Image",
        logicalType: "VARCHAR",
        physicalType: "VARCHAR(255)",
        reasoning: "Image file path or URL"
      },
      "Document": {
        conceptualType: "Document",
        logicalType: "VARCHAR",
        physicalType: "VARCHAR(255)",
        reasoning: "Document file path or URL"
      },
      "Location": {
        conceptualType: "Location",
        logicalType: "VARCHAR",
        physicalType: "VARCHAR(500)",
        reasoning: "Geographic location or address"
      }
    };

    const suggestions: TypeMappingSuggestion[] = [];
    
    // Add rule-based suggestion as primary
    const ruleMapping = ruleMappings[conceptualType] || ruleMappings["Text"];
    suggestions.push(ruleMapping);

    // Try to enhance with AI suggestions if we have OpenAI available
    try {
      if (attributeName && context) {
        const aiSuggestions = await this.getAITypeMappingSuggestions(conceptualType, attributeName, context);
        suggestions.push(...aiSuggestions);
      }
    } catch (error: any) {
      console.warn("AI type mapping failed, using rule-based only:", error?.message);
    }

    return suggestions.slice(0, 3); // Return top 3 suggestions
  }

  private async getAITypeMappingSuggestions(conceptualType: string, attributeName: string, context: string): Promise<TypeMappingSuggestion[]> {
    const prompt = `
Given the following information:
- Conceptual Type: ${conceptualType}
- Attribute Name: ${attributeName}
- Context: ${context}

Suggest the most appropriate logical and physical data types for this attribute in a database schema.
Consider factors like:
- Data storage efficiency
- Query performance
- Data integrity constraints
- Industry best practices

Return a JSON array of up to 2 alternative type mapping suggestions with the following structure:
[
  {
    "conceptualType": "${conceptualType}",
    "logicalType": "suggested_logical_type",
    "physicalType": "suggested_physical_type_with_constraints",
    "reasoning": "brief explanation for this choice"
  }
]

Focus on common database types like VARCHAR, INTEGER, DECIMAL, DATE, DATETIME, BOOLEAN, TEXT, BLOB, JSON, UUID.
`;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a database design expert who provides practical type mapping suggestions for data modeling."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 500,
      temperature: 0.3
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return [];
    }

    try {
      const suggestions = JSON.parse(content);
      if (Array.isArray(suggestions)) {
        return suggestions.map(s => ({
          conceptualType: s.conceptualType || conceptualType,
          logicalType: s.logicalType || "VARCHAR",
          physicalType: s.physicalType || "VARCHAR(255)",
          reasoning: s.reasoning || "AI-suggested mapping"
        }));
      }
    } catch (parseError) {
      console.warn("Failed to parse AI type mapping suggestions:", parseError);
    }

    return [];
  }

  // Auto-normalization suggestions
  suggestNormalizationImprovements(objects: DataObject[], attributes: Attribute[]): any[] {
    const suggestions: any[] = [];
    
    // Check for repeating groups (denormalized data)
    for (const obj of objects) {
      const objAttributes = attributes.filter(attr => attr.objectId === obj.id);
      const repeatingGroups = this.findRepeatingGroups(objAttributes);
      
      if (repeatingGroups.length > 0) {
        suggestions.push({
          type: "normalization",
          title: "Separate Repeating Groups",
          description: `Found repeating groups in ${obj.name}. Consider separating into related tables.`,
          objectId: obj.id,
          confidence: 0.75,
          reasoning: "Repeating groups violate 1NF (First Normal Form)"
        });
      }
    }
    
    // Check for partial dependencies (2NF violations)
    for (const obj of objects) {
      const objAttributes = attributes.filter(attr => attr.objectId === obj.id);
      const partialDependencies = this.findPartialDependencies(objAttributes);
      
      if (partialDependencies.length > 0) {
        suggestions.push({
          type: "normalization",
          title: "Remove Partial Dependencies",
          description: `Found partial dependencies in ${obj.name}. Consider splitting into separate tables.`,
          objectId: obj.id,
          confidence: 0.80,
          reasoning: "Partial dependencies violate 2NF (Second Normal Form)"
        });
      }
    }
    
    // Check for transitive dependencies (3NF violations)
    for (const obj of objects) {
      const objAttributes = attributes.filter(attr => attr.objectId === obj.id);
      const transitiveDependencies = this.findTransitiveDependencies(objAttributes);
      
      if (transitiveDependencies.length > 0) {
        suggestions.push({
          type: "normalization",
          title: "Remove Transitive Dependencies",
          description: `Found transitive dependencies in ${obj.name}. Consider normalizing to 3NF.`,
          objectId: obj.id,
          confidence: 0.85,
          reasoning: "Transitive dependencies violate 3NF (Third Normal Form)"
        });
      }
    }
    
    return suggestions;
  }

  async suggestAttributeRelationshipsFromConceptual(
    conceptualRelationships: any[], 
    objects: DataObject[], 
    allAttributes: Attribute[]
  ): Promise<RelationshipSuggestion[]> {
    const suggestions: RelationshipSuggestion[] = [];
    
    for (const conceptualRel of conceptualRelationships) {
      const sourceObject = objects.find(obj => obj.id === conceptualRel.sourceObjectId);
      const targetObject = objects.find(obj => obj.id === conceptualRel.targetObjectId);
      
      if (!sourceObject || !targetObject) continue;
      
      const sourceAttributes = allAttributes.filter(attr => attr.objectId === sourceObject.id);
      const targetAttributes = allAttributes.filter(attr => attr.objectId === targetObject.id);
      
      // For logical layer, find the best attribute pairs for each relationship type
      if (conceptualRel.type === "1:N") {
        // For 1:N relationships, the "many" side should have a foreign key to the "one" side
        const targetPrimaryKey = targetAttributes.find(attr => attr.isPrimaryKey) || targetAttributes[0];
        const sourceForeignKey = this.findBestReferenceAttribute(sourceAttributes, targetObject.name) || 
                                sourceAttributes.find(attr => attr.isForeignKey);
        
        if (targetPrimaryKey && sourceForeignKey) {
          suggestions.push({
            sourceObjectId: conceptualRel.sourceObjectId,
            targetObjectId: conceptualRel.targetObjectId,
            type: conceptualRel.type,
            sourceAttributeName: sourceForeignKey.name,
            targetAttributeName: targetPrimaryKey.name,
            confidence: 0.90,
            reasoning: `Foreign key relationship: ${sourceForeignKey.name} in ${sourceObject.name} references ${targetPrimaryKey.name} in ${targetObject.name}`
          });
        }
      } else if (conceptualRel.type === "1:1") {
        // For 1:1 relationships, either side can have the foreign key
        const sourcePrimaryKey = sourceAttributes.find(attr => attr.isPrimaryKey) || sourceAttributes[0];
        const targetPrimaryKey = targetAttributes.find(attr => attr.isPrimaryKey) || targetAttributes[0];
        
        if (sourcePrimaryKey && targetPrimaryKey) {
          suggestions.push({
            sourceObjectId: conceptualRel.sourceObjectId,
            targetObjectId: conceptualRel.targetObjectId,
            type: conceptualRel.type,
            sourceAttributeName: sourcePrimaryKey.name,
            targetAttributeName: targetPrimaryKey.name,
            confidence: 0.85,
            reasoning: `One-to-one relationship: ${sourcePrimaryKey.name} in ${sourceObject.name} relates to ${targetPrimaryKey.name} in ${targetObject.name}`
          });
        }
      } else if (conceptualRel.type === "N:M") {
        // For N:M relationships, suggest both primary keys for junction table creation
        const sourcePrimaryKey = sourceAttributes.find(attr => attr.isPrimaryKey) || sourceAttributes[0];
        const targetPrimaryKey = targetAttributes.find(attr => attr.isPrimaryKey) || targetAttributes[0];
        
        if (sourcePrimaryKey && targetPrimaryKey) {
          suggestions.push({
            sourceObjectId: conceptualRel.sourceObjectId,
            targetObjectId: conceptualRel.targetObjectId,
            type: conceptualRel.type,
            sourceAttributeName: sourcePrimaryKey.name,
            targetAttributeName: targetPrimaryKey.name,
            confidence: 0.80,
            reasoning: `Many-to-many relationship: Junction table needed connecting ${sourcePrimaryKey.name} from ${sourceObject.name} to ${targetPrimaryKey.name} from ${targetObject.name}`
          });
        }
      }
    }
    
    return suggestions;
  }

  private findRepeatingGroups(attributes: Attribute[]): string[] {
    const groups: string[] = [];
    const patterns = /(\w+)(\d+)$/;
    
    for (const attr of attributes) {
      const match = attr.name.match(patterns);
      if (match) {
        const baseName = match[1];
        const number = parseInt(match[2]);
        
        if (number > 1) {
          // Check if there's a similar attribute with number 1
          const baseAttr = attributes.find(a => a.name === baseName + "1");
          if (baseAttr) {
            groups.push(baseName);
          }
        }
      }
    }
    
    return Array.from(new Set(groups));
  }

  private findPartialDependencies(attributes: Attribute[]): string[] {
    // Simplified partial dependency detection
    const primaryKeys = attributes.filter(attr => attr.isPrimaryKey);
    const nonKeyAttributes = attributes.filter(attr => !attr.isPrimaryKey);
    
    if (primaryKeys.length > 1) {
      // Composite primary key exists, check for partial dependencies
      return nonKeyAttributes.map(attr => attr.name);
    }
    
    return [];
  }

  private findTransitiveDependencies(attributes: Attribute[]): string[] {
    const dependencies: string[] = [];
    
    // Look for patterns like: id -> category_id -> category_name
    for (const attr of attributes) {
      if (attr.name.toLowerCase().includes('name') && !attr.isPrimaryKey) {
        const relatedId = attributes.find(a => 
          a.name.toLowerCase().includes('id') && 
          a.name.toLowerCase().includes(attr.name.toLowerCase().replace('name', '').replace('_', ''))
        );
        
        if (relatedId) {
          dependencies.push(attr.name);
        }
      }
    }
    
    return dependencies;
  }

  private matchesPatterns(text: string, patterns: string[]): boolean {
    return patterns.some(pattern => text.includes(pattern));
  }

  private hasAttributePatterns(attributes: string[], patterns: string[]): boolean {
    return patterns.some(pattern => 
      attributes.some(attr => attr.includes(pattern))
    );
  }

  private getHRDataArea(objectName: string, attributes: string[]): string {
    if (this.matchesPatterns(objectName, ["department", "org"]) ||
        this.hasAttributePatterns(attributes, ["department", "manager"])) {
      return "Organization";
    }
    if (this.hasAttributePatterns(attributes, ["salary", "wage", "pay"])) {
      return "Payroll";
    }
    return "Recruitment";
  }
}

export const aiEngine = new AIEngine();
