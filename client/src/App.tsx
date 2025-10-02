import { Switch, Route, useLocation } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import NotFound from "@/pages/not-found";
import ModelerPage from "@/pages/modeler";
import ConfigurationPage from "@/pages/ConfigurationPage";
import ColorThemePage from "@/pages/ColorThemePage";

function RedirectToConfiguration() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation("/configuration");
  }, [setLocation]);

  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={ModelerPage} />
      <Route path="/modeler" component={ModelerPage} />
  <Route path="/configuration" component={ConfigurationPage} />
  <Route path="/enhanced-config" component={RedirectToConfiguration} />
      <Route path="/color-themes" component={ColorThemePage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="modeler-ui-theme">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
