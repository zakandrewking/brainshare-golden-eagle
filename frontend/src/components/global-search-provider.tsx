"use client";

import {
  createContext,
  useContext,
  useState,
} from "react";

import { useCmdK } from "@/hooks/use-keyboard-shortcut";

import { SearchCommand } from "./ui/search-command";

interface SearchContextType {
  isOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

export function useSearch() {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error("useSearch must be used within a SearchProvider");
  }
  return context;
}

interface SearchProviderProps {
  children: React.ReactNode;
}

export function SearchProvider({ children }: SearchProviderProps) {
  const [isOpen, setIsOpen] = useState(false);

  const openSearch = () => setIsOpen(true);
  const closeSearch = () => setIsOpen(false);

  useCmdK(openSearch);

  return (
    <SearchContext.Provider value={{ isOpen, openSearch, closeSearch }}>
      {children}
      <SearchCommand open={isOpen} onOpenChange={setIsOpen} />
    </SearchContext.Provider>
  );
}
