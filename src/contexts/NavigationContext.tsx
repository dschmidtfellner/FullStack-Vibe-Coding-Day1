import React, { createContext, useContext, useState } from 'react';
import { SleepLog } from '@/lib/firebase-messaging';

// Navigation state type definition
export type NavigationState = {
  view: "messaging" | "LogList" | "log-detail" | "LoggingModal" | "edit-log";
  logId?: string | null;
  childId: string | null;
  timezone: string;
  logs: SleepLog[];
  logCache: Map<string, SleepLog>;
  isLoading: boolean;
  previousView?:
    | "messaging"
    | "LogList"
    | "log-detail"
    | "LoggingModal"
    | "edit-log"
    | null;
  defaultLogDate?: string; // For passing default date to new log modal
};

// Navigation context type definition
export type NavigationContextType = {
  state: NavigationState;
  navigateToLogs: () => void;
  navigateToLogDetail: (logId: string) => void;
  navigateToNewLog: (defaultDate?: string) => void;
  navigateToEditLog: (logId: string) => void;
  navigateToLogDetailAndShowModal: (logId: string) => void;
  navigateToLogDetailAndShowModalFromDetail: (logId: string) => void;
  navigateToMessaging: () => void;
  navigateBack: () => void;
  updateLog: (log: SleepLog) => void;
  setLogs: (logs: SleepLog[]) => void;
};

// Create the navigation context
const NavigationContext = createContext<NavigationContextType | null>(null);

// Custom hook to use navigation context
export function useNavigation() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error("useNavigation must be used within NavigationProvider");
  }
  return context;
}

// Navigation provider props
export interface NavigationProviderProps {
  children: React.ReactNode;
  initialChildId: string | null;
  initialTimezone: string;
}

// Navigation provider component
export function NavigationProvider({
  children,
  initialChildId,
  initialTimezone,
}: NavigationProviderProps) {
  // Parse initial view from URL
  const urlParams = new URLSearchParams(window.location.search);
  const initialView =
    (urlParams.get("view") as NavigationState["view"]) || "LogList";
  const initialLogId = urlParams.get("logId");

  const [state, setState] = useState<NavigationState>({
    view: initialView,
    logId: initialLogId,
    childId: initialChildId,
    timezone: initialTimezone,
    logs: [],
    logCache: new Map(),
    isLoading: false,
    previousView: null,
  });

  // Update URL without page reload
  const updateURL = (view: string, logId?: string | null) => {
    const url = new URL(window.location.href);
    url.searchParams.set("view", view);
    if (logId) {
      url.searchParams.set("logId", logId);
    } else {
      url.searchParams.delete("logId");
    }
    window.history.replaceState({}, "", url.toString());
  };

  const navigateToLogs = () => {
    setState((prev) => ({ ...prev, view: "LogList", logId: null }));
    updateURL("LogList");
  };

  const navigateToLogDetail = (logId: string) => {
    setState((prev) => ({ ...prev, view: "log-detail", logId }));
    updateURL("log-detail", logId);
  };

  const navigateToNewLog = (defaultDate?: string) => {
    setState((prev) => ({
      ...prev,
      view: "LoggingModal",
      logId: null,
      defaultLogDate: defaultDate,
      previousView:
        prev.view === "LoggingModal" ? prev.previousView : prev.view,
    }));
    updateURL("LoggingModal");
  };

  const navigateToEditLog = (logId: string) => {
    setState((prev) => ({
      ...prev,
      view: "edit-log",
      logId,
      previousView: prev.view === "edit-log" ? prev.previousView : prev.view,
    }));
    updateURL("edit-log", logId);
  };

  const navigateToLogDetailAndShowModal = (logId: string) => {
    // First navigate to LogDetail, then show the modal
    setState((prev) => ({
      ...prev,
      view: "log-detail",
      logId,
      previousView: prev.view === "log-detail" ? prev.previousView : prev.view,
    }));
    updateURL("log-detail", logId);

    // After a brief delay, show the modal
    setTimeout(() => {
      setState((prev) => ({
        ...prev,
        view: "LoggingModal",
        logId,
        previousView: "log-detail",
      }));
      updateURL("LoggingModal", logId);
    }, 100);
  };

  const navigateToLogDetailAndShowModalFromDetail = (logId: string) => {
    // Already on log-detail, just show the modal
    setState((prev) => ({
      ...prev,
      view: "LoggingModal",
      logId,
      previousView: "log-detail",
    }));
    updateURL("LoggingModal", logId);
  };

  const navigateToMessaging = () => {
    setState((prev) => ({ ...prev, view: "messaging", logId: null }));
    updateURL("messaging");
  };

  const navigateBack = () => {
    // Different logic based on current view
    if (state.view === "LoggingModal") {
      // From modal: go to Log Detail if we have a logId, otherwise use previousView
      if (state.logId) {
        navigateToLogDetail(state.logId);
      } else if (state.previousView === "LogList") {
        navigateToLogs();
      } else if (state.previousView === "messaging") {
        navigateToMessaging();
      } else {
        navigateToLogs();
      }
    } else if (state.view === "log-detail") {
      // From log detail: always go back to logs list
      navigateToLogs();
    } else if (state.view === "edit-log") {
      // From edit log: go back to log detail
      if (state.logId) {
        navigateToLogDetail(state.logId);
      } else {
        navigateToLogs();
      }
    } else {
      // Default fallback for other views
      navigateToLogs();
    }
  };

  const updateLog = (log: SleepLog) => {
    setState((prev) => ({
      ...prev,
      logCache: new Map(prev.logCache).set(log.id, log),
      logs: prev.logs.map((l) => (l.id === log.id ? log : l)),
    }));
  };

  const setLogs = (logs: SleepLog[]) => {
    setState((prev) => ({ ...prev, logs }));
    // Update cache with new logs
    const newCache = new Map(state.logCache);
    logs.forEach((log) => newCache.set(log.id, log));
    setState((prev) => ({ ...prev, logCache: newCache }));
  };

  const contextValue: NavigationContextType = {
    state,
    navigateToLogs,
    navigateToLogDetail,
    navigateToNewLog,
    navigateToEditLog,
    navigateToLogDetailAndShowModal,
    navigateToLogDetailAndShowModalFromDetail,
    navigateToMessaging,
    navigateBack,
    updateLog,
    setLogs,
  };

  return (
    <NavigationContext.Provider value={contextValue}>
      {children}
    </NavigationContext.Provider>
  );
}