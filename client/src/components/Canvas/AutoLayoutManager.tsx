import React, { useCallback } from 'react';
import { Node, Edge, useReactFlow } from 'reactflow';
import { Grid, Shuffle, GitBranch, Target, Layers, ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useModelerStore } from '@/store/modelerStore';
import { Badge } from '@/components/ui/badge';

interface AutoLayoutManagerProps {
  onLayoutApplied?: () => void;
}

// Layout algorithms
const layoutAlgorithms = {
  hierarchical: 'Hierarchical',
  grid: 'Grid',
  force: 'Force-Directed', 
  circular: 'Circular',
  domain: 'Domain Groups',
  system: 'System Groups'
};

export default function AutoLayoutManager({ onLayoutApplied }: AutoLayoutManagerProps) {
  const { nodes, edges, setNodes } = useModelerStore();
  const { fitView } = useReactFlow();

  // Calculate hierarchical layout based on relationships
  const applyHierarchicalLayout = useCallback(() => {
    const nodeMap = new Map(nodes.map(node => [node.id, { ...node, level: 0, children: [] as any[] }]));
    const rootNodes: any[] = [];
    
    // Build hierarchy based on relationships
    edges.forEach(edge => {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);
      if (source && target) {
        source.children.push(target);
        target.level = Math.max(target.level, source.level + 1);
      }
    });

    // Find root nodes (no incoming edges)
    const hasIncoming = new Set(edges.map(e => e.target));
    nodes.forEach(node => {
      if (!hasIncoming.has(node.id)) {
        rootNodes.push(nodeMap.get(node.id));
      }
    });

    // Layout nodes level by level
    const levelWidth = 300;
    const levelHeight = 200;
    const nodeWidth = 200;
    
    const levelNodes = new Map<number, any[]>();
    nodeMap.forEach(node => {
      const level = node.level;
      if (!levelNodes.has(level)) levelNodes.set(level, []);
      levelNodes.get(level)!.push(node);
    });

    const newNodes = nodes.map(node => {
      const nodeData = nodeMap.get(node.id)!;
      const level = nodeData.level;
      const levelNodesList = levelNodes.get(level)!;
      const indexInLevel = levelNodesList.indexOf(nodeData);
      
      return {
        ...node,
        position: {
          x: indexInLevel * levelWidth,
          y: level * levelHeight
        }
      };
    });

    setNodes(newNodes);
  }, [nodes, edges, setNodes]);

  // Apply grid layout
  const applyGridLayout = useCallback(() => {
    const cols = Math.ceil(Math.sqrt(nodes.length));
    const cellWidth = 300;
    const cellHeight = 200;

    const newNodes = nodes.map((node, index) => ({
      ...node,
      position: {
        x: (index % cols) * cellWidth,
        y: Math.floor(index / cols) * cellHeight
      }
    }));

    setNodes(newNodes);
  }, [nodes, setNodes]);

  // Apply force-directed layout (simplified)
  const applyForceDirectedLayout = useCallback(() => {
    const iterations = 100;
    const k = 200; // optimal distance
    const attraction = 0.1;
    const repulsion = 1000;
    
    let nodePositions = nodes.map(node => ({
      id: node.id,
      x: node.position.x || Math.random() * 800,
      y: node.position.y || Math.random() * 600,
      vx: 0,
      vy: 0
    }));

    // Run force simulation
    for (let iter = 0; iter < iterations; iter++) {
      // Reset forces
      nodePositions.forEach(node => {
        node.vx = 0;
        node.vy = 0;
      });

      // Repulsion between all nodes
      for (let i = 0; i < nodePositions.length; i++) {
        for (let j = i + 1; j < nodePositions.length; j++) {
          const n1 = nodePositions[i];
          const n2 = nodePositions[j];
          const dx = n2.x - n1.x;
          const dy = n2.y - n1.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = repulsion / (distance * distance);
          
          n1.vx -= (dx / distance) * force;
          n1.vy -= (dy / distance) * force;
          n2.vx += (dx / distance) * force;
          n2.vy += (dy / distance) * force;
        }
      }

      // Attraction along edges
      edges.forEach(edge => {
        const source = nodePositions.find(n => n.id === edge.source);
        const target = nodePositions.find(n => n.id === edge.target);
        if (source && target) {
          const dx = target.x - source.x;
          const dy = target.y - source.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = attraction * (distance - k);
          
          source.vx += (dx / distance) * force;
          source.vy += (dy / distance) * force;
          target.vx -= (dx / distance) * force;
          target.vy -= (dy / distance) * force;
        }
      });

      // Apply forces with damping
      const damping = 0.9;
      nodePositions.forEach(node => {
        node.x += node.vx * damping;
        node.y += node.vy * damping;
      });
    }

    const newNodes = nodes.map(node => {
      const pos = nodePositions.find(p => p.id === node.id);
      return {
        ...node,
        position: pos ? { x: pos.x, y: pos.y } : node.position
      };
    });

    setNodes(newNodes);
  }, [nodes, edges, setNodes]);

  // Apply circular layout
  const applyCircularLayout = useCallback(() => {
    const centerX = 400;
    const centerY = 300;
    const radius = Math.max(200, nodes.length * 30);

    const newNodes = nodes.map((node, index) => {
      const angle = (2 * Math.PI * index) / nodes.length;
      return {
        ...node,
        position: {
          x: centerX + radius * Math.cos(angle),
          y: centerY + radius * Math.sin(angle)
        }
      };
    });

    setNodes(newNodes);
  }, [nodes, setNodes]);

  // Group by domain
  const applyDomainGroupLayout = useCallback(() => {
    const domains = Array.from(new Set(nodes.map(node => node.data?.domain).filter(Boolean)));
    const groupSpacing = 400;
    const nodesPerRow = 3;
    const nodeSpacing = 250;

    const newNodes = nodes.map(node => {
      const domain = node.data?.domain || 'Uncategorized';
      const domainIndex = domains.includes(domain) ? domains.indexOf(domain) : domains.length;
      const nodesInDomain = nodes.filter(n => (n.data?.domain || 'Uncategorized') === domain);
      const indexInDomain = nodesInDomain.indexOf(node);
      
      const row = Math.floor(indexInDomain / nodesPerRow);
      const col = indexInDomain % nodesPerRow;

      return {
        ...node,
        position: {
          x: domainIndex * groupSpacing + col * nodeSpacing,
          y: row * 200
        }
      };
    });

    setNodes(newNodes);
  }, [nodes, setNodes]);

  // Group by target system
  const applySystemGroupLayout = useCallback(() => {
    const systems = Array.from(new Set(nodes.map(node => node.data?.targetSystem).filter(Boolean)));
    const groupSpacing = 450;
    const nodesPerRow = 3;
    const nodeSpacing = 250;

    const newNodes = nodes.map(node => {
      const system = node.data?.targetSystem || 'Uncategorized';
      const systemIndex = systems.includes(system) ? systems.indexOf(system) : systems.length;
      const nodesInSystem = nodes.filter(n => (n.data?.targetSystem || 'Uncategorized') === system);
      const indexInSystem = nodesInSystem.indexOf(node);
      
      const row = Math.floor(indexInSystem / nodesPerRow);
      const col = indexInSystem % nodesPerRow;

      return {
        ...node,
        position: {
          x: systemIndex * groupSpacing + col * nodeSpacing,
          y: row * 200
        }
      };
    });

    setNodes(newNodes);
  }, [nodes, setNodes]);

  const applyLayout = useCallback((layoutType: string) => {
    switch (layoutType) {
      case 'hierarchical':
        applyHierarchicalLayout();
        break;
      case 'grid':
        applyGridLayout();
        break;
      case 'force':
        applyForceDirectedLayout();
        break;
      case 'circular':
        applyCircularLayout();
        break;
      case 'domain':
        applyDomainGroupLayout();
        break;
      case 'system':
        applySystemGroupLayout();
        break;
    }

    // Auto-fit view after layout
    setTimeout(() => {
      fitView({ duration: 800 });
      onLayoutApplied?.();
    }, 100);
  }, [
    applyHierarchicalLayout,
    applyGridLayout,
    applyForceDirectedLayout,
    applyCircularLayout,
    applyDomainGroupLayout,
    applySystemGroupLayout,
    fitView,
    onLayoutApplied
  ]);

  // Get layout recommendations based on model characteristics
  const getRecommendedLayouts = useCallback(() => {
    const recommendations = [];
    
    if (edges.length > 0) {
      recommendations.push({
        type: 'hierarchical',
        reason: 'Has relationships - good for showing data flow'
      });
    }
    
    const domains = new Set(nodes.map(node => node.data?.domain).filter(Boolean));
    if (domains.size > 1) {
      recommendations.push({
        type: 'domain',
        reason: `${domains.size} domains - group by business area`
      });
    }
    
    const systems = new Set(nodes.map(node => node.data?.targetSystem).filter(Boolean));
    if (systems.size > 1) {
      recommendations.push({
        type: 'system',
        reason: `${systems.size} systems - group by target system`
      });
    }
    
    if (nodes.length > 10) {
      recommendations.push({
        type: 'force',
        reason: 'Large model - force-directed reduces clutter'
      });
    }
    
    return recommendations;
  }, [nodes, edges]);

  const recommendations = getRecommendedLayouts();

  return (
    <div className="absolute top-4 right-4 z-10 bg-card/95 dark:bg-card/95 backdrop-blur-md rounded-xl shadow-strong border border-border p-4 max-w-sm max-h-[80vh] overflow-y-auto animate-slide-up">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-lg">
          <GitBranch className="h-4 w-4 text-primary" />
        </div>
        <div>
          <span className="text-sm font-semibold text-foreground">Smart Auto Layout</span>
          <p className="text-xs text-muted-foreground">Optimize your diagram automatically</p>
        </div>
      </div>

      {/* Quick Layout Buttons */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => applyLayout('hierarchical')}
          className="text-xs h-10 touch-target hover:bg-primary/10 hover:border-primary/50 hover:text-primary transition-all duration-200 hover:scale-105"
        >
          <ArrowUp className="h-4 w-4 mr-1" />
          <div className="flex flex-col">
            <span className="font-medium">Hierarchy</span>
            <span className="text-xs opacity-75">Top-down</span>
          </div>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => applyLayout('grid')}
          className="text-xs h-10 touch-target hover:bg-green-50 hover:border-green-200 hover:text-green-700 dark:hover:bg-green-950 dark:hover:border-green-800 dark:hover:text-green-300 transition-all duration-200 hover:scale-105"
        >
          <Grid className="h-4 w-4 mr-1" />
          <div className="flex flex-col">
            <span className="font-medium">Grid</span>
            <span className="text-xs opacity-75">Aligned</span>
          </div>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => applyLayout('domain')}
          className="text-xs h-10 touch-target hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 dark:hover:bg-blue-950 dark:hover:border-blue-800 dark:hover:text-blue-300 transition-all duration-200 hover:scale-105"
        >
          <Layers className="h-4 w-4 mr-1" />
          <div className="flex flex-col">
            <span className="font-medium">Domains</span>
            <span className="text-xs opacity-75">By area</span>
          </div>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => applyLayout('system')}
          className="text-xs h-10 touch-target hover:bg-purple-50 hover:border-purple-200 hover:text-purple-700 dark:hover:bg-purple-950 dark:hover:border-purple-800 dark:hover:text-purple-300 transition-all duration-200 hover:scale-105"
        >
          <Target className="h-4 w-4 mr-1" />
          <div className="flex flex-col">
            <span className="font-medium">Systems</span>
            <span className="text-xs opacity-75">By target</span>
          </div>
        </Button>
      </div>

      {/* Advanced Layout Selector */}
      <Select onValueChange={applyLayout}>
        <SelectTrigger className="w-full h-10 text-sm bg-muted/50 border-border hover:bg-muted transition-colors duration-200">
          <SelectValue placeholder="🎯 More layouts..." />
        </SelectTrigger>
        <SelectContent className="bg-card/95 backdrop-blur-md border-border">
          <SelectItem value="force" className="hover:bg-orange-50 dark:hover:bg-orange-950">
            <div className="flex items-center">
              <Shuffle className="h-4 w-4 mr-2 text-orange-600" />
              <div className="flex flex-col">
                <span>Force-Directed</span>
                <span className="text-xs text-muted-foreground">Physics-based positioning</span>
              </div>
            </div>
          </SelectItem>
          <SelectItem value="circular" className="hover:bg-indigo-50 dark:hover:bg-indigo-950">
            <div className="flex items-center">
              <div className="w-4 h-4 border-2 border-indigo-600 rounded-full mr-2"></div>
              <div className="flex flex-col">
                <span>Circular</span>
                <span className="text-xs text-muted-foreground">Radial arrangement</span>
              </div>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 bg-gradient-to-r from-yellow-400 to-amber-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium text-foreground">AI Recommendations</span>
          </div>
          <div className="space-y-2">
            {recommendations.slice(0, 2).map((rec, index) => (
              <button
                key={index}
                onClick={() => applyLayout(rec.type)}
                className="w-full text-left p-3 rounded-lg bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/50 dark:to-yellow-950/50 border border-amber-200/50 dark:border-amber-800/50 hover:from-amber-100 hover:to-yellow-100 dark:hover:from-amber-900/50 dark:hover:to-yellow-900/50 transition-all duration-200 hover:scale-105 touch-target"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold capitalize text-amber-900 dark:text-amber-100">
                    {layoutAlgorithms[rec.type as keyof typeof layoutAlgorithms]}
                  </span>
                  <Badge variant="secondary" className="text-xs bg-amber-200 text-amber-800 dark:bg-amber-800 dark:text-amber-200">
                    ⭐ Recommended
                  </Badge>
                </div>
                <div className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">{rec.reason}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Model Stats */}
      <div className="mt-4 pt-4 border-t border-border">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900 dark:to-indigo-900 rounded-md flex items-center justify-center">
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400">📊</span>
          </div>
          <span className="text-sm font-medium text-foreground">Model Statistics</span>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-muted/50 rounded-lg p-2 text-center">
            <div className="font-semibold text-primary">{nodes.length}</div>
            <div className="text-xs text-muted-foreground">Objects</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-2 text-center">
            <div className="font-semibold text-secondary">{edges.length}</div>
            <div className="text-xs text-muted-foreground">Relations</div>
          </div>
        </div>
      </div>
    </div>
  );
}