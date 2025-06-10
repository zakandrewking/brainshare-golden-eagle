"use client";

import { Bug } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  useIsAiFillSelectionDebugEnabled,
  useSetAiFillSelectionDebugEnabled,
} from "@/stores/debugSettingsStore";

export function DebugSettings() {
  const isDebugEnabled = useIsAiFillSelectionDebugEnabled();
  const setDebugEnabled = useSetAiFillSelectionDebugEnabled();

  return (
    <div className="w-full space-y-6">
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Bug size={20} />
          AI Fill Selection
        </div>
        <Separator />

        <div className="space-y-4">
          <div className="flex items-start space-x-3">
            <Checkbox
              id="ai-fill-debug"
              checked={isDebugEnabled}
              onCheckedChange={(checked: boolean) => setDebugEnabled(checked)}
            />
            <div className="grid gap-2 leading-none">
              <Label
                htmlFor="ai-fill-debug"
                className="text-base font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Enable Debug Mode
              </Label>
              <p className="text-sm text-muted-foreground leading-relaxed">
                When enabled, AI Fill Selection will output detailed test case
                data to the browser console. This data can be copied and used to
                create automated test cases for evaluating AI model performance.
              </p>
              <div className="mt-3 p-3 bg-muted rounded-md">
                <p className="text-xs text-muted-foreground font-medium mb-1">
                  How to use:
                </p>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Enable this setting</li>
                  <li>Use AI Fill Selection on any table</li>
                  <li>Check browser console for JSON test case data</li>
                  <li>Copy the JSON to create automated tests</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
