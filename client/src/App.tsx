import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import NotFound from "@/pages/not-found";
import ModelerPage from "@/pages/modeler";
import ConfigurationPage from "@/pages/ConfigurationPage";
import EnhancedConfigurationPage from "@/pages/EnhancedConfigurationPage";
import ColorThemePage from "@/pages/ColorThemePage";

function Router() {
  return (
    <Switch>
      <Route path="/" component={ModelerPage} />
      <Route path="/modeler" component={ModelerPage} />
      <Route path="/configuration" component={ConfigurationPage} />
      <Route path="/enhanced-config" component={EnhancedConfigurationPage} />
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
