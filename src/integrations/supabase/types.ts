export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          archived: boolean
          color: string
          created_at: string
          id: string
          institution: string | null
          name: string
          opening_balance_cents: number
          opening_date: string
          type: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          color?: string
          created_at?: string
          id?: string
          institution?: string | null
          name: string
          opening_balance_cents?: number
          opening_date: string
          type: string
          user_id?: string
        }
        Update: {
          archived?: boolean
          color?: string
          created_at?: string
          id?: string
          institution?: string | null
          name?: string
          opening_balance_cents?: number
          opening_date?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      budgets: {
        Row: {
          category_id: string
          id: string
          limit_cents: number
          month: string
          user_id: string
        }
        Insert: {
          category_id: string
          id?: string
          limit_cents: number
          month: string
          user_id?: string
        }
        Update: {
          category_id?: string
          id?: string
          limit_cents?: number
          month?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_user_id_fkey"
            columns: ["category_id", "user_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      card_purchases: {
        Row: {
          card_id: string
          category_id: string
          client_key: string | null
          created_at: string
          description: string
          id: string
          installments: number
          kind: string
          notes: string | null
          purchase_date: string
          refund_of: string | null
          total_cents: number
          user_id: string
        }
        Insert: {
          card_id: string
          category_id: string
          client_key?: string | null
          created_at?: string
          description: string
          id?: string
          installments: number
          kind?: string
          notes?: string | null
          purchase_date: string
          refund_of?: string | null
          total_cents: number
          user_id?: string
        }
        Update: {
          card_id?: string
          category_id?: string
          client_key?: string | null
          created_at?: string
          description?: string
          id?: string
          installments?: number
          kind?: string
          notes?: string | null
          purchase_date?: string
          refund_of?: string | null
          total_cents?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_purchases_card_id_user_id_fkey"
            columns: ["card_id", "user_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "card_purchases_category_id_user_id_fkey"
            columns: ["category_id", "user_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "card_purchases_refund_of_fkey"
            columns: ["refund_of"]
            isOneToOne: false
            referencedRelation: "card_purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      cards: {
        Row: {
          archived: boolean
          closing_day: number
          color: string
          created_at: string
          due_day: number
          id: string
          limit_cents: number
          name: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          closing_day: number
          color?: string
          created_at?: string
          due_day: number
          id?: string
          limit_cents: number
          name: string
          user_id?: string
        }
        Update: {
          archived?: boolean
          closing_day?: number
          color?: string
          created_at?: string
          due_day?: number
          id?: string
          limit_cents?: number
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          archived: boolean
          color: string
          created_at: string
          icon: string
          id: string
          kind: string
          name: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          color?: string
          created_at?: string
          icon?: string
          id?: string
          kind: string
          name: string
          user_id?: string
        }
        Update: {
          archived?: boolean
          color?: string
          created_at?: string
          icon?: string
          id?: string
          kind?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      goal_entries: {
        Row: {
          amount_cents: number
          client_key: string | null
          created_at: string
          entry_date: string
          goal_id: string
          id: string
          kind: string
          note: string | null
          user_id: string
        }
        Insert: {
          amount_cents: number
          client_key?: string | null
          created_at?: string
          entry_date: string
          goal_id: string
          id?: string
          kind: string
          note?: string | null
          user_id?: string
        }
        Update: {
          amount_cents?: number
          client_key?: string | null
          created_at?: string
          entry_date?: string
          goal_id?: string
          id?: string
          kind?: string
          note?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_entries_goal_id_user_id_fkey"
            columns: ["goal_id", "user_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      goals: {
        Row: {
          created_at: string
          deadline: string | null
          description: string | null
          id: string
          name: string
          target_cents: number
          user_id: string
        }
        Insert: {
          created_at?: string
          deadline?: string | null
          description?: string | null
          id?: string
          name: string
          target_cents: number
          user_id?: string
        }
        Update: {
          created_at?: string
          deadline?: string | null
          description?: string | null
          id?: string
          name?: string
          target_cents?: number
          user_id?: string
        }
        Relationships: []
      }
      installments: {
        Row: {
          amount_cents: number
          id: string
          invoice_id: string
          number: number
          purchase_id: string
          total_count: number
          user_id: string
        }
        Insert: {
          amount_cents: number
          id?: string
          invoice_id: string
          number: number
          purchase_id: string
          total_count: number
          user_id?: string
        }
        Update: {
          amount_cents?: number
          id?: string
          invoice_id?: string
          number?: number
          purchase_id?: string
          total_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "installments_invoice_id_user_id_fkey"
            columns: ["invoice_id", "user_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "installments_purchase_id_user_id_fkey"
            columns: ["purchase_id", "user_id"]
            isOneToOne: false
            referencedRelation: "card_purchases"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      invoice_payments: {
        Row: {
          account_id: string
          amount_cents: number
          client_key: string | null
          created_at: string
          id: string
          invoice_id: string
          paid_date: string
          user_id: string
        }
        Insert: {
          account_id: string
          amount_cents: number
          client_key?: string | null
          created_at?: string
          id?: string
          invoice_id: string
          paid_date: string
          user_id?: string
        }
        Update: {
          account_id?: string
          amount_cents?: number
          client_key?: string | null
          created_at?: string
          id?: string
          invoice_id?: string
          paid_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payments_account_id_user_id_fkey"
            columns: ["account_id", "user_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id", "user_id"]
          },
          {
            foreignKeyName: "invoice_payments_account_id_user_id_fkey"
            columns: ["account_id", "user_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "invoice_payments_invoice_id_user_id_fkey"
            columns: ["invoice_id", "user_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      invoices: {
        Row: {
          card_id: string
          closing_date: string
          closing_month: string
          created_at: string
          due_date: string
          id: string
          user_id: string
        }
        Insert: {
          card_id: string
          closing_date: string
          closing_month: string
          created_at?: string
          due_date: string
          id?: string
          user_id?: string
        }
        Update: {
          card_id?: string
          closing_date?: string
          closing_month?: string
          created_at?: string
          due_date?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_card_id_user_id_fkey"
            columns: ["card_id", "user_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          onboarded: boolean
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          onboarded?: boolean
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          onboarded?: boolean
        }
        Relationships: []
      }
      recurrences: {
        Row: {
          account_id: string | null
          active: boolean
          amount_cents: number
          category_id: string | null
          created_at: string
          day_of_month: number
          description: string
          end_date: string | null
          id: string
          kind: string
          notes: string | null
          payment_method: string
          start_date: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          active?: boolean
          amount_cents: number
          category_id?: string | null
          created_at?: string
          day_of_month: number
          description: string
          end_date?: string | null
          id?: string
          kind: string
          notes?: string | null
          payment_method?: string
          start_date: string
          user_id?: string
        }
        Update: {
          account_id?: string | null
          active?: boolean
          amount_cents?: number
          category_id?: string | null
          created_at?: string
          day_of_month?: number
          description?: string
          end_date?: string | null
          id?: string
          kind?: string
          notes?: string | null
          payment_method?: string
          start_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurrences_account_id_user_id_fkey"
            columns: ["account_id", "user_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id", "user_id"]
          },
          {
            foreignKeyName: "recurrences_account_id_user_id_fkey"
            columns: ["account_id", "user_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "recurrences_category_id_user_id_fkey"
            columns: ["category_id", "user_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string
          amount_cents: number
          category_id: string
          client_key: string | null
          competence_date: string
          created_at: string
          description: string
          due_date: string
          id: string
          kind: string
          notes: string | null
          paid_date: string | null
          payment_method: string
          recurrence_id: string | null
          recurrence_seq: number | null
          status: string
          user_id: string
        }
        Insert: {
          account_id: string
          amount_cents: number
          category_id: string
          client_key?: string | null
          competence_date: string
          created_at?: string
          description: string
          due_date: string
          id?: string
          kind: string
          notes?: string | null
          paid_date?: string | null
          payment_method?: string
          recurrence_id?: string | null
          recurrence_seq?: number | null
          status?: string
          user_id?: string
        }
        Update: {
          account_id?: string
          amount_cents?: number
          category_id?: string
          client_key?: string | null
          competence_date?: string
          created_at?: string
          description?: string
          due_date?: string
          id?: string
          kind?: string
          notes?: string | null
          paid_date?: string | null
          payment_method?: string
          recurrence_id?: string | null
          recurrence_seq?: number | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_user_id_fkey"
            columns: ["account_id", "user_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id", "user_id"]
          },
          {
            foreignKeyName: "transactions_account_id_user_id_fkey"
            columns: ["account_id", "user_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "transactions_category_id_user_id_fkey"
            columns: ["category_id", "user_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "transactions_recurrence_id_user_id_fkey"
            columns: ["recurrence_id", "user_id"]
            isOneToOne: false
            referencedRelation: "recurrences"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      transfers: {
        Row: {
          amount_cents: number
          client_key: string | null
          created_at: string
          description: string | null
          from_account_id: string
          id: string
          to_account_id: string
          transfer_date: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          client_key?: string | null
          created_at?: string
          description?: string | null
          from_account_id: string
          id?: string
          to_account_id: string
          transfer_date: string
          user_id?: string
        }
        Update: {
          amount_cents?: number
          client_key?: string | null
          created_at?: string
          description?: string | null
          from_account_id?: string
          id?: string
          to_account_id?: string
          transfer_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfers_from_account_id_user_id_fkey"
            columns: ["from_account_id", "user_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id", "user_id"]
          },
          {
            foreignKeyName: "transfers_from_account_id_user_id_fkey"
            columns: ["from_account_id", "user_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "transfers_to_account_id_user_id_fkey"
            columns: ["to_account_id", "user_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id", "user_id"]
          },
          {
            foreignKeyName: "transfers_to_account_id_user_id_fkey"
            columns: ["to_account_id", "user_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
    }
    Views: {
      account_balances: {
        Row: {
          account_id: string | null
          balance_cents: number | null
          user_id: string | null
        }
        Insert: {
          account_id?: string | null
          balance_cents?: never
          user_id?: string | null
        }
        Update: {
          account_id?: string | null
          balance_cents?: never
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      clamp_day: { Args: { p_day: number; p_month: string }; Returns: string }
      create_card_purchase: {
        Args: {
          p_card: string
          p_category: string
          p_client_key: string
          p_description: string
          p_first_closing_month: string
          p_installments: number
          p_notes: string
          p_purchase_date: string
          p_total_cents: number
        }
        Returns: string
      }
      delete_card_purchase: { Args: { p_purchase: string }; Returns: undefined }
      ensure_invoice: {
        Args: { p_card: string; p_closing_month: string }
        Returns: string
      }
      invoice_dates: {
        Args: {
          p_closing_day: number
          p_closing_month: string
          p_due_day: number
        }
        Returns: Record<string, unknown>
      }
      pay_invoice: {
        Args: {
          p_account: string
          p_amount_cents: number
          p_client_key: string
          p_date: string
          p_invoice: string
        }
        Returns: string
      }
      refund_card_purchase: {
        Args: {
          p_amount_cents: number
          p_client_key: string
          p_closing_month: string
          p_date: string
          p_purchase: string
        }
        Returns: string
      }
      today_br: { Args: never; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
