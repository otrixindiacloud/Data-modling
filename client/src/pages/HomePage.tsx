import { ArrowRight, Layers3, Sparkles, Server, BarChart3, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";

export default function HomePage() {
  const [, setLocation] = useLocation();

  const handleNavigate = (href: string) => {
    setLocation(href);
  };

  return (
    <div className="flex flex-1 flex-col bg-muted/20">
      <div className="relative overflow-hidden border-b bg-card/60">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.25),_transparent_55%)]" aria-hidden />
        <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-12 md:px-10 lg:px-16">
          <Badge variant="outline" className="w-max bg-white/60 text-slate-800 dark:bg-slate-900/80 dark:text-slate-100">
            Welcome to DArk Modeler
          </Badge>
          <div className="space-y-6">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50 md:text-4xl">
              Build smarter data architectures with an AI-assisted workspace
            </h1>
            <p className="max-w-2xl text-base text-slate-600 dark:text-slate-300 md:text-lg">
              Explore your data ecosystems, generate consistent models, and collaborate across teams with a unified toolkit.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="lg" onClick={() => handleNavigate("/modeler")}
                className="group">
                Launch Modeler
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
              <Button variant="outline" size="lg" onClick={() => handleNavigate("/models")}>
                Browse Models
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 gap-6 px-6 py-10 md:grid-cols-2 md:px-10 lg:grid-cols-3 lg:px-16">
        <Card className="border border-primary/10 bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold">Model Explorer</CardTitle>
              <CardDescription>Navigate conceptual, logical, and physical layers</CardDescription>
            </div>
            <Layers3 className="h-6 w-6 text-primary" />
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>Discover existing assets, version history, and lineage from a single hub.</p>
            <Button variant="ghost" className="group px-0" onClick={() => handleNavigate("/models")}>
              Open models
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold">Systems Management</CardTitle>
              <CardDescription>Control integrations and sync targets</CardDescription>
            </div>
            <Server className="h-6 w-6 text-primary" />
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>Connect to source systems, validate access, and orchestrate bidirectional syncs.</p>
            <Button variant="ghost" className="group px-0" onClick={() => handleNavigate("/systems")}>
              Manage systems
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold">Configuration Control</CardTitle>
              <CardDescription>Govern settings, templates, and access</CardDescription>
            </div>
            <Settings className="h-6 w-6 text-primary" />
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>Apply reusable templates and rollout guardrails across your teams.</p>
            <Button variant="ghost" className="group px-0" onClick={() => handleNavigate("/configuration")}>
              Configure workspace
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold">AI Suggestions</CardTitle>
              <CardDescription>Accelerate modeling with intelligent prompts</CardDescription>
            </div>
            <Sparkles className="h-6 w-6 text-primary" />
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>Generate entity relationships, naming standards, and color systems instantly.</p>
            <Button variant="ghost" className="group px-0" onClick={() => handleNavigate("/modeler")}>
              Try AI co-pilot
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold">Reporting Insights</CardTitle>
              <CardDescription>Summaries for stakeholders and audits</CardDescription>
            </div>
            <BarChart3 className="h-6 w-6 text-primary" />
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>Track adoption, attribute coverage, and sync health across systems.</p>
            <Button variant="ghost" className="group px-0" onClick={() => handleNavigate("/reports")}>
              View reports
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold">Quick Start</CardTitle>
              <CardDescription>New to the workspace?</CardDescription>
            </div>
            <Sparkles className="h-6 w-6 text-primary" />
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>Follow an onboarding checklist to stand up your first configuration in minutes.</p>
            <Button variant="outline" className="group" onClick={() => handleNavigate("/configuration")}
            >
              Begin setup
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
