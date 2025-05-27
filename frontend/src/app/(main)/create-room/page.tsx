"use client";

import * as React from "react";

import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { z } from "zod";

import { zodResolver } from "@hookform/resolvers/zod";

import FlexTitle from "@/components/flex-title";
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

import {
  handleCreateRoomForm,
  type HandleCreateRoomFormState,
} from "./actions";

const formSchema = z.object({
  name: z
    .string()
    .min(3, "Room name must be at least 3 characters long.")
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      "Room name can only contain letters, numbers, underscores, and hyphens."
    ),
  description: z.string().optional(),
  docType: z.enum(["text", "table"], {
    message: "A document type must be selected.",
  }),
});

type FormValues = z.infer<typeof formSchema>;

export default function CreateRoom() {
  const [state, formAction] = React.useActionState<
    HandleCreateRoomFormState | null,
    FormData
  >(handleCreateRoomForm, null);
  const { mutate } = useSWRConfig();

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
      if (state.createdRoomData) {
      }
    } else if (state?.errors) {
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
  }, [state, form, mutate]);

  return (
    <Container>
      <FlexTitle
        title="Create a room"
        description="An open space to collaborate and jot down ideas"
      />
      <Stack direction="col" className="w-full mt-8" gap={6}>
        <form action={formAction} className="space-y-6 w-full">
          <div>
            <Label htmlFor="name">Room Name</Label>
            <Input id="name" {...form.register("name")} />
            {form.formState.errors.name && (
              <p className="text-sm text-red-500 mt-1">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea id="description" {...form.register("description")} />
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
            >
              <SelectTrigger id="docType" className="w-full">
                <SelectValue placeholder="Select document type" />
              </SelectTrigger>
              <SelectContent>
                {/* <SelectItem value="text">Text Document</SelectItem> */}
                <SelectItem value="table">Table Document</SelectItem>
              </SelectContent>
            </Select>
            {form.formState.errors.docType && (
              <p className="text-sm text-red-500 mt-1">
                {form.formState.errors.docType.message}
              </p>
            )}
          </div>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Creating..." : "Create Room"}
          </Button>
        </form>
      </Stack>
    </Container>
  );
}
