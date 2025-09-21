import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { insertDataModelSchema } from "@shared/schema";
import { useModelerStore } from "@/store/modelerStore";

const TARGET_SYSTEMS = [
  "Data Lake",
  "Data Warehouse", 
  "Operational Database",
  "Analytics Platform",
  "Reporting System"
];

const LAYERS = [
  { value: "conceptual", label: "Conceptual" },
  { value: "logical", label: "Logical" },
  { value: "physical", label: "Physical" },
];

const formSchema = z.object({
  name: z.string().min(1, "Model name is required"),
  targetSystem: z.string().optional(),
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
      targetSystem: "Data Lake",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      const response = await apiRequest("POST", "/api/models/create-with-layers", data);
      return response.json();
    },
    onSuccess: (responseData) => {
      queryClient.invalidateQueries({ queryKey: ["/api/models"] });
      
      // Switch to the newly created conceptual model
      if (responseData?.conceptual) {
        setCurrentModel(responseData.conceptual);
      }
      
      toast({
        title: "Success", 
        description: "Data model created with Conceptual, Logical, and Physical layers. Switched to new model.",
      });
      form.reset();
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Error creating data model:", error);
      toast({
        title: "Error",
        description: `Failed to create data model: ${error.message}`,
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
            This will create a complete model with Conceptual, Logical, and Physical layers.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select target system" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {TARGET_SYSTEMS.map((system) => (
                        <SelectItem key={system} value={system}>
                          {system}
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