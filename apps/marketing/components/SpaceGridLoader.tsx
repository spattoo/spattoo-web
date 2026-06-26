"use client";

import dynamic from "next/dynamic";
import { Component, ReactNode } from "react";

const SpaceGrid = dynamic(() => import("@/components/SpaceGrid"), { ssr: false });

class ErrorBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  componentDidCatch(error: Error) { console.error("[SpaceGrid error]", error); }
  render() {
    return this.state.error ? null : this.props.children;
  }
}

export default function SpaceGridLoader() {
  return (
    <div style={{ width: "100%", height: "100vh" }}>
      <ErrorBoundary>
        <SpaceGrid />
      </ErrorBoundary>
    </div>
  );
}
