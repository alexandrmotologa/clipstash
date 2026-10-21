import React from "react";
import {
  ListFilter,
  Pin,
  ShieldAlert,
  Code2,
  Palette,
  Link2,
} from "lucide-react";
import type { CategoryFilter, ClipItem } from "../types/clip";

interface CategoryTabsProps {
  activeCategory: CategoryFilter;
  onSelectCategory: (cat: CategoryFilter) => void;
  clips: ClipItem[];
}

export const CategoryTabs: React.FC<CategoryTabsProps> = ({
  activeCategory,
  onSelectCategory,
  clips,
}) => {
  const counts = {
    all: clips.length,
    pinned: clips.filter((c) => c.is_pinned).length,
    secrets: clips.filter((c) => c.is_secret).length,
    code: clips.filter((c) => c.category_id === "code" || c.line_count > 2).length,
    colors: clips.filter((c) => c.category_id === "colors" || /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c.preview_text.trim())).length,
    links: clips.filter((c) => c.category_id === "links" || c.preview_text.trim().startsWith("http")).length,
  };

  const tabs: { id: CategoryFilter; label: string; icon: React.ReactNode; count: number; alert?: boolean }[] = [
    { id: "all", label: "All Clips", icon: <ListFilter className="w-3.5 h-3.5" />, count: counts.all },
    { id: "pinned", label: "Pinned", icon: <Pin className="w-3.5 h-3.5" />, count: counts.pinned },
    {
      id: "secrets",
      label: "Vault Secrets",
      icon: <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />,
      count: counts.secrets,
      alert: counts.secrets > 0,
    },
    { id: "code", label: "Code", icon: <Code2 className="w-3.5 h-3.5 text-sky-400" />, count: counts.code },
    { id: "colors", label: "Colors", icon: <Palette className="w-3.5 h-3.5 text-pink-400" />, count: counts.colors },
    { id: "links", label: "Links", icon: <Link2 className="w-3.5 h-3.5 text-emerald-400" />, count: counts.links },
  ];

  return (
    <div className="flex items-center gap-1.5 px-4 py-2 border-b border-zinc-800/60 bg-zinc-950/60 select-none overflow-x-auto no-scrollbar">
      {tabs.map((tab) => {
        const isActive = activeCategory === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onSelectCategory(tab.id)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-colors whitespace-nowrap ${
              isActive
                ? "bg-zinc-800 text-zinc-100 font-medium shadow-sm border border-zinc-700/60"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-transparent"
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                isActive
                  ? "bg-zinc-700 text-zinc-200"
                  : tab.alert
                    ? "bg-amber-500/20 text-amber-300 font-semibold"
                    : "bg-zinc-900 text-zinc-500"
              }`}
            >
              {tab.count}
            </span>
          </button>
        );
      })}
    </div>
  );
};
