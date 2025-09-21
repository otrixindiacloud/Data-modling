// Utility for generating consistent colors for different systems
export function getSystemColor(systemName: string | null | undefined): string {
  if (!systemName) return "border-gray-300";
  
  // Generate a consistent color based on system name hash
  let hash = 0;
  for (let i = 0; i < systemName.length; i++) {
    const char = systemName.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Define a palette of professional colors
  const colors = [
    "border-blue-500",     // Blue
    "border-green-500",    // Green  
    "border-purple-500",   // Purple
    "border-orange-500",   // Orange
    "border-red-500",      // Red
    "border-teal-500",     // Teal
    "border-indigo-500",   // Indigo
    "border-pink-500",     // Pink
    "border-yellow-500",   // Yellow
    "border-cyan-500",     // Cyan
    "border-emerald-500",  // Emerald
    "border-violet-500",   // Violet
  ];
  
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

export function getSystemColorBg(systemName: string | null | undefined): string {
  if (!systemName) return "bg-gray-50";
  
  // Generate a consistent background color based on system name hash
  let hash = 0;
  for (let i = 0; i < systemName.length; i++) {
    const char = systemName.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Define a palette of light background colors
  const colors = [
    "bg-blue-50",      // Blue
    "bg-green-50",     // Green  
    "bg-purple-50",    // Purple
    "bg-orange-50",    // Orange
    "bg-red-50",       // Red
    "bg-teal-50",      // Teal
    "bg-indigo-50",    // Indigo
    "bg-pink-50",      // Pink
    "bg-yellow-50",    // Yellow
    "bg-cyan-50",      // Cyan
    "bg-emerald-50",   // Emerald
    "bg-violet-50",    // Violet
  ];
  
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

export function getSystemColorText(systemName: string | null | undefined): string {
  if (!systemName) return "text-gray-600";
  
  // Generate a consistent text color based on system name hash
  let hash = 0;
  for (let i = 0; i < systemName.length; i++) {
    const char = systemName.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Define a palette of text colors
  const colors = [
    "text-blue-600",     // Blue
    "text-green-600",    // Green  
    "text-purple-600",   // Purple
    "text-orange-600",   // Orange
    "text-red-600",      // Red
    "text-teal-600",     // Teal
    "text-indigo-600",   // Indigo
    "text-pink-600",     // Pink
    "text-yellow-600",   // Yellow
    "text-cyan-600",     // Cyan
    "text-emerald-600",  // Emerald
    "text-violet-600",   // Violet
  ];
  
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}