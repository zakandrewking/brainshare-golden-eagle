"use client";

import * as React from "react";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { z } from "zod";

import { zodResolver } from "@hookform/resolvers/zod";

import type {
  CreateYSweetDocumentFormState,
} from "@/components/live-table/actions/create-y-sweet-document";
import {
  createYSweetDocument,
} from "@/components/live-table/actions/create-y-sweet-document";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const formSchema = z.object({
  name: z.string().trim().min(1, "Document name cannot be empty."),
  description: z.string().optional(),
  docType: z.enum(["text", "table"], {
    message: "A document type must be selected.",
  }),
});

type FormValues = z.infer<typeof formSchema>;

export default function CreateDocumentView() {
  const [state, formAction] = React.useActionState<
    CreateYSweetDocumentFormState | null,
    FormData
  >(createYSweetDocument, null);
  const { mutate } = useSWRConfig();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      docType: "text",
    },
  });

  React.useEffect(() => {
    if (state?.success) {
      toast.success(state.message);
      form.reset();
      mutate("/api/documents");
      setIsSubmitting(false);

      if (state.aiSuggestionsError) {
        toast.error(
          `AI suggestions failed: ${state.aiSuggestionsError}. Using default column names.`
        );
      } else if (state.aiSuggestionsUsed) {
        toast.success("AI-powered column suggestions applied successfully!");
      }

      if (state.documentId) {
        router.push(`/document/${state.documentId}`);
      }
    } else if (state?.errors) {
      setIsSubmitting(false);
      if (state.errors.name) {
        form.setError("name", {
          type: "server",
          message: state.errors.name.join(", "),
        });
      }
      if (state.errors.description) {
        form.setError("description", {
          type: "server",
          message: state.errors.description.join(", "),
        });
      }
      if (state.errors.docType) {
        form.setError("docType", {
          type: "server",
          message: state.errors.docType.join(", "),
        });
      }
      if (state.errors._form) {
        toast.error(state.errors._form.join(", "));
      }
    }
  }, [state, form, mutate, router]);

  const handleSubmit = () => {
    setIsSubmitting(true);
  };

  return (
    <form
      action={formAction}
      onSubmit={handleSubmit}
      className="space-y-6 w-full flex flex-col gap-6 mt-8"
    >
      <div>
        <Label htmlFor="name">Document Name</Label>
        <Input
          id="name"
          {...form.register("name")}
          disabled={isSubmitting}
          autoComplete="off"
          autoFocus
        />
        {form.formState.errors.name && (
          <p className="text-sm text-red-500 mt-1">
            {form.formState.errors.name.message}
          </p>
        )}
      </div>
      <div>
        <Label htmlFor="description">Description (Optional)</Label>
        <Textarea
          id="description"
          {...form.register("description")}
          disabled={isSubmitting}
        />
        {form.formState.errors.description && (
          <p className="text-sm text-red-500 mt-1">
            {form.formState.errors.description.message}
          </p>
        )}
      </div>
      <div>
        <Label htmlFor="docType">Document Type</Label>
        <Select
          value={form.watch("docType")}
          onValueChange={(value) =>
            form.setValue("docType", value as "text" | "table")
          }
          disabled={isSubmitting}
        >
          <SelectTrigger id="docType">
            <SelectValue placeholder="Select document type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="text">Text Document</SelectItem>
            <SelectItem value="table">Table Document</SelectItem>
          </SelectContent>
        </Select>
        {form.formState.errors.docType && (
          <p className="text-sm text-red-500 mt-1">
            {form.formState.errors.docType.message}
          </p>
        )}
      </div>
      <Button
        type="submit"
        disabled={isSubmitting || !form.formState.isValid}
        className="w-full"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creating Document...
          </>
        ) : (
          "Create Document"
        )}
      </Button>
    </form>
  );
}
