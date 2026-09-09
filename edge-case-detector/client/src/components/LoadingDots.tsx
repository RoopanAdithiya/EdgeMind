/*
 * LoadingDots — terminal-style loading indicator
 * Design: Laboratory Terminal
 * Three pulsing dots instead of a generic spinner
 */
export default function LoadingDots() {
  return (
    <div className="flex items-center justify-center h-full gap-1.5 px-4">
      <div className="flex flex-col items-center gap-4">
        <div className="flex gap-2">
          <div
            className="w-2.5 h-2.5 rounded-full bg-primary"
            style={{
              animation: "pulse 1.4s ease-in-out infinite",
              animationDelay: "0ms",
            }}
          />
          <div
            className="w-2.5 h-2.5 rounded-full bg-primary"
            style={{
              animation: "pulse 1.4s ease-in-out infinite",
              animationDelay: "200ms",
            }}
          />
          <div
            className="w-2.5 h-2.5 rounded-full bg-primary"
            style={{
              animation: "pulse 1.4s ease-in-out infinite",
              animationDelay: "400ms",
            }}
          />
        </div>
        <p className="text-xs font-mono text-muted-foreground">
          analyzing code...
        </p>
      </div>
    </div>
  );
}
