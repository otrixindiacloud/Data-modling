import { useState, useEffect, useCallback } from "react";
import { configManager } from "@/lib/configManager";

export const useConfiguration = (category: string, key: string) => {
  const [value, setValue] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    configManager.getConfiguration(category, key).then(config => {
      setValue(config?.value || null);
      setLoading(false);
    });

    const unsubscribe = configManager.onConfigurationChange((cat, k, val) => {
      if (cat === category && k === key) {
        setValue(val);
      }
    });

    return unsubscribe;
  }, [category, key]);

  const updateValue = useCallback(async (newValue: any) => {
    const success = await configManager.setConfiguration(category, key, newValue);
    if (success) {
      setValue(newValue);
    }
    return success;
  }, [category, key]);

  return { value, loading, updateValue };
};