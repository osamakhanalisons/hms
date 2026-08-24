import React, { useState } from "react";
import { Folder, ChevronRight, ChevronDown, Plus, Home, Building2 } from "lucide-react";
import { Button } from "./ui/button";

export interface PropertyNode {
  id: string;
  name: string;
  type: "society" | "apartment_area" | "house_villa_area" | "block" | "building" | "floor" | "unit";
  unitNumber?: string;
  unitType?: string;
  status?: string;
  children?: PropertyNode[];
  societyId?: string;
  blockName?: string;
}

interface PropertyTreeProps {
  data: PropertyNode[];
  onSelect: (node: PropertyNode) => void;
  onAddChild?: (parent: PropertyNode) => void;
  selectedId?: string;
}

export function PropertyTree({ data, onSelect, onAddChild, selectedId }: PropertyTreeProps) {
  return (
    <div className="space-y-1 font-sans text-sm">
      {data.map((node) => (
        <TreeNode
          key={node.id}
          node={node}
          onSelect={onSelect}
          onAddChild={onAddChild}
          selectedId={selectedId}
          level={0}
        />
      ))}
    </div>
  );
}

function TreeNode({
  node,
  onSelect,
  onAddChild,
  selectedId,
  level,
}: {
  node: PropertyNode;
  onSelect: (node: PropertyNode) => void;
  onAddChild?: (parent: PropertyNode) => void;
  selectedId?: string;
  level: number;
}) {
  const [isOpen, setIsOpen] = useState(level === 0);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedId === node.id;

  const toggleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  return (
    <div className="select-none">
      <div
        onClick={() => onSelect(node)}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        className={`flex items-center justify-between py-1.5 pr-2 rounded-md cursor-pointer transition-colors group ${
          isSelected ? "bg-primary-soft text-primary font-medium" : "hover:bg-muted/50"
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {node.type !== "unit" ? (
            <button
              onClick={toggleOpen}
              className="p-0.5 hover:bg-muted rounded text-muted-foreground"
            >
              {isOpen ? (
                <ChevronDown className="size-3.5" />
              ) : (
                <ChevronRight className="size-3.5" />
              )}
            </button>
          ) : (
            <Home className="size-3.5 shrink-0 text-muted-foreground ml-4" />
          )}

          {node.type !== "unit" && (
            node.type === "apartment_area" ? (
              <Building2 className="size-3.5 shrink-0 text-primary" />
            ) : node.type === "house_villa_area" ? (
              <Home className="size-3.5 shrink-0 text-primary" />
            ) : (
              <Folder className="size-3.5 shrink-0 text-muted-foreground" />
            )
          )}

          <span className="truncate">
            {node.type === "unit" ? (node.name || `Unit ${node.unitNumber}`) : node.name}
          </span>

          {node.type === "unit" && node.status && (
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-semibold ${
                node.status === "occupied"
                  ? "bg-success/15 text-success"
                  : node.status === "vacant"
                    ? "bg-muted text-muted-foreground"
                    : "bg-warning/15 text-warning-foreground"
              }`}
            >
              {node.status}
            </span>
          )}
        </div>

        {onAddChild && node.type !== "unit" && (
          <Button
            size="icon"
            variant="ghost"
            className="size-6 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              onAddChild(node);
            }}
          >
            <Plus className="size-3" />
          </Button>
        )}
      </div>

      {isOpen && hasChildren && (
        <div className="mt-0.5">
          {node.children!.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              onSelect={onSelect}
              onAddChild={onAddChild}
              selectedId={selectedId}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
