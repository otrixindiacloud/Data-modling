import React from 'react';
import { BusinessCapabilityMap } from "@/components/BusinessCapabilityMap";

export function BusinessCapabilityMapPage() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Business Capability Map</h1>
        <p className="text-muted-foreground mt-2">
          Explore the manufacturing business capabilities and their relationships to data domains, areas, and systems.
        </p>
      </div>
      <BusinessCapabilityMap />
    </div>
  );
}