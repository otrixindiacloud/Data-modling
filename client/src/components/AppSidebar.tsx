import { useLocation } from "wouter";
import { Home, Layers3, Server, Settings, BarChart3, Building2, Database, PanelLeftClose, PanelLeftOpen, LogOut, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AppSidebarProps {
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
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
    label: "Business Capabilities",
    href: "/capabilities",
    icon: Building2,
    description: "Business capability map"
  },
  {
    label: "Systems",
    href: "/systems",
    icon: Server,
  },
  {
    label: "Object Lake",
    href: "/object-lake",
    icon: Database,
    description: "Unified object management"
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

export function AppSidebar({ onNavigate, collapsed = false, onToggleCollapse }: AppSidebarProps) {
  const [location, setLocation] = useLocation();
  const { user, organization, logout } = useAuth();

  const handleNavigate = (href: string) => {
    setLocation(href);
    onNavigate?.();
  };

  const handleLogout = async () => {
    try {
      await logout();
      setLocation("/auth/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <TooltipProvider delayDuration={100}>
      <div
        className={cn(
          "flex h-full flex-col bg-card text-card-foreground",
          collapsed && "items-center"
        )}
      >
        <div
          className={cn(
            "border-b border-border px-4 pb-4 pt-6 w-full",
            collapsed && "px-2"
          )}
        >
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "flex flex-1 items-center gap-3 transition-all duration-300",
                collapsed && "justify-center gap-0"
              )}
            >
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
              {!collapsed && (
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">DArk Modeler</h2>
                  <p className="text-xs text-muted-foreground">AI-Powered Data Architecture</p>
                </div>
              )}
            </div>
            {onToggleCollapse && (
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={onToggleCollapse}
                    className={cn(
                      "h-8 w-8 rounded-md border border-transparent text-muted-foreground transition hover:text-foreground",
                      collapsed && "h-9 w-9"
                    )}
                    aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
                  >
                    {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p className="text-sm font-medium">{collapsed ? "Expand" : "Collapse"} navigation</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        <nav
          className={cn(
            "flex-1 overflow-y-auto px-2 py-4 w-full",
            collapsed && "px-1 py-3"
          )}
        >
          <div className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = item.href === "/"
                ? location === "/" || location.startsWith("/home")
                : location === item.href || location.startsWith(`${item.href}/`);

              const buttonClasses = cn(
                "w-full flex items-center rounded-md text-sm font-medium transition-all",
                collapsed ? "justify-center px-2 py-2" : "gap-3 px-3 py-2",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              );

              if (collapsed) {
                return (
                  <Tooltip key={item.href} delayDuration={100}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => handleNavigate(item.href)}
                        className={buttonClasses}
                        aria-label={item.label}
                      >
                        <Icon className="h-5 w-5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p className="text-sm font-medium">{item.label}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => handleNavigate(item.href)}
                  className={buttonClasses}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        <div
          className={cn(
            "border-t border-border px-4 py-4 w-full space-y-4",
            collapsed && "px-2 py-3"
          )}
        >
          {/* User menu */}
          <div className={cn("w-full", collapsed && "flex justify-center")}>
            {collapsed ? (
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                      >
                        <User className="h-5 w-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" side="right" className="w-56">
                      <DropdownMenuLabel>
                        <div className="flex flex-col space-y-1">
                          <p className="text-sm font-medium leading-none">{user?.name || "User"}</p>
                          <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                          {organization && (
                            <p className="text-xs leading-none text-muted-foreground pt-1">
                              {organization.name}
                            </p>
                          )}
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive cursor-pointer">
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Log out</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p className="text-sm font-medium">Account</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-start px-3 py-2 h-auto"
                  >
                    <div className="flex items-center gap-3 w-full">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <User className="h-4 w-4" />
                      </div>
                      <div className="flex flex-col items-start flex-1 min-w-0">
                        <p className="text-sm font-medium truncate w-full">{user?.name || "User"}</p>
                        <p className="text-xs text-muted-foreground truncate w-full">{organization?.name || "Organization"}</p>
                      </div>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="right" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user?.name || "User"}</p>
                      <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                      {organization && (
                        <p className="text-xs leading-none text-muted-foreground pt-1">
                          {organization.name}
                        </p>
                      )}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive cursor-pointer">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Theme toggle */}
          <div
            className={cn(
              "rounded-lg bg-muted/40 p-4 flex flex-col gap-2",
              collapsed && "items-center justify-center p-2"
            )}
          >
            {collapsed ? (
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <ThemeToggle />
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p className="text-sm font-medium">Toggle theme</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <>
                <p className="text-xs text-muted-foreground font-medium">Theme</p>
                <ThemeToggle />
              </>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

export default AppSidebar;
