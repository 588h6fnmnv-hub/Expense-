export type Section = "Personal" | "Business" | "Account";
export type TransactionType = "Income" | "Expense" | "Pay In" | "Pay Out";
export type PaymentMethod = "UPI" | "Cash" | "Card";
export type PlanType = "Starter" | "Pro" | "Business";
export type WorkspaceRole = "owner" | "admin" | "supervisor" | "worker";
export type LegacyWorkspaceRole = "manager" | "accountant" | "viewer";
export type SaaSRole = WorkspaceRole | LegacyWorkspaceRole;
export type EmployeeRole = Extract<WorkspaceRole, "supervisor" | "worker">;
export type WorkerSubRole =
  | "Supervisor"
  | "Electrician"
  | "Plumber"
  | "Mason"
  | "Carpenter"
  | "Painter"
  | "Helper"
  | "Tile Worker"
  | "Driver"
  | "Welder"
  | "Site Engineer"
  | "Other";
export type WorkerStatus = "Active" | "Inactive";
export type DailyReportStatus = "Draft" | "Submitted" | "Reviewed";
export type MaterialCategory =
  | "Cement"
  | "Steel"
  | "Sand"
  | "Aggregate"
  | "Bricks/Blocks"
  | "Electrical"
  | "Plumbing"
  | "Paint"
  | "Tiles"
  | "Wood"
  | "Hardware"
  | "Tools"
  | "Safety Items"
  | "Other";
export type ExpenseAnalyticsCategory =
  | "Petrol"
  | "Materials"
  | "Worker Salary"
  | "Bills"
  | "Transport"
  | "Food"
  | "Tools"
  | "Rent"
  | "Electricity"
  | "Other";

export type Transaction = {
  id: string;
  companyId?: string;
  sourceId?: string;
  title: string;
  amount: number;
  type: TransactionType;
  method: PaymentMethod;
  section: Section;
  selectedCard?: string;
  category?: string;
  person?: string;
  fromAccount?: string;
  toAccount?: string;
  projectId?: string;
  date: string;
  time?: string;
};

export type CardItem = {
  id: string;
  name: string;
  number?: string;
  expiry?: string;
  cardType?: "Debit" | "Credit";
  repaymentDay?: number;
  upiId?: string;
};

export type PersonAccountEntry = {
  id: string;
  amount: number;
  direction: "Debit" | "Credit";
  method: PaymentMethod;
  narration: string;
  date: string;
  projectId?: string;
};

export type PersonAccount = {
  id: string;
  companyId?: string;
  name: string;
  phone?: string;
  amount: number;
  direction: "Receivable" | "Payable";
  note?: string;
  date: string;
  entries?: PersonAccountEntry[];
  role?: "worker";
  invitedBy?: string;
  assignedSupervisor?: string;
  workerSubRole?: WorkerSubRole;
  projectId?: string;
  dailyWage?: number;
  monthlyWage?: number;
  status?: WorkerStatus;
  referralCode?: string;
};

export type ProjectExtraWork = {
  id: string;
  title: string;
  amount: number;
  date: string;
};

export type ProjectSite = {
  id: string;
  companyId?: string;
  name: string;
  budget: number;
  customer?: string;
  status: "Active" | "Paused" | "Completed";
  note?: string;
  date: string;
  extras?: ProjectExtraWork[];
};


export type CompanyProfile = {
  id: string;
  name: string;
  ownerEmail: string;
  plan: PlanType;
  role?: "Owner" | "Admin" | "Supervisor" | "Worker" | "Manager" | "Accountant" | "Viewer";
};

export type MaterialItem = {
  id: string;
  companyId?: string;
  projectId?: string;
  category?: MaterialCategory;
  name: string;
  quantity: number;
  usedQuantity?: number;
  lowStockAt?: number;
  unit: string;
  rate: number;
  supplier?: string;
  date: string;
  note?: string;
};

