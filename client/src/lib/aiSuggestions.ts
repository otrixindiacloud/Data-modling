import { apiRequest } from "@/lib/queryClient";
import { AISuggestion } from "@/types/modeler";

export async function generateDomainSuggestions(
  objectName: string,
  attributeNames: string[]
): Promise<AISuggestion[]> {
  try {
    const response = await apiRequest("POST", "/api/ai/suggest-domain", {
      objectName,
      attributes: attributeNames,
    });
    
    const suggestions = await response.json();
    
    return suggestions.map((suggestion: any) => ({
      type: "domain" as const,
      title: `Classify as ${suggestion.domain}`,
      description: `${suggestion.reasoning} (${Math.round(suggestion.confidence * 100)}% confidence)`,
      confidence: suggestion.confidence,
      action: () => {
        // This will be implemented in the component that uses it
        console.log("Apply domain suggestion:", suggestion);
      },
    }));
  } catch (error) {
    console.error("Failed to generate domain suggestions:", error);
    return [];
  }
}

export async function generateRelationshipSuggestions(
  modelId: number
): Promise<AISuggestion[]> {
  try {
    const response = await apiRequest("POST", "/api/ai/suggest-relationships", {
      modelId,
    });
    
    const suggestions = await response.json();
    
    return suggestions.map((suggestion: any) => ({
      type: "relationship" as const,
      title: `${suggestion.type} Relationship`,
      description: `${suggestion.reasoning} (${Math.round(suggestion.confidence * 100)}% confidence)`,
      confidence: suggestion.confidence,
      action: () => {
        console.log("Apply relationship suggestion:", suggestion);
      },
    }));
  } catch (error) {
    console.error("Failed to generate relationship suggestions:", error);
    return [];
  }
}

export async function generateNormalizationSuggestions(
  modelId: number
): Promise<AISuggestion[]> {
  try {
    const response = await apiRequest("POST", "/api/ai/suggest-normalization", {
      modelId,
    });
    
    const suggestions = await response.json();
    
    return suggestions.map((suggestion: any) => ({
      type: "normalization" as const,
      title: `${suggestion.type} Normalization Issue`,
      description: `${suggestion.reasoning} (${Math.round(suggestion.confidence * 100)}% confidence)`,
      confidence: suggestion.confidence,
      action: () => {
        console.log("Apply normalization suggestion:", suggestion);
      },
    }));
  } catch (error) {
    console.error("Failed to generate normalization suggestions:", error);
    return [];
  }
}

export async function generateTypeMappingSuggestions(
  conceptualType: string
): Promise<{ logicalType: string; physicalType: string; reasoning: string }> {
  try {
    const response = await apiRequest("POST", "/api/ai/suggest-types", {
      conceptualType,
    });
    
    return await response.json();
  } catch (error) {
    console.error("Failed to generate type mapping suggestions:", error);
    return {
      logicalType: "VARCHAR",
      physicalType: "VARCHAR(255)",
      reasoning: "Default mapping for unknown type",
    };
  }
}

