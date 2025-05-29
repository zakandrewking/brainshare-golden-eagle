"use client";

import { useState } from "react";

import { MoreVertical, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { deleteDocument } from "@/app/(main)/document/[docId]/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DocumentSettingsDropdownProps {
  docId: string;
  documentTitle?: string;
}

export default function DocumentSettingsDropdown({
  docId,
  documentTitle,
}: DocumentSettingsDropdownProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  const handleDeleteDocument = async () => {
    setIsDeleting(true);

    const loadingToast = toast.loading(
      <div className="flex items-center gap-2">
        Deleting document...
      </div>
    );

    try {
      const result = await deleteDocument(docId);

      toast.dismiss(loadingToast);

      if (result.error) {
        toast.error("Failed to delete document");
        console.error("Delete error:", result.error);
      } else {
        toast.success("Document deleted successfully");
        router.push("/");
      }
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error("Failed to delete document");
      console.error("Delete error:", error);
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon-sm"
            className="absolute top-3 right-3"
            data-testid="settings-dropdown-trigger"
          >
            <MoreVertical className="h-4 w-4" />
            <span className="sr-only">Document settings</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => setIsDeleteDialogOpen(true)}
            data-testid="delete-document-item"
            asChild
          >
            <Button variant="destructive" size="sm">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete document
            </Button>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent data-testid="delete-confirmation-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              {documentTitle ? `"${documentTitle}"` : "this document"}? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="cancel-delete-button">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteDocument}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="confirm-delete-button"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
