type FacilitatorFooterProps = {
  countLabel?: string;
  actionLabel: string;
  onAction: () => void;
  disabled?: boolean;
};

export function FacilitatorFooter({ countLabel, actionLabel, onAction, disabled }: FacilitatorFooterProps) {
  return (
    <div className="facilitator-footer no-print">
      {countLabel && <span className="facilitator-footer-count">{countLabel}</span>}
      <button className="btn btn--primary" onClick={onAction} disabled={disabled}>
        {actionLabel}
      </button>
    </div>
  );
}
