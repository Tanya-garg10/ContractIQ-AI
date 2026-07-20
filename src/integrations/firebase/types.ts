export interface FirebaseUser {
  id: string;
  email: string | null;
  displayName: string | null;
}

export interface Contract {
  id: string;
  filename: string;
  storage_path: string;
  mime: string;
  size: number;
  created_at: Date;
  updated_at: Date;
  user_id: string;
  status: "pending" | "analyzing" | "completed" | "failed";
  confidence?: number;
  parties?: string[];
  summary?: string;
  risk_counts: {
    high: number;
    medium: number;
    low: number;
  };
}

export interface AnalysisRun {
  id: string;
  contract_id: string;
  status: "pending" | "running" | "completed" | "failed";
  agent_states: Record<string, string>;
  error?: string;
  created_at: Date;
  updated_at: Date;
}

export interface ChatMessage {
  id: string;
  contract_id: string;
  role: "user" | "assistant";
  content: string;
  sources?: string[];
  created_at: Date;
}
