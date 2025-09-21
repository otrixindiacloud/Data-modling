import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useModelerStore } from "@/store/modelerStore";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Upload, FileText, Database, Server } from "lucide-react";

export default function AddDataSourceModal() {
  const { showAddSourceModal, setShowAddSourceModal } = useModelerStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    name: "",
    type: "sql" as "sql" | "adls" | "file",
    connectionString: "",
    configuration: {},
    fileType: "csv" as "csv" | "excel" | "parquet" | "sqlite" | "ddl"
  });
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/sources", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sources"] });
      setShowAddSourceModal(false);
      setFormData({ name: "", type: "sql", connectionString: "", configuration: {}, fileType: "csv" });
      setUploadFile(null);
      toast({
        title: "Success",
        description: "Data source added successfully"
      });
    },
    onError: (error: any) => {
      console.error("Failed to add data source:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to add data source",
        variant: "destructive"
      });
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.type === "file" && uploadFile) {
      // Handle file upload
      const formDataToSend = new FormData();
      formDataToSend.append("file", uploadFile);
      
      try {
        const uploadEndpoint = `/api/upload/${formData.fileType}`;
        const uploadResponse = await fetch(uploadEndpoint, {
          method: "POST",
          body: formDataToSend,
        });
        
        if (!uploadResponse.ok) {
          throw new Error(`Upload failed: ${uploadResponse.statusText}`);
        }
        
        const metadata = await uploadResponse.json();
        
        // Create data source with metadata
        const dataToSend = {
          name: formData.name,
          type: formData.type,
          connectionString: null,
          configuration: {
            fileType: formData.fileType,
            metadata: metadata
          },
        };
        
        mutation.mutate(dataToSend);
      } catch (error) {
        console.error("File upload error:", error);
        toast({
          title: "Error",
          description: (error as any).message || "Failed to upload file",
          variant: "destructive"
        });
      }
    } else {
      // Handle other source types
      const dataToSend = {
        name: formData.name,
        type: formData.type,
        connectionString: formData.type === "sql" ? formData.connectionString : null,
        configuration: formData.type === "sql" ? {} : formData.configuration,
      };
      
      mutation.mutate(dataToSend);
    }
  };

  return (
    <Dialog open={showAddSourceModal} onOpenChange={setShowAddSourceModal}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Data Source</DialogTitle>
          <DialogDescription>
            Connect to a new data source or upload a file to analyze its structure.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          
          <div>
            <Label htmlFor="type">Type</Label>
            <Select value={formData.type} onValueChange={(value: any) => setFormData({ ...formData, type: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sql">SQL Database</SelectItem>
                <SelectItem value="adls">Azure Data Lake</SelectItem>
                <SelectItem value="file">File Upload</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {formData.type === "sql" && (
            <div>
              <Label htmlFor="connectionString">Connection String</Label>
              <Textarea
                id="connectionString"
                value={formData.connectionString}
                onChange={(e) => setFormData({ ...formData, connectionString: e.target.value })}
                placeholder="Server=myServerAddress;Database=myDataBase;User Id=myUsername;Password=myPassword;"
              />
            </div>
          )}
          
          {formData.type === "file" && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="fileType">File Type</Label>
                <Select value={formData.fileType} onValueChange={(value: any) => setFormData({ ...formData, fileType: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">CSV File</SelectItem>
                    <SelectItem value="excel">Excel File (.xlsx)</SelectItem>
                    <SelectItem value="parquet">Parquet File</SelectItem>
                    <SelectItem value="sqlite">SQLite Database</SelectItem>
                    <SelectItem value="ddl">DDL Script</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="fileUpload">Upload File</Label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                  <Upload className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="mt-2">
                    <Label htmlFor="fileUpload" className="cursor-pointer">
                      <span className="text-blue-600 hover:text-blue-700">Click to upload</span>
                      <span className="text-gray-500"> or drag and drop</span>
                    </Label>
                    <Input
                      id="fileUpload"
                      type="file"
                      className="hidden"
                      accept={
                        formData.fileType === "csv" ? ".csv" :
                        formData.fileType === "excel" ? ".xlsx,.xls" :
                        formData.fileType === "parquet" ? ".parquet" :
                        formData.fileType === "sqlite" ? ".db,.sqlite,.sqlite3" :
                        formData.fileType === "ddl" ? ".sql,.ddl" : "*"
                      }
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setUploadFile(file);
                          setFormData({ ...formData, name: formData.name || file.name });
                        }
                      }}
                    />
                  </div>
                  {uploadFile && (
                    <div className="mt-2 text-sm text-gray-600">
                      Selected: {uploadFile.name}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => {
              setShowAddSourceModal(false);
              setFormData({ name: "", type: "sql", connectionString: "", configuration: {}, fileType: "csv" });
              setUploadFile(null);
            }}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={mutation.isPending || !formData.name.trim() || (formData.type === "sql" && !formData.connectionString.trim()) || (formData.type === "file" && !uploadFile)}
            >
              {mutation.isPending ? "Adding..." : "Add Source"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}