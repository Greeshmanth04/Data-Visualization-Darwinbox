export enum UserRole {
  ADMIN = 'ADMIN',
  ANALYST = 'ANALYST',
  VIEWER = 'VIEWER'
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
  status: 'active' | 'pending' | 'rejected';
}

export interface ColumnDefinition {
  name: string;
  type: string;
  description?: string;
  displayName?: string;
}

export interface AccessPolicy {
  role: UserRole;
  canView: boolean;
  canEdit: boolean;
  restrictedColumns: string[]; // Columns hidden from this role
}

export interface Dataset {
  id: string;
  name: string;
  description: string;
  columns: ColumnDefinition[];
  data: any[]; // Array of rows
  accessPolicies?: AccessPolicy[];
  source?: string; // Legacy
  sourceType?: 'csv' | 'json' | 'xlsx' | 'mongodb' | 'mysql' | 'postgres';
  connectionConfig?: string;
  sourceMetadata?: any;
  isLive?: boolean;
}

export interface DatabaseForeignKey {
  column: string;
  referenceTable: string;
  referenceColumn: string;
}

export interface DatabaseColumn {
  name: string;
  type: string;
  isPrimaryKey: boolean;
}

export interface DatabaseTable {
  name: string;
  columns: DatabaseColumn[];
  foreignKeys: DatabaseForeignKey[];
}

export interface DatabaseConnection {
  id: string;
  name: string;
  type: 'mysql' | 'postgres' | 'mongodb';
  uri: string;
  tables: DatabaseTable[];
  createdAt?: string;
  updatedAt?: string;
}


export interface DashboardWidget {
  id: string;
  title: string;
  type: 'bar' | 'line' | 'pie' | 'metric' | 'table';
  datasetId: string;
  config: {
    xAxis?: string;
    dataKey?: string; // for metrics or single value charts
    series?: string[]; // for multi-line/bar
    color?: string;
  };
  w: number; // width col span (1-12)
  h: number; // height row span
}

export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  widgets: DashboardWidget[];
  ownerId: string;
  sharedWith?: {
    userId: string;
    accessLevel: 'view' | 'edit';
  }[];
}

export interface AIAnalysisResult {
  summary: string;
  trends: { title: string; description: string }[];
  anomalies: { title: string; description: string; severity: 'low' | 'medium' | 'high' }[];
  correlations: { factor1: string; factor2: string; description: string }[];
  recommendations: string[];
}

export type ViewState = 'dashboard' | 'sql' | 'catalog' | 'knowledge' | 'settings' | 'users' | 'schema';