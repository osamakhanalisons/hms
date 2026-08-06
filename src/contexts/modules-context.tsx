import React, { createContext, useContext, useEffect, useState } from "react";
import { getActiveModulesFn } from "@/lib/api/tenants";

interface ModuleState {
  module_key: string;
  display_name: string;
  category: string;
  is_core: boolean;
  is_active: boolean;
  min_plan: string;
  dependencies: string[];
  description?: string;
}

interface ModulesContextType {
  activeModules: Set<string>;
  allModules: ModuleState[];
  isModuleActive: (key: string) => boolean;
  refreshModules: () => Promise<void>;
  isLoading: boolean;
}

const ModulesContext = createContext<ModulesContextType | undefined>(undefined);

export function ModulesProvider({ children }: { children: React.ReactNode }) {
  const [allModules, setAllModules] = useState<ModuleState[]>([]);
  const [activeModules, setActiveModules] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  const refreshModules = async () => {
    try {
      const data = await getActiveModulesFn();
      setAllModules(data as ModuleState[]);
      const active = new Set<string>(
        (data as ModuleState[])
          .filter((m: ModuleState) => m.is_active)
          .map((m: ModuleState) => m.module_key),
      );
      setActiveModules(active);
    } catch (err) {
      console.error("Failed to load active modules:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshModules();
  }, []);

  const isModuleActive = (key: string) => {
    // If the system hasn't loaded modules yet, assume true for core
    if (allModules.length === 0)
      return [
        "platform",
        "property",
        "residents",
        "notifications",
        "documents",
        "reports",
      ].includes(key);
    return activeModules.has(key);
  };

  return (
    <ModulesContext.Provider
      value={{ activeModules, allModules, isModuleActive, refreshModules, isLoading }}
    >
      {children}
    </ModulesContext.Provider>
  );
}

export function useModules() {
  const context = useContext(ModulesContext);
  if (context === undefined) {
    throw new Error("useModules must be used within a ModulesProvider");
  }
  return context;
}
