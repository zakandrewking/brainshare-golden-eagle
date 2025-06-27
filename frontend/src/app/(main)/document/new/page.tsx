"use client";

import * as React from "react";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { z } from "zod";

import { zodResolver } from "@hookform/resolvers/zod";

import FileUpload from "@/components/file-upload";
import FlexTitle from "@/components/flex-title";
import {
  createYSweetDocument,
  type CreateYSweetDocumentFormState,
} from "@/components/live-table/actions/create-y-sweet-document";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import Container from "@/components/ui/container";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Stack } from "@/components/ui/stack";
import { Textarea } from "@/components/ui/textarea";

const formSchema = z.object({
  name: z.string().trim().min(1, "Document name cannot be empty."),
  description: z.string().optional(),
  docType: z.enum(["text", "table"], {
    message: "A document type must be selected.",
  }),
});

type FormValues = z.infer<typeof formSchema>;

export default function CreateDocument() {
  const [state, formAction] = React.useActionState<
    CreateYSweetDocumentFormState | null,
    FormData
  >(createYSweetDocument, null);
  const { mutate } = useSWRConfig();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [_fileProcessed, setFileProcessed] = React.useState(false);

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

      // Handle AI suggestions feedback
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

  const handleFileProcessed = (_result: {
    message: string;
    success: boolean;
    fileName: string;
    fileType: string;
    fileSize: number;
  }) => {
    setFileProcessed(true);
    toast.success(
      "File processed successfully! You can now create the document."
    );
  };

  return (
    <Container>
      <FlexTitle
        title="Create a document"
        description="An open space to collaborate and jot down ideas"
      />
      <Stack direction="col" className="w-full mt-8" gap={6}>
        <form
          action={formAction}
          onSubmit={handleSubmit}
          className="space-y-6 w-full"
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
              defaultValue="table"
              onValueChange={(value) =>
                form.setValue("docType", value as "text" | "table", {
                  shouldValidate: true,
                })
              }
              name="docType"
              disabled={isSubmitting}
            >
              <SelectTrigger id="docType" className="w-full">
                <SelectValue placeholder="Select document type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="table">Table Document</SelectItem>
              </SelectContent>
            </Select>
            {form.formState.errors.docType && (
              <p className="text-sm text-red-500 mt-1">
                {form.formState.errors.docType.message}
              </p>
            )}
          </div>

          {process.env.NODE_ENV === "development" && (
            <Accordion
              type="single"
              collapsible
              className="w-full rounded-md bg-muted px-4"
            >
              <AccordionItem value="file-upload">
                <AccordionTrigger>More Options</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium">
                        Create from File
                      </Label>
                      <p className="text-xs text-muted-foreground mb-3">
                        Upload a CSV or TSV file to automatically populate your
                        document
                      </p>
                      <FileUpload
                        onFileProcessed={handleFileProcessed}
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Document"
            )}
          </Button>
        </form>
      </Stack>
    </Container>
  );
}
