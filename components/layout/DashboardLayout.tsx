"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Menu, X, Moon, Sun, PanelLeftClose, PanelLeft } from "lucide-react";
import { Sidebar, CollapsibleSidebar, NavSection } from "./Sidebar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: React.ReactNode;
  sections: NavSection[];
  /** Full logo for expanded sidebar */
  logo?: React.ReactNode;
  /** Compact logo for collapsed sidebar (icon only) */
  logoCollapsed?: React.ReactNode;
  headerRight?: React.ReactNode;
  sidebarFooter?: React.ReactNode;
  className?: string;
  /** Enable collapsible sidebar (default: true) */
  collapsible?: boolean;
  /** Show dark mode toggle */
  showThemeToggle?: boolean;
  /** Show loading state on header */
  loading?: boolean;
}

export function DashboardLayout({
  children,
  sections,
  logo,
  logoCollapsed,
  headerRight,
  sidebarFooter,
  className,
  collapsible = true,
  showThemeToggle = true,
  loading = false,
}: DashboardLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Initialize dark mode after mount to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;
    const stored = localStorage.getItem("theme");
    const shouldBeDark = stored ? stored === "dark" : prefersDark;

    document.documentElement.classList.toggle("dark", shouldBeDark);
    setIsDark(shouldBeDark);

    // Add CSS animation keyframes for the loading effect
    if (!document.getElementById("header-loader-styles")) {
      const style = document.createElement("style");
      style.id = "header-loader-styles";
      style.textContent = `
        @keyframes headerLoader {
          0%     {background-position: calc(0*100%/15) 100%,calc(1*100%/15)   0%,calc(2*100%/15) 100%,calc(3*100%/15)   0%,calc(4*100%/15) 100%,calc(5*100%/15)   0%,calc(6*100%/15) 100%,calc(7*100%/15)   0%,calc(8*100%/15) 100%,calc(9*100%/15)   0%,calc(10*100%/15) 100%,calc(11*100%/15)   0%,calc(12*100%/15) 100%,calc(13*100%/15)   0%,calc(14*100%/15) 100%,calc(15*100%/15)   0%}
          6.25%  {background-position: calc(0*100%/15)   0%,calc(1*100%/15)   0%,calc(2*100%/15) 100%,calc(3*100%/15)   0%,calc(4*100%/15) 100%,calc(5*100%/15)   0%,calc(6*100%/15) 100%,calc(7*100%/15)   0%,calc(8*100%/15) 100%,calc(9*100%/15)   0%,calc(10*100%/15) 100%,calc(11*100%/15)   0%,calc(12*100%/15) 100%,calc(13*100%/15)   0%,calc(14*100%/15) 100%,calc(15*100%/15)   0%}
          12.5%  {background-position: calc(0*100%/15)   0%,calc(1*100%/15) 100%,calc(2*100%/15) 100%,calc(3*100%/15)   0%,calc(4*100%/15) 100%,calc(5*100%/15)   0%,calc(6*100%/15) 100%,calc(7*100%/15)   0%,calc(8*100%/15) 100%,calc(9*100%/15)   0%,calc(10*100%/15) 100%,calc(11*100%/15)   0%,calc(12*100%/15) 100%,calc(13*100%/15)   0%,calc(14*100%/15) 100%,calc(15*100%/15)   0%}
          18.75% {background-position: calc(0*100%/15)   0%,calc(1*100%/15) 100%,calc(2*100%/15)   0%,calc(3*100%/15)   0%,calc(4*100%/15) 100%,calc(5*100%/15)   0%,calc(6*100%/15) 100%,calc(7*100%/15)   0%,calc(8*100%/15) 100%,calc(9*100%/15)   0%,calc(10*100%/15) 100%,calc(11*100%/15)   0%,calc(12*100%/15) 100%,calc(13*100%/15)   0%,calc(14*100%/15) 100%,calc(15*100%/15)   0%}
          25%    {background-position: calc(0*100%/15)   0%,calc(1*100%/15) 100%,calc(2*100%/15)   0%,calc(3*100%/15) 100%,calc(4*100%/15) 100%,calc(5*100%/15)   0%,calc(6*100%/15) 100%,calc(7*100%/15)   0%,calc(8*100%/15) 100%,calc(9*100%/15)   0%,calc(10*100%/15) 100%,calc(11*100%/15)   0%,calc(12*100%/15) 100%,calc(13*100%/15)   0%,calc(14*100%/15) 100%,calc(15*100%/15)   0%}
          31.25% {background-position: calc(0*100%/15)   0%,calc(1*100%/15) 100%,calc(2*100%/15)   0%,calc(3*100%/15) 100%,calc(4*100%/15)   0%,calc(5*100%/15)   0%,calc(6*100%/15) 100%,calc(7*100%/15)   0%,calc(8*100%/15) 100%,calc(9*100%/15)   0%,calc(10*100%/15) 100%,calc(11*100%/15)   0%,calc(12*100%/15) 100%,calc(13*100%/15)   0%,calc(14*100%/15) 100%,calc(15*100%/15)   0%}
          37.5%  {background-position: calc(0*100%/15)   0%,calc(1*100%/15) 100%,calc(2*100%/15)   0%,calc(3*100%/15) 100%,calc(4*100%/15)   0%,calc(5*100%/15) 100%,calc(6*100%/15) 100%,calc(7*100%/15)   0%,calc(8*100%/15) 100%,calc(9*100%/15)   0%,calc(10*100%/15) 100%,calc(11*100%/15)   0%,calc(12*100%/15) 100%,calc(13*100%/15)   0%,calc(14*100%/15) 100%,calc(15*100%/15)   0%}
          43.75% {background-position: calc(0*100%/15)   0%,calc(1*100%/15) 100%,calc(2*100%/15)   0%,calc(3*100%/15) 100%,calc(4*100%/15)   0%,calc(5*100%/15) 100%,calc(6*100%/15)   0%,calc(7*100%/15)   0%,calc(8*100%/15) 100%,calc(9*100%/15)   0%,calc(10*100%/15) 100%,calc(11*100%/15)   0%,calc(12*100%/15) 100%,calc(13*100%/15)   0%,calc(14*100%/15) 100%,calc(15*100%/15)   0%}
          50%    {background-position: calc(0*100%/15)   0%,calc(1*100%/15) 100%,calc(2*100%/15)   0%,calc(3*100%/15) 100%,calc(4*100%/15)   0%,calc(5*100%/15) 100%,calc(6*100%/15)   0%,calc(7*100%/15) 100%,calc(8*100%/15) 100%,calc(9*100%/15)   0%,calc(10*100%/15) 100%,calc(11*100%/15)   0%,calc(12*100%/15) 100%,calc(13*100%/15)   0%,calc(14*100%/15) 100%,calc(15*100%/15)   0%}
          56.25% {background-position: calc(0*100%/15)   0%,calc(1*100%/15) 100%,calc(2*100%/15)   0%,calc(3*100%/15) 100%,calc(4*100%/15)   0%,calc(5*100%/15) 100%,calc(6*100%/15)   0%,calc(7*100%/15) 100%,calc(8*100%/15)   0%,calc(9*100%/15)   0%,calc(10*100%/15) 100%,calc(11*100%/15)   0%,calc(12*100%/15) 100%,calc(13*100%/15)   0%,calc(14*100%/15) 100%,calc(15*100%/15)   0%}
          62.5%  {background-position: calc(0*100%/15)   0%,calc(1*100%/15) 100%,calc(2*100%/15)   0%,calc(3*100%/15) 100%,calc(4*100%/15)   0%,calc(5*100%/15) 100%,calc(6*100%/15)   0%,calc(7*100%/15) 100%,calc(8*100%/15)   0%,calc(9*100%/15) 100%,calc(10*100%/15) 100%,calc(11*100%/15)   0%,calc(12*100%/15) 100%,calc(13*100%/15)   0%,calc(14*100%/15) 100%,calc(15*100%/15)   0%}
          68.75% {background-position: calc(0*100%/15)   0%,calc(1*100%/15) 100%,calc(2*100%/15)   0%,calc(3*100%/15) 100%,calc(4*100%/15)   0%,calc(5*100%/15) 100%,calc(6*100%/15)   0%,calc(7*100%/15) 100%,calc(8*100%/15)   0%,calc(9*100%/15) 100%,calc(10*100%/15)   0%,calc(11*100%/15)   0%,calc(12*100%/15) 100%,calc(13*100%/15)   0%,calc(14*100%/15) 100%,calc(15*100%/15)   0%}
          75%    {background-position: calc(0*100%/15)   0%,calc(1*100%/15) 100%,calc(2*100%/15)   0%,calc(3*100%/15) 100%,calc(4*100%/15)   0%,calc(5*100%/15) 100%,calc(6*100%/15)   0%,calc(7*100%/15) 100%,calc(8*100%/15)   0%,calc(9*100%/15) 100%,calc(10*100%/15)   0%,calc(11*100%/15) 100%,calc(12*100%/15) 100%,calc(13*100%/15)   0%,calc(14*100%/15) 100%,calc(15*100%/15)   0%}
          81.25% {background-position: calc(0*100%/15)   0%,calc(1*100%/15) 100%,calc(2*100%/15)   0%,calc(3*100%/15) 100%,calc(4*100%/15)   0%,calc(5*100%/15) 100%,calc(6*100%/15)   0%,calc(7*100%/15) 100%,calc(8*100%/15)   0%,calc(9*100%/15) 100%,calc(10*100%/15)   0%,calc(11*100%/15) 100%,calc(12*100%/15)   0%,calc(13*100%/15)   0%,calc(14*100%/15) 100%,calc(15*100%/15)   0%}
          87.5%  {background-position: calc(0*100%/15)   0%,calc(1*100%/15) 100%,calc(2*100%/15)   0%,calc(3*100%/15) 100%,calc(4*100%/15)   0%,calc(5*100%/15) 100%,calc(6*100%/15)   0%,calc(7*100%/15) 100%,calc(8*100%/15)   0%,calc(9*100%/15) 100%,calc(10*100%/15)   0%,calc(11*100%/15) 100%,calc(12*100%/15)   0%,calc(13*100%/15) 100%,calc(14*100%/15) 100%,calc(15*100%/15)   0%}
          93.75% {background-position: calc(0*100%/15)   0%,calc(1*100%/15) 100%,calc(2*100%/15)   0%,calc(3*100%/15) 100%,calc(4*100%/15)   0%,calc(5*100%/15) 100%,calc(6*100%/15)   0%,calc(7*100%/15) 100%,calc(8*100%/15)   0%,calc(9*100%/15) 100%,calc(10*100%/15)   0%,calc(11*100%/15) 100%,calc(12*100%/15)   0%,calc(13*100%/15) 100%,calc(14*100%/15)   0%,calc(15*100%/15)   0%}
          100%   {background-position: calc(0*100%/15)   0%,calc(1*100%/15) 100%,calc(2*100%/15)   0%,calc(3*100%/15) 100%,calc(4*100%/15)   0%,calc(5*100%/15) 100%,calc(6*100%/15)   0%,calc(7*100%/15) 100%,calc(8*100%/15)   0%,calc(9*100%/15) 100%,calc(10*100%/15)   0%,calc(11*100%/15) 100%,calc(12*100%/15)   0%,calc(13*100%/15) 100%,calc(14*100%/15)   0%,calc(15*100%/15) 100%}
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => {
      // If user hasn't manually set a theme, follow system preference
      if (!localStorage.getItem("theme")) {
        setIsDark(e.matches);
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  // Add a dummy state to force re-render on theme change
  const [themeKey, setThemeKey] = useState(0);

  const toggleDarkMode = () => {
    const newValue = !isDark;
    setIsDark(newValue);
    document.documentElement.classList.toggle("dark", newValue);
    localStorage.setItem("theme", newValue ? "dark" : "light");
    // Force re-render to update loading effect
    setThemeKey((prev) => prev + 1);
  };

  const sidebarWidth = collapsible ? (sidebarCollapsed ? 72 : 256) : 256;

  // Sidebar header with logo (switches between full and collapsed versions)
  const sidebarHeader =
    logo || logoCollapsed ? (
      <div
        className={cn(
          "flex items-center",
          sidebarCollapsed && collapsible ? "justify-center" : "gap-3"
        )}
      >
        {sidebarCollapsed && collapsible ? logoCollapsed || logo : logo}
      </div>
    ) : null;

  // Sidebar footer with collapse toggle
  const sidebarFooterContent = (
    <div className="space-y-2">
      {sidebarFooter}
      {collapsible && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="w-full justify-start gap-2"
        >
          {sidebarCollapsed ? (
            <PanelLeft className="w-4 h-4" />
          ) : (
            <>
              <PanelLeftClose className="w-4 h-4" />
              <span>Collapse</span>
            </>
          )}
        </Button>
      )}
    </div>
  );

  return (
    <div className={cn("min-h-screen bg-background", className)}>
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        {collapsible ? (
          <CollapsibleSidebar
            sections={sections}
            header={sidebarHeader}
            footer={sidebarFooterContent}
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
        ) : (
          <Sidebar
            sections={sections}
            header={sidebarHeader}
            footer={sidebarFooterContent}
          />
        )}
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <motion.div
        className="fixed inset-y-0 left-0 z-50 md:hidden"
        initial={{ x: "-100%" }}
        animate={{ x: mobileMenuOpen ? 0 : "-100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <Sidebar
          sections={sections}
          header={
            <div className="flex items-center justify-between">
              {logo}
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setMobileMenuOpen(false)}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          }
          footer={sidebarFooter}
        />
      </motion.div>

      {/* Main Content Area */}
      <motion.div
        className="md:transition-[margin-left] md:duration-300"
        style={{ marginLeft: 0 }}
        animate={{ marginLeft: `${sidebarWidth}px` }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        {/* Top Header Bar */}
        <header
          className={cn(
            "border-b border-border bg-background relative overflow-hidden"
          )}
        >
          {loading && (
            <div
              key={themeKey}
              className="absolute inset-0 z-0"
              style={
                {
                  background: `
                  linear-gradient(var(--loader-color, rgba(0,0,0,0.05)) 50%, transparent 0),
                  linear-gradient(transparent 50%, var(--loader-color, rgba(0,0,0,0.05)) 0),
                  linear-gradient(var(--loader-color, rgba(0,0,0,0.05)) 50%, transparent 0),
                  linear-gradient(transparent 50%, var(--loader-color, rgba(0,0,0,0.05)) 0),
                  linear-gradient(var(--loader-color, rgba(0,0,0,0.05)) 50%, transparent 0),
                  linear-gradient(transparent 50%, var(--loader-color, rgba(0,0,0,0.05)) 0),
                  linear-gradient(var(--loader-color, rgba(0,0,0,0.05)) 50%, transparent 0),
                  linear-gradient(transparent 50%, var(--loader-color, rgba(0,0,0,0.05)) 0),
                  linear-gradient(var(--loader-color, rgba(0,0,0,0.05)) 50%, transparent 0),
                  linear-gradient(transparent 50%, var(--loader-color, rgba(0,0,0,0.05)) 0),
                  linear-gradient(var(--loader-color, rgba(0,0,0,0.05)) 50%, transparent 0),
                  linear-gradient(transparent 50%, var(--loader-color, rgba(0,0,0,0.05)) 0),
                  linear-gradient(var(--loader-color, rgba(0,0,0,0.05)) 50%, transparent 0),
                  linear-gradient(transparent 50%, var(--loader-color, rgba(0,0,0,0.05)) 0),
                  linear-gradient(var(--loader-color, rgba(0,0,0,0.05)) 50%, transparent 0),
                  linear-gradient(transparent 50%, var(--loader-color, rgba(0,0,0,0.05)) 0),
                  transparent
                `,
                  backgroundSize: "calc(100%/16 + 1px) 200%",
                  backgroundRepeat: "no-repeat",
                  animation: "headerLoader 5s infinite",
                  "--loader-color": isDark
                    ? "rgba(255,255,255,0.08)"
                    : "rgba(0,0,0,0.05)",
                } as React.CSSProperties
              }
            />
          )}
          <div className="flex h-14 items-center gap-4 px-4 md:px-6 relative z-10">
            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="icon-sm"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </Button>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Header Right Content */}
            <div className="flex items-center gap-2">
              {headerRight}

              {showThemeToggle && mounted && (
                <Button variant="ghost" size="icon-sm" onClick={toggleDarkMode}>
                  {isDark ? (
                    <Sun className="w-4 h-4" />
                  ) : (
                    <Moon className="w-4 h-4" />
                  )}
                </Button>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 md:p-6">{children}</main>
      </motion.div>
    </div>
  );
}

// Simple page header component for consistency
interface PageHeaderProps {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("mb-6 md:mb-8", className)}>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl tracking-widest uppercase font-normal">
            {title}
          </h1>
          {description && (
            <p className="text-muted-foreground mt-1 text-sm md:text-base">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

// Content section wrapper
interface ContentSectionProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function ContentSection({
  title,
  description,
  children,
  className,
}: ContentSectionProps) {
  return (
    <section className={cn("mb-8", className)}>
      {(title || description) && (
        <div className="mb-4">
          {title && (
            <h2 className="text-sm tracking-widest uppercase text-muted-foreground">
              {title}
            </h2>
          )}
          {description && (
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          )}
        </div>
      )}
      {children}
    </section>
  );
}
