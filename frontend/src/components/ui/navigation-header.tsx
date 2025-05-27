/** Minimal header for every page */

"use client";

import React from "react";

import { NavigationButtonWithDrawer } from "./navigation-drawer";

export default function NavigationHeader() {
  return (
    <div className="h-16 fixed top-3 left-3">
      <NavigationButtonWithDrawer />
    </div>
  );
}
