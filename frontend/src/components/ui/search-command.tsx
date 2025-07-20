"use client";

import { useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import { useDocuments } from "@/hooks/use-documents";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./command";

interface SearchItem {
  id: string;
  title: string;
  href: string;
  type: "page" | "document";
}

interface SearchCommandProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SearchCommand({ open, onOpenChange }: SearchCommandProps) {
  const router = useRouter();
  const { documents, isLoading } = useDocuments();
  const [searchItems, setSearchItems] = useState<SearchItem[]>([]);

  useEffect(() => {
    const hardcodedItems: SearchItem[] = [
      {
        id: "home",
        title: "Home",
        href: "/",
        type: "page",
      },
      {
        id: "create-doc",
        title: "Create a doc",
        href: "/document/new",
        type: "page",
      },
      {
        id: "files",
        title: "Files",
        href: "/files",
        type: "page",
      },
      {
        id: "chat",
        title: "Chat",
        href: "/chat",
        type: "page",
      },
      {
        id: "planets",
        title: "Planets",
        href: "/planets",
        type: "page",
      },
      {
        id: "moons",
        title: "Moons",
        href: "/moons",
        type: "page",
      },
      {
        id: "debug",
        title: "Debug",
        href: "/debug",
        type: "page",
      },
    ];

    const documentItems: SearchItem[] = documents
      ? documents.map((doc) => ({
          id: doc.id,
          title: doc.title,
          href: `/document/${doc.id}`,
          type: "document" as const,
        }))
      : [];

    setSearchItems([...hardcodedItems, ...documentItems]);
  }, [documents]);

  const handleSelect = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onOpenChange(false);
    }
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search"
      description="Search for pages and documents"
    >
      <CommandInput
        placeholder="Search pages and documents..."
        onKeyDown={handleKeyDown}
      />
      <CommandList>
        <CommandEmpty>
          {isLoading ? "Loading..." : "No results found."}
        </CommandEmpty>

        <CommandGroup heading="Pages">
          {searchItems
            .filter((item) => item.type === "page")
            .map((item) => (
              <CommandItem
                key={item.id}
                value={item.title}
                onSelect={() => handleSelect(item.href)}
              >
                {item.title}
              </CommandItem>
            ))}
        </CommandGroup>

        {searchItems.filter((item) => item.type === "document").length > 0 && (
          <CommandGroup heading="Documents">
            {searchItems
              .filter((item) => item.type === "document")
              .map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.title}
                  onSelect={() => handleSelect(item.href)}
                >
                  {item.title}
                </CommandItem>
              ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
