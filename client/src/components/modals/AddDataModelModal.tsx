import { useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { DataArea, DataDomain, System } from "@shared/schema";
import { useModelerStore } from "@/store/modelerStore";

const formSchema = z.object({
  name: z.string().min(1, "Model name is required"),
  targetSystemId: z.string().min(1, "Select a target system"),
  targetSystem: z.string().min(1, "Select a target system"),
  domainId: z.string().min(1, "Select a domain"),
  dataAreaId: z.string().min(1, "Select a data area"),
});

interface AddDataModelModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AddDataModelModal({
  open,
  onOpenChange,
}: AddDataModelModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { setCurrentModel } = useModelerStore();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      targetSystem: "",
      targetSystemId: "",
      domainId: "",
      dataAreaId: "",
    },
  });

  const { data: systems = [], isLoading: systemsLoading } = useQuery<System[]>({
    queryKey: ["/api/systems"],
    queryFn: async () => {
      const response = await fetch("/api/systems");
      if (!response.ok) {
        throw new Error("Failed to fetch systems");
      }
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: domains = [], isLoading: domainsLoading } = useQuery<DataDomain[]>({
    queryKey: ["/api/domains"],
    queryFn: async () => {
      const response = await fetch("/api/domains");
      if (!response.ok) {
        throw new Error("Failed to fetch domains");
      }
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: dataAreas = [], isLoading: dataAreasLoading } = useQuery<DataArea[]>({
    queryKey: ["/api/areas"],
    queryFn: async () => {
      const response = await fetch("/api/areas");
      if (!response.ok) {
        throw new Error("Failed to fetch data areas");
      }
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const selectedDomainId = form.watch("domainId");
  const filteredDataAreas = useMemo(() => {
    if (!selectedDomainId) return dataAreas;
    const domainIdNum = Number(selectedDomainId);
    return dataAreas.filter((area) => area.domainId === domainIdNum);
  }, [dataAreas, selectedDomainId]);

  useEffect(() => {
    if (!systemsLoading && systems.length > 0 && !form.getValues("targetSystemId")) {
      const defaultSystem = systems[0];
      form.setValue("targetSystemId", String(defaultSystem.id), { shouldValidate: true });
      form.setValue("targetSystem", defaultSystem.name, { shouldValidate: true });
    }
  }, [systems, systemsLoading, form]);

  useEffect(() => {
    if (!domainsLoading && domains.length > 0 && !form.getValues("domainId")) {
      form.setValue("domainId", String(domains[0].id), { shouldValidate: true });
    }
  }, [domains, domainsLoading, form]);

  useEffect(() => {
    if (dataAreasLoading) {
      return;
    }

    if (!selectedDomainId) {
      form.setValue("dataAreaId", "", { shouldValidate: true });
      return;
    }

    const domainIdNum = Number(selectedDomainId);
    const areasForDomain = dataAreas.filter((area) => area.domainId === domainIdNum);
    const currentAreaId = form.getValues("dataAreaId");

    if (areasForDomain.length === 0) {
      form.setValue("dataAreaId", "", { shouldValidate: true });
      return;
    }

    const hasCurrentArea = areasForDomain.some((area) => String(area.id) === currentAreaId);
    if (!hasCurrentArea) {
      form.setValue("dataAreaId", String(areasForDomain[0].id), { shouldValidate: true });
    }
  }, [dataAreas, dataAreasLoading, form, selectedDomainId]);

  const mutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      const payload = {
        name: data.name,
        targetSystem: data.targetSystem,
        targetSystemId: Number(data.targetSystemId),
        domainId: Number(data.domainId),
        dataAreaId: Number(data.dataAreaId),
      };
      const response = await apiRequest("POST", "/api/models/create-with-layers", payload);
      return response.json();
    },
    onSuccess: (responseData) => {
      queryClient.invalidateQueries({ queryKey: ["/api/models"] });
      
      // Switch to the newly created conceptual (or flow) model
      if (responseData?.conceptual ?? responseData?.flow) {
        setCurrentModel(responseData.conceptual ?? responseData.flow);
      }
      
      toast({
        title: "Success", 
        description: "Data model created with Flow, Conceptual, Logical, and Physical layers. Switched to new model.",
      });
      const defaultSystem = systems[0];
      const defaultDomain = domains[0];
      const defaultArea = defaultDomain
        ? dataAreas.find((area) => area.domainId === defaultDomain.id)
        : undefined;

      form.reset({
        name: "",
        targetSystem: defaultSystem ? defaultSystem.name : "",
        targetSystemId: defaultSystem ? String(defaultSystem.id) : "",
        domainId: defaultDomain ? String(defaultDomain.id) : "",
        dataAreaId: defaultArea ? String(defaultArea.id) : "",
      });
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Error creating data model:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      toast({
        title: "Error",
        description: `Failed to create data model: ${message}`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Data Model</DialogTitle>
          <DialogDescription>
            This will create a complete model with Flow, Conceptual, Logical, and Physical layers.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <input type="hidden" {...form.register("targetSystemId")} />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Model Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Customer Analytics Model"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />



            <FormField
              control={form.control}
              name="targetSystem"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Target System</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      const selectedSystem = systems.find((system) => system.name === value || String(system.id) === value);
                      if (selectedSystem) {
                        form.setValue("targetSystemId", String(selectedSystem.id), { shouldValidate: true });
                        form.setValue("targetSystem", selectedSystem.name, { shouldValidate: true });
                      } else {
                        field.onChange(value);
                      }
                    }}
                    defaultValue={field.value}
                    value={field.value}
                    disabled={systemsLoading || systems.length === 0}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select target system" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {systems.map((system) => (
                        <SelectItem key={system.id} value={system.name}>
                          {system.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="domainId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Domain</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      form.setValue("dataAreaId", "", { shouldValidate: true });
                    }}
                    value={field.value}
                    disabled={domainsLoading || domains.length === 0}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select domain" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {domains.map((domain) => (
                        <SelectItem key={domain.id} value={String(domain.id)}>
                          {domain.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="dataAreaId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data Area</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={dataAreasLoading || filteredDataAreas.length === 0}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={filteredDataAreas.length ? "Select data area" : "No areas available"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {filteredDataAreas.map((area) => (
                        <SelectItem key={area.id} value={String(area.id)}>
                          {area.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Creating..." : "Create Model"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}