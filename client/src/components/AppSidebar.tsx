import { useLocation } from "wouter";
import { Home, Layers3, Server, Settings, BarChart3 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ThemeToggle";

interface AppSidebarProps {
  onNavigate?: () => void;
}

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  description?: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "Home",
    href: "/",
    icon: Home,
  },
  {
    label: "Model List",
    href: "/models",
    icon: Layers3,
  },
  {
    label: "Systems",
    href: "/systems",
    icon: Server,
  },
  {
    label: "Configurations",
    href: "/configuration",
    icon: Settings,
  },
  {
    label: "Reports",
    href: "/reports",
    icon: BarChart3,
  },
];

export function AppSidebar({ onNavigate }: AppSidebarProps) {
  const [location, setLocation] = useLocation();

  const handleNavigate = (href: string) => {
    setLocation(href);
    onNavigate?.();
  };

  return (
    <div className="flex h-full flex-col bg-card text-card-foreground">
      <div className="px-4 pb-4 pt-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 via-purple-600 to-blue-700 shadow-lg ring-1 ring-white/20 dark:ring-white/10">
            <svg width="20" height="20" viewBox="0 0 32 32" fill="none" className="text-white">
              <path
                d="M4 4 L4 28 L16 28 Q24 28 28 20 Q28 16 28 12 Q24 4 16 4 Z"
                fill="currentColor"
                fillOpacity="0.9"
              />
              <circle cx="20" cy="12" r="2" fill="currentColor" fillOpacity="0.7" />
              <circle cx="16" cy="16" r="1.5" fill="currentColor" fillOpacity="0.6" />
              <circle cx="12" cy="20" r="1" fill="currentColor" fillOpacity="0.5" />
              <path d="M20 12 L16 16 L12 20" stroke="currentColor" strokeWidth="1" strokeOpacity="0.4" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">DArk Modeler</h2>
            <p className="text-xs text-muted-foreground">AI-Powered Data Architecture</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-4">
        <div className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = item.href === "/"
              ? location === "/" || location.startsWith("/home")
              : location === item.href || location.startsWith(`${item.href}/`);
            return (
              <button
                key={item.href}
                type="button"
                onClick={() => handleNavigate(item.href)}
                className={cn(
                  "w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all", 
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-border px-4 py-4">
        <div className="rounded-lg bg-muted/40 p-4">
          <p className="text-xs text-muted-foreground mb-2 font-medium">Theme</p>
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}

export default AppSidebar;
