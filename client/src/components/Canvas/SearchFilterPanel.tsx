import React, { useState, useCallback, useEffect } from 'react';
import { Search, Filter, X, ChevronDown, Target, Database, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { motion, AnimatePresence } from 'framer-motion';
import { useModelerStore } from '@/store/modelerStore';
import { useReactFlow } from 'reactflow';

interface SearchFilterPanelProps {
  isVisible: boolean;
  onClose: () => void;
}

export default function SearchFilterPanel({ isVisible, onClose }: SearchFilterPanelProps) {
  const { nodes, edges, currentLayer } = useModelerStore();
  const { fitView, setCenter } = useReactFlow();
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedSystems, setSelectedSystems] = useState<string[]>([]);
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [showNewOnly, setShowNewOnly] = useState(false);
  const [relationshipType, setRelationshipType] = useState<string>('all');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [colorFilter, setColorFilter] = useState<string>('all');

  // Extract unique systems and domains from nodes
  const availableSystems = Array.from(new Set(nodes.map(node => node.data?.targetSystem).filter(Boolean))) as string[];
  const availableDomains = Array.from(new Set(nodes.map(node => node.data?.domain).filter(Boolean))) as string[];

  // Search and filter logic
  const performSearch = useCallback(() => {
    if (!searchQuery.trim() && selectedSystems.length === 0 && selectedDomains.length === 0 && !showNewOnly && colorFilter === 'all') {
      setSearchResults([]);
      return;
    }

    const results: any[] = [];
    const query = searchQuery.toLowerCase();

    // Search through nodes (objects)
    nodes.forEach(node => {
      const objectName = node.data?.name?.toLowerCase() || '';
      const targetSystem = node.data?.targetSystem || '';
      const domain = node.data?.domain || '';
      const isNew = node.data?.isNew || false;

      // Apply filters
      if (selectedSystems.length > 0 && !selectedSystems.includes(targetSystem)) return;
      if (selectedDomains.length > 0 && !selectedDomains.includes(domain)) return;
      if (showNewOnly && !isNew) return;
      
      // Apply color filter
      if (colorFilter !== 'all') {
        if (colorFilter === 'new' && !isNew) return;
        if (colorFilter === 'system' && !targetSystem) return;
        if (colorFilter === 'domain' && !domain) return;
      }

      // Apply search query
      const matchesQuery = !searchQuery.trim() || 
        objectName.includes(query) ||
        targetSystem.toLowerCase().includes(query) ||
        domain.toLowerCase().includes(query);

      if (matchesQuery) {
        results.push({
          type: 'object',
          id: node.id,
          name: node.data?.name || '',
          targetSystem,
          domain,
          isNew,
          position: node.position,
          matchType: objectName.includes(query) ? 'name' : 'system'
        });
      }

      // Search through attributes if in logical/physical layer
      if (currentLayer !== 'conceptual' && node.data?.attributes) {
        node.data.attributes.forEach((attr: any) => {
          const attrName = attr.name?.toLowerCase() || '';
          const attrType = attr.type?.toLowerCase() || '';
          
          if (matchesQuery && (attrName.includes(query) || attrType.includes(query))) {
            results.push({
              type: 'attribute',
              id: `${node.id}-${attr.id}`,
              name: `${node.data?.name}.${attr.name}`,
              attributeName: attr.name,
              attributeType: attr.type,
              objectId: node.id,
              objectName: node.data?.name,
              targetSystem,
              domain,
              isNew: attr.isNew,
              position: node.position,
              matchType: attrName.includes(query) ? 'attribute' : 'type'
            });
          }
        });
      }
    });

    // Search through relationships
    if (relationshipType === 'all' || relationshipType !== 'all') {
      edges.forEach(edge => {
        const sourceNode = nodes.find(n => n.id === edge.source);
        const targetNode = nodes.find(n => n.id === edge.target);
        const edgeType = edge.data?.relationshipType || edge.data?.label || '';

        if (relationshipType !== 'all' && edgeType !== relationshipType) return;

        const searchableText = `${sourceNode?.data?.name || ''} ${targetNode?.data?.name || ''} ${edgeType}`.toLowerCase();
        
        if (!searchQuery.trim() || searchableText.includes(query)) {
          results.push({
            type: 'relationship',
            id: edge.id,
            name: `${sourceNode?.data?.name || ''} → ${targetNode?.data?.name || ''}`,
            relationshipType: edgeType,
            source: sourceNode?.data?.name || '',
            target: targetNode?.data?.name || '',
            sourcePosition: sourceNode?.position,
            targetPosition: targetNode?.position,
            matchType: 'relationship'
          });
        }
      });
    }

    setSearchResults(results);
  }, [searchQuery, selectedSystems, selectedDomains, showNewOnly, relationshipType, colorFilter, nodes, edges, currentLayer]);

  // Perform search when inputs change
  useEffect(() => {
    performSearch();
  }, [performSearch]);

  // Navigate to search result
  const navigateToResult = useCallback((result: any) => {
    if (result.type === 'object' || result.type === 'attribute') {
      // Center on the object
      setCenter(result.position.x + 150, result.position.y + 100, { zoom: 1.2, duration: 800 });
      
      // Highlight the node temporarily
      const nodeElement = document.querySelector(`[data-id="${result.objectId || result.id}"]`);
      if (nodeElement) {
        nodeElement.classList.add('ring-4', 'ring-blue-500', 'ring-opacity-50');
        setTimeout(() => {
          nodeElement.classList.remove('ring-4', 'ring-blue-500', 'ring-opacity-50');
        }, 2000);
      }
    } else if (result.type === 'relationship' && result.sourcePosition && result.targetPosition) {
      // Center between source and target
      const centerX = (result.sourcePosition.x + result.targetPosition.x) / 2;
      const centerY = (result.sourcePosition.y + result.targetPosition.y) / 2;
      setCenter(centerX, centerY, { zoom: 1, duration: 800 });
    }
  }, [setCenter]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f' && isVisible) {
        e.preventDefault();
        document.getElementById('search-input')?.focus();
      }
      if (e.key === 'Escape' && isVisible) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="absolute top-16 left-1/2 transform -translate-x-1/2 z-50 w-96 max-w-[90vw]"
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-border overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2 mb-3">
            <Search className="h-5 w-5 text-muted-foreground" />
            <Input
              id="search-input"
              placeholder="Search objects, attributes, relationships..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
              autoFocus
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="text-xs"
            >
              <Filter className="h-3 w-3 mr-1" />
              Filters
              <ChevronDown className={`h-3 w-3 ml-1 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </Button>
            
            {(selectedSystems.length > 0 || selectedDomains.length > 0 || showNewOnly || colorFilter !== 'all') && (
              <Badge variant="secondary" className="text-xs">
                {selectedSystems.length + selectedDomains.length + (showNewOnly ? 1 : 0) + (colorFilter !== 'all' ? 1 : 0)} filters
              </Badge>
            )}
          </div>
        </div>

        {/* Filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              className="overflow-hidden border-b border-border"
            >
              <div className="p-4 space-y-3">
                {/* Systems Filter */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">
                    Target Systems
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {availableSystems.map(system => (
                      <Button
                        key={system}
                        variant={selectedSystems.includes(system) ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          setSelectedSystems(prev => 
                            prev.includes(system)
                              ? prev.filter(s => s !== system)
                              : [...prev, system]
                          );
                        }}
                        className="text-xs h-7"
                      >
                        <Target className="h-3 w-3 mr-1" />
                        {system}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Domains Filter */}
                {availableDomains.length > 0 && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-2 block">
                      Domains
                    </label>
                    <div className="flex flex-wrap gap-1">
                      {availableDomains.map(domain => (
                        <Button
                          key={domain}
                          variant={selectedDomains.includes(domain) ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            setSelectedDomains(prev => 
                              prev.includes(domain)
                                ? prev.filter(d => d !== domain)
                                : [...prev, domain]
                            );
                          }}
                          className="text-xs h-7"
                        >
                          <Database className="h-3 w-3 mr-1" />
                          {domain}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Color Filter */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">
                    Color Filter
                  </label>
                  <Select value={colorFilter} onValueChange={setColorFilter}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Colors</SelectItem>
                      <SelectItem value="new">New Items Only</SelectItem>
                      <SelectItem value="system">With Target System</SelectItem>
                      <SelectItem value="domain">With Domain</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Additional Filters */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="new-only"
                      checked={showNewOnly}
                      onCheckedChange={(checked) => setShowNewOnly(checked === true)}
                    />
                    <label htmlFor="new-only" className="text-xs text-muted-foreground">
                      New items only
                    </label>
                  </div>

                  <Select value={relationshipType} onValueChange={setRelationshipType}>
                    <SelectTrigger className="w-32 h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Relations</SelectItem>
                      <SelectItem value="1:1">1:1</SelectItem>
                      <SelectItem value="1:N">1:N</SelectItem>
                      <SelectItem value="N:M">N:M</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results */}
        <div className="max-h-64 overflow-y-auto">
          {searchResults.length === 0 && (searchQuery.trim() || selectedSystems.length > 0 || selectedDomains.length > 0 || showNewOnly) ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              No results found
            </div>
          ) : searchResults.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              Start typing to search or use filters
            </div>
          ) : (
            <div className="divide-y divide-border">
              {searchResults.map((result, index) => (
                <button
                  key={result.id}
                  onClick={() => navigateToResult(result)}
                  className="w-full p-3 text-left hover:bg-accent transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      {result.type === 'object' && <Database className="h-4 w-4 text-blue-500 flex-shrink-0" />}
                      {result.type === 'attribute' && <Layers className="h-4 w-4 text-green-500 flex-shrink-0" />}
                      {result.type === 'relationship' && <Target className="h-4 w-4 text-purple-500 flex-shrink-0" />}
                      
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">{result.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {result.type === 'object' && `${result.targetSystem} • ${result.domain}`}
                          {result.type === 'attribute' && `${result.attributeType} in ${result.objectName}`}
                          {result.type === 'relationship' && `${result.relationshipType} relationship`}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {result.isNew && (
                        <Badge variant="outline" className="text-xs">New</Badge>
                      )}
                      <Badge variant="secondary" className="text-xs capitalize">
                        {result.type}
                      </Badge>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {searchResults.length > 0 && (
          <div className="p-2 bg-muted text-center text-xs text-muted-foreground border-t border-border">
            {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
          </div>
        )}
      </div>
    </motion.div>
  );
}