export type DailyWorkReport = {
  id: string;
  companyId?: string;
  date: string;
  projectId?: string;
  workerId?: string;
  workerName: string;
  workerRole: WorkerSubRole;
  workDescription: string;
  materialsUsed?: string;
  hoursWorked?: number;
  paymentAdvance?: number;
  issues?: string;
  nextWorkPlan?: string;
  photosNote?: string;
  status: DailyReportStatus;
  createdBy?: string;
  reviewedBy?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type ReminderItem = {
  id: string;
  companyId?: string;
  title: string;
  dueDate: string;
  projectId?: string;
  amount?: number;
  note?: string;
  done: boolean;
  type?: "payment" | "worker_payment" | "material_reorder" | "bill_due" | "general";
  targetId?: string;
  notifyAt?: string;
  notificationReady?: boolean;
};

export type ThemeMode = "light" | "dark";

export type ActivityLogItem = {
  id: string;
  timestamp: string;
  action:
    | "worker:create"
    | "worker:update"
    | "site:create"
    | "site:update"
    | "site:delete"
    | "material:create"
    | "material:update"
    | "material:delete"
    | "transaction:create"
    | "transaction:delete"
    | "report:create"
    | "reminder:create"
    | "reminder:update"
    | "reminder:delete"
    | "backup:import";
  entityType: "worker" | "site" | "material" | "transaction" | "report" | "reminder" | "backup";
  entityId?: string;
  summary: string;
  changedBy?: string;
};

export type AccountBalances = {
  cash: number;
  upi: number;
  upis: Record<string, number>;
  cards: Record<string, number>;
};

export type WalletData = {
  profileName: string;
  transactions: Transaction[];
  cards: CardItem[];
  upiAccounts: CardItem[];
  personAccounts: PersonAccount[];
  projects: ProjectSite[];
  company: CompanyProfile | null;
  materials: MaterialItem[];
  reminders: ReminderItem[];
  dailyReports: DailyWorkReport[];
  accountBalances: AccountBalances;
  personalBalance: number;
  businessBalance: number;
  theme: ThemeMode;
  deletedSourceIds: string[];
  employeeInvites: EmployeeInvite[];
  activityLog: ActivityLogItem[];
};

export type EmployeeInviteStatus = "active" | "disabled";

export type EmployeeInvite = {
  id: string;
  companyId: string;
  ownerUser: string;
  code: string;
  role: EmployeeRole;
  displayName: string;
  phone?: string;
  workerSubRole?: WorkerSubRole;
  workerId?: string;
  assignedSupervisor?: string;
  dailyWage?: number;
  monthlyWage?: number;
  workerStatus?: WorkerStatus;
  assignedProjectIds: string[];
  assignedWorkerIds: string[];
  status: EmployeeInviteStatus;
  createdAt: string;
};

export type EmployeeSession = EmployeeInvite & {
  loginAt: string;
};

/**
 * Production SaaS types (scoped under companies/{companyId})
 * Priority phase: company collections + members/roles + auditLogs.
 */

export type Company = {
  id: string;
  name: string;
  ownerEmail: string;
  plan: PlanType;
  createdAt?: unknown;
};

export type MemberStatus = "active" | "invited" | "disabled";

export type Member = {
  id: string; // memberId == encodeURIComponent(userEmailLower)
  companyId: string;
  email: string;
  role: SaaSRole;
  displayName?: string;
  invitedBy?: string;
  assignedSupervisor?: string;
  workerSubRole?: WorkerSubRole;
  referralCode?: string;
  inviteLink?: string;
  status: MemberStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type Worker = {
  id: string;
  companyId?: string;
  name: string;
  phone?: string;
  role?: "worker";
  workerSubRole?: WorkerSubRole;
  invitedBy?: string;
  assignedSupervisor?: string;
  referralCode?: string;
  projectId?: string;
  dailyWage?: number;
  monthlyWage?: number;
  status?: WorkerStatus;
  amount?: number;
  direction?: "Receivable" | "Payable";
  date?: string;
  note?: string;
  entries?: PersonAccountEntry[];
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type Material = {
  id: string;
  companyId?: string;
  projectId?: string;
  category?: MaterialCategory;
  name: string;
  quantity: number;
  usedQuantity?: number;
  lowStockAt?: number;
  unit: string;
  rate: number;
  supplier?: string;
  date: string;
  note?: string;
};

export type DailyReport = DailyWorkReport & {
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type Bill = {
  id: string;
  companyId?: string;
  projectId?: string;
  title: string;
  amount: number;
  supplier?: string;
  billDate?: string;
  note?: string;
  uploadedAt?: unknown;
};

export type Reminder = {
  id: string;
  companyId?: string;
  title: string;
  dueDate: string;
  projectId?: string;
  amount?: number;
  note?: string;
  done: boolean;
  type?: "payment" | "worker_payment" | "material_reorder" | "bill_due" | "general";
  targetId?: string;
  notifyAt?: string;
  notificationReady?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type Site = {
  id: string;
  companyId?: string;
  name: string;
  budget: number;
  customer?: string;
  status: "Active" | "Paused" | "Completed";
  note?: string;
  date?: string;
};

export type Payroll = {
  id: string;
  companyId?: string;
  workerId: string;
  periodStart: string;
  periodEnd: string;
  amount: number;
  paidAt?: string;
  note?: string;
  createdAt?: unknown;
};

export type AccountType =
  | "Asset"
  | "Liability"
  | "Equity"
  | "Income"
  | "Expense";

export type Account = {
  id: string;
  companyId: string;
  name: string;
  type: AccountType;
  parentAccount?: string;
  code?: string;
  isGroup: boolean;
  balance: number;
  createdAt?: unknown;
};

export type JournalEntryLine = {
  accountId: string;
  accountName: string;
  debit: number;
  credit: number;
  note?: string;
};

export type JournalEntry = {
  id: string;
  companyId: string;
  date: string;
  reference?: string;
  notes?: string;
  lines: JournalEntryLine[];
  sourceType?: string;
  sourceId?: string;
  createdBy: string;
  createdAt?: unknown;
};

export type LedgerEntry = {
  id: string;
  companyId: string;
  accountId: string;
  date: string;
  journalEntryId: string;
  debit: number;
  credit: number;
  balance: number;
  note?: string;
  siteId?: string;
  createdAt?: unknown;
};

export type Customer = {
  id: string;
  companyId: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  gstin?: string;
  balance: number;
  createdAt?: unknown;
};

export type Supplier = {
  id: string;
  companyId: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  gstin?: string;
  balance: number;
  createdAt?: unknown;
};

export type InvoiceStatus = "Draft" | "Sent" | "Paid" | "Overdue" | "Cancelled";

export type InvoiceItem = {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  taxRate?: number;
  taxAmount?: number;
};

export type Invoice = {
  id: string;
  companyId: string;
  customerId: string;
  customerName: string;
  date: string;
  dueDate: string;
  items: InvoiceItem[];
  subtotal: number;
  taxTotal: number;
  total: number;
  status: InvoiceStatus;
  siteId?: string;
  note?: string;
  createdAt?: unknown;
};

export type SupplierBillStatus = "Pending" | "Paid" | "Cancelled";

export type SupplierBill = {
  id: string;
  companyId: string;
  supplierId: string;
  supplierName: string;
  date: string;
  dueDate: string;
  reference?: string;
  items: InvoiceItem[];
  total: number;
  status: SupplierBillStatus;
  siteId?: string;
  note?: string;
  createdAt?: unknown;
};

export type PurchaseOrderStatus = "Draft" | "Ordered" | "Received" | "Cancelled";

export type PurchaseOrder = {
  id: string;
  companyId: string;
  supplierId: string;
  date: string;
  items: InvoiceItem[];
  total: number;
  status: PurchaseOrderStatus;
  siteId?: string;
  note?: string;
  createdAt?: unknown;
};

export type AttendanceStatus = "Present" | "Absent" | "Half Day" | "Leave";

export type Attendance = {
  id: string;
  companyId: string;
  workerId: string;
  workerName: string;
  date: string;
  status: AttendanceStatus;
  siteId?: string;
  note?: string;
  createdAt?: unknown;
};

export type PayrollRun = {
  id: string;
  companyId: string;
  workerId: string;
  periodStart: string;
  periodEnd: string;
  basicWage: number;
  allowances: number;
  deductions: number;
  netPay: number;
  status: "Draft" | "Approved" | "Paid";
  createdAt?: unknown;
};
