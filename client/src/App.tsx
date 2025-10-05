import { Switch, Route, useLocation } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AppLayout } from "@/components/layout/AppLayout";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/HomePage";
import ModelerPage from "@/pages/modeler";
import DataModelsListPage from "@/pages/DataModelsListPage";
import ConfigurationPage from "@/pages/ConfigurationPage";
import {
  ConfigurationSystemCreatePage,
  ConfigurationSystemEditPage,
  ConfigurationSystemViewPage,
} from "@/pages/ConfigurationSystemPage";
import ColorThemePage from "@/pages/ColorThemePage";
import SystemsManagementPage from "@/pages/SystemsManagementPage";
import ReportsPage from "@/pages/ReportsPage";
import { BusinessCapabilityMapPage } from "@/pages/BusinessCapabilityMapPage";
import ObjectLakePage from "@/pages/ObjectLakePage";

function RedirectToConfiguration() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation("/configuration");
  }, [setLocation]);

  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="modeler-ui-theme">
        <TooltipProvider>
          <AppLayout>
            <Switch>
              <Route path="/" component={HomePage} />
              <Route path="/home" component={HomePage} />
              <Route path="/models" component={DataModelsListPage} />
              <Route path="/modeler/:modelId" component={ModelerPage} />
              <Route path="/modeler" component={ModelerPage} />
              <Route path="/configuration/systems/new" component={ConfigurationSystemCreatePage} />
              <Route path="/configuration/systems/:id/edit" component={ConfigurationSystemEditPage} />
              <Route path="/configuration/systems/:id" component={ConfigurationSystemViewPage} />
              <Route path="/configuration" component={ConfigurationPage} />
              <Route path="/systems" component={SystemsManagementPage} />
              <Route path="/reports" component={ReportsPage} />
              <Route path="/capabilities" component={BusinessCapabilityMapPage} />
              <Route path="/object-lake" component={ObjectLakePage} />
              <Route path="/enhanced-config" component={RedirectToConfiguration} />
              <Route path="/color-themes" component={ColorThemePage} />
              <Route component={NotFound} />
            </Switch>
          </AppLayout>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
