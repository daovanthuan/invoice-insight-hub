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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      invoice_items: {
        Row: {
          amount: number | null
          created_at: string
          description: string | null
          id: string
          invoice_id: string
          item_code: string | null
          quantity: number | null
          sort_order: number | null
          tax_amount: number | null
          tax_rate: number | null
          unit: string | null
          unit_price: number | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          description?: string | null
          id?: string
          invoice_id: string
          item_code?: string | null
          quantity?: number | null
          sort_order?: number | null
          tax_amount?: number | null
          tax_rate?: number | null
          unit?: string | null
          unit_price?: number | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          description?: string | null
          id?: string
          invoice_id?: string
          item_code?: string | null
          quantity?: number | null
          sort_order?: number | null
          tax_amount?: number | null
          tax_rate?: number | null
          unit?: string | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "fact_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_in_words: string | null
          buyer_account_no: string | null
          buyer_address: string | null
          buyer_name: string | null
          buyer_tax_id: string | null
          confidence_score: number | null
          created_at: string
          created_by: string | null
          currency: string | null
          exchange_rate: number | null
          extend: Json | null
          id: string
          invoice_date: string | null
          invoice_number: string | null
          invoice_serial: string | null
          invoice_type: string | null
          lookup_code: string | null
          lookup_url: string | null
          original_file_path: string | null
          owner_id: string | null
          payment_method: string | null
          raw_json: Json | null
          source_zip_name: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number | null
          tax_amount: number | null
          tax_authority_code: string | null
          tax_rate: number | null
          total_amount: number | null
          updated_at: string
          updated_by: string | null
          vendor_account_no: string | null
          vendor_address: string | null
          vendor_fax: string | null
          vendor_name: string | null
          vendor_phone: string | null
          vendor_tax_id: string | null
        }
        Insert: {
          amount_in_words?: string | null
          buyer_account_no?: string | null
          buyer_address?: string | null
          buyer_name?: string | null
          buyer_tax_id?: string | null
          confidence_score?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          exchange_rate?: number | null
          extend?: Json | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          invoice_serial?: string | null
          invoice_type?: string | null
          lookup_code?: string | null
          lookup_url?: string | null
          original_file_path?: string | null
          owner_id?: string | null
          payment_method?: string | null
          raw_json?: Json | null
          source_zip_name?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number | null
          tax_amount?: number | null
          tax_authority_code?: string | null
          tax_rate?: number | null
          total_amount?: number | null
          updated_at?: string
          updated_by?: string | null
          vendor_account_no?: string | null
          vendor_address?: string | null
          vendor_fax?: string | null
          vendor_name?: string | null
          vendor_phone?: string | null
          vendor_tax_id?: string | null
        }
        Update: {
          amount_in_words?: string | null
          buyer_account_no?: string | null
          buyer_address?: string | null
          buyer_name?: string | null
          buyer_tax_id?: string | null
          confidence_score?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          exchange_rate?: number | null
          extend?: Json | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          invoice_serial?: string | null
          invoice_type?: string | null
          lookup_code?: string | null
          lookup_url?: string | null
          original_file_path?: string | null
          owner_id?: string | null
          payment_method?: string | null
          raw_json?: Json | null
          source_zip_name?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number | null
          tax_amount?: number | null
          tax_authority_code?: string | null
          tax_rate?: number | null
          total_amount?: number | null
          updated_at?: string
          updated_by?: string | null
          vendor_account_no?: string | null
          vendor_address?: string | null
          vendor_fax?: string | null
          vendor_name?: string | null
          vendor_phone?: string | null
          vendor_tax_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string
          metadata: Json | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message: string
          metadata?: Json | null
          title: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          metadata?: Json | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          created_at: string
          date_of_birth: string | null
          email: string | null
          full_name: string | null
          gender: Database["public"]["Enums"]["gender_type"] | null
          id: string
          phone: string | null
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
          updated_by: string | null
          user_code: string | null
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          full_name?: string | null
          gender?: Database["public"]["Enums"]["gender_type"] | null
          id: string
          phone?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
          updated_by?: string | null
          user_code?: string | null
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          full_name?: string | null
          gender?: Database["public"]["Enums"]["gender_type"] | null
          id?: string
          phone?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
          updated_by?: string | null
          user_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_system: boolean
          name: string
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_system?: boolean
          name: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roles_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          created_at: string
          date_format: string
          default_currency: string
          email_notifications: boolean
          error_alerts: boolean
          id: string
          language: string
          theme: string
          timezone: string
          updated_at: string
          user_id: string
          weekly_reports: boolean
        }
        Insert: {
          created_at?: string
          date_format?: string
          default_currency?: string
          email_notifications?: boolean
          error_alerts?: boolean
          id?: string
          language?: string
          theme?: string
          timezone?: string
          updated_at?: string
          user_id: string
          weekly_reports?: boolean
        }
        Update: {
          created_at?: string
          date_format?: string
          default_currency?: string
          email_notifications?: boolean
          error_alerts?: boolean
          id?: string
          language?: string
          theme?: string
          timezone?: string
          updated_at?: string
          user_id?: string
          weekly_reports?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      analytics_vendor_comparison: {
        Row: {
          avg_confidence: number | null
          avg_invoice_value: number | null
          currency_count: number | null
          max_invoice: number | null
          min_invoice: number | null
          success_rate: number | null
          total_invoices: number | null
          total_revenue: number | null
          vendor_name: string | null
          vendor_rating: string | null
          vendor_scale: string | null
        }
        Relationships: []
      }
      analytics_vendor_monthly: {
        Row: {
          avg_amount: number | null
          invoice_count: number | null
          month: number | null
          pending_count: number | null
          period: string | null
          processed_count: number | null
          rejected_count: number | null
          success_rate: number | null
          total_revenue: number | null
          total_tax: number | null
          vendor_name: string | null
          year: number | null
        }
        Relationships: []
      }
      dim_buyer: {
        Row: {
          buyer_address: string | null
          buyer_name: string | null
          buyer_tax_id: string | null
        }
        Relationships: []
      }
      dim_time: {
        Row: {
          date_value: string | null
          day_of_month: number | null
          day_of_week: number | null
          month: number | null
          month_name: string | null
          quarter: number | null
          quarter_name: string | null
          year: number | null
        }
        Relationships: []
      }
      dim_vendor: {
        Row: {
          vendor_address: string | null
          vendor_name: string | null
          vendor_phone: string | null
          vendor_tax_id: string | null
        }
        Relationships: []
      }
      fact_invoices: {
        Row: {
          buyer_name: string | null
          buyer_tax_id: string | null
          confidence_score: number | null
          created_at: string | null
          currency: string | null
          exchange_rate: number | null
          id: string | null
          invoice_date: string | null
          is_approved: number | null
          is_pending: number | null
          is_processed: number | null
          is_rejected: number | null
          item_count: number | null
          month: number | null
          owner_id: string | null
          payment_method: string | null
          quarter: number | null
          status: Database["public"]["Enums"]["invoice_status"] | null
          subtotal: number | null
          tax_amount: number | null
          tax_rate: number | null
          total_amount: number | null
          vendor_name: string | null
          vendor_tax_id: string | null
          year: number | null
        }
        Insert: {
          buyer_name?: string | null
          buyer_tax_id?: string | null
          confidence_score?: number | null
          created_at?: string | null
          currency?: string | null
          exchange_rate?: number | null
          id?: string | null
          invoice_date?: string | null
          is_approved?: never
          is_pending?: never
          is_processed?: never
          is_rejected?: never
          item_count?: never
          month?: never
          owner_id?: string | null
          payment_method?: string | null
          quarter?: never
          status?: Database["public"]["Enums"]["invoice_status"] | null
          subtotal?: number | null
          tax_amount?: number | null
          tax_rate?: number | null
          total_amount?: number | null
          vendor_name?: string | null
          vendor_tax_id?: string | null
          year?: never
        }
        Update: {
          buyer_name?: string | null
          buyer_tax_id?: string | null
          confidence_score?: number | null
          created_at?: string | null
          currency?: string | null
          exchange_rate?: number | null
          id?: string | null
          invoice_date?: string | null
          is_approved?: never
          is_pending?: never
          is_processed?: never
          is_rejected?: never
          item_count?: never
          month?: never
          owner_id?: string | null
          payment_method?: string | null
          quarter?: never
          status?: Database["public"]["Enums"]["invoice_status"] | null
          subtotal?: number | null
          tax_amount?: number | null
          tax_rate?: number | null
          total_amount?: number | null
          vendor_name?: string | null
          vendor_tax_id?: string | null
          year?: never
        }
        Relationships: [
          {
            foreignKeyName: "invoices_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      get_user_roles: {
        Args: { _user_id: string }
        Returns: {
          role_id: string
          role_name: string
        }[]
      }
      has_permission: {
        Args: { _action: string; _resource: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: { _role_name: string; _user_id: string }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      entity_status: "active" | "inactive" | "deleted"
      file_status: "pending" | "processing" | "completed" | "error"
      gender_type: "male" | "female" | "other"
      invoice_status:
        | "draft"
        | "pending"
        | "approved"
        | "rejected"
        | "processed"
        | "cancelled"
      notification_type: "info" | "warning" | "error" | "success"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      entity_status: ["active", "inactive", "deleted"],
      file_status: ["pending", "processing", "completed", "error"],
      gender_type: ["male", "female", "other"],
      invoice_status: [
        "draft",
        "pending",
        "approved",
        "rejected",
        "processed",
        "cancelled",
      ],
      notification_type: ["info", "warning", "error", "success"],
    },
  },
} as const
