import { PageHeader, Panel, RoadmapList } from "../../../components/admin/ui";

export default function PaymentsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description="Commission, transactions, and provider payouts — the money control room."
      />
      <Panel
        title="Revenue controls (M4/M5)"
        description="Stripe Connect + admin finance APIs land with payments milestone work."
      >
        <RoadmapList
          items={[
            "Set platform commission percentage",
            "Transaction ledger with filters",
            "Provider payout history and status",
            "Daily / weekly / monthly revenue reports",
          ]}
        />
      </Panel>
    </div>
  );
}
