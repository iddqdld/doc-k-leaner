export enum Severity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export enum AuditType {
  DOCKERFILE = 'DOCKERFILE',
  TERRAFORM = 'TERRAFORM',
  KUBERNETES = 'KUBERNETES'
}

export interface Vulnerability {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  mitigation: string;
  line?: number;
}

export interface AuditResult {
  id: string;
  timestamp: string;
  targetName: string;
  type: AuditType;
  vulnerabilities: Vulnerability[];
  score: number; // 0-100
  aiSummary?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
}
