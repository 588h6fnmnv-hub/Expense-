"use client";

import WorkerLedger from "@/components/workers/WorkerLedger";
import type {
  DailyWorkReport,
  PersonAccount,
  PersonAccountEntry,
  ProjectSite,
  SaaSRole,
  Transaction,
} from "@/lib/types";

type WorkersTabProps = {
  workers: PersonAccount[];
  projects: ProjectSite[];
  transactions: Transaction[];
  dailyReports: DailyWorkReport[];
  companyName: string;
  accessRole: Extract<SaaSRole, "owner" | "admin" | "supervisor" | "worker">;
  canManageWorkers: boolean;
  canManageLedger: boolean;
  canReviewReports: boolean;
  onCreateWorker: (
    worker: Omit<PersonAccount, "id" | "entries"> & {
      entries?: PersonAccountEntry[];
    }
  ) => void;
  onUpdateWorker: (workerId: string, patch: Partial<PersonAccount>) => void;
  onCreateDailyReport: (report: Omit<DailyWorkReport, "id">) => void;
  onUpdateDailyReport: (
    reportId: string,
    patch: Partial<DailyWorkReport>
  ) => void;
  onAddEntry: (workerId: string, entry: Omit<PersonAccountEntry, "id">) => void;
  onDeleteEntry: (workerId: string, entryId: string) => void;
};

export default function WorkersTab(props: WorkersTabProps) {
  return <WorkerLedger {...props} />;
}
