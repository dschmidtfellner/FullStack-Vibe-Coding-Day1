import { useBubbleAuth, useChildAccess } from "@/hooks/useBubbleAuth";
import { createFileRoute } from "@tanstack/react-router";
import {
  NavigationProvider,
  useNavigation,
} from "@/contexts/NavigationContext";
import {
  LogModal,
  EditLogModal,
  LogDetailView,
  LogsListView,
  MessagingView,
} from "@/features";
import { UniversalSkeleton } from "@/components/shared/UniversalSkeleton";

// Navigation Context for client-side routing

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const { user, isLoading, error } = useBubbleAuth();

  // Show loading animation while authenticating or if there's an auth error
  if (isLoading || error || !user) {
    return <UniversalSkeleton />;
  }

  // Parse URL parameters for NavigationProvider
  const urlParams = new URLSearchParams(window.location.search);
  const childId = urlParams.get("childId");
  const timezone = urlParams.get("timezone") || "America/New_York";

  // Only show loading if we don't have required data
  if (!childId) {
    return <UniversalSkeleton />;
  }

  return (
    <div className="not-prose">
      <NavigationProvider initialChildId={childId} initialTimezone={timezone}>
        <AppRouter />
      </NavigationProvider>
    </div>
  );
}

// Main app router that switches views based on navigation state
function AppRouter() {
  const { state } = useNavigation();

  // Check if user has access to the current child
  const hasChildAccess = useChildAccess(state.childId);

  if (!hasChildAccess) {
    return <UniversalSkeleton />;
  }

  // Route to appropriate view based on navigation state
  const renderMainView = () => {
    switch (state.view) {
      case "messaging":
        return <MessagingView />;
      case "LogList":
        return <LogsListView />;
      case "log-detail":
        return <LogDetailView />;
      case "LoggingModal":
        // When modal is open, we need to determine what to show behind it
        if (state.logId) {
          // If editing an existing log, show the log detail view
          return <LogDetailView />;
        } else {
          // If creating a new log, show the logs list
          return <LogsListView />;
        }
      case "edit-log":
        return null; // Don't render background view when EditLogModal is open
      default:
        return <LogsListView />;
    }
  };

  return (
    <>
      {renderMainView()}
      {state.view === "LoggingModal" && <LogModal />}
      {state.view === "edit-log" && <EditLogModal />}
    </>
  );
}