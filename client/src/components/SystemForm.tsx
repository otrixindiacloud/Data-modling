import { useEffect, useMemo, useState } from "react";
import { Save, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { DataArea, DataDomain } from "@shared/schema";
import {
  CONNECTION_TYPE_OPTIONS,
  getConnectionFields,
  mergeConnectionDefaults,
  type ConnectionFieldDefinition,
} from "@/lib/connectionTemplates";

export const SYSTEM_CATEGORIES = [
  "Enterprise Resource Planning (ERP)",
  "Customer Relationship Management (CRM)",
  "Human Resources Information System (HRIS)",
  "Financial Management System",
  "Supply Chain Management",
  "Business Intelligence",
  "Legacy Database",
  "Cloud Application",
  "File System",
  "API Service",
  "Data Lake",
  "Data Warehouse",
  "Operational Database",
  "Analytics Platform",
  "Cloud Storage",
  "Real-time Stream",
  "API Endpoint",
  "Reporting System"
];

const DEFAULT_CONNECTION_TYPE = "sql";

const createDomainConfiguration = (domainId: number | null, areaIds: number[]) => ({
  domainId: domainId ?? undefined,
  domainIds: domainId ? [domainId] : [],
  dataAreaIds: areaIds,
});


export interface SystemFormValues {
  id?: number;
  name: string;
  category: string;
  type: string;
  description: string;
  connectionString?: string;
  configuration: Record<string, any>;
  canBeSource?: boolean;
  canBeTarget?: boolean;
  colorCode?: string;
  domainIds?: number[];
  dataAreaIds?: number[];
  domainId?: number;
}

interface SystemFormProps {
  system: SystemFormValues | null;
  domains: DataDomain[];
  dataAreas: DataArea[];
  mode: "create" | "edit" | "view";
  onSubmit: (system: SystemFormValues) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function SystemForm({
  system,
  domains,
  dataAreas,
  mode,
  onSubmit,
  onCancel,
  isSubmitting
}: SystemFormProps) {
  const isReadOnly = mode === "view";

  const normalizeIdArray = (value: unknown): number[] =>
    Array.isArray(value)
      ? value
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id) && !Number.isNaN(id))
      : [];

  const buildFormState = (systemConfig: SystemFormValues | null): SystemFormValues => {
    if (!systemConfig) {
      const type = DEFAULT_CONNECTION_TYPE;
  const domainConfig = createDomainConfiguration(null, []);
      return {
        name: "",
        type,
        category: "",
        description: "",
        connectionString: "",
        configuration: mergeConnectionDefaults(type, {
          ...domainConfig,
          type,
        }),
        canBeSource: true,
        canBeTarget: true,
        colorCode: "#6366f1",
        domainIds: [],
        dataAreaIds: [],
        domainId: undefined
      };
    }

    const type = systemConfig.type ?? DEFAULT_CONNECTION_TYPE;
    const normalizedDomainIds = systemConfig.domainIds && systemConfig.domainIds.length
      ? normalizeIdArray(systemConfig.domainIds)
      : normalizeIdArray(systemConfig.configuration?.domainIds);

    const normalizedAreaIds = systemConfig.dataAreaIds && systemConfig.dataAreaIds.length
      ? normalizeIdArray(systemConfig.dataAreaIds)
      : normalizeIdArray(systemConfig.configuration?.dataAreaIds);

    const primaryDomainId = normalizedDomainIds.length
      ? normalizedDomainIds[0]
      : typeof systemConfig.configuration?.domainId === "number"
        ? Number(systemConfig.configuration.domainId)
        : undefined;

  const domainConfig = createDomainConfiguration(primaryDomainId ?? null, normalizedAreaIds);
    const mergedConfiguration = mergeConnectionDefaults(type, {
      ...(systemConfig.configuration || {}),
      ...domainConfig,
      type,
    });

    return {
      ...systemConfig,
      type,
      configuration: {
        ...mergedConfiguration,
      },
      domainIds: normalizedDomainIds,
      dataAreaIds: normalizedAreaIds,
      domainId: primaryDomainId
    };
  };

  const [formData, setFormData] = useState<SystemFormValues>(() => buildFormState(system));
  const [selectedDomainId, setSelectedDomainId] = useState<number | null>(() =>
    typeof formData.domainId === "number"
      ? formData.domainId
      : formData.domainIds && formData.domainIds.length
        ? formData.domainIds[0]
        : null
  );
  const [selectedAreaIds, setSelectedAreaIds] = useState<number[]>(() => formData.dataAreaIds || []);
  const [domainError, setDomainError] = useState<string | null>(null);

  useEffect(() => {
    const nextForm = buildFormState(system);
    setFormData(nextForm);
    setSelectedDomainId(
      typeof nextForm.domainId === "number"
        ? nextForm.domainId
        : nextForm.domainIds && nextForm.domainIds.length
          ? nextForm.domainIds[0]
          : null
    );
    setSelectedAreaIds(nextForm.dataAreaIds || []);
  }, [system]);

  useEffect(() => {
    setSelectedAreaIds((prev) =>
      prev.filter((areaId) => {
        const area = dataAreas.find((item) => item.id === areaId);
        if (!selectedDomainId) return false;
        return area ? area.domainId === selectedDomainId : false;
      })
    );
  }, [selectedDomainId, dataAreas]);

  useEffect(() => {
  const domainConfig = createDomainConfiguration(selectedDomainId, selectedAreaIds);
    setFormData((prev) => ({
      ...prev,
      domainId: domainConfig.domainId,
      domainIds: domainConfig.domainIds,
      dataAreaIds: domainConfig.dataAreaIds,
      configuration: {
        ...(prev.configuration || {}),
        ...domainConfig
      }
    }));
  }, [selectedDomainId, selectedAreaIds]);

  const availableDataAreas = useMemo(
    () => (selectedDomainId ? dataAreas.filter((area) => area.domainId === selectedDomainId) : []),
    [dataAreas, selectedDomainId]
  );

  const selectedAreaObjects = useMemo(
    () => dataAreas.filter((area) => selectedAreaIds.includes(area.id)),
    [dataAreas, selectedAreaIds]
  );
  const selectedDomain = useMemo(
    () => (selectedDomainId ? domains.find((domain) => domain.id === selectedDomainId) ?? null : null),
    [domains, selectedDomainId]
  );
  const connectionFields = useMemo<ConnectionFieldDefinition[]>(
    () => getConnectionFields(formData.type),
    [formData.type]
  );
  const activeConnectionLabel = useMemo(
    () => CONNECTION_TYPE_OPTIONS.find((option) => option.value === formData.type)?.label ?? "Connection",
    [formData.type]
  );

  const handleConfigurationChange = (field: ConnectionFieldDefinition, rawValue: string) => {
    if (isReadOnly || isSubmitting) return;

    setFormData((prev) => {
      const nextConfiguration: Record<string, unknown> = {
        ...(prev.configuration || {}),
        type: prev.type,
      };

      if (field.type === "number") {
        if (rawValue === "") {
          nextConfiguration[field.key] = "";
        } else {
          const numericValue = Number(rawValue);
          nextConfiguration[field.key] = Number.isFinite(numericValue) ? numericValue : rawValue;
        }
      } else {
        nextConfiguration[field.key] = rawValue;
      }

      return {
        ...prev,
        configuration: nextConfiguration,
      };
    });
  };

  const handleAreaToggle = (areaId: number, checked: boolean | string) => {
    if (isReadOnly || isSubmitting) return;
    if (!selectedDomainId) return;
    const isChecked = checked === true;
    setSelectedAreaIds((prev) => {
      if (isChecked) {
        if (prev.includes(areaId)) {
          return prev;
        }
        return [...prev, areaId];
      }
      return prev.filter((id) => id !== areaId);
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isReadOnly) {
      onCancel();
      return;
    }

    if (!selectedDomainId) {
      setDomainError("Please select a domain");
      return;
    }

    const payload: SystemFormValues = {
      ...formData,
      domainId: selectedDomainId ?? undefined,
      domainIds: selectedDomainId ? [selectedDomainId] : [],
      dataAreaIds: selectedAreaIds,
      configuration: {
        ...(formData.configuration || {}),
        domainId: selectedDomainId ?? undefined,
        domainIds: selectedDomainId ? [selectedDomainId] : [],
        dataAreaIds: selectedAreaIds
      }
    };

    onSubmit(payload);
  };

  const primaryButtonLabel = mode === "edit" ? "Update System" : "Save System";
  const secondaryButtonLabel = isReadOnly ? "Back" : "Cancel";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="name">System Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            disabled={isReadOnly || isSubmitting}
          />
        </div>
        <div>
          <Label htmlFor="type">Connection Type</Label>
          <Select
            value={formData.type}
            onValueChange={(value) =>
              setFormData((prev) => {
                const domainConfig = createDomainConfiguration(
                  selectedDomainId,
                  selectedAreaIds,
                );

                return {
                  ...prev,
                  type: value,
                  category: "",
                  configuration: mergeConnectionDefaults(value, {
                    ...(prev.configuration || {}),
                    ...domainConfig,
                    type: value,
                  }),
                };
              })
            }
            disabled={isReadOnly || isSubmitting}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONNECTION_TYPE_OPTIONS.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="category">Category</Label>
        <Select
          value={formData.category}
          onValueChange={(value) =>
            setFormData({ ...formData, category: value })
          }
          disabled={isReadOnly || isSubmitting}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a category" />
          </SelectTrigger>
          <SelectContent>
            {SYSTEM_CATEGORIES.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Describe this system's purpose and usage"
          disabled={isReadOnly || isSubmitting}
        />
      </div>

  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Domain</Label>
          <p className="text-xs text-muted-foreground">
            Choose the domain this system belongs to
          </p>
        </div>
        {domains.length ? (
          <Select
            value={selectedDomainId ? String(selectedDomainId) : ""}
            onValueChange={(value) => {
              setSelectedDomainId(Number(value));
              setDomainError(null);
            }}
            disabled={isReadOnly || isSubmitting}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a domain" />
            </SelectTrigger>
            <SelectContent>
              {domains.map((domain) => (
                <SelectItem key={domain.id} value={String(domain.id)}>
                  {domain.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <p className="text-xs text-muted-foreground">
            No domains available. Create domains first from the Domains tab.
          </p>
        )}
        {domainError && <p className="text-xs text-destructive">{domainError}</p>}
        {selectedDomain && (
          <Badge variant="secondary" className="w-fit">
            {selectedDomain.name}
          </Badge>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Data Areas</Label>
          <p className="text-xs text-muted-foreground">
            Choose data areas within the selected domain
          </p>
        </div>
        {!selectedDomainId ? (
          <p className="text-xs italic text-muted-foreground">
            Select a domain to enable data area selection.
          </p>
        ) : (
          <div className="max-h-40 space-y-2 overflow-y-auto rounded-lg border p-3">
            {availableDataAreas.length ? (
              availableDataAreas.map((area) => {
                const checkboxId = `system-area-${area.id}`;
                return (
                  <label
                    key={area.id}
                    htmlFor={checkboxId}
                    className="flex items-start gap-2 text-sm"
                  >
                    <Checkbox
                      id={checkboxId}
                      checked={selectedAreaIds.includes(area.id)}
                      onCheckedChange={(checked) => handleAreaToggle(area.id, checked)}
                      disabled={isReadOnly || isSubmitting}
                    />
                    <span className="space-y-1">
                      <span className="font-medium">{area.name}</span>
                      {area.description && (
                        <span className="text-xs text-muted-foreground block">
                          {area.description}
                        </span>
                      )}
                    </span>
                  </label>
                );
              })
            ) : (
              <p className="text-xs text-muted-foreground">
                No data areas are available for the selected domain yet.
              </p>
            )}
          </div>
        )}
        {selectedAreaObjects.length ? (
          <div className="flex flex-wrap gap-2">
            {selectedAreaObjects.map((area) => (
              <Badge key={area.id} variant="outline">
                {area.name}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Connection Details</Label>
          <p className="text-xs text-muted-foreground">
            Provide credentials for the {activeConnectionLabel} connection.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {connectionFields.map((field) => {
            const configurationValue = formData.configuration?.[field.key];
            const inputValue =
              typeof configurationValue === "number"
                ? String(configurationValue)
                : configurationValue === undefined || configurationValue === null
                  ? ""
                  : String(configurationValue);
            const inputId = `connection-${field.key}`;
            const inputType = field.type === "number" ? "number" : field.type === "password" ? "password" : field.type;

            if (inputType === "textarea") {
              return (
                <div key={field.key} className="space-y-1">
                  <Label htmlFor={inputId}>{field.label}</Label>
                  <Textarea
                    id={inputId}
                    value={inputValue}
                    onChange={(event) => handleConfigurationChange(field, event.target.value)}
                    placeholder={field.placeholder}
                    disabled={isReadOnly || isSubmitting}
                    required={field.required}
                  />
                  {field.description ? (
                    <p className="text-xs text-muted-foreground">{field.description}</p>
                  ) : null}
                </div>
              );
            }

            return (
              <div key={field.key} className="space-y-1">
                <Label htmlFor={inputId}>{field.label}</Label>
                <Input
                  id={inputId}
                  type={inputType === "password" ? "password" : inputType === "number" ? "number" : "text"}
                  value={inputValue}
                  onChange={(event) => handleConfigurationChange(field, event.target.value)}
                  placeholder={field.placeholder}
                  disabled={isReadOnly || isSubmitting}
                  required={field.required}
                />
                {field.description ? (
                  <p className="text-xs text-muted-foreground">{field.description}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <Label htmlFor="connectionString">Connection String (Optional)</Label>
        <Input
          id="connectionString"
          value={formData.connectionString}
          onChange={(e) => setFormData({ ...formData, connectionString: e.target.value })}
          placeholder="Database connection string or API endpoint"
          disabled={isReadOnly || isSubmitting}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="canBeSource"
            checked={formData.canBeSource ?? true}
            onChange={(e) => setFormData({ ...formData, canBeSource: e.target.checked })}
            disabled={isReadOnly || isSubmitting}
          />
          <Label htmlFor="canBeSource">Can be Source System</Label>
        </div>
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="canBeTarget"
            checked={formData.canBeTarget ?? true}
            onChange={(e) => setFormData({ ...formData, canBeTarget: e.target.checked })}
            disabled={isReadOnly || isSubmitting}
          />
          <Label htmlFor="canBeTarget">Can be Target System</Label>
        </div>
      </div>

      <div>
        <Label htmlFor="colorCode">Color Code</Label>
        <div className="flex items-center space-x-2">
          <Input
            id="colorCode"
            type="color"
            value={formData.colorCode || "#6366f1"}
            onChange={(e) => setFormData({ ...formData, colorCode: e.target.value })}
            className="w-16 h-10 p-1 cursor-pointer"
            disabled={isReadOnly || isSubmitting}
          />
          <Input
            value={formData.colorCode || "#6366f1"}
            onChange={(e) => setFormData({ ...formData, colorCode: e.target.value })}
            placeholder="#6366f1"
            className="flex-1 font-mono text-sm"
            disabled={isReadOnly || isSubmitting}
          />
        </div>
      </div>

      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          {isReadOnly ? (
            secondaryButtonLabel
          ) : (
            <>
              <X className="h-4 w-4 mr-2" />
              {secondaryButtonLabel}
            </>
          )}
        </Button>
        {!isReadOnly && (
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {primaryButtonLabel}
              </>
            )}
          </Button>
        )}
      </div>
    </form>
  );
}
