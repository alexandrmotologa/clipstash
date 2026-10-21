export interface ClipItem {
  id: string;
  preview_text: string;
  masked_content: string;
  char_count: number;
  byte_count: number;
  line_count: number;
  is_pinned: boolean;
  is_secret: boolean;
  secret_types: string[];
  category_id: string;
  tags: string[];
  copy_count: number;
  created_at: number;
  last_copied_at: number;
  auto_purge_at: number | null;
}

export interface DatabaseStats {
  total_clips: number;
  secret_clips: number;
  pinned_clips: number;
  total_purged: number;
  db_size_bytes: number;
}

export type CategoryFilter =
  | "all"
  | "pinned"
  | "secrets"
  | "code"
  | "colors"
  | "links";

export interface TransformationAction {
  id: string;
  label: string;
  group:
    | "json"
    | "curl"
    | "encoding"
    | "colors"
    | "text"
    | "regex"
    | "security";
  shortcut?: string;
  description: string;
}
