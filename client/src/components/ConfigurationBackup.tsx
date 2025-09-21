import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  Save, 
  Download, 
  Upload, 
  History, 
  Trash2, 
  Clock,
  CheckCircle,
  AlertTriangle,
  FileText
} from "lucide-react";
import { configManager } from "@/lib/configManager";

interface ConfigBackup {
  id: string;
  name: string;
  description: string;
  timestamp: Date;
  size: number;
  categories: string[];
  version: string;
  automatic: boolean;
}

interface ConfigurationBackupProps {
  onBackupCreated?: () => void;
  onBackupRestored?: () => void;
}

export default function ConfigurationBackup({ onBackupCreated, onBackupRestored }: ConfigurationBackupProps) {
  const [backups, setBackups] = useState<ConfigBackup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBackup, setSelectedBackup] = useState<ConfigBackup | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadBackups();
    
    // Set up automatic backups every hour
    const interval = setInterval(createAutomaticBackup, 3600000); // 1 hour
    
    return () => clearInterval(interval);
  }, []);

  const loadBackups = () => {
    // Simulate loading backups from localStorage
    const savedBackups = localStorage.getItem("configuration-backups");
    if (savedBackups) {
      try {
        const parsed = JSON.parse(savedBackups).map((backup: any) => ({
          ...backup,
          timestamp: new Date(backup.timestamp)
        }));
        setBackups(parsed);
      } catch (error) {
        console.error("Failed to parse saved backups:", error);
      }
    }
    setLoading(false);
  };

  const saveBackupsToStorage = (newBackups: ConfigBackup[]) => {
    localStorage.setItem("configuration-backups", JSON.stringify(newBackups));
    setBackups(newBackups);
  };

  const createBackup = async (name: string, description: string, automatic = false) => {
    try {
      const configData = await configManager.exportConfiguration();
      
      const backup: ConfigBackup = {
        id: `backup-${Date.now()}`,
        name: name || `Backup ${new Date().toLocaleDateString()}`,
        description: description || (automatic ? "Automatic backup" : "Manual backup"),
        timestamp: new Date(),
        size: JSON.stringify(configData).length,
        categories: Object.keys(configData.configurations || {}),
        version: configData.version || "1.0",
        automatic
      };

      // Save backup data
      localStorage.setItem(`config-backup-${backup.id}`, JSON.stringify(configData));
      
      const newBackups = [backup, ...backups].slice(0, 10); // Keep only last 10 backups
      saveBackupsToStorage(newBackups);
      
      if (!automatic) {
        toast({ title: "Backup created successfully" });
        onBackupCreated?.();
      }
      
      return backup;
    } catch (error) {
      toast({ title: "Failed to create backup", variant: "destructive" });
      throw error;
    }
  };

  const createAutomaticBackup = async () => {
    try {
      await createBackup("", "", true);
    } catch (error) {
      console.error("Automatic backup failed:", error);
    }
  };

  const restoreBackup = async (backupId: string) => {
    try {
      const backupData = localStorage.getItem(`config-backup-${backupId}`);
      if (!backupData) {
        throw new Error("Backup data not found");
      }

      const configData = JSON.parse(backupData);
      const success = await configManager.importConfiguration(configData);
      
      if (success) {
        toast({ title: "Configuration restored successfully" });
        onBackupRestored?.();
        setSelectedBackup(null);
      } else {
        throw new Error("Failed to restore configuration");
      }
    } catch (error) {
      toast({ title: "Failed to restore backup", variant: "destructive" });
    }
  };

  const deleteBackup = (backupId: string) => {
    const newBackups = backups.filter(backup => backup.id !== backupId);
    saveBackupsToStorage(newBackups);
    localStorage.removeItem(`config-backup-${backupId}`);
    
    if (selectedBackup?.id === backupId) {
      setSelectedBackup(null);
    }
    
    toast({ title: "Backup deleted successfully" });
  };

  const downloadBackup = (backup: ConfigBackup) => {
    const backupData = localStorage.getItem(`config-backup-${backup.id}`);
    if (!backupData) {
      toast({ title: "Backup data not found", variant: "destructive" });
      return;
    }

    const blob = new Blob([backupData], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${backup.name.replace(/\s+/g, '-')}-${backup.timestamp.toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({ title: "Backup downloaded successfully" });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      const minutes = Math.floor(diffInHours * 60);
      return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    } else if (diffInHours < 24) {
      const hours = Math.floor(diffInHours);
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    } else {
      const days = Math.floor(diffInHours / 24);
      return `${days} day${days !== 1 ? 's' : ''} ago`;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Configuration Backups</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-4 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center">
                <Save className="h-5 w-5 mr-2" />
                Configuration Backups
              </CardTitle>
              <CardDescription>
                Create, restore, and manage configuration backups
              </CardDescription>
            </div>
            <div className="flex space-x-2">
              <Dialog>
                <DialogTrigger asChild>
                  <Button>
                    <Save className="h-4 w-4 mr-2" />
                    Create Backup
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Configuration Backup</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Backup Name</label>
                      <input
                        className="w-full mt-1 px-3 py-2 border rounded-md"
                        placeholder="Enter backup name..."
                        id="backup-name"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Description</label>
                      <textarea
                        className="w-full mt-1 px-3 py-2 border rounded-md"
                        placeholder="Optional description..."
                        rows={3}
                        id="backup-description"
                      />
                    </div>
                    <Button
                      onClick={() => {
                        const name = (document.getElementById("backup-name") as HTMLInputElement)?.value;
                        const description = (document.getElementById("backup-description") as HTMLTextAreaElement)?.value;
                        createBackup(name, description);
                      }}
                      className="w-full"
                    >
                      Create Backup
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {backups.length === 0 ? (
            <div className="text-center py-8">
              <History className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No backups found</h3>
              <p className="text-muted-foreground mb-4">
                Create your first configuration backup to get started
              </p>
              <Button onClick={() => createBackup("Initial Backup", "First configuration backup")}>
                Create First Backup
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {backups.map(backup => (
                <div key={backup.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      {backup.automatic ? (
                        <Clock className="h-5 w-5 text-blue-600" />
                      ) : (
                        <FileText className="h-5 w-5 text-green-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <h4 className="font-medium truncate">{backup.name}</h4>
                        {backup.automatic && (
                          <Badge variant="outline" className="text-xs">
                            Auto
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {backup.description}
                      </p>
                      <div className="flex items-center space-x-4 text-xs text-muted-foreground mt-1">
                        <span>{formatTimestamp(backup.timestamp)}</span>
                        <span>{formatFileSize(backup.size)}</span>
                        <span>{backup.categories.length} categories</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedBackup(backup)}
                      title="View details"
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => downloadBackup(backup)}
                      title="Download"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => restoreBackup(backup.id)}
                      title="Restore"
                    >
                      <Upload className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteBackup(backup.id)}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Backup Details Dialog */}
      <Dialog open={!!selectedBackup} onOpenChange={() => setSelectedBackup(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Backup Details</DialogTitle>
          </DialogHeader>
          {selectedBackup && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Name</label>
                  <div className="font-medium">{selectedBackup.name}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Created</label>
                  <div className="font-medium">{selectedBackup.timestamp.toLocaleString()}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Size</label>
                  <div className="font-medium">{formatFileSize(selectedBackup.size)}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Version</label>
                  <div className="font-medium">{selectedBackup.version}</div>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Description</label>
                <div className="font-medium mt-1">{selectedBackup.description}</div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Categories</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedBackup.categories.map(category => (
                    <Badge key={category} variant="secondary">
                      {category}
                    </Badge>
                  ))}
                </div>
              </div>
              
              <div className="flex space-x-2 pt-4">
                <Button 
                  onClick={() => restoreBackup(selectedBackup.id)}
                  className="flex-1"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Restore This Backup
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => downloadBackup(selectedBackup)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}