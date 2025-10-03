import { TrendingUp, Activity, Layers3, Server, AlertTriangle, Calendar } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

const METRICS = [
  {
    label: "Active Models",
    value: "24",
    change: "+3",
    trend: "month",
    icon: Layers3,
  },
  {
    label: "Systems Connected",
    value: "11",
    change: "+1",
    trend: "quarter",
    icon: Server,
  },
  {
    label: "Sync Success Rate",
    value: "98.6%",
    change: "+0.4%",
    trend: "30d",
    icon: Activity,
  },
  {
    label: "Open Issues",
    value: "4",
    change: "-2",
    trend: "week",
    icon: AlertTriangle,
  },
];

const REPORT_TEMPLATES = [
  {
    title: "Architecture Health Overview",
    description: "Blend adoption, usage, and governance signals for executive stakeholders.",
    insights: ["Layer coverage", "Model freshness", "Ownership gaps"],
  },
  {
    title: "Integration Sync Report",
    description: "Audit data flows, success rates, and pending actions across systems.",
    insights: ["Sync latency", "Failed transfers", "Validation backlog"],
  },
  {
    title: "Change Impact Summary",
    description: "Highlight downstream systems, API consumers, and governance approvals.",
    insights: ["Impact radius", "Pending approvals", "Version deltas"],
  },
];

export default function ReportsPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="flex flex-1 flex-col bg-muted/10">
      <header className="border-b bg-card/60 px-6 py-6 shadow-sm md:px-10 lg:px-16">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Badge variant="secondary" className="mb-2 w-max">Insights</Badge>
            <h1 className="text-3xl font-semibold tracking-tight">Operational Reports</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Monitor model health, system integrations, and governance signals. Export curated packets for stakeholders or schedule automated delivery.
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setLocation("/models")}>
              View model list
            </Button>
            <Button onClick={() => setLocation("/modeler")}>Open modeler</Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-10 md:px-10 lg:px-16">
        <section>
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Key metrics
            </h2>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-4 w-4" />
              Last refreshed 5 minutes ago
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {METRICS.map((metric) => {
              const Icon = metric.icon;
              return (
                <Card key={metric.label}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {metric.label}
                    </CardTitle>
                    <Icon className="h-4 w-4 text-primary" />
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-baseline gap-3">
                      <span className="text-2xl font-semibold">{metric.value}</span>
                      <Badge variant={metric.change.startsWith("-") ? "destructive" : "outline"}>
                        {metric.change}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">vs previous {metric.trend}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Usage trends</CardTitle>
              <CardDescription>Model adoption and system sync cadence across environments.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30">
                <div className="text-center text-sm text-muted-foreground">
                  <TrendingUp className="mx-auto mb-3 h-10 w-10 text-primary" />
                  Charts coming soon—plug into analytics to visualize real-time signals.
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Scheduled exports</CardTitle>
              <CardDescription>Automate delivery to stakeholders and shared drives.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 text-sm text-muted-foreground">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span>Weekly governance bundle</span>
                  <Badge variant="outline">Friday</Badge>
                </div>
                <p className="text-xs text-muted-foreground/80">Email distribution to data office and security teams.</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span>Integration sync log</span>
                  <Badge variant="outline">Daily</Badge>
                </div>
                <p className="text-xs text-muted-foreground/80">Delivered to shared analytics workspace.</p>
              </div>
              <Button variant="ghost" className="px-0" onClick={() => setLocation("/configuration")}
              >
                Manage schedules
              </Button>
            </CardContent>
          </Card>
        </section>

        <section>
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Report templates</h2>
              <p className="text-sm text-muted-foreground">
                Start with optimized layouts for leadership, architecture, and engineering audiences.
              </p>
            </div>
            <Button variant="outline" onClick={() => setLocation("/configuration")}>Customize templates</Button>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {REPORT_TEMPLATES.map((template) => (
              <Card key={template.title} className="flex flex-col">
                <CardHeader>
                  <CardTitle>{template.title}</CardTitle>
                  <CardDescription>{template.description}</CardDescription>
                </CardHeader>
                <CardContent className="mt-auto space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {template.insights.map((item) => (
                      <Badge key={item} variant="secondary" className="capitalize">
                        {item}
                      </Badge>
                    ))}
                  </div>
                  <Button className="w-full" variant="secondary" onClick={() => setLocation("/modeler")}>
                    Generate preview
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
