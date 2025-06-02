"use client";

import { useEffect, useState } from "react";

import {
  ChevronLeft,
  ChevronRight,
  Grid2x2Plus,
  Search,
} from "lucide-react";

import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

import { useSearch } from "@/components/global-search-provider";
import { Button } from "@/components/ui/button";

import { DocumentNavList, NavButton } from "./document-nav-list";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "./drawer";
import { Stack } from "./stack";

/**
 * Menu button that also manages the nav drawer.
 */
function NavigationButtonWithDrawer() {
  const [mounted, setMounted] = useState(false);
  const [willOpen, setWillOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [isMac, setIsMac] = useState(false);
  const { openSearch } = useSearch();

  // useEffect only runs on the client, so now we can safely show the UI
  useEffect(() => {
    setMounted(true);
    setIsMac(navigator.platform.toUpperCase().indexOf("MAC") >= 0);
  }, []);

  // The drawer doesn't like it when the active element is focused
  useEffect(() => {
    if (willOpen) {
      (document.activeElement as HTMLElement)?.blur();
      setOpen(true);
    } else {
      setOpen(false);
    }
  }, [willOpen]);

  if (!mounted) {
    return (
      <Button variant="outline" size="sm" className="pl-2" disabled>
        <ChevronRight className="mr-1" size={16} /> Menu
      </Button>
    );
  }

  return (
    <Drawer direction="left" open={open} onOpenChange={setWillOpen}>
      <DrawerTrigger className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium ring-offset-background transition-all duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 rounded-md px-3 pr-3 pl-2 w-[80px]">
        <ChevronRight className="mr-1" size={16} /> Menu
      </DrawerTrigger>
      <DrawerContent
        className="p-2 items-start z-[1000] fixed inset-y-0 left-0 top-0 bottom-0 mr-24"
        aria-describedby="navigation-links"
      >
        <Stack
          direction="col"
          className="overflow-y-auto min-h-full"
          justifyContent="between"
        >
          <div className="w-full">
            <VisuallyHidden>
              <DrawerTitle>Navigation</DrawerTitle>
              <DrawerDescription>Navigation links</DrawerDescription>
            </VisuallyHidden>
            <DrawerHeader className="p-0 w-full flex flex-row justify-end">
              <DrawerClose asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-start text-left"
                >
                  <ChevronLeft className="mr-1" size={16} /> Close
                </Button>
              </DrawerClose>
            </DrawerHeader>
            <Stack direction="col" gap={1} className="w-full">
              <Button
                variant="outline"
                className="w-full mt-3 justify-start text-left"
                onClick={() => {
                  openSearch();
                  setWillOpen(false);
                }}
              >
                <Search className="mr-2" size={16} />
                Search
                <span className="ml-auto text-xs text-muted-foreground">
                  {isMac ? "⌘K" : "Ctrl+K"}
                </span>
              </Button>

              <NavButton
                href="/document/new"
                variant="outline"
                className="w-full my-2 justify-center"
                setOpen={setWillOpen}
              >
                <Grid2x2Plus className="mr-2" size={16} />
                Create a doc
              </NavButton>

              <NavButton
                href="/"
                match={new RegExp("^/?$")}
                setOpen={setWillOpen}
              >
                Home
              </NavButton>
              {/* TODO: add a separator here */}
              <NavButton
                href="/planets"
                match={new RegExp("^/planets$")}
                setOpen={setWillOpen}
              >
                Planets
              </NavButton>
              <NavButton
                href="/moons"
                match={new RegExp("^/moons$")}
                setOpen={setWillOpen}
              >
                Moons
              </NavButton>

              <DocumentNavList setOpen={setWillOpen} />
            </Stack>
          </div>
          <DrawerFooter>
            version: {process.env.NEXT_PUBLIC_GIT_SHA}
          </DrawerFooter>
        </Stack>
      </DrawerContent>
    </Drawer>
  );
}

export { NavigationButtonWithDrawer };
