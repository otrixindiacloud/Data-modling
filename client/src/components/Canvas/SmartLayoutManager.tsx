import React, { useCallback } from 'react';
import { Node, Edge, useReactFlow } from 'reactflow';

interface LayoutOptions {
  direction: 'TB' | 'BT' | 'LR' | 'RL';
  nodeSpacing: number;
  rankSpacing: number;
  alignment: 'UL' | 'UR' | 'DL' | 'DR';
}

export function useSmartLayout() {
  const { setNodes, setEdges, fitView } = useReactFlow();

  const applyHierarchicalLayout = useCallback((nodes: Node[], edges: Edge[], options: LayoutOptions = {
    direction: 'TB',
    nodeSpacing: 100,
    rankSpacing: 150,
    alignment: 'UL'
  }) => {
    // Build adjacency list for topological sorting
    const adjList = new Map<string, string[]>();
    const inDegree = new Map<string, number>();
    
    // Initialize
    nodes.forEach(node => {
      adjList.set(node.id, []);
      inDegree.set(node.id, 0);
    });
    
    // Build graph from edges
    edges.forEach(edge => {
      const source = edge.source;
      const target = edge.target;
      
      adjList.get(source)?.push(target);
      inDegree.set(target, (inDegree.get(target) || 0) + 1);
    });
    
    // Topological sort to find levels
    const levels: string[][] = [];
    const queue: string[] = [];
    const nodeToLevel = new Map<string, number>();
    
    // Find nodes with no incoming edges (roots)
    inDegree.forEach((degree, nodeId) => {
      if (degree === 0) {
        queue.push(nodeId);
        nodeToLevel.set(nodeId, 0);
      }
    });
    
    // Process nodes level by level
    while (queue.length > 0) {
      const levelSize = queue.length;
      const currentLevel: string[] = [];
      
      for (let i = 0; i < levelSize; i++) {
        const current = queue.shift()!;
        currentLevel.push(current);
        
        // Process neighbors
        adjList.get(current)?.forEach(neighbor => {
          const newInDegree = (inDegree.get(neighbor) || 0) - 1;
          inDegree.set(neighbor, newInDegree);
          
          if (newInDegree === 0) {
            const currentNodeLevel = nodeToLevel.get(current) || 0;
            nodeToLevel.set(neighbor, currentNodeLevel + 1);
            queue.push(neighbor);
          }
        });
      }
      
      if (currentLevel.length > 0) {
        levels.push(currentLevel);
      }
    }
    
    // Handle disconnected nodes (place them in level 0)
    nodes.forEach(node => {
      if (!nodeToLevel.has(node.id)) {
        if (levels.length === 0) levels.push([]);
        levels[0].push(node.id);
        nodeToLevel.set(node.id, 0);
      }
    });
    
    // Calculate positions
    const updatedNodes = nodes.map(node => {
      const level = nodeToLevel.get(node.id) || 0;
      const indexInLevel = levels[level]?.indexOf(node.id) || 0;
      const levelSize = levels[level]?.length || 1;
      
      let x, y;
      
      if (options.direction === 'TB' || options.direction === 'BT') {
        // Top-to-bottom or bottom-to-top
        x = (indexInLevel - (levelSize - 1) / 2) * options.nodeSpacing;
        y = level * options.rankSpacing;
        
        if (options.direction === 'BT') {
          y = -y;
        }
      } else {
        // Left-to-right or right-to-left
        x = level * options.rankSpacing;
        y = (indexInLevel - (levelSize - 1) / 2) * options.nodeSpacing;
        
        if (options.direction === 'RL') {
          x = -x;
        }
      }
      
      return {
        ...node,
        position: { x, y }
      };
    });
    
    setNodes(updatedNodes);
    
    // Fit view after layout
    setTimeout(() => fitView({ duration: 800 }), 100);
    
    return updatedNodes;
  }, [setNodes, fitView]);

  const applyForceDirectedLayout = useCallback((nodes: Node[], edges: Edge[]) => {
    // Simple force-directed algorithm for better organic layouts
    const iterations = 100;
    const k = Math.sqrt((800 * 600) / nodes.length); // Optimal distance
    const c = 0.1; // Cooling factor
    
    // Initialize positions if not set
    const positions = new Map(nodes.map(node => [
      node.id, 
      node.position || { 
        x: Math.random() * 400 - 200, 
        y: Math.random() * 400 - 200 
      }
    ]));
    
    for (let iter = 0; iter < iterations; iter++) {
      const forces = new Map(nodes.map(node => [node.id, { x: 0, y: 0 }]));
      
      // Repulsive forces between all nodes
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const node1 = nodes[i];
          const node2 = nodes[j];
          const pos1 = positions.get(node1.id)!;
          const pos2 = positions.get(node2.id)!;
          
          const dx = pos1.x - pos2.x;
          const dy = pos1.y - pos2.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;
          
          const force = (k * k) / distance;
          const fx = (dx / distance) * force;
          const fy = (dy / distance) * force;
          
          const force1 = forces.get(node1.id)!;
          const force2 = forces.get(node2.id)!;
          
          force1.x += fx;
          force1.y += fy;
          force2.x -= fx;
          force2.y -= fy;
        }
      }
      
      // Attractive forces for connected nodes
      edges.forEach(edge => {
        const pos1 = positions.get(edge.source)!;
        const pos2 = positions.get(edge.target)!;
        
        const dx = pos2.x - pos1.x;
        const dy = pos2.y - pos1.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        
        const force = (distance * distance) / k;
        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;
        
        const force1 = forces.get(edge.source)!;
        const force2 = forces.get(edge.target)!;
        
        force1.x += fx;
        force1.y += fy;
        force2.x -= fx;
        force2.y -= fy;
      });
      
      // Apply forces with cooling
      const temperature = c * (1 - iter / iterations);
      nodes.forEach(node => {
        const force = forces.get(node.id)!;
        const pos = positions.get(node.id)!;
        const magnitude = Math.sqrt(force.x * force.x + force.y * force.y) || 1;
        
        const displacement = Math.min(magnitude, temperature * 50);
        pos.x += (force.x / magnitude) * displacement;
        pos.y += (force.y / magnitude) * displacement;
      });
    }
    
    // Update nodes with new positions
    const updatedNodes = nodes.map(node => ({
      ...node,
      position: positions.get(node.id)!
    }));
    
    setNodes(updatedNodes);
    setTimeout(() => fitView({ duration: 800 }), 100);
    
    return updatedNodes;
  }, [setNodes, fitView]);

  const applyCircularLayout = useCallback((nodes: Node[]) => {
    const centerX = 0;
    const centerY = 0;
    const radius = Math.max(200, nodes.length * 30);
    
    const updatedNodes = nodes.map((node, index) => {
      const angle = (2 * Math.PI * index) / nodes.length;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      
      return {
        ...node,
        position: { x, y }
      };
    });
    
    setNodes(updatedNodes);
    setTimeout(() => fitView({ duration: 800 }), 100);
    
    return updatedNodes;
  }, [setNodes, fitView]);

  const applyGridLayout = useCallback((nodes: Node[]) => {
    const columns = Math.ceil(Math.sqrt(nodes.length));
    const nodeSpacing = 250;
    
    const updatedNodes = nodes.map((node, index) => {
      const row = Math.floor(index / columns);
      const col = index % columns;
      
      return {
        ...node,
        position: {
          x: col * nodeSpacing,
          y: row * nodeSpacing
        }
      };
    });
    
    setNodes(updatedNodes);
    setTimeout(() => fitView({ duration: 800 }), 100);
    
    return updatedNodes;
  }, [setNodes, fitView]);

  return {
    applyHierarchicalLayout,
    applyForceDirectedLayout,
    applyCircularLayout,
    applyGridLayout
  };
}