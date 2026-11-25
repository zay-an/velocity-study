/**
 * Database types mirroring supabase/migrations/001_core_schema.sql.
 *
 * Hand-maintained until the project is linked to the Supabase CLI. Once it is,
 * regenerate with:
 *   npx supabase gen types typescript --linked > src/lib/supabase/database.types.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "student" | "researcher";
export type QuestionDifficulty = "easy" | "medium" | "hard";
export type ScoringMode =
  | "control"
  | "linear_speed"
  | "exponential_streak"
  | "variable_pressure";
export type SessionType =
  | "solo"
  | "multiplayer"
  | "experiment"
  | "retention_retest";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          role: UserRole;
          xp: number;
          level: number;
          selected_avatar: string;
          unlocked_avatars: Json;
          current_streak_days: number;
          participant_code: string | null;
          created_at: string;
        };
        // Rows are created by the handle_new_user() trigger only.
        Insert: never;
        // Only these columns are granted UPDATE to `authenticated`.
        Update: {
          display_name?: string;
          selected_avatar?: string;
        };
        Relationships: [];
      };
      decks: {
        Row: {
          id: string;
          owner_id: string | null;
          title: string;
          subject: string;
          description: string;
          is_public: boolean;
          is_benchmark: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          title: string;
          subject: string;
          description?: string;
          is_public?: boolean;
          is_benchmark?: boolean;
          created_at?: string;
        };
        Update: {
          title?: string;
          subject?: string;
          description?: string;
          is_public?: boolean;
          is_benchmark?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "decks_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      questions: {
        Row: {
          id: string;
          deck_id: string;
          prompt: string;
          options: Json;
          correct_index: number;
          difficulty: QuestionDifficulty;
          explanation: string;
          tags: string[];
          order_index: number;
        };
        Insert: {
          id?: string;
          deck_id: string;
          prompt: string;
          options: Json;
          correct_index: number;
          difficulty?: QuestionDifficulty;
          explanation?: string;
          tags?: string[];
          order_index: number;
        };
        Update: {
          prompt?: string;
          options?: Json;
          correct_index?: number;
          difficulty?: QuestionDifficulty;
          explanation?: string;
          tags?: string[];
          order_index?: number;
        };
        Relationships: [
          {
            foreignKeyName: "questions_deck_id_fkey";
            columns: ["deck_id"];
            isOneToOne: false;
            referencedRelation: "decks";
            referencedColumns: ["id"];
          },
        ];
      };
      experiments: {
        Row: {
          id: string;
          creator_id: string | null;
          title: string;
          deck_id: string;
          condition_order_matrix: Json;
          enable_confidence_probe: boolean;
          enable_retention_retest: boolean;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          creator_id: string;
          title: string;
          deck_id: string;
          condition_order_matrix: Json;
          enable_confidence_probe?: boolean;
          enable_retention_retest?: boolean;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          title?: string;
          deck_id?: string;
          condition_order_matrix?: Json;
          enable_confidence_probe?: boolean;
          enable_retention_retest?: boolean;
          is_active?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "experiments_creator_id_fkey";
            columns: ["creator_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "experiments_deck_id_fkey";
            columns: ["deck_id"];
            isOneToOne: false;
            referencedRelation: "decks";
            referencedColumns: ["id"];
          },
        ];
      };
      study_sessions: {
        Row: {
          id: string;
          user_id: string | null;
          participant_code: string | null;
          experiment_id: string | null;
          deck_id: string;
          scoring_mode: ScoringMode;
          session_type: SessionType;
          powerups_enabled: boolean;
          total_score: number;
          accuracy_pct: number | null;
          avg_rt_ms: number | null;
          inverse_efficiency_score: number | null;
          started_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          participant_code?: string | null;
          experiment_id?: string | null;
          deck_id: string;
          scoring_mode: ScoringMode;
          session_type: SessionType;
          powerups_enabled?: boolean;
          total_score?: number;
          started_at?: string;
        };
        // Only result columns are granted UPDATE to `authenticated`.
        Update: {
          total_score?: number;
          accuracy_pct?: number | null;
          avg_rt_ms?: number | null;
          inverse_efficiency_score?: number | null;
          completed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "study_sessions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "study_sessions_experiment_id_fkey";
            columns: ["experiment_id"];
            isOneToOne: false;
            referencedRelation: "experiments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "study_sessions_deck_id_fkey";
            columns: ["deck_id"];
            isOneToOne: false;
            referencedRelation: "decks";
            referencedColumns: ["id"];
          },
        ];
      };
      question_attempts: {
        Row: {
          id: string;
          session_id: string;
          question_id: string;
          applied_regime: ScoringMode;
          time_limit_ms: number | null;
          reaction_time_ms: number;
          first_hover_ms: number | null;
          option_hover_switches: number;
          selected_index: number | null;
          is_correct: boolean;
          timed_out: boolean;
          confidence_rating: number | null;
          powerup_used: string | null;
          points_awarded: number;
          streak_before: number;
          tab_switched: boolean;
          created_at: string;
        };
        // is_correct is computed by the grade_question_attempt() trigger.
        Insert: {
          id?: string;
          session_id: string;
          question_id: string;
          applied_regime: ScoringMode;
          time_limit_ms?: number | null;
          reaction_time_ms: number;
          first_hover_ms?: number | null;
          option_hover_switches?: number;
          selected_index?: number | null;
          timed_out?: boolean;
          confidence_rating?: number | null;
          powerup_used?: string | null;
          points_awarded?: number;
          streak_before?: number;
          tab_switched?: boolean;
        };
        // Append-only: no client updates.
        Update: never;
        Relationships: [
          {
            foreignKeyName: "question_attempts_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "study_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "question_attempts_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      is_researcher: { Args: Record<string, never>; Returns: boolean };
      current_participant_code: {
        Args: Record<string, never>;
        Returns: string | null;
      };
      can_read_deck: { Args: { p_deck_id: string }; Returns: boolean };
      can_write_deck: { Args: { p_deck_id: string }; Returns: boolean };
      owns_session: { Args: { p_session_id: string }; Returns: boolean };
      owns_open_session: { Args: { p_session_id: string }; Returns: boolean };
    };
    Enums: {
      user_role: UserRole;
      question_difficulty: QuestionDifficulty;
      scoring_mode: ScoringMode;
      session_type: SessionType;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
