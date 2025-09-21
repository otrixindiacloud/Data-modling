// Color coding system for source/target visualization
export const SYSTEM_COLORS = {
  'Data Lake': 'bg-blue-50 border-blue-200 text-blue-900',
  'Data Warehouse': 'bg-purple-50 border-purple-200 text-purple-900', 
  'Operational Database': 'bg-green-50 border-green-200 text-green-900',
  'Analytics Platform': 'bg-orange-50 border-orange-200 text-orange-900',
  'Cloud Storage': 'bg-cyan-50 border-cyan-200 text-cyan-900',
  'Real-time Stream': 'bg-red-50 border-red-200 text-red-900',
  'External System': 'bg-gray-50 border-gray-200 text-gray-900',
  'Default': 'bg-slate-50 border-slate-200 text-slate-900'
};

// Dynamic color storage for systems, domains, and areas
let dynamicSystemColors: Record<string, string> = {};
let dynamicDomainColors: Record<string, string> = {};
let dynamicAreaColors: Record<string, string> = {};

// Update dynamic colors from API data
export function updateDynamicColors(systems: any[], domains: any[], areas: any[]) {
  // Update system colors
  systems.forEach(system => {
    if (system.colorCode) {
      dynamicSystemColors[system.name] = system.colorCode;
    }
  });
  
  // Update domain colors
  domains.forEach(domain => {
    if (domain.colorCode) {
      dynamicDomainColors[domain.name] = domain.colorCode;
    }
  });
  
  // Update area colors
  areas.forEach(area => {
    if (area.colorCode) {
      dynamicAreaColors[area.name] = area.colorCode;
    }
  });
}

// Get color classes for a system (with dynamic color support)
export function getSystemColor(systemName: string | null | undefined): string {
  if (!systemName) return SYSTEM_COLORS.Default;
  
  // Check if we have a dynamic color for this system
  if (dynamicSystemColors[systemName]) {
    const color = dynamicSystemColors[systemName];
    return `bg-[${color}20] border-[${color}] text-[${color}]`;
  }
  
  return SYSTEM_COLORS[systemName as keyof typeof SYSTEM_COLORS] || SYSTEM_COLORS.Default;
}

// Get color classes for a domain
export function getDomainColor(domainName: string | null | undefined): string {
  if (!domainName) return 'bg-slate-50 border-slate-200 text-slate-900';
  
  if (dynamicDomainColors[domainName]) {
    const color = dynamicDomainColors[domainName];
    return `bg-[${color}20] border-[${color}] text-[${color}]`;
  }
  
  return 'bg-slate-50 border-slate-200 text-slate-900';
}

// Get color classes for an area
export function getAreaColor(areaName: string | null | undefined): string {
  if (!areaName) return 'bg-slate-50 border-slate-200 text-slate-900';
  
  if (dynamicAreaColors[areaName]) {
    const color = dynamicAreaColors[areaName];
    return `bg-[${color}20] border-[${color}] text-[${color}]`;
  }
  
  return 'bg-slate-50 border-slate-200 text-slate-900';
}

// Get color for new objects/attributes
export function getNewItemColor(): string {
  return 'bg-green-100 border-green-300 text-green-900 ring-2 ring-green-200';
}

// Get border color for different systems
export function getSystemBorderColor(systemName: string | null | undefined): string {
  const colorMap = {
    'Data Lake': 'border-blue-400',
    'Data Warehouse': 'border-purple-400',
    'Operational Database': 'border-green-400', 
    'Analytics Platform': 'border-orange-400',
    'Cloud Storage': 'border-cyan-400',
    'Real-time Stream': 'border-red-400',
    'External System': 'border-gray-400',
    'Default': 'border-slate-400'
  };
  
  if (!systemName) return colorMap.Default;
  return colorMap[systemName as keyof typeof colorMap] || colorMap.Default;
}

// Get header background for different systems
export function getSystemHeaderColor(systemName: string | null | undefined): string {
  const colorMap = {
    'Data Lake': 'bg-blue-500',
    'Data Warehouse': 'bg-purple-500',
    'Operational Database': 'bg-green-500',
    'Analytics Platform': 'bg-orange-500', 
    'Cloud Storage': 'bg-cyan-500',
    'Real-time Stream': 'bg-red-500',
    'External System': 'bg-gray-500',
    'Default': 'bg-slate-500'
  };
  
  if (!systemName) return colorMap.Default;
  return colorMap[systemName as keyof typeof colorMap] || colorMap.Default;
}