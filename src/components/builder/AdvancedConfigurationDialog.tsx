import { type JSX } from "react";
import type { TemplateDesign } from "@/design";
import { ContentLibraryPanel } from "@/components/builder/ContentLibraryDialog";
import { ContentLimitsPanel } from "@/components/builder/ContentLimitsDialog";
import { ExpertTemplateSettingsPanel } from "@/components/builder/ExpertTemplateSettingsDialog";
import { LayoutProfilesPanel } from "@/components/builder/LayoutProfilesDialog";
import { MandatoryContentPanel } from "@/components/builder/MandatoryContentDialog";
import { Dialog, DialogContent, DialogDescription, DialogTitle, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/radix";

export type AdvancedConfigurationTab = "layout" | "content" | "limits" | "expert" | "mandatory";

export function AdvancedConfigurationDialog({
  open,
  activeTab,
  onOpenChange,
  onActiveTabChange,
  design,
  onUpdate,
  onGlobal
}: {
  open: boolean;
  activeTab: AdvancedConfigurationTab;
  onOpenChange(open: boolean): void;
  onActiveTabChange(tab: AdvancedConfigurationTab): void;
  design: TemplateDesign;
  onUpdate(mutator: (design: TemplateDesign) => void): void;
  onGlobal<K extends keyof TemplateDesign>(key: K, value: TemplateDesign[K]): void;
}): JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="advanced-configuration-dialog">
        <div className="dialog-heading">
          <div>
            <DialogTitle>Advanced Configuration</DialogTitle>
            <DialogDescription>Configure layout profiles, content pools, limits, expert settings, and mandatory content in one workspace.</DialogDescription>
          </div>
        </div>
        <Tabs value={activeTab} onValueChange={(value) => onActiveTabChange(value as AdvancedConfigurationTab)} className="advanced-configuration">
          <TabsList aria-label="Advanced configuration sections" className="advanced-configuration__tabs">
            <TabsTrigger value="layout">Layout &amp; Profiles</TabsTrigger>
            <TabsTrigger value="content">Content Pools</TabsTrigger>
            <TabsTrigger value="limits">Count Limits</TabsTrigger>
            <TabsTrigger value="expert">Expert Settings</TabsTrigger>
            <TabsTrigger value="mandatory">Mandatory Content</TabsTrigger>
          </TabsList>
          <div className="advanced-configuration__panel">
            <TabsContent value="layout" forceMount style={activeTab === "layout" ? undefined : { display: "none" }}>
              <LayoutProfilesPanel active={open && activeTab === "layout"} design={design} onUpdate={onUpdate} />
            </TabsContent>
            <TabsContent value="content" forceMount style={activeTab === "content" ? undefined : { display: "none" }}>
              <ContentLibraryPanel active={open && activeTab === "content"} design={design} onUpdate={onUpdate} onClose={() => onOpenChange(false)} />
            </TabsContent>
            <TabsContent value="limits" forceMount style={activeTab === "limits" ? undefined : { display: "none" }}>
              <ContentLimitsPanel active={open && activeTab === "limits"} design={design} onUpdate={onUpdate} />
            </TabsContent>
            <TabsContent value="expert" forceMount style={activeTab === "expert" ? undefined : { display: "none" }}>
              <ExpertTemplateSettingsPanel active={open && activeTab === "expert"} design={design} onUpdate={onUpdate} onGlobal={onGlobal} onClose={() => onOpenChange(false)} />
            </TabsContent>
            <TabsContent value="mandatory" forceMount style={activeTab === "mandatory" ? undefined : { display: "none" }}>
              <MandatoryContentPanel active={open && activeTab === "mandatory"} design={design} onUpdate={onUpdate} />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
