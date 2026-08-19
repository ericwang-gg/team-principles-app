type AppBarProps = {
  myName: string;
  isFacilitator: boolean;
  participantCount: number;
  demoMode: boolean;
};

export function AppBar({ myName, isFacilitator, participantCount, demoMode }: AppBarProps) {
  return (
    <div className="app-bar no-print">
      <img src="/GetGo_horizontal_blue.svg" alt="GetGo" />
      <div className="app-bar-pills">
        {demoMode && <span className="pill pill--demo">DEMO</span>}
        <span className="pill pill--outline">
          {myName}
          {isFacilitator ? " · Facilitator" : ""}
        </span>
        <span className="pill pill--blue">{participantCount} joined</span>
      </div>
    </div>
  );
}
