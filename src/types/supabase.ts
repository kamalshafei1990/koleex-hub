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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      access_presets: {
        Row: {
          can_access_finance: boolean
          can_access_hr: boolean
          can_access_marketing: boolean
          can_access_products: boolean
          can_create_quotations: boolean
          can_manage_accounts: boolean
          can_manage_products: boolean
          can_place_orders: boolean
          can_view_pricing: boolean
          created_at: string
          description: string | null
          id: string
          preset_name: string
          role_id: string
          scope_notes: string | null
        }
        Insert: {
          can_access_finance?: boolean
          can_access_hr?: boolean
          can_access_marketing?: boolean
          can_access_products?: boolean
          can_create_quotations?: boolean
          can_manage_accounts?: boolean
          can_manage_products?: boolean
          can_place_orders?: boolean
          can_view_pricing?: boolean
          created_at?: string
          description?: string | null
          id?: string
          preset_name: string
          role_id: string
          scope_notes?: string | null
        }
        Update: {
          can_access_finance?: boolean
          can_access_hr?: boolean
          can_access_marketing?: boolean
          can_access_products?: boolean
          can_create_quotations?: boolean
          can_manage_accounts?: boolean
          can_manage_products?: boolean
          can_place_orders?: boolean
          can_view_pricing?: boolean
          created_at?: string
          description?: string | null
          id?: string
          preset_name?: string
          role_id?: string
          scope_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "access_presets_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: true
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      accessory_option_values: {
        Row: {
          affects_price: boolean
          axis: string
          cost_delta_cny: number | null
          created_at: string
          id: string
          is_default: boolean
          price_delta_cny: number
          product_id: string
          sort_order: number
          value: string
        }
        Insert: {
          affects_price?: boolean
          axis: string
          cost_delta_cny?: number | null
          created_at?: string
          id?: string
          is_default?: boolean
          price_delta_cny?: number
          product_id: string
          sort_order?: number
          value: string
        }
        Update: {
          affects_price?: boolean
          axis?: string
          cost_delta_cny?: number | null
          created_at?: string
          id?: string
          is_default?: boolean
          price_delta_cny?: number
          product_id?: string
          sort_order?: number
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "accessory_option_values_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      account_api_keys: {
        Row: {
          account_id: string
          created_at: string
          expires_at: string | null
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          revoked_at: string | null
          scopes: string[]
        }
        Insert: {
          account_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          revoked_at?: string | null
          scopes?: string[]
        }
        Update: {
          account_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          revoked_at?: string | null
          scopes?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "account_api_keys_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      account_login_history: {
        Row: {
          account_id: string
          created_at: string
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json
          user_agent: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          event_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          user_agent?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "account_login_history_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      account_permission_overrides: {
        Row: {
          access_level: string
          account_id: string
          can_create: boolean
          can_delete: boolean
          can_edit: boolean
          can_view: boolean
          created_at: string
          data_scope: string
          id: string
          module_key: string
          updated_at: string
        }
        Insert: {
          access_level: string
          account_id: string
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          data_scope?: string
          id?: string
          module_key: string
          updated_at?: string
        }
        Update: {
          access_level?: string
          account_id?: string
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          data_scope?: string
          id?: string
          module_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_permission_overrides_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      account_sessions: {
        Row: {
          account_id: string
          auth_method: string
          browser: string | null
          created_at: string
          device_name: string | null
          device_type: string | null
          expires_at: string | null
          id: string
          ip_address: string | null
          last_active_at: string
          os: string | null
          revoked_at: string | null
          rotated_from: string | null
          session_token_hash: string
        }
        Insert: {
          account_id: string
          auth_method?: string
          browser?: string | null
          created_at?: string
          device_name?: string | null
          device_type?: string | null
          expires_at?: string | null
          id?: string
          ip_address?: string | null
          last_active_at?: string
          os?: string | null
          revoked_at?: string | null
          rotated_from?: string | null
          session_token_hash: string
        }
        Update: {
          account_id?: string
          auth_method?: string
          browser?: string | null
          created_at?: string
          device_name?: string | null
          device_type?: string | null
          expires_at?: string | null
          id?: string
          ip_address?: string | null
          last_active_at?: string
          os?: string | null
          revoked_at?: string | null
          rotated_from?: string | null
          session_token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_sessions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_accounts: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          metadata: Json
          name: string
          normal_balance: string
          parent_id: string | null
          subtype: string | null
          system_account: boolean
          tenant_id: string
          type: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          name: string
          normal_balance: string
          parent_id?: string | null
          subtype?: string | null
          system_account?: boolean
          tenant_id: string
          type: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          name?: string
          normal_balance?: string
          parent_id?: string | null
          subtype?: string | null
          system_account?: boolean
          tenant_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "accounting_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_accounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_journal_entries: {
        Row: {
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          description: string | null
          entry_date: string
          id: string
          journal_no: string
          metadata: Json
          posted_at: string | null
          posted_by: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          reverses_entry_id: string | null
          source_id: string | null
          source_type: string
          status: string
          submitted_at: string | null
          submitted_by: string | null
          tenant_id: string
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          entry_date: string
          id?: string
          journal_no: string
          metadata?: Json
          posted_at?: string | null
          posted_by?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          reverses_entry_id?: string | null
          source_id?: string | null
          source_type: string
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          tenant_id: string
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          entry_date?: string
          id?: string
          journal_no?: string
          metadata?: Json
          posted_at?: string | null
          posted_by?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          reverses_entry_id?: string | null
          source_id?: string | null
          source_type?: string
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          tenant_id?: string
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounting_journal_entries_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_journal_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_journal_entries_posted_by_fkey"
            columns: ["posted_by"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_journal_entries_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_journal_entries_reverses_entry_id_fkey"
            columns: ["reverses_entry_id"]
            isOneToOne: false
            referencedRelation: "accounting_journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_journal_entries_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_journal_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_journal_entries_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_journal_lines: {
        Row: {
          account_id: string
          created_at: string
          credit: number
          currency: string
          debit: number
          description: string | null
          entry_id: string
          exchange_rate: number
          id: string
          line_index: number
          metadata: Json
          party_id: string | null
          party_type: string | null
          reference: string | null
          tenant_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          credit?: number
          currency?: string
          debit?: number
          description?: string | null
          entry_id: string
          exchange_rate?: number
          id?: string
          line_index: number
          metadata?: Json
          party_id?: string | null
          party_type?: string | null
          reference?: string | null
          tenant_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          credit?: number
          currency?: string
          debit?: number
          description?: string | null
          entry_id?: string
          exchange_rate?: number
          id?: string
          line_index?: number
          metadata?: Json
          party_id?: string | null
          party_type?: string | null
          reference?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_journal_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounting_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_journal_lines_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "accounting_journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_journal_lines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_period_locks: {
        Row: {
          locked_at: string
          locked_by: string | null
          locked_through: string
          note: string | null
          tenant_id: string
        }
        Insert: {
          locked_at?: string
          locked_by?: string | null
          locked_through: string
          note?: string | null
          tenant_id: string
        }
        Update: {
          locked_at?: string
          locked_by?: string | null
          locked_through?: string
          note?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_period_locks_locked_by_fkey"
            columns: ["locked_by"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_period_locks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_sequences: {
        Row: {
          key: string
          next_value: number
          tenant_id: string
        }
        Insert: {
          key: string
          next_value?: number
          tenant_id: string
        }
        Update: {
          key?: string
          next_value?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_sequences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          auth_user_id: string | null
          avatar_url: string | null
          company_id: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          force_password_change: boolean
          id: string
          internal_notes: string | null
          is_super_admin: boolean
          last_login_at: string | null
          login_email: string
          password_algo: string
          password_changed_at: string | null
          password_hash: string | null
          password_rehash_required: boolean
          person_id: string | null
          preferences: Json
          reviews_membership_requests: boolean
          role_id: string | null
          sessions_valid_after: string | null
          status: string
          tenant_id: string
          two_factor_enabled: boolean
          updated_at: string
          user_type: string
          username: string
        }
        Insert: {
          auth_user_id?: string | null
          avatar_url?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          force_password_change?: boolean
          id?: string
          internal_notes?: string | null
          is_super_admin?: boolean
          last_login_at?: string | null
          login_email: string
          password_algo?: string
          password_changed_at?: string | null
          password_hash?: string | null
          password_rehash_required?: boolean
          person_id?: string | null
          preferences?: Json
          reviews_membership_requests?: boolean
          role_id?: string | null
          sessions_valid_after?: string | null
          status?: string
          tenant_id?: string
          two_factor_enabled?: boolean
          updated_at?: string
          user_type?: string
          username: string
        }
        Update: {
          auth_user_id?: string | null
          avatar_url?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          force_password_change?: boolean
          id?: string
          internal_notes?: string | null
          is_super_admin?: boolean
          last_login_at?: string | null
          login_email?: string
          password_algo?: string
          password_changed_at?: string | null
          password_hash?: string | null
          password_rehash_required?: boolean
          person_id?: string | null
          preferences?: Json
          reviews_membership_requests?: boolean
          role_id?: string | null
          sessions_valid_after?: string | null
          status?: string
          tenant_id?: string
          two_factor_enabled?: boolean
          updated_at?: string
          user_type?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_events: {
        Row: {
          account_id: string
          browser: string | null
          country: string | null
          created_at: string
          device_id: string | null
          device_type: string | null
          event_type: string
          id: string
          ip: string | null
          metadata: Json
          module: string | null
          os: string | null
          referrer: string | null
          route: string | null
          session_id: string | null
          severity: string
          tenant_id: string | null
          title: string | null
        }
        Insert: {
          account_id: string
          browser?: string | null
          country?: string | null
          created_at?: string
          device_id?: string | null
          device_type?: string | null
          event_type: string
          id?: string
          ip?: string | null
          metadata?: Json
          module?: string | null
          os?: string | null
          referrer?: string | null
          route?: string | null
          session_id?: string | null
          severity?: string
          tenant_id?: string | null
          title?: string | null
        }
        Update: {
          account_id?: string
          browser?: string | null
          country?: string | null
          created_at?: string
          device_id?: string | null
          device_type?: string | null
          event_type?: string
          id?: string
          ip?: string | null
          metadata?: Json
          module?: string | null
          os?: string | null
          referrer?: string | null
          route?: string | null
          session_id?: string | null
          severity?: string
          tenant_id?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_events_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "app_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversations: {
        Row: {
          account_id: string
          created_at: string
          id: string
          last_preview: string | null
          message_count: number
          pinned: boolean
          project_id: string | null
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          last_preview?: string | null
          message_count?: number
          pinned?: boolean
          project_id?: string | null
          tenant_id: string
          title?: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          last_preview?: string | null
          message_count?: number
          pinned?: boolean
          project_id?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ai_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_knowledge_units: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          body: string
          created_at: string
          domains: string[]
          id: string
          kind: string
          languages: string[]
          locator: Json
          meta: Json
          pipeline_version: string
          sensitivity: string
          seq: number
          source_id: string
          status: string
          tags: string[]
          tenant_id: string | null
          title: string | null
          tokens: number | null
          trust_score: number
          updated_at: string
          valid_until: string | null
          version: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          body: string
          created_at?: string
          domains?: string[]
          id?: string
          kind?: string
          languages?: string[]
          locator?: Json
          meta?: Json
          pipeline_version?: string
          sensitivity?: string
          seq?: number
          source_id: string
          status?: string
          tags?: string[]
          tenant_id?: string | null
          title?: string | null
          tokens?: number | null
          trust_score?: number
          updated_at?: string
          valid_until?: string | null
          version?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          body?: string
          created_at?: string
          domains?: string[]
          id?: string
          kind?: string
          languages?: string[]
          locator?: Json
          meta?: Json
          pipeline_version?: string
          sensitivity?: string
          seq?: number
          source_id?: string
          status?: string
          tags?: string[]
          tenant_id?: string | null
          title?: string | null
          tokens?: number | null
          trust_score?: number
          updated_at?: string
          valid_until?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_knowledge_units_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "ai_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_ku_lineage: {
        Row: {
          created_at: string
          id: string
          ku_id: string
          parent_ku_id: string | null
          relation: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ku_id: string
          parent_ku_id?: string | null
          relation?: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ku_id?: string
          parent_ku_id?: string | null
          relation?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_ku_lineage_ku_id_fkey"
            columns: ["ku_id"]
            isOneToOne: false
            referencedRelation: "ai_knowledge_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_ku_lineage_parent_ku_id_fkey"
            columns: ["parent_ku_id"]
            isOneToOne: false
            referencedRelation: "ai_knowledge_units"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_memories: {
        Row: {
          account_id: string
          created_at: string
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_memories_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          provider: string | null
          role: string
          source: string
          tenant_id: string
          thinking: Json | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          provider?: string | null
          role: string
          source?: string
          tenant_id: string
          thinking?: Json | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          provider?: string | null
          role?: string
          source?: string
          tenant_id?: string
          thinking?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_pending_actions: {
        Row: {
          account_id: string
          args_hash: string
          cancelled_at: string | null
          confirmed_at: string | null
          conversation_id: string | null
          created_at: string
          expires_at: string
          id: string
          normalized_args: Json
          preview_payload: Json | null
          risk_class: string
          status: string
          tenant_id: string
          tool_name: string
        }
        Insert: {
          account_id: string
          args_hash: string
          cancelled_at?: string | null
          confirmed_at?: string | null
          conversation_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          normalized_args: Json
          preview_payload?: Json | null
          risk_class?: string
          status?: string
          tenant_id: string
          tool_name: string
        }
        Update: {
          account_id?: string
          args_hash?: string
          cancelled_at?: string | null
          confirmed_at?: string | null
          conversation_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          normalized_args?: Json
          preview_payload?: Json | null
          risk_class?: string
          status?: string
          tenant_id?: string
          tool_name?: string
        }
        Relationships: []
      }
      ai_projects: {
        Row: {
          account_id: string
          color: string
          created_at: string
          icon: string
          id: string
          name: string
          sort_order: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          account_id: string
          color?: string
          created_at?: string
          icon?: string
          id?: string
          name: string
          sort_order?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          color?: string
          created_at?: string
          icon?: string
          id?: string
          name?: string
          sort_order?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_rate_limits: {
        Row: {
          bucket: string
          count: number
          subject: string
          updated_at: string
          window_start: string
        }
        Insert: {
          bucket: string
          count?: number
          subject: string
          updated_at?: string
          window_start: string
        }
        Update: {
          bucket?: string
          count?: number
          subject?: string
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      ai_sources: {
        Row: {
          created_at: string
          created_by: string | null
          domain: string | null
          error: string | null
          id: string
          kind: string
          lang: string | null
          meta: Json
          mime: string | null
          origin: string | null
          pipeline_version: string
          status: string
          tenant_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          domain?: string | null
          error?: string | null
          id?: string
          kind?: string
          lang?: string | null
          meta?: Json
          mime?: string | null
          origin?: string | null
          pipeline_version?: string
          status?: string
          tenant_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          domain?: string | null
          error?: string | null
          id?: string
          kind?: string
          lang?: string | null
          meta?: Json
          mime?: string | null
          origin?: string | null
          pipeline_version?: string
          status?: string
          tenant_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_tool_calls: {
        Row: {
          account_id: string
          args: Json
          conversation_id: string | null
          created_at: string
          filtered_fields: string[] | null
          id: string
          latency_ms: number | null
          message: string | null
          ok: boolean
          permission_status: string
          result_summary: string | null
          sources: string[] | null
          tenant_id: string
          tool_name: string
        }
        Insert: {
          account_id: string
          args?: Json
          conversation_id?: string | null
          created_at?: string
          filtered_fields?: string[] | null
          id?: string
          latency_ms?: number | null
          message?: string | null
          ok: boolean
          permission_status: string
          result_summary?: string | null
          sources?: string[] | null
          tenant_id: string
          tool_name: string
        }
        Update: {
          account_id?: string
          args?: Json
          conversation_id?: string | null
          created_at?: string
          filtered_fields?: string[] | null
          id?: string
          latency_ms?: number | null
          message?: string | null
          ok?: boolean
          permission_status?: string
          result_summary?: string | null
          sources?: string[] | null
          tenant_id?: string
          tool_name?: string
        }
        Relationships: []
      }
      app_sessions: {
        Row: {
          account_id: string
          browser: string | null
          city: string | null
          country: string | null
          created_at: string
          current_module: string | null
          current_route: string | null
          device_id: string
          device_type: string | null
          ended_at: string | null
          id: string
          ip: string | null
          last_action: string | null
          last_seen_at: string
          metadata: Json
          os: string | null
          revoked_at: string | null
          revoked_by: string | null
          started_at: string
          status: string
          tenant_id: string | null
          user_agent: string | null
        }
        Insert: {
          account_id: string
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          current_module?: string | null
          current_route?: string | null
          device_id: string
          device_type?: string | null
          ended_at?: string | null
          id?: string
          ip?: string | null
          last_action?: string | null
          last_seen_at?: string
          metadata?: Json
          os?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          started_at?: string
          status?: string
          tenant_id?: string | null
          user_agent?: string | null
        }
        Update: {
          account_id?: string
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          current_module?: string | null
          current_route?: string | null
          device_id?: string
          device_type?: string | null
          ended_at?: string | null
          id?: string
          ip?: string | null
          last_action?: string | null
          last_seen_at?: string
          metadata?: Json
          os?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          started_at?: string
          status?: string
          tenant_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_sessions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      archived_visual_asset_registry_links: {
        Row: {
          ai_product_mapping: Json | null
          ai_usage_prediction: Json | null
          ai_visual_role: string | null
          asset_id: string
          category_id: string | null
          created_at: string
          deprecated: boolean
          division_id: string | null
          id: string
          priority: number
          product_system_id: string | null
          recommended: boolean
          required: boolean
          subcategory_id: string | null
          tenant_id: string
          usage_role: string
          visual_weight: number
        }
        Insert: {
          ai_product_mapping?: Json | null
          ai_usage_prediction?: Json | null
          ai_visual_role?: string | null
          asset_id: string
          category_id?: string | null
          created_at?: string
          deprecated?: boolean
          division_id?: string | null
          id?: string
          priority?: number
          product_system_id?: string | null
          recommended?: boolean
          required?: boolean
          subcategory_id?: string | null
          tenant_id: string
          usage_role?: string
          visual_weight?: number
        }
        Update: {
          ai_product_mapping?: Json | null
          ai_usage_prediction?: Json | null
          ai_visual_role?: string | null
          asset_id?: string
          category_id?: string | null
          created_at?: string
          deprecated?: boolean
          division_id?: string | null
          id?: string
          priority?: number
          product_system_id?: string | null
          recommended?: boolean
          required?: boolean
          subcategory_id?: string | null
          tenant_id?: string
          usage_role?: string
          visual_weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "visual_asset_registry_links_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "visual_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visual_asset_registry_links_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "archived_visual_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visual_asset_registry_links_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "archived_visual_divisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visual_asset_registry_links_product_system_id_fkey"
            columns: ["product_system_id"]
            isOneToOne: false
            referencedRelation: "archived_visual_product_systems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visual_asset_registry_links_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "archived_visual_subcategories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visual_asset_registry_links_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      archived_visual_categories: {
        Row: {
          active: boolean
          ai_category_vector: Json | null
          approval_state: string
          code: string | null
          cover_asset_id: string | null
          created_at: string
          description: string | null
          division_id: string
          dna_profile_id: string | null
          icon_asset_id: string | null
          icon_url: string | null
          id: string
          name: string
          slug: string
          sort_order: number
          tenant_id: string
          updated_at: string
          usage_context: string | null
          visual_style: string | null
        }
        Insert: {
          active?: boolean
          ai_category_vector?: Json | null
          approval_state?: string
          code?: string | null
          cover_asset_id?: string | null
          created_at?: string
          description?: string | null
          division_id: string
          dna_profile_id?: string | null
          icon_asset_id?: string | null
          icon_url?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
          tenant_id: string
          updated_at?: string
          usage_context?: string | null
          visual_style?: string | null
        }
        Update: {
          active?: boolean
          ai_category_vector?: Json | null
          approval_state?: string
          code?: string | null
          cover_asset_id?: string | null
          created_at?: string
          description?: string | null
          division_id?: string
          dna_profile_id?: string | null
          icon_asset_id?: string | null
          icon_url?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
          tenant_id?: string
          updated_at?: string
          usage_context?: string | null
          visual_style?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visual_categories_cover_asset_id_fkey"
            columns: ["cover_asset_id"]
            isOneToOne: false
            referencedRelation: "visual_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visual_categories_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "archived_visual_divisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visual_categories_dna_profile_id_fkey"
            columns: ["dna_profile_id"]
            isOneToOne: false
            referencedRelation: "design_dna_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visual_categories_icon_asset_id_fkey"
            columns: ["icon_asset_id"]
            isOneToOne: false
            referencedRelation: "visual_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visual_categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      archived_visual_divisions: {
        Row: {
          active: boolean
          ai_category_vector: Json | null
          approval_state: string
          code: string | null
          cover_asset_id: string | null
          created_at: string
          description: string | null
          dna_profile_id: string | null
          icon_asset_id: string | null
          icon_url: string | null
          id: string
          name: string
          slug: string
          sort_order: number
          tenant_id: string
          updated_at: string
          visual_style: string | null
        }
        Insert: {
          active?: boolean
          ai_category_vector?: Json | null
          approval_state?: string
          code?: string | null
          cover_asset_id?: string | null
          created_at?: string
          description?: string | null
          dna_profile_id?: string | null
          icon_asset_id?: string | null
          icon_url?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
          tenant_id: string
          updated_at?: string
          visual_style?: string | null
        }
        Update: {
          active?: boolean
          ai_category_vector?: Json | null
          approval_state?: string
          code?: string | null
          cover_asset_id?: string | null
          created_at?: string
          description?: string | null
          dna_profile_id?: string | null
          icon_asset_id?: string | null
          icon_url?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
          tenant_id?: string
          updated_at?: string
          visual_style?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visual_divisions_cover_asset_id_fkey"
            columns: ["cover_asset_id"]
            isOneToOne: false
            referencedRelation: "visual_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visual_divisions_dna_profile_id_fkey"
            columns: ["dna_profile_id"]
            isOneToOne: false
            referencedRelation: "design_dna_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visual_divisions_icon_asset_id_fkey"
            columns: ["icon_asset_id"]
            isOneToOne: false
            referencedRelation: "visual_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visual_divisions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      archived_visual_product_systems: {
        Row: {
          active: boolean
          ai_product_mapping: Json | null
          code: string | null
          complexity_level: string
          created_at: string
          description: string | null
          feature_priority: number
          icon_asset_id: string | null
          id: string
          machine_relevance: number
          name: string
          slug: string
          subcategory_id: string
          system_type: string
          tenant_id: string
          ui_relevance: number
          updated_at: string
          visual_style: string | null
        }
        Insert: {
          active?: boolean
          ai_product_mapping?: Json | null
          code?: string | null
          complexity_level?: string
          created_at?: string
          description?: string | null
          feature_priority?: number
          icon_asset_id?: string | null
          id?: string
          machine_relevance?: number
          name: string
          slug: string
          subcategory_id: string
          system_type?: string
          tenant_id: string
          ui_relevance?: number
          updated_at?: string
          visual_style?: string | null
        }
        Update: {
          active?: boolean
          ai_product_mapping?: Json | null
          code?: string | null
          complexity_level?: string
          created_at?: string
          description?: string | null
          feature_priority?: number
          icon_asset_id?: string | null
          id?: string
          machine_relevance?: number
          name?: string
          slug?: string
          subcategory_id?: string
          system_type?: string
          tenant_id?: string
          ui_relevance?: number
          updated_at?: string
          visual_style?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visual_product_systems_icon_asset_id_fkey"
            columns: ["icon_asset_id"]
            isOneToOne: false
            referencedRelation: "visual_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visual_product_systems_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "archived_visual_subcategories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visual_product_systems_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      archived_visual_subcategories: {
        Row: {
          active: boolean
          ai_category_vector: Json | null
          approval_state: string
          category_id: string
          code: string | null
          created_at: string
          description: string | null
          dna_profile_id: string | null
          icon_asset_id: string | null
          icon_url: string | null
          id: string
          machine_type: string | null
          name: string
          operational_context: string | null
          slug: string
          sort_order: number
          tenant_id: string
          updated_at: string
          usage_rules: Json | null
          visual_style: string | null
        }
        Insert: {
          active?: boolean
          ai_category_vector?: Json | null
          approval_state?: string
          category_id: string
          code?: string | null
          created_at?: string
          description?: string | null
          dna_profile_id?: string | null
          icon_asset_id?: string | null
          icon_url?: string | null
          id?: string
          machine_type?: string | null
          name: string
          operational_context?: string | null
          slug: string
          sort_order?: number
          tenant_id: string
          updated_at?: string
          usage_rules?: Json | null
          visual_style?: string | null
        }
        Update: {
          active?: boolean
          ai_category_vector?: Json | null
          approval_state?: string
          category_id?: string
          code?: string | null
          created_at?: string
          description?: string | null
          dna_profile_id?: string | null
          icon_asset_id?: string | null
          icon_url?: string | null
          id?: string
          machine_type?: string | null
          name?: string
          operational_context?: string | null
          slug?: string
          sort_order?: number
          tenant_id?: string
          updated_at?: string
          usage_rules?: Json | null
          visual_style?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visual_subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "archived_visual_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visual_subcategories_dna_profile_id_fkey"
            columns: ["dna_profile_id"]
            isOneToOne: false
            referencedRelation: "design_dna_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visual_subcategories_icon_asset_id_fkey"
            columns: ["icon_asset_id"]
            isOneToOne: false
            referencedRelation: "visual_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visual_subcategories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      archived_visual_types: {
        Row: {
          active: boolean
          approval_state: string
          code: string | null
          created_at: string
          description: string | null
          icon_asset_id: string | null
          icon_url: string | null
          id: string
          name: string
          slug: string
          sort_order: number
          subcategory_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          approval_state?: string
          code?: string | null
          created_at?: string
          description?: string | null
          icon_asset_id?: string | null
          icon_url?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
          subcategory_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          approval_state?: string
          code?: string | null
          created_at?: string
          description?: string | null
          icon_asset_id?: string | null
          icon_url?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
          subcategory_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "visual_types_icon_asset_id_fkey"
            columns: ["icon_asset_id"]
            isOneToOne: false
            referencedRelation: "visual_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visual_types_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "archived_visual_subcategories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visual_types_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_dna_analysis: {
        Row: {
          asset_id: string
          balance_score: number
          complexity_level: string | null
          computed_at: string
          consistency_score: number
          corner_family: string | null
          corner_score: number
          created_at: string
          futuristic_score: number
          geometry_family: string | null
          geometry_score: number
          icon_personality: string | null
          id: string
          inconsistent_stroke: boolean
          industrial_score: number
          luxury_score: number
          minimalism_score: number
          negative_space_ratio: number | null
          over_detailed: boolean
          overall_score: number
          pattern_matches: Json
          poor_scalability: boolean
          profile_id: string
          readability_score: number
          review_notes: string | null
          reviewed_by: string | null
          shape_language: string | null
          spacing_score: number
          stroke_family: string | null
          stroke_score: number
          symmetry_score: number
          tenant_id: string
          too_complex: boolean
          updated_at: string
          violates_brand_language: boolean
          visual_density: number | null
          visual_temperature: string | null
          visual_weight: string | null
          weak_balance: boolean
        }
        Insert: {
          asset_id: string
          balance_score?: number
          complexity_level?: string | null
          computed_at?: string
          consistency_score?: number
          corner_family?: string | null
          corner_score?: number
          created_at?: string
          futuristic_score?: number
          geometry_family?: string | null
          geometry_score?: number
          icon_personality?: string | null
          id?: string
          inconsistent_stroke?: boolean
          industrial_score?: number
          luxury_score?: number
          minimalism_score?: number
          negative_space_ratio?: number | null
          over_detailed?: boolean
          overall_score?: number
          pattern_matches?: Json
          poor_scalability?: boolean
          profile_id: string
          readability_score?: number
          review_notes?: string | null
          reviewed_by?: string | null
          shape_language?: string | null
          spacing_score?: number
          stroke_family?: string | null
          stroke_score?: number
          symmetry_score?: number
          tenant_id: string
          too_complex?: boolean
          updated_at?: string
          violates_brand_language?: boolean
          visual_density?: number | null
          visual_temperature?: string | null
          visual_weight?: string | null
          weak_balance?: boolean
        }
        Update: {
          asset_id?: string
          balance_score?: number
          complexity_level?: string | null
          computed_at?: string
          consistency_score?: number
          corner_family?: string | null
          corner_score?: number
          created_at?: string
          futuristic_score?: number
          geometry_family?: string | null
          geometry_score?: number
          icon_personality?: string | null
          id?: string
          inconsistent_stroke?: boolean
          industrial_score?: number
          luxury_score?: number
          minimalism_score?: number
          negative_space_ratio?: number | null
          over_detailed?: boolean
          overall_score?: number
          pattern_matches?: Json
          poor_scalability?: boolean
          profile_id?: string
          readability_score?: number
          review_notes?: string | null
          reviewed_by?: string | null
          shape_language?: string | null
          spacing_score?: number
          stroke_family?: string | null
          stroke_score?: number
          symmetry_score?: number
          tenant_id?: string
          too_complex?: boolean
          updated_at?: string
          violates_brand_language?: boolean
          visual_density?: number | null
          visual_temperature?: string | null
          visual_weight?: string | null
          weak_balance?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "asset_dna_analysis_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "visual_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_dna_analysis_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "design_dna_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_dna_analysis_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          account_id: string | null
          action_type: string
          changed_fields: Json | null
          created_at: string
          entity_id: string | null
          entity_label: string | null
          entity_type: string | null
          id: string
          ip: string | null
          metadata: Json
          module: string | null
          new_values: Json | null
          old_values: Json | null
          route: string | null
          session_id: string | null
          severity: string
          tenant_id: string | null
        }
        Insert: {
          account_id?: string | null
          action_type: string
          changed_fields?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_label?: string | null
          entity_type?: string | null
          id?: string
          ip?: string | null
          metadata?: Json
          module?: string | null
          new_values?: Json | null
          old_values?: Json | null
          route?: string | null
          session_id?: string | null
          severity?: string
          tenant_id?: string | null
        }
        Update: {
          account_id?: string | null
          action_type?: string
          changed_fields?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_label?: string | null
          entity_type?: string | null
          id?: string
          ip?: string | null
          metadata?: Json
          module?: string | null
          new_values?: Json | null
          old_values?: Json | null
          route?: string | null
          session_id?: string | null
          severity?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      behavior_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          name_ar: string | null
          name_zh: string | null
          sort_order: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          name_ar?: string | null
          name_zh?: string | null
          sort_order?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          name_ar?: string | null
          name_zh?: string | null
          sort_order?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      behavior_followup_actions: {
        Row: {
          action_type: string
          assessment_id: string | null
          created_at: string
          due_date: string | null
          employee_id: string
          id: string
          linked_record_id: string | null
          linked_record_type: string | null
          notes: string | null
          owner: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          action_type?: string
          assessment_id?: string | null
          created_at?: string
          due_date?: string | null
          employee_id: string
          id?: string
          linked_record_id?: string | null
          linked_record_type?: string | null
          notes?: string | null
          owner?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          action_type?: string
          assessment_id?: string | null
          created_at?: string
          due_date?: string | null
          employee_id?: string
          id?: string
          linked_record_id?: string | null
          linked_record_type?: string | null
          notes?: string | null
          owner?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "behavior_followup_actions_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "employee_behavior_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "behavior_followup_actions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "koleex_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      behavior_indicators: {
        Row: {
          assessor_guidance: string | null
          category_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_critical_default: boolean
          name: string
          name_ar: string | null
          name_zh: string | null
          sort_order: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          assessor_guidance?: string | null
          category_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_critical_default?: boolean
          name: string
          name_ar?: string | null
          name_zh?: string | null
          sort_order?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          assessor_guidance?: string | null
          category_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_critical_default?: boolean
          name?: string
          name_ar?: string | null
          name_zh?: string | null
          sort_order?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "behavior_indicators_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "behavior_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_designs: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_default: boolean
          item_id: string
          kind: string
          name: string
          name_i18n: Json
          notes: string | null
          option_ids: string[]
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          item_id: string
          kind?: string
          name: string
          name_i18n?: Json
          notes?: string | null
          option_ids?: string[]
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          item_id?: string
          kind?: string
          name?: string
          name_i18n?: Json
          notes?: string | null
          option_ids?: string[]
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_designs_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "brand_items"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_files: {
        Row: {
          created_at: string
          created_by: string | null
          design_id: string
          file_name: string
          height_mm: number | null
          id: string
          mime: string | null
          purpose: string
          size_bytes: number | null
          storage_path: string
          tenant_id: string
          width_mm: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          design_id: string
          file_name: string
          height_mm?: number | null
          id?: string
          mime?: string | null
          purpose?: string
          size_bytes?: number | null
          storage_path: string
          tenant_id: string
          width_mm?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          design_id?: string
          file_name?: string
          height_mm?: number | null
          id?: string
          mime?: string | null
          purpose?: string
          size_bytes?: number | null
          storage_path?: string
          tenant_id?: string
          width_mm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_files_design_id_fkey"
            columns: ["design_id"]
            isOneToOne: false
            referencedRelation: "brand_designs"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_groups: {
        Row: {
          created_at: string
          id: string
          name: string
          name_i18n: Json
          section_id: string
          sort: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          name_i18n?: Json
          section_id: string
          sort?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          name_i18n?: Json
          section_id?: string
          sort?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_groups_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "brand_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_item_options: {
        Row: {
          chosen: boolean
          created_at: string
          id: string
          item_id: string
          key: string
          label: string
          label_i18n: Json
          recommended: boolean
          sort: number
          tenant_id: string
          type_id: string
        }
        Insert: {
          chosen?: boolean
          created_at?: string
          id?: string
          item_id: string
          key: string
          label: string
          label_i18n?: Json
          recommended?: boolean
          sort?: number
          tenant_id: string
          type_id: string
        }
        Update: {
          chosen?: boolean
          created_at?: string
          id?: string
          item_id?: string
          key?: string
          label?: string
          label_i18n?: Json
          recommended?: boolean
          sort?: number
          tenant_id?: string
          type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_item_options_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "brand_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_item_options_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "brand_item_types"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_item_types: {
        Row: {
          created_at: string
          id: string
          item_id: string
          key: string
          label: string
          label_i18n: Json
          sort: number
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          key: string
          label: string
          label_i18n?: Json
          sort?: number
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          key?: string
          label?: string
          label_i18n?: Json
          sort?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_item_types_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "brand_items"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_items: {
        Row: {
          created_at: string
          created_by: string | null
          decision: string
          group_id: string | null
          id: string
          importance: string
          key: string
          name: string
          name_i18n: Json
          note: string | null
          owner_note: string | null
          roles: string[]
          rules: Json
          section_id: string
          sort: number
          status: string
          tenant_id: string
          updated_at: string
          use_i18n: Json
          use_text: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          decision?: string
          group_id?: string | null
          id?: string
          importance?: string
          key: string
          name: string
          name_i18n?: Json
          note?: string | null
          owner_note?: string | null
          roles?: string[]
          rules?: Json
          section_id: string
          sort?: number
          status?: string
          tenant_id: string
          updated_at?: string
          use_i18n?: Json
          use_text?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          decision?: string
          group_id?: string | null
          id?: string
          importance?: string
          key?: string
          name?: string
          name_i18n?: Json
          note?: string | null
          owner_note?: string | null
          roles?: string[]
          rules?: Json
          section_id?: string
          sort?: number
          status?: string
          tenant_id?: string
          updated_at?: string
          use_i18n?: Json
          use_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_items_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "brand_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_items_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "brand_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_saved_templates: {
        Row: {
          account_id: string
          created_at: string
          fill: Json
          id: string
          name: string
          shared: boolean
          template_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          fill?: Json
          id?: string
          name: string
          shared?: boolean
          template_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          fill?: Json
          id?: string
          name?: string
          shared?: boolean
          template_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      brand_sections: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          key: string
          name: string
          name_i18n: Json
          no: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          key: string
          name: string
          name_i18n?: Json
          no: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          key?: string
          name?: string
          name_i18n?: Json
          no?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      brand_template_styles: {
        Row: {
          status: string
          style: string
          template_id: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          status: string
          style: string
          template_id: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          status?: string
          style?: string
          template_id?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      brands: {
        Row: {
          created_at: string
          id: string
          logo_url: string | null
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      catalogs: {
        Row: {
          category_name: string | null
          category_names: string[] | null
          category_slug: string | null
          category_slugs: string[] | null
          company_name_cn: string | null
          company_name_en: string | null
          contact_id: string | null
          contact_name: string | null
          contact_photo_url: string | null
          contact_type: string | null
          cover_path: string | null
          cover_url: string | null
          created_at: string
          created_by: string | null
          created_by_name: string | null
          description: string | null
          division_name: string | null
          division_slug: string | null
          download_count: number
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          file_url: string
          id: string
          page_count: number | null
          tags: string[]
          tenant_id: string
          title: string
          title_cn: string | null
          updated_at: string
          valid_until: string | null
          view_count: number
          year: number | null
        }
        Insert: {
          category_name?: string | null
          category_names?: string[] | null
          category_slug?: string | null
          category_slugs?: string[] | null
          company_name_cn?: string | null
          company_name_en?: string | null
          contact_id?: string | null
          contact_name?: string | null
          contact_photo_url?: string | null
          contact_type?: string | null
          cover_path?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          description?: string | null
          division_name?: string | null
          division_slug?: string | null
          download_count?: number
          file_name: string
          file_path: string
          file_size?: number
          file_type?: string
          file_url: string
          id?: string
          page_count?: number | null
          tags?: string[]
          tenant_id: string
          title: string
          title_cn?: string | null
          updated_at?: string
          valid_until?: string | null
          view_count?: number
          year?: number | null
        }
        Update: {
          category_name?: string | null
          category_names?: string[] | null
          category_slug?: string | null
          category_slugs?: string[] | null
          company_name_cn?: string | null
          company_name_en?: string | null
          contact_id?: string | null
          contact_name?: string | null
          contact_photo_url?: string | null
          contact_type?: string | null
          cover_path?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          description?: string | null
          division_name?: string | null
          division_slug?: string | null
          download_count?: number
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          file_url?: string
          id?: string
          page_count?: number | null
          tags?: string[]
          tenant_id?: string
          title?: string
          title_cn?: string | null
          updated_at?: string
          valid_until?: string | null
          view_count?: number
          year?: number | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string | null
          description: string | null
          division_id: string
          id: string
          name: string
          name_ar: string | null
          name_zh: string | null
          order: number
          slug: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          division_id: string
          id?: string
          name: string
          name_ar?: string | null
          name_zh?: string | null
          order?: number
          slug: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          division_id?: string
          id?: string
          name?: string
          name_ar?: string | null
          name_zh?: string | null
          order?: number
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
        ]
      }
      classification_icons: {
        Row: {
          icon_asset_id: string | null
          icon_url: string | null
          id: string
          level: string
          slug: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          icon_asset_id?: string | null
          icon_url?: string | null
          id?: string
          level: string
          slug: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          icon_asset_id?: string | null
          icon_url?: string | null
          id?: string
          level?: string
          slug?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classification_icons_icon_asset_id_fkey"
            columns: ["icon_asset_id"]
            isOneToOne: false
            referencedRelation: "visual_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_approval_authority: {
        Row: {
          can_approve: string[]
          created_at: string
          id: string
          is_active: boolean
          level: number
          role_label: string
          role_slug: string
          sort_order: number
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          can_approve?: string[]
          created_at?: string
          id?: string
          is_active?: boolean
          level: number
          role_label: string
          role_slug: string
          sort_order?: number
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          can_approve?: string[]
          created_at?: string
          id?: string
          is_active?: boolean
          level?: number
          role_label?: string
          role_slug?: string
          sort_order?: number
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commercial_approval_authority_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_approval_authority_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_band_countries: {
        Row: {
          band_id: string
          country_code: string
          created_at: string
          id: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          band_id: string
          country_code: string
          created_at?: string
          id?: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          band_id?: string
          country_code?: string
          created_at?: string
          id?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commercial_band_countries_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "commercial_market_bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_band_countries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_band_countries_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_channel_multipliers: {
        Row: {
          applies_to_tier: string | null
          code: string
          created_at: string
          id: string
          is_active: boolean
          margin_max_percent: number | null
          margin_min_percent: number | null
          multiplier: number
          name: string
          sort_order: number
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          applies_to_tier?: string | null
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          margin_max_percent?: number | null
          margin_min_percent?: number | null
          multiplier: number
          name: string
          sort_order?: number
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          applies_to_tier?: string | null
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          margin_max_percent?: number | null
          margin_min_percent?: number | null
          multiplier?: number
          name?: string
          sort_order?: number
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commercial_channel_multipliers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_channel_multipliers_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_commission_tiers: {
        Row: {
          applies_to: string
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          rate_percent: number
          sort_order: number
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          applies_to: string
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          rate_percent: number
          sort_order?: number
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          applies_to?: string
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          rate_percent?: number
          sort_order?: number
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commercial_commission_tiers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_commission_tiers_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_customer_tiers: {
        Row: {
          code: string
          created_at: string
          credit_days: number | null
          credit_multiplier: number | null
          discount_cap_percent: number
          has_credit: boolean
          id: string
          is_active: boolean
          level_number: number
          market_rights: string | null
          name: string
          real_name: string | null
          sort_order: number
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          credit_days?: number | null
          credit_multiplier?: number | null
          discount_cap_percent?: number
          has_credit?: boolean
          id?: string
          is_active?: boolean
          level_number: number
          market_rights?: string | null
          name: string
          real_name?: string | null
          sort_order?: number
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          credit_days?: number | null
          credit_multiplier?: number | null
          discount_cap_percent?: number
          has_credit?: boolean
          id?: string
          is_active?: boolean
          level_number?: number
          market_rights?: string | null
          name?: string
          real_name?: string | null
          sort_order?: number
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commercial_customer_tiers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_customer_tiers_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_discount_tiers: {
        Row: {
          approver_role: string
          code: string
          created_at: string
          id: string
          is_active: boolean
          label: string
          max_percent: number | null
          min_percent: number
          sort_order: number
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          approver_role: string
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          max_percent?: number | null
          min_percent: number
          sort_order?: number
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          approver_role?: string
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          max_percent?: number | null
          min_percent?: number
          sort_order?: number
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commercial_discount_tiers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_discount_tiers_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_market_bands: {
        Row: {
          adjustment_percent: number
          code: string
          created_at: string
          description: string | null
          flex_max_percent: number | null
          flex_min_percent: number | null
          id: string
          is_active: boolean
          is_flexible: boolean
          label: string | null
          name: string
          sort_order: number
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          adjustment_percent: number
          code: string
          created_at?: string
          description?: string | null
          flex_max_percent?: number | null
          flex_min_percent?: number | null
          id?: string
          is_active?: boolean
          is_flexible?: boolean
          label?: string | null
          name: string
          sort_order?: number
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          adjustment_percent?: number
          code?: string
          created_at?: string
          description?: string | null
          flex_max_percent?: number | null
          flex_min_percent?: number | null
          id?: string
          is_active?: boolean
          is_flexible?: boolean
          label?: string | null
          name?: string
          sort_order?: number
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commercial_market_bands_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_market_bands_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_product_levels: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          margin_max_percent: number | null
          margin_min_percent: number | null
          margin_percent: number
          max_cost_cny: number | null
          min_cost_cny: number
          min_margin_percent: number
          name: string
          sort_order: number
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          margin_max_percent?: number | null
          margin_min_percent?: number | null
          margin_percent: number
          max_cost_cny?: number | null
          min_cost_cny: number
          min_margin_percent: number
          name: string
          sort_order?: number
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          margin_max_percent?: number | null
          margin_min_percent?: number | null
          margin_percent?: number
          max_cost_cny?: number | null
          min_cost_cny?: number
          min_margin_percent?: number
          name?: string
          sort_order?: number
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commercial_product_levels_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_product_levels_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_settings: {
        Row: {
          cost_uplift_percent: number
          created_at: string
          fx_cny_per_usd: number
          fx_safety_buffer_percent: number
          id: string
          notes: string | null
          policy_version: string
          sales_sees_cost: boolean
          tax_refund_rate_percent: number
          tenant_id: string
          updated_at: string
          updated_by: string | null
          use_policy_engine: boolean
        }
        Insert: {
          cost_uplift_percent?: number
          created_at?: string
          fx_cny_per_usd?: number
          fx_safety_buffer_percent?: number
          id?: string
          notes?: string | null
          policy_version?: string
          sales_sees_cost?: boolean
          tax_refund_rate_percent?: number
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
          use_policy_engine?: boolean
        }
        Update: {
          cost_uplift_percent?: number
          created_at?: string
          fx_cny_per_usd?: number
          fx_safety_buffer_percent?: number
          id?: string
          notes?: string | null
          policy_version?: string
          sales_sees_cost?: boolean
          tax_refund_rate_percent?: number
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          use_policy_engine?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "commercial_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_volume_discount_tiers: {
        Row: {
          code: string
          created_at: string
          discount_max_percent: number
          discount_min_percent: number
          id: string
          is_active: boolean
          max_order_usd: number | null
          min_order_usd: number
          name: string
          sort_order: number
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          discount_max_percent?: number
          discount_min_percent?: number
          id?: string
          is_active?: boolean
          max_order_usd?: number | null
          min_order_usd?: number
          name: string
          sort_order?: number
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          discount_max_percent?: number
          discount_min_percent?: number
          id?: string
          is_active?: boolean
          max_order_usd?: number | null
          min_order_usd?: number
          name?: string
          sort_order?: number
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commercial_volume_discount_tiers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_volume_discount_tiers_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          country: string | null
          created_at: string
          currency: string | null
          customer_level: string | null
          id: string
          logo_url: string | null
          name: string
          notes: string | null
          tax_id: string | null
          tenant_id: string | null
          type: string
          updated_at: string
          website: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string
          currency?: string | null
          customer_level?: string | null
          id?: string
          logo_url?: string | null
          name: string
          notes?: string | null
          tax_id?: string | null
          tenant_id?: string | null
          type?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string
          currency?: string | null
          customer_level?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          notes?: string | null
          tax_id?: string | null
          tenant_id?: string | null
          type?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_roles: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          role_name: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          role_name: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          role_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_roles_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_tag_links: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          tag_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          tag_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_tag_links_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_tag_links_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "contact_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_tags: {
        Row: {
          color: string | null
          created_at: string
          id: string
          tag_name: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          tag_name: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          tag_name?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          account_manager: string | null
          additional_company_names: Json | null
          address_1: string | null
          address_2: string | null
          addresses: Json | null
          alipay_id: string | null
          alipay_qr: string | null
          aml_status: string | null
          annual_revenue_range: string | null
          assigned_branch: string | null
          attachments: Json | null
          backup_account_manager: string | null
          backup_supplier_name: string | null
          bank_accounts: Json | null
          birthday: string | null
          blacklist_reason: string | null
          brand_names: Json | null
          business_card_back: string | null
          business_card_front: string | null
          business_hours_end: string | null
          business_hours_start: string | null
          business_license_image: string | null
          business_registration_number: string | null
          business_timezone: string | null
          buying_behavior: string | null
          catalogues: Json | null
          categories: string[] | null
          category: string | null
          certificate_level: string | null
          certifications: Json | null
          certifications_required: string[] | null
          churn_risk: string | null
          city: string | null
          commercial_role: string | null
          commission_rate: string | null
          communication_preference: string | null
          company: string | null
          company_name: string | null
          company_name_cn: string | null
          company_name_en: string | null
          company_type: string | null
          contact_persons: Json | null
          contact_type: string | null
          container_preference: string | null
          contract_pricing_expiry: string | null
          country: string | null
          country_code: string | null
          cr_number: string | null
          created_at: string
          credit_insurance_coverage: string | null
          credit_insurance_covered: boolean | null
          credit_insurance_provider: string | null
          credit_limit: string | null
          credit_limit_approved_by: string | null
          credit_limit_approved_date: string | null
          credit_rating_external: string | null
          credit_rating_internal: string | null
          currency: string | null
          custom_fields: Json | null
          customer_health_score: string | null
          customer_level_assigned_date: string | null
          customer_level_review_date: string | null
          customer_type: string | null
          customs_broker: string | null
          customs_code: string | null
          days_sales_outstanding: string | null
          department: string | null
          dingtalk_id: string | null
          dingtalk_qr: string | null
          display_name: string
          division: string | null
          documents: Json | null
          duns_number: string | null
          ecatalog_qr: string | null
          ecatalog_url: string | null
          email: string | null
          emails: Json | null
          emergency_contacts: Json | null
          employee_bank_account: string | null
          employee_count_range: string | null
          entity_type: string
          eori_number: string | null
          exclusivity: string | null
          exclusivity_expiry: string | null
          exclusivity_scope: string | null
          factory_visit_date: string | null
          family_members: Json | null
          field_of_study: string | null
          first_contact_date: string | null
          first_name: string | null
          flags: string[] | null
          follow_up_date: string | null
          freight_forwarder: string | null
          full_name: string | null
          gender: string | null
          gst_number: string | null
          high_risk_country: boolean | null
          home_work_distance: string | null
          hs_codes: string[] | null
          id: string
          id_no: string | null
          importer_exporter_code: string | null
          incoterms: string | null
          industry: string | null
          internal_notes: string | null
          is_active: boolean
          job_position: string | null
          job_title: string | null
          kyc_review_due_date: string | null
          kyc_status: string | null
          kyc_verified_by: string | null
          kyc_verified_date: string | null
          labeling_requirements: string | null
          language: string | null
          last_contacted: string | null
          last_name: string | null
          last_order_date: string | null
          last_quality_issue: string | null
          lead_time: string | null
          legal_name: string | null
          line_id: string | null
          line_qr: string | null
          logo_url: string | null
          management: string | null
          manager: string | null
          marital_status: string | null
          market_band: string | null
          max_discount_allowed: string | null
          messaging_channels: Json | null
          messenger_id: string | null
          messenger_qr: string | null
          middle_name: string | null
          mobile: string | null
          moq: string | null
          nationality: string | null
          nationality_code: string | null
          notes: string | null
          nps_score: string | null
          number_of_children: string | null
          origin_country: string | null
          origin_country_code: string | null
          outstanding_balance: string | null
          overdue_balance: string | null
          passport_doc_path: string | null
          passport_expiry_date: string | null
          passport_issue_date: string | null
          passport_issuing_authority: string | null
          passport_mrz: string | null
          passport_no: string | null
          payment_info: string | null
          payment_terms: string | null
          pep_status: boolean | null
          person_id: string | null
          phone: string | null
          phones: Json | null
          photo_url: string | null
          place_of_birth: string | null
          port_of_entry: string | null
          position: string | null
          preferred_carriers: string[] | null
          preferred_payment_method: string | null
          preferred_shipping: string | null
          price_list_tier: string | null
          price_sensitivity: string | null
          private_address: string | null
          private_email: string | null
          private_phone: string | null
          product_categories: Json | null
          province: string | null
          province_code: string | null
          qq_id: string | null
          qq_qr: string | null
          quality_issues: Json | null
          quality_notes: string | null
          quality_sensitivity: string | null
          rating: number | null
          readiness_milestone: number
          referred_by: string | null
          registration_country: string | null
          registration_date: string | null
          related_names: Json | null
          relationship_stage: string | null
          reliability_score: string | null
          resume_lines: Json | null
          risk_score: string | null
          sales_rep: string | null
          sample_status: string | null
          sample_turnaround_days: number | null
          sanctions_check_date: string | null
          sanctions_check_status: string | null
          shipping_addresses: Json | null
          shipping_marks: string | null
          skype_id: string | null
          skype_qr: string | null
          social_profiles: Json | null
          source: string | null
          source_details: string | null
          special_pricing_agreement: boolean | null
          ssn_no: string | null
          strategic_account: boolean | null
          strategic_status: string | null
          strategic_status_reason: string | null
          strategic_status_since: string | null
          sub_industry: string | null
          supplier_address: string | null
          supplier_address_cn: string | null
          supplier_email: string | null
          supplier_mobile: string | null
          supplier_postal_code: string | null
          supplier_profile_url: string | null
          supplier_tel: string | null
          supplier_type: string | null
          supplier_website: string | null
          support_tier: string | null
          supports_oem_branding: boolean | null
          supports_packaging_customization: boolean | null
          supports_samples: boolean | null
          supports_spare_parts: boolean | null
          tags: Json | null
          tax_id: string | null
          telegram_id: string | null
          telegram_qr: string | null
          tenant_id: string
          territory: string | null
          title: string | null
          total_purchases: string | null
          total_revenue: string | null
          trading_name: string | null
          updated_at: string
          vip_status: boolean | null
          visa_documents: Json | null
          visa_no: string | null
          website: string | null
          website_qr: string | null
          websites: Json | null
          wechat_group_members: string | null
          wechat_group_name: string | null
          wechat_id: string | null
          wechat_official_account: string | null
          wechat_official_account_qr: string | null
          wechat_pay_id: string | null
          wechat_pay_qr: string | null
          wechat_qr: string | null
          wechat_sales_group_available: boolean | null
          wecom_support_available: boolean | null
          whatsapp_business: string | null
          whatsapp_qr: string | null
          work_address: string | null
          work_email: string | null
          work_location: string | null
          work_mobile: string | null
          work_permit: string | null
          work_tel: string | null
          year_established: string | null
        }
        Insert: {
          account_manager?: string | null
          additional_company_names?: Json | null
          address_1?: string | null
          address_2?: string | null
          addresses?: Json | null
          alipay_id?: string | null
          alipay_qr?: string | null
          aml_status?: string | null
          annual_revenue_range?: string | null
          assigned_branch?: string | null
          attachments?: Json | null
          backup_account_manager?: string | null
          backup_supplier_name?: string | null
          bank_accounts?: Json | null
          birthday?: string | null
          blacklist_reason?: string | null
          brand_names?: Json | null
          business_card_back?: string | null
          business_card_front?: string | null
          business_hours_end?: string | null
          business_hours_start?: string | null
          business_license_image?: string | null
          business_registration_number?: string | null
          business_timezone?: string | null
          buying_behavior?: string | null
          catalogues?: Json | null
          categories?: string[] | null
          category?: string | null
          certificate_level?: string | null
          certifications?: Json | null
          certifications_required?: string[] | null
          churn_risk?: string | null
          city?: string | null
          commercial_role?: string | null
          commission_rate?: string | null
          communication_preference?: string | null
          company?: string | null
          company_name?: string | null
          company_name_cn?: string | null
          company_name_en?: string | null
          company_type?: string | null
          contact_persons?: Json | null
          contact_type?: string | null
          container_preference?: string | null
          contract_pricing_expiry?: string | null
          country?: string | null
          country_code?: string | null
          cr_number?: string | null
          created_at?: string
          credit_insurance_coverage?: string | null
          credit_insurance_covered?: boolean | null
          credit_insurance_provider?: string | null
          credit_limit?: string | null
          credit_limit_approved_by?: string | null
          credit_limit_approved_date?: string | null
          credit_rating_external?: string | null
          credit_rating_internal?: string | null
          currency?: string | null
          custom_fields?: Json | null
          customer_health_score?: string | null
          customer_level_assigned_date?: string | null
          customer_level_review_date?: string | null
          customer_type?: string | null
          customs_broker?: string | null
          customs_code?: string | null
          days_sales_outstanding?: string | null
          department?: string | null
          dingtalk_id?: string | null
          dingtalk_qr?: string | null
          display_name: string
          division?: string | null
          documents?: Json | null
          duns_number?: string | null
          ecatalog_qr?: string | null
          ecatalog_url?: string | null
          email?: string | null
          emails?: Json | null
          emergency_contacts?: Json | null
          employee_bank_account?: string | null
          employee_count_range?: string | null
          entity_type: string
          eori_number?: string | null
          exclusivity?: string | null
          exclusivity_expiry?: string | null
          exclusivity_scope?: string | null
          factory_visit_date?: string | null
          family_members?: Json | null
          field_of_study?: string | null
          first_contact_date?: string | null
          first_name?: string | null
          flags?: string[] | null
          follow_up_date?: string | null
          freight_forwarder?: string | null
          full_name?: string | null
          gender?: string | null
          gst_number?: string | null
          high_risk_country?: boolean | null
          home_work_distance?: string | null
          hs_codes?: string[] | null
          id?: string
          id_no?: string | null
          importer_exporter_code?: string | null
          incoterms?: string | null
          industry?: string | null
          internal_notes?: string | null
          is_active?: boolean
          job_position?: string | null
          job_title?: string | null
          kyc_review_due_date?: string | null
          kyc_status?: string | null
          kyc_verified_by?: string | null
          kyc_verified_date?: string | null
          labeling_requirements?: string | null
          language?: string | null
          last_contacted?: string | null
          last_name?: string | null
          last_order_date?: string | null
          last_quality_issue?: string | null
          lead_time?: string | null
          legal_name?: string | null
          line_id?: string | null
          line_qr?: string | null
          logo_url?: string | null
          management?: string | null
          manager?: string | null
          marital_status?: string | null
          market_band?: string | null
          max_discount_allowed?: string | null
          messaging_channels?: Json | null
          messenger_id?: string | null
          messenger_qr?: string | null
          middle_name?: string | null
          mobile?: string | null
          moq?: string | null
          nationality?: string | null
          nationality_code?: string | null
          notes?: string | null
          nps_score?: string | null
          number_of_children?: string | null
          origin_country?: string | null
          origin_country_code?: string | null
          outstanding_balance?: string | null
          overdue_balance?: string | null
          passport_doc_path?: string | null
          passport_expiry_date?: string | null
          passport_issue_date?: string | null
          passport_issuing_authority?: string | null
          passport_mrz?: string | null
          passport_no?: string | null
          payment_info?: string | null
          payment_terms?: string | null
          pep_status?: boolean | null
          person_id?: string | null
          phone?: string | null
          phones?: Json | null
          photo_url?: string | null
          place_of_birth?: string | null
          port_of_entry?: string | null
          position?: string | null
          preferred_carriers?: string[] | null
          preferred_payment_method?: string | null
          preferred_shipping?: string | null
          price_list_tier?: string | null
          price_sensitivity?: string | null
          private_address?: string | null
          private_email?: string | null
          private_phone?: string | null
          product_categories?: Json | null
          province?: string | null
          province_code?: string | null
          qq_id?: string | null
          qq_qr?: string | null
          quality_issues?: Json | null
          quality_notes?: string | null
          quality_sensitivity?: string | null
          rating?: number | null
          readiness_milestone?: number
          referred_by?: string | null
          registration_country?: string | null
          registration_date?: string | null
          related_names?: Json | null
          relationship_stage?: string | null
          reliability_score?: string | null
          resume_lines?: Json | null
          risk_score?: string | null
          sales_rep?: string | null
          sample_status?: string | null
          sample_turnaround_days?: number | null
          sanctions_check_date?: string | null
          sanctions_check_status?: string | null
          shipping_addresses?: Json | null
          shipping_marks?: string | null
          skype_id?: string | null
          skype_qr?: string | null
          social_profiles?: Json | null
          source?: string | null
          source_details?: string | null
          special_pricing_agreement?: boolean | null
          ssn_no?: string | null
          strategic_account?: boolean | null
          strategic_status?: string | null
          strategic_status_reason?: string | null
          strategic_status_since?: string | null
          sub_industry?: string | null
          supplier_address?: string | null
          supplier_address_cn?: string | null
          supplier_email?: string | null
          supplier_mobile?: string | null
          supplier_postal_code?: string | null
          supplier_profile_url?: string | null
          supplier_tel?: string | null
          supplier_type?: string | null
          supplier_website?: string | null
          support_tier?: string | null
          supports_oem_branding?: boolean | null
          supports_packaging_customization?: boolean | null
          supports_samples?: boolean | null
          supports_spare_parts?: boolean | null
          tags?: Json | null
          tax_id?: string | null
          telegram_id?: string | null
          telegram_qr?: string | null
          tenant_id?: string
          territory?: string | null
          title?: string | null
          total_purchases?: string | null
          total_revenue?: string | null
          trading_name?: string | null
          updated_at?: string
          vip_status?: boolean | null
          visa_documents?: Json | null
          visa_no?: string | null
          website?: string | null
          website_qr?: string | null
          websites?: Json | null
          wechat_group_members?: string | null
          wechat_group_name?: string | null
          wechat_id?: string | null
          wechat_official_account?: string | null
          wechat_official_account_qr?: string | null
          wechat_pay_id?: string | null
          wechat_pay_qr?: string | null
          wechat_qr?: string | null
          wechat_sales_group_available?: boolean | null
          wecom_support_available?: boolean | null
          whatsapp_business?: string | null
          whatsapp_qr?: string | null
          work_address?: string | null
          work_email?: string | null
          work_location?: string | null
          work_mobile?: string | null
          work_permit?: string | null
          work_tel?: string | null
          year_established?: string | null
        }
        Update: {
          account_manager?: string | null
          additional_company_names?: Json | null
          address_1?: string | null
          address_2?: string | null
          addresses?: Json | null
          alipay_id?: string | null
          alipay_qr?: string | null
          aml_status?: string | null
          annual_revenue_range?: string | null
          assigned_branch?: string | null
          attachments?: Json | null
          backup_account_manager?: string | null
          backup_supplier_name?: string | null
          bank_accounts?: Json | null
          birthday?: string | null
          blacklist_reason?: string | null
          brand_names?: Json | null
          business_card_back?: string | null
          business_card_front?: string | null
          business_hours_end?: string | null
          business_hours_start?: string | null
          business_license_image?: string | null
          business_registration_number?: string | null
          business_timezone?: string | null
          buying_behavior?: string | null
          catalogues?: Json | null
          categories?: string[] | null
          category?: string | null
          certificate_level?: string | null
          certifications?: Json | null
          certifications_required?: string[] | null
          churn_risk?: string | null
          city?: string | null
          commercial_role?: string | null
          commission_rate?: string | null
          communication_preference?: string | null
          company?: string | null
          company_name?: string | null
          company_name_cn?: string | null
          company_name_en?: string | null
          company_type?: string | null
          contact_persons?: Json | null
          contact_type?: string | null
          container_preference?: string | null
          contract_pricing_expiry?: string | null
          country?: string | null
          country_code?: string | null
          cr_number?: string | null
          created_at?: string
          credit_insurance_coverage?: string | null
          credit_insurance_covered?: boolean | null
          credit_insurance_provider?: string | null
          credit_limit?: string | null
          credit_limit_approved_by?: string | null
          credit_limit_approved_date?: string | null
          credit_rating_external?: string | null
          credit_rating_internal?: string | null
          currency?: string | null
          custom_fields?: Json | null
          customer_health_score?: string | null
          customer_level_assigned_date?: string | null
          customer_level_review_date?: string | null
          customer_type?: string | null
          customs_broker?: string | null
          customs_code?: string | null
          days_sales_outstanding?: string | null
          department?: string | null
          dingtalk_id?: string | null
          dingtalk_qr?: string | null
          display_name?: string
          division?: string | null
          documents?: Json | null
          duns_number?: string | null
          ecatalog_qr?: string | null
          ecatalog_url?: string | null
          email?: string | null
          emails?: Json | null
          emergency_contacts?: Json | null
          employee_bank_account?: string | null
          employee_count_range?: string | null
          entity_type?: string
          eori_number?: string | null
          exclusivity?: string | null
          exclusivity_expiry?: string | null
          exclusivity_scope?: string | null
          factory_visit_date?: string | null
          family_members?: Json | null
          field_of_study?: string | null
          first_contact_date?: string | null
          first_name?: string | null
          flags?: string[] | null
          follow_up_date?: string | null
          freight_forwarder?: string | null
          full_name?: string | null
          gender?: string | null
          gst_number?: string | null
          high_risk_country?: boolean | null
          home_work_distance?: string | null
          hs_codes?: string[] | null
          id?: string
          id_no?: string | null
          importer_exporter_code?: string | null
          incoterms?: string | null
          industry?: string | null
          internal_notes?: string | null
          is_active?: boolean
          job_position?: string | null
          job_title?: string | null
          kyc_review_due_date?: string | null
          kyc_status?: string | null
          kyc_verified_by?: string | null
          kyc_verified_date?: string | null
          labeling_requirements?: string | null
          language?: string | null
          last_contacted?: string | null
          last_name?: string | null
          last_order_date?: string | null
          last_quality_issue?: string | null
          lead_time?: string | null
          legal_name?: string | null
          line_id?: string | null
          line_qr?: string | null
          logo_url?: string | null
          management?: string | null
          manager?: string | null
          marital_status?: string | null
          market_band?: string | null
          max_discount_allowed?: string | null
          messaging_channels?: Json | null
          messenger_id?: string | null
          messenger_qr?: string | null
          middle_name?: string | null
          mobile?: string | null
          moq?: string | null
          nationality?: string | null
          nationality_code?: string | null
          notes?: string | null
          nps_score?: string | null
          number_of_children?: string | null
          origin_country?: string | null
          origin_country_code?: string | null
          outstanding_balance?: string | null
          overdue_balance?: string | null
          passport_doc_path?: string | null
          passport_expiry_date?: string | null
          passport_issue_date?: string | null
          passport_issuing_authority?: string | null
          passport_mrz?: string | null
          passport_no?: string | null
          payment_info?: string | null
          payment_terms?: string | null
          pep_status?: boolean | null
          person_id?: string | null
          phone?: string | null
          phones?: Json | null
          photo_url?: string | null
          place_of_birth?: string | null
          port_of_entry?: string | null
          position?: string | null
          preferred_carriers?: string[] | null
          preferred_payment_method?: string | null
          preferred_shipping?: string | null
          price_list_tier?: string | null
          price_sensitivity?: string | null
          private_address?: string | null
          private_email?: string | null
          private_phone?: string | null
          product_categories?: Json | null
          province?: string | null
          province_code?: string | null
          qq_id?: string | null
          qq_qr?: string | null
          quality_issues?: Json | null
          quality_notes?: string | null
          quality_sensitivity?: string | null
          rating?: number | null
          readiness_milestone?: number
          referred_by?: string | null
          registration_country?: string | null
          registration_date?: string | null
          related_names?: Json | null
          relationship_stage?: string | null
          reliability_score?: string | null
          resume_lines?: Json | null
          risk_score?: string | null
          sales_rep?: string | null
          sample_status?: string | null
          sample_turnaround_days?: number | null
          sanctions_check_date?: string | null
          sanctions_check_status?: string | null
          shipping_addresses?: Json | null
          shipping_marks?: string | null
          skype_id?: string | null
          skype_qr?: string | null
          social_profiles?: Json | null
          source?: string | null
          source_details?: string | null
          special_pricing_agreement?: boolean | null
          ssn_no?: string | null
          strategic_account?: boolean | null
          strategic_status?: string | null
          strategic_status_reason?: string | null
          strategic_status_since?: string | null
          sub_industry?: string | null
          supplier_address?: string | null
          supplier_address_cn?: string | null
          supplier_email?: string | null
          supplier_mobile?: string | null
          supplier_postal_code?: string | null
          supplier_profile_url?: string | null
          supplier_tel?: string | null
          supplier_type?: string | null
          supplier_website?: string | null
          support_tier?: string | null
          supports_oem_branding?: boolean | null
          supports_packaging_customization?: boolean | null
          supports_samples?: boolean | null
          supports_spare_parts?: boolean | null
          tags?: Json | null
          tax_id?: string | null
          telegram_id?: string | null
          telegram_qr?: string | null
          tenant_id?: string
          territory?: string | null
          title?: string | null
          total_purchases?: string | null
          total_revenue?: string | null
          trading_name?: string | null
          updated_at?: string
          vip_status?: boolean | null
          visa_documents?: Json | null
          visa_no?: string | null
          website?: string | null
          website_qr?: string | null
          websites?: Json | null
          wechat_group_members?: string | null
          wechat_group_name?: string | null
          wechat_id?: string | null
          wechat_official_account?: string | null
          wechat_official_account_qr?: string | null
          wechat_pay_id?: string | null
          wechat_pay_qr?: string | null
          wechat_qr?: string | null
          wechat_sales_group_available?: boolean | null
          wecom_support_available?: boolean | null
          whatsapp_business?: string | null
          whatsapp_qr?: string | null
          work_address?: string | null
          work_email?: string | null
          work_location?: string | null
          work_mobile?: string | null
          work_permit?: string | null
          work_tel?: string | null
          year_established?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_activities: {
        Row: {
          assignee_account_id: string | null
          created_at: string
          created_by_account_id: string | null
          done_at: string | null
          due_at: string | null
          id: string
          notes: string | null
          opportunity_id: string
          tenant_id: string | null
          title: string
          type: string
        }
        Insert: {
          assignee_account_id?: string | null
          created_at?: string
          created_by_account_id?: string | null
          done_at?: string | null
          due_at?: string | null
          id?: string
          notes?: string | null
          opportunity_id: string
          tenant_id?: string | null
          title: string
          type?: string
        }
        Update: {
          assignee_account_id?: string | null
          created_at?: string
          created_by_account_id?: string | null
          done_at?: string | null
          due_at?: string | null
          id?: string
          notes?: string | null
          opportunity_id?: string
          tenant_id?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_activities_assignee_account_id_fkey"
            columns: ["assignee_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_created_by_account_id_fkey"
            columns: ["created_by_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "crm_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_opportunities: {
        Row: {
          archived_at: string | null
          color: number
          company_name: string | null
          contact_id: string | null
          contact_name: string | null
          created_at: string
          description: string | null
          email: string | null
          expected_close_date: string | null
          expected_revenue: number
          id: string
          lost_at: string | null
          lost_reason: string | null
          name: string
          owner_account_id: string | null
          phone: string | null
          priority: number
          probability: number
          source: string | null
          stage_id: string | null
          tags: string[]
          tenant_id: string
          updated_at: string
          won_at: string | null
        }
        Insert: {
          archived_at?: string | null
          color?: number
          company_name?: string | null
          contact_id?: string | null
          contact_name?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          expected_close_date?: string | null
          expected_revenue?: number
          id?: string
          lost_at?: string | null
          lost_reason?: string | null
          name: string
          owner_account_id?: string | null
          phone?: string | null
          priority?: number
          probability?: number
          source?: string | null
          stage_id?: string | null
          tags?: string[]
          tenant_id?: string
          updated_at?: string
          won_at?: string | null
        }
        Update: {
          archived_at?: string | null
          color?: number
          company_name?: string | null
          contact_id?: string | null
          contact_name?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          expected_close_date?: string | null
          expected_revenue?: number
          id?: string
          lost_at?: string | null
          lost_reason?: string | null
          name?: string
          owner_account_id?: string | null
          phone?: string | null
          priority?: number
          probability?: number
          source?: string | null
          stage_id?: string | null
          tags?: string[]
          tenant_id?: string
          updated_at?: string
          won_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_opportunities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_opportunities_owner_account_id_fkey"
            columns: ["owner_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_opportunities_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "crm_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_opportunities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_stages: {
        Row: {
          created_at: string
          fold: boolean
          id: string
          is_won: boolean
          name: string
          sequence: number
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          fold?: boolean
          id?: string
          is_won?: boolean
          name: string
          sequence?: number
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          fold?: boolean
          id?: string
          is_won?: boolean
          name?: string
          sequence?: number
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_stages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_code_sequences: {
        Row: {
          country_code: string
          next_value: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          country_code: string
          next_value?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          country_code?: string
          next_value?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      customer_credit_profiles: {
        Row: {
          available_credit: number | null
          buyer_risk_score: number | null
          contact_id: string
          created_at: string | null
          credit_currency: string | null
          credit_limit_amount: number | null
          default_payment_term_id: string | null
          exporter_risk_score: number | null
          external_credit_rating: string | null
          id: string
          internal_credit_rating: string | null
          notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          available_credit?: number | null
          buyer_risk_score?: number | null
          contact_id: string
          created_at?: string | null
          credit_currency?: string | null
          credit_limit_amount?: number | null
          default_payment_term_id?: string | null
          exporter_risk_score?: number | null
          external_credit_rating?: string | null
          id?: string
          internal_credit_rating?: string | null
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          available_credit?: number | null
          buyer_risk_score?: number | null
          contact_id?: string
          created_at?: string | null
          credit_currency?: string | null
          credit_limit_amount?: number | null
          default_payment_term_id?: string | null
          exporter_risk_score?: number | null
          external_credit_rating?: string | null
          id?: string
          internal_credit_rating?: string | null
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_credit_profiles_default_payment_term_id_fkey"
            columns: ["default_payment_term_id"]
            isOneToOne: false
            referencedRelation: "payment_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_payment_history: {
        Row: {
          amount: number
          contact_id: string
          created_at: string | null
          currency: string | null
          days_late: number | null
          due_on: string | null
          id: string
          invoice_id: string | null
          notes: string | null
          paid_on: string
          payment_method: string | null
          reference: string | null
          tenant_id: string
        }
        Insert: {
          amount: number
          contact_id: string
          created_at?: string | null
          currency?: string | null
          days_late?: number | null
          due_on?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          paid_on: string
          payment_method?: string | null
          reference?: string | null
          tenant_id: string
        }
        Update: {
          amount?: number
          contact_id?: string
          created_at?: string | null
          currency?: string | null
          days_late?: number | null
          due_on?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          paid_on?: string
          payment_method?: string | null
          reference?: string | null
          tenant_id?: string
        }
        Relationships: []
      }
      customer_price_overrides: {
        Row: {
          customer_id: string
          id: string
          price: number
          product_id: string
        }
        Insert: {
          customer_id: string
          id?: string
          price: number
          product_id: string
        }
        Update: {
          customer_id?: string
          id?: string
          price?: number
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_price_overrides_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_pricing: {
        Row: {
          customer_id: string
          price_list_id: string | null
        }
        Insert: {
          customer_id: string
          price_list_id?: string | null
        }
        Update: {
          customer_id?: string
          price_list_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_pricing_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_pricing_price_list_id_fkey"
            columns: ["price_list_id"]
            isOneToOne: false
            referencedRelation: "price_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_users: {
        Row: {
          created_at: string
          customer_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_users_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          assigned_salesperson: string | null
          city: string | null
          city_id: string | null
          company_name: string | null
          contact_id: string | null
          country: string | null
          created_at: string
          currency_code: string | null
          customer_code: string | null
          customer_type: string | null
          email: string | null
          id: string
          is_active: boolean
          last_contact_date: string | null
          market_id: string | null
          mobile: string | null
          name: string
          next_followup_date: string | null
          notes: string | null
          payment_terms: string | null
          phone: string | null
          port_id: string | null
          preferred_pricing_tier: string | null
          status: string | null
          tags: string | null
          tenant_id: string | null
          updated_at: string | null
          website: string | null
          wechat: string | null
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          assigned_salesperson?: string | null
          city?: string | null
          city_id?: string | null
          company_name?: string | null
          contact_id?: string | null
          country?: string | null
          created_at?: string
          currency_code?: string | null
          customer_code?: string | null
          customer_type?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          last_contact_date?: string | null
          market_id?: string | null
          mobile?: string | null
          name: string
          next_followup_date?: string | null
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          port_id?: string | null
          preferred_pricing_tier?: string | null
          status?: string | null
          tags?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          website?: string | null
          wechat?: string | null
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          assigned_salesperson?: string | null
          city?: string | null
          city_id?: string | null
          company_name?: string | null
          contact_id?: string | null
          country?: string | null
          created_at?: string
          currency_code?: string | null
          customer_code?: string | null
          customer_type?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          last_contact_date?: string | null
          market_id?: string | null
          mobile?: string | null
          name?: string
          next_followup_date?: string | null
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          port_id?: string | null
          preferred_pricing_tier?: string | null
          status?: string | null
          tags?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          website?: string | null
          wechat?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "market_cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_port_id_fkey"
            columns: ["port_id"]
            isOneToOne: false
            referencedRelation: "market_ports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_customers_market"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
        ]
      }
      design_dna_patterns: {
        Row: {
          approved: boolean
          category: string | null
          created_at: string
          description: string | null
          example_asset_ids: string[]
          id: string
          pattern_name: string
          pattern_vector: Json
          profile_id: string
          tenant_id: string
        }
        Insert: {
          approved?: boolean
          category?: string | null
          created_at?: string
          description?: string | null
          example_asset_ids?: string[]
          id?: string
          pattern_name: string
          pattern_vector?: Json
          profile_id: string
          tenant_id: string
        }
        Update: {
          approved?: boolean
          category?: string | null
          created_at?: string
          description?: string | null
          example_asset_ids?: string[]
          id?: string
          pattern_name?: string
          pattern_vector?: Json
          profile_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "design_dna_patterns_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "design_dna_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_dna_patterns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      design_dna_profiles: {
        Row: {
          code: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          profile_type: string
          slug: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          profile_type?: string
          slug: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          profile_type?: string
          slug?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "design_dna_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      design_dna_rules: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          profile_id: string
          rule_group: string
          rule_name: string
          rule_type: string
          target_value: string | null
          tenant_id: string
          tolerance: number | null
          weight: number
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          profile_id: string
          rule_group: string
          rule_name: string
          rule_type?: string
          target_value?: string | null
          tenant_id: string
          tolerance?: number | null
          weight?: number
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          profile_id?: string
          rule_group?: string
          rule_name?: string
          rule_type?: string
          target_value?: string | null
          tenant_id?: string
          tolerance?: number | null
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "design_dna_rules_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "design_dna_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_dna_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      discuss_channels: {
        Row: {
          archived_at: string | null
          color: string | null
          created_at: string
          created_by: string | null
          description: string | null
          icon: string | null
          id: string
          kind: string
          last_message_at: string
          linked_contact_id: string | null
          linked_project_id: string | null
          name: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          kind: string
          last_message_at?: string
          linked_contact_id?: string | null
          linked_project_id?: string | null
          name?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          kind?: string
          last_message_at?: string
          linked_contact_id?: string | null
          linked_project_id?: string | null
          name?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "discuss_channels_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discuss_channels_linked_contact_id_fkey"
            columns: ["linked_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discuss_channels_linked_project_id_fkey"
            columns: ["linked_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discuss_channels_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      discuss_drafts: {
        Row: {
          account_id: string
          body: string
          channel_id: string
          id: string
          metadata: Json
          updated_at: string
        }
        Insert: {
          account_id: string
          body?: string
          channel_id: string
          id?: string
          metadata?: Json
          updated_at?: string
        }
        Update: {
          account_id?: string
          body?: string
          channel_id?: string
          id?: string
          metadata?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "discuss_drafts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discuss_drafts_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "discuss_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      discuss_members: {
        Row: {
          account_id: string
          channel_id: string
          hidden_at: string | null
          id: string
          joined_at: string
          last_read_at: string
          left_at: string | null
          marked_unread: boolean
          muted: boolean
          notification_pref: string
          pinned_at: string | null
          role: string
        }
        Insert: {
          account_id: string
          channel_id: string
          hidden_at?: string | null
          id?: string
          joined_at?: string
          last_read_at?: string
          left_at?: string | null
          marked_unread?: boolean
          muted?: boolean
          notification_pref?: string
          pinned_at?: string | null
          role?: string
        }
        Update: {
          account_id?: string
          channel_id?: string
          hidden_at?: string | null
          id?: string
          joined_at?: string
          last_read_at?: string
          left_at?: string | null
          marked_unread?: boolean
          muted?: boolean
          notification_pref?: string
          pinned_at?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "discuss_members_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discuss_members_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "discuss_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      discuss_messages: {
        Row: {
          author_account_id: string | null
          body: string | null
          body_html: string | null
          channel_id: string
          client_msg_id: string | null
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          kind: string
          metadata: Json
          reply_to_message_id: string | null
        }
        Insert: {
          author_account_id?: string | null
          body?: string | null
          body_html?: string | null
          channel_id: string
          client_msg_id?: string | null
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          kind?: string
          metadata?: Json
          reply_to_message_id?: string | null
        }
        Update: {
          author_account_id?: string | null
          body?: string | null
          body_html?: string | null
          channel_id?: string
          client_msg_id?: string | null
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          kind?: string
          metadata?: Json
          reply_to_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discuss_messages_author_account_id_fkey"
            columns: ["author_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discuss_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "discuss_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discuss_messages_reply_to_message_id_fkey"
            columns: ["reply_to_message_id"]
            isOneToOne: false
            referencedRelation: "discuss_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      discuss_pending_uploads: {
        Row: {
          account_id: string
          bucket: string
          created_at: string
          path: string
          tenant_id: string
        }
        Insert: {
          account_id: string
          bucket: string
          created_at?: string
          path: string
          tenant_id: string
        }
        Update: {
          account_id?: string
          bucket?: string
          created_at?: string
          path?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discuss_pending_uploads_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      discuss_pinned: {
        Row: {
          channel_id: string
          id: string
          message_id: string
          pinned_at: string
          pinned_by: string | null
        }
        Insert: {
          channel_id: string
          id?: string
          message_id: string
          pinned_at?: string
          pinned_by?: string | null
        }
        Update: {
          channel_id?: string
          id?: string
          message_id?: string
          pinned_at?: string
          pinned_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discuss_pinned_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "discuss_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discuss_pinned_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "discuss_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discuss_pinned_pinned_by_fkey"
            columns: ["pinned_by"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      discuss_reactions: {
        Row: {
          account_id: string
          created_at: string
          emoji: string
          id: string
          message_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          emoji: string
          id?: string
          message_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discuss_reactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discuss_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "discuss_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      discuss_starred: {
        Row: {
          account_id: string
          id: string
          message_id: string
          starred_at: string
        }
        Insert: {
          account_id: string
          id?: string
          message_id: string
          starred_at?: string
        }
        Update: {
          account_id?: string
          id?: string
          message_id?: string
          starred_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "discuss_starred_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discuss_starred_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "discuss_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      divisions: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          name_ar: string | null
          name_zh: string | null
          order: number
          slug: string
          tagline: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          name_ar?: string | null
          name_zh?: string | null
          order?: number
          slug: string
          tagline?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          name_ar?: string | null
          name_zh?: string | null
          order?: number
          slug?: string
          tagline?: string | null
        }
        Relationships: []
      }
      doc_sequences: {
        Row: {
          next_value: number
          scope: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          next_value?: number
          scope?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          next_value?: number
          scope?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      document_titles: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          doc_family: string
          id: string
          is_active: boolean
          is_default: boolean
          is_system: boolean
          label_ar: string | null
          label_en: string
          label_zh: string | null
          meta_noun: string | null
          notes: string | null
          shows_validity: boolean
          sort_order: number
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          doc_family?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          is_system?: boolean
          label_ar?: string | null
          label_en: string
          label_zh?: string | null
          meta_noun?: string | null
          notes?: string | null
          shows_validity?: boolean
          sort_order?: number
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          doc_family?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          is_system?: boolean
          label_ar?: string | null
          label_en?: string
          label_zh?: string | null
          meta_noun?: string | null
          notes?: string | null
          shows_validity?: boolean
          sort_order?: number
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_titles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_titles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string | null
          customer_id: string | null
          deal_no: number | null
          doc: Json
          doc_kind: string
          doc_no: string | null
          due_date: string | null
          id: string
          issue_date: string | null
          order_id: string | null
          status: string
          tenant_id: string
          title: string | null
          total: number
          updated_at: string
          updated_by: string | null
          updated_by_name: string | null
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string | null
          customer_id?: string | null
          deal_no?: number | null
          doc?: Json
          doc_kind: string
          doc_no?: string | null
          due_date?: string | null
          id?: string
          issue_date?: string | null
          order_id?: string | null
          status?: string
          tenant_id: string
          title?: string | null
          total?: number
          updated_at?: string
          updated_by?: string | null
          updated_by_name?: string | null
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string | null
          customer_id?: string | null
          deal_no?: number | null
          doc?: Json
          doc_kind?: string
          doc_no?: string | null
          due_date?: string | null
          id?: string
          issue_date?: string | null
          order_id?: string | null
          status?: string
          tenant_id?: string
          title?: string | null
          total?: number
          updated_at?: string
          updated_by?: string | null
          updated_by_name?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "documents_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      elements: {
        Row: {
          content: Json | null
          created_at: string | null
          id: string
          order: number
          section_id: string
          settings: Json | null
          style: Json | null
          type: string
          updated_at: string | null
          visible: boolean
        }
        Insert: {
          content?: Json | null
          created_at?: string | null
          id?: string
          order?: number
          section_id: string
          settings?: Json | null
          style?: Json | null
          type?: string
          updated_at?: string | null
          visible?: boolean
        }
        Update: {
          content?: Json | null
          created_at?: string | null
          id?: string
          order?: number
          section_id?: string
          settings?: Json | null
          style?: Json | null
          type?: string
          updated_at?: string | null
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "elements_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_behavior_assessment_items: {
        Row: {
          assessment_id: string
          behavior_indicator_id: string
          comment: string | null
          created_at: string
          critical_snapshot: boolean
          employee_score: number | null
          evidence: string | null
          id: string
          mandatory_snapshot: boolean
          required_score_snapshot: number | null
          source: string
          tenant_id: string
          updated_at: string
          weight_snapshot: number | null
        }
        Insert: {
          assessment_id: string
          behavior_indicator_id: string
          comment?: string | null
          created_at?: string
          critical_snapshot?: boolean
          employee_score?: number | null
          evidence?: string | null
          id?: string
          mandatory_snapshot?: boolean
          required_score_snapshot?: number | null
          source?: string
          tenant_id: string
          updated_at?: string
          weight_snapshot?: number | null
        }
        Update: {
          assessment_id?: string
          behavior_indicator_id?: string
          comment?: string | null
          created_at?: string
          critical_snapshot?: boolean
          employee_score?: number | null
          evidence?: string | null
          id?: string
          mandatory_snapshot?: boolean
          required_score_snapshot?: number | null
          source?: string
          tenant_id?: string
          updated_at?: string
          weight_snapshot?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_behavior_assessment_items_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "employee_behavior_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_behavior_assessment_items_behavior_indicator_id_fkey"
            columns: ["behavior_indicator_id"]
            isOneToOne: false
            referencedRelation: "behavior_indicators"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_behavior_assessments: {
        Row: {
          assessed_by: string | null
          assessment_period_end: string | null
          assessment_period_start: string | null
          assessment_type: string
          created_at: string
          critical_gap_count: number | null
          employee_id: string
          finalized_at: string | null
          id: string
          overall_behavior_score: number | null
          position_behavior_match: number | null
          position_id_at_assessment: string | null
          recommendation: string | null
          review_date: string | null
          reviewed_by: string | null
          status: string
          summary: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          assessed_by?: string | null
          assessment_period_end?: string | null
          assessment_period_start?: string | null
          assessment_type?: string
          created_at?: string
          critical_gap_count?: number | null
          employee_id: string
          finalized_at?: string | null
          id?: string
          overall_behavior_score?: number | null
          position_behavior_match?: number | null
          position_id_at_assessment?: string | null
          recommendation?: string | null
          review_date?: string | null
          reviewed_by?: string | null
          status?: string
          summary?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          assessed_by?: string | null
          assessment_period_end?: string | null
          assessment_period_start?: string | null
          assessment_type?: string
          created_at?: string
          critical_gap_count?: number | null
          employee_id?: string
          finalized_at?: string | null
          id?: string
          overall_behavior_score?: number | null
          position_behavior_match?: number | null
          position_id_at_assessment?: string | null
          recommendation?: string | null
          review_date?: string | null
          reviewed_by?: string | null
          status?: string
          summary?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_behavior_assessments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "koleex_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_skill_assessments: {
        Row: {
          created_at: string
          employee_id: string
          employee_score: number | null
          id: string
          is_verified: boolean
          last_assessed_at: string | null
          notes: string | null
          skill_id: string
          source: string
          tenant_id: string
          updated_at: string
          verified_at: string | null
          verified_by: string | null
          years_of_experience: number | null
        }
        Insert: {
          created_at?: string
          employee_id: string
          employee_score?: number | null
          id?: string
          is_verified?: boolean
          last_assessed_at?: string | null
          notes?: string | null
          skill_id: string
          source?: string
          tenant_id: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
          years_of_experience?: number | null
        }
        Update: {
          created_at?: string
          employee_id?: string
          employee_score?: number | null
          id?: string
          is_verified?: boolean
          last_assessed_at?: string | null
          notes?: string | null
          skill_id?: string
          source?: string
          tenant_id?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
          years_of_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_skill_assessments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "koleex_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_skill_assessments_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_skill_history: {
        Row: {
          employee_id: string
          employee_score: number | null
          id: string
          recorded_at: string
          recorded_by: string | null
          skill_id: string
          tenant_id: string
        }
        Insert: {
          employee_id: string
          employee_score?: number | null
          id?: string
          recorded_at?: string
          recorded_by?: string | null
          skill_id: string
          tenant_id: string
        }
        Update: {
          employee_id?: string
          employee_score?: number | null
          id?: string
          recorded_at?: string
          recorded_by?: string | null
          skill_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_skill_history_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "koleex_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_skill_history_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_activity_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string
          entity_kind: string
          id: string
          metadata: Json | null
          note: string | null
          tenant_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id: string
          entity_kind: string
          id?: string
          metadata?: Json | null
          note?: string | null
          tenant_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string
          entity_kind?: string
          id?: string
          metadata?: Json | null
          note?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_activity_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_activity_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_approval_history: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          amount_approved: number | null
          created_at: string
          entity_id: string
          entity_type: string
          from_status: string | null
          id: string
          metadata: Json | null
          notes: string | null
          tenant_id: string
          to_status: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          amount_approved?: number | null
          created_at?: string
          entity_id: string
          entity_type: string
          from_status?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          tenant_id: string
          to_status?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          amount_approved?: number | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          from_status?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          tenant_id?: string
          to_status?: string | null
        }
        Relationships: []
      }
      finance_assets: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          currency: string
          depreciation_method: string
          id: string
          name: string
          notes: string | null
          purchase_date: string | null
          purchase_value: number
          status: string
          tenant_id: string
          updated_at: string
          useful_life_years: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          depreciation_method?: string
          id?: string
          name: string
          notes?: string | null
          purchase_date?: string | null
          purchase_value?: number
          status?: string
          tenant_id: string
          updated_at?: string
          useful_life_years?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          depreciation_method?: string
          id?: string
          name?: string
          notes?: string | null
          purchase_date?: string | null
          purchase_value?: number
          status?: string
          tenant_id?: string
          updated_at?: string
          useful_life_years?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_assets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_attachments: {
        Row: {
          category: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          entity_id: string
          entity_type: string
          extracted_metadata: Json | null
          extracted_text: string | null
          file_hash: string | null
          file_name: string
          file_size: number
          file_type: string
          id: string
          is_primary: boolean
          notes: string | null
          ocr_status: string | null
          replaced_at: string | null
          replaced_by: string | null
          replaces_attachment_id: string | null
          storage_path: string
          tags: string[] | null
          tenant_id: string
          updated_at: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          entity_id: string
          entity_type: string
          extracted_metadata?: Json | null
          extracted_text?: string | null
          file_hash?: string | null
          file_name: string
          file_size: number
          file_type: string
          id?: string
          is_primary?: boolean
          notes?: string | null
          ocr_status?: string | null
          replaced_at?: string | null
          replaced_by?: string | null
          replaces_attachment_id?: string | null
          storage_path: string
          tags?: string[] | null
          tenant_id: string
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          entity_id?: string
          entity_type?: string
          extracted_metadata?: Json | null
          extracted_text?: string | null
          file_hash?: string | null
          file_name?: string
          file_size?: number
          file_type?: string
          id?: string
          is_primary?: boolean
          notes?: string | null
          ocr_status?: string | null
          replaced_at?: string | null
          replaced_by?: string | null
          replaces_attachment_id?: string | null
          storage_path?: string
          tags?: string[] | null
          tenant_id?: string
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_attachments_replaces_attachment_id_fkey"
            columns: ["replaces_attachment_id"]
            isOneToOne: false
            referencedRelation: "finance_attachments"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_bank_accounts: {
        Row: {
          account_name: string
          account_number: string | null
          available_balance: number
          bank_name: string
          base_amount: number | null
          base_currency: string | null
          country: string | null
          created_at: string
          created_by: string | null
          currency: string
          current_balance: number
          deleted_at: string | null
          fx_conversion_date: string | null
          fx_rate: number | null
          gl_account_id: string | null
          iban: string | null
          id: string
          is_primary: boolean
          last_reconciled_at: string | null
          metadata: Json | null
          opening_balance: number
          pending_balance: number
          restricted_balance: number
          status: string
          swift_code: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          account_name: string
          account_number?: string | null
          available_balance?: number
          bank_name: string
          base_amount?: number | null
          base_currency?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          currency: string
          current_balance?: number
          deleted_at?: string | null
          fx_conversion_date?: string | null
          fx_rate?: number | null
          gl_account_id?: string | null
          iban?: string | null
          id?: string
          is_primary?: boolean
          last_reconciled_at?: string | null
          metadata?: Json | null
          opening_balance?: number
          pending_balance?: number
          restricted_balance?: number
          status?: string
          swift_code?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          account_name?: string
          account_number?: string | null
          available_balance?: number
          bank_name?: string
          base_amount?: number | null
          base_currency?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          current_balance?: number
          deleted_at?: string | null
          fx_conversion_date?: string | null
          fx_rate?: number | null
          gl_account_id?: string | null
          iban?: string | null
          id?: string
          is_primary?: boolean
          last_reconciled_at?: string | null
          metadata?: Json | null
          opening_balance?: number
          pending_balance?: number
          restricted_balance?: number
          status?: string
          swift_code?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_bank_accounts_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "accounting_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_bank_reconciliation_sessions: {
        Row: {
          bank_account_id: string
          closing_balance: number
          created_at: string
          discrepancy_amount: number
          id: string
          matched_amount: number
          metadata: Json | null
          notes: string | null
          opening_balance: number
          performed_at: string | null
          performed_by: string | null
          period_end: string
          period_start: string
          status: string
          tenant_id: string
          unmatched_amount: number
          updated_at: string
        }
        Insert: {
          bank_account_id: string
          closing_balance?: number
          created_at?: string
          discrepancy_amount?: number
          id?: string
          matched_amount?: number
          metadata?: Json | null
          notes?: string | null
          opening_balance?: number
          performed_at?: string | null
          performed_by?: string | null
          period_end: string
          period_start: string
          status?: string
          tenant_id: string
          unmatched_amount?: number
          updated_at?: string
        }
        Update: {
          bank_account_id?: string
          closing_balance?: number
          created_at?: string
          discrepancy_amount?: number
          id?: string
          matched_amount?: number
          metadata?: Json | null
          notes?: string | null
          opening_balance?: number
          performed_at?: string | null
          performed_by?: string | null
          period_end?: string
          period_start?: string
          status?: string
          tenant_id?: string
          unmatched_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_bank_reconciliation_sessions_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "finance_bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_bank_statement_imports: {
        Row: {
          bank_account_id: string
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          duplicate_count: number
          error_count: number
          file_hash: string | null
          file_name: string
          file_size: number
          file_type: string
          id: string
          imported_count: number
          metadata: Json
          notes: string | null
          row_count: number
          status: string
          storage_path: string | null
          tenant_id: string
          updated_at: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          bank_account_id: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          duplicate_count?: number
          error_count?: number
          file_hash?: string | null
          file_name: string
          file_size?: number
          file_type: string
          id?: string
          imported_count?: number
          metadata?: Json
          notes?: string | null
          row_count?: number
          status?: string
          storage_path?: string | null
          tenant_id: string
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          bank_account_id?: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          duplicate_count?: number
          error_count?: number
          file_hash?: string | null
          file_name?: string
          file_size?: number
          file_type?: string
          id?: string
          imported_count?: number
          metadata?: Json
          notes?: string | null
          row_count?: number
          status?: string
          storage_path?: string | null
          tenant_id?: string
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_bank_statement_imports_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "finance_bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_bank_statement_rows: {
        Row: {
          amount: number | null
          balance_after: number | null
          bank_account_id: string
          counterparty_name: string | null
          created_at: string
          currency: string | null
          description: string | null
          direction: string | null
          duplicate_status: string
          error_message: string | null
          id: string
          import_id: string
          import_status: string
          matched_cash_movement_id: string | null
          metadata: Json
          movement_date: string | null
          movement_type: string | null
          raw_data: Json
          reference: string | null
          row_index: number
          tenant_id: string
          updated_at: string
          value_date: string | null
        }
        Insert: {
          amount?: number | null
          balance_after?: number | null
          bank_account_id: string
          counterparty_name?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          direction?: string | null
          duplicate_status?: string
          error_message?: string | null
          id?: string
          import_id: string
          import_status?: string
          matched_cash_movement_id?: string | null
          metadata?: Json
          movement_date?: string | null
          movement_type?: string | null
          raw_data?: Json
          reference?: string | null
          row_index: number
          tenant_id: string
          updated_at?: string
          value_date?: string | null
        }
        Update: {
          amount?: number | null
          balance_after?: number | null
          bank_account_id?: string
          counterparty_name?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          direction?: string | null
          duplicate_status?: string
          error_message?: string | null
          id?: string
          import_id?: string
          import_status?: string
          matched_cash_movement_id?: string | null
          metadata?: Json
          movement_date?: string | null
          movement_type?: string | null
          raw_data?: Json
          reference?: string | null
          row_index?: number
          tenant_id?: string
          updated_at?: string
          value_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_bank_statement_rows_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "finance_bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_bank_statement_rows_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "finance_bank_statement_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_bank_statement_rows_matched_cash_movement_id_fkey"
            columns: ["matched_cash_movement_id"]
            isOneToOne: false
            referencedRelation: "finance_cash_movements"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_cash_movements: {
        Row: {
          accounting_entry_id: string | null
          accounting_last_error: string | null
          accounting_posted_at: string | null
          accounting_status: string
          amount: number
          bank_account_id: string
          bank_reference: string | null
          base_amount: number | null
          base_currency: string | null
          cleared_at: string | null
          counterparty_name: string | null
          created_at: string
          created_by: string | null
          currency: string
          direction: string
          evidence_status: string
          exchange_rate: number | null
          external_reference: string | null
          fx_conversion_date: string | null
          fx_rate: number | null
          id: string
          metadata: Json | null
          movement_date: string
          movement_type: string
          notes: string | null
          reconciliation_status: string
          related_payment_id: string | null
          reporting_amount: number | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          accounting_entry_id?: string | null
          accounting_last_error?: string | null
          accounting_posted_at?: string | null
          accounting_status?: string
          amount: number
          bank_account_id: string
          bank_reference?: string | null
          base_amount?: number | null
          base_currency?: string | null
          cleared_at?: string | null
          counterparty_name?: string | null
          created_at?: string
          created_by?: string | null
          currency: string
          direction: string
          evidence_status?: string
          exchange_rate?: number | null
          external_reference?: string | null
          fx_conversion_date?: string | null
          fx_rate?: number | null
          id?: string
          metadata?: Json | null
          movement_date: string
          movement_type: string
          notes?: string | null
          reconciliation_status?: string
          related_payment_id?: string | null
          reporting_amount?: number | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          accounting_entry_id?: string | null
          accounting_last_error?: string | null
          accounting_posted_at?: string | null
          accounting_status?: string
          amount?: number
          bank_account_id?: string
          bank_reference?: string | null
          base_amount?: number | null
          base_currency?: string | null
          cleared_at?: string | null
          counterparty_name?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          direction?: string
          evidence_status?: string
          exchange_rate?: number | null
          external_reference?: string | null
          fx_conversion_date?: string | null
          fx_rate?: number | null
          id?: string
          metadata?: Json | null
          movement_date?: string
          movement_type?: string
          notes?: string | null
          reconciliation_status?: string
          related_payment_id?: string | null
          reporting_amount?: number | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_cash_movements_accounting_entry_id_fkey"
            columns: ["accounting_entry_id"]
            isOneToOne: false
            referencedRelation: "accounting_journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_cash_movements_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "finance_bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_cash_movements_related_payment_id_fkey"
            columns: ["related_payment_id"]
            isOneToOne: false
            referencedRelation: "finance_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_customer_accounts: {
        Row: {
          created_at: string
          credit_limit: number | null
          credit_status: string
          customer_id: string
          customer_name: string
          default_currency: string
          id: string
          notes: string | null
          payment_terms: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          credit_limit?: number | null
          credit_status?: string
          customer_id: string
          customer_name?: string
          default_currency?: string
          id?: string
          notes?: string | null
          payment_terms?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          credit_limit?: number | null
          credit_status?: string
          customer_id?: string
          customer_name?: string
          default_currency?: string
          id?: string
          notes?: string | null
          payment_terms?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_customer_accounts_customer_fk"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_customer_accounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_expense_categories: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          is_system: boolean
          name: string
          parent_id: string | null
          sort_order: number
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          is_system?: boolean
          name: string
          parent_id?: string | null
          sort_order?: number
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          is_system?: boolean
          name?: string
          parent_id?: string | null
          sort_order?: number
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_expense_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "finance_expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_expense_categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_expenses: {
        Row: {
          accounting_entry_id: string | null
          accounting_last_error: string | null
          accounting_posted_at: string | null
          accounting_status: string
          amount: number
          approval_level: number
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          attachment_url: string | null
          base_amount: number | null
          base_currency: string | null
          category_id: string | null
          created_at: string
          created_by_account_id: string | null
          currency: string
          due_date: string | null
          evidence_status: string
          expense_date: string
          fx_conversion_date: string | null
          fx_rate: number | null
          has_attachments: boolean
          id: string
          last_attachment_at: string | null
          linked_customer_id: string | null
          linked_order_id: string | null
          linked_project_id: string | null
          linked_supplier_id: string | null
          notes: string | null
          payment_status: string
          primary_receipt_url: string | null
          receipt_count: number
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          requires_changes_reason: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          subcategory_id: string | null
          submitted_at: string | null
          submitted_by: string | null
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          accounting_entry_id?: string | null
          accounting_last_error?: string | null
          accounting_posted_at?: string | null
          accounting_status?: string
          amount?: number
          approval_level?: number
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          attachment_url?: string | null
          base_amount?: number | null
          base_currency?: string | null
          category_id?: string | null
          created_at?: string
          created_by_account_id?: string | null
          currency?: string
          due_date?: string | null
          evidence_status?: string
          expense_date?: string
          fx_conversion_date?: string | null
          fx_rate?: number | null
          has_attachments?: boolean
          id?: string
          last_attachment_at?: string | null
          linked_customer_id?: string | null
          linked_order_id?: string | null
          linked_project_id?: string | null
          linked_supplier_id?: string | null
          notes?: string | null
          payment_status?: string
          primary_receipt_url?: string | null
          receipt_count?: number
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          requires_changes_reason?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          subcategory_id?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          tenant_id: string
          title?: string
          updated_at?: string
        }
        Update: {
          accounting_entry_id?: string | null
          accounting_last_error?: string | null
          accounting_posted_at?: string | null
          accounting_status?: string
          amount?: number
          approval_level?: number
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          attachment_url?: string | null
          base_amount?: number | null
          base_currency?: string | null
          category_id?: string | null
          created_at?: string
          created_by_account_id?: string | null
          currency?: string
          due_date?: string | null
          evidence_status?: string
          expense_date?: string
          fx_conversion_date?: string | null
          fx_rate?: number | null
          has_attachments?: boolean
          id?: string
          last_attachment_at?: string | null
          linked_customer_id?: string | null
          linked_order_id?: string | null
          linked_project_id?: string | null
          linked_supplier_id?: string | null
          notes?: string | null
          payment_status?: string
          primary_receipt_url?: string | null
          receipt_count?: number
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          requires_changes_reason?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          subcategory_id?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_expenses_accounting_entry_id_fkey"
            columns: ["accounting_entry_id"]
            isOneToOne: false
            referencedRelation: "accounting_journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "finance_expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_expenses_created_by_account_id_fkey"
            columns: ["created_by_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_expenses_linked_order_id_fkey"
            columns: ["linked_order_id"]
            isOneToOne: false
            referencedRelation: "finance_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_expenses_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "finance_expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_expenses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_fx_exchanges: {
        Row: {
          accounting_entry_id: string | null
          accounting_last_error: string | null
          accounting_posted_at: string | null
          accounting_status: string
          base_currency: string
          created_at: string
          created_by: string | null
          exchange_date: string
          exchange_no: string
          from_amount: number
          from_bank_id: string | null
          from_currency: string
          fx_rate: number
          gain_loss_base: number | null
          id: string
          notes: string | null
          status: string
          tenant_id: string
          to_amount: number
          to_bank_id: string | null
          to_currency: string
          updated_at: string
        }
        Insert: {
          accounting_entry_id?: string | null
          accounting_last_error?: string | null
          accounting_posted_at?: string | null
          accounting_status?: string
          base_currency: string
          created_at?: string
          created_by?: string | null
          exchange_date?: string
          exchange_no: string
          from_amount: number
          from_bank_id?: string | null
          from_currency: string
          fx_rate: number
          gain_loss_base?: number | null
          id?: string
          notes?: string | null
          status?: string
          tenant_id: string
          to_amount: number
          to_bank_id?: string | null
          to_currency: string
          updated_at?: string
        }
        Update: {
          accounting_entry_id?: string | null
          accounting_last_error?: string | null
          accounting_posted_at?: string | null
          accounting_status?: string
          base_currency?: string
          created_at?: string
          created_by?: string | null
          exchange_date?: string
          exchange_no?: string
          from_amount?: number
          from_bank_id?: string | null
          from_currency?: string
          fx_rate?: number
          gain_loss_base?: number | null
          id?: string
          notes?: string | null
          status?: string
          tenant_id?: string
          to_amount?: number
          to_bank_id?: string | null
          to_currency?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_fx_exchanges_accounting_entry_id_fkey"
            columns: ["accounting_entry_id"]
            isOneToOne: false
            referencedRelation: "accounting_journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_fx_exchanges_from_bank_id_fkey"
            columns: ["from_bank_id"]
            isOneToOne: false
            referencedRelation: "finance_bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_fx_exchanges_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_fx_exchanges_to_bank_id_fkey"
            columns: ["to_bank_id"]
            isOneToOne: false
            referencedRelation: "finance_bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_fx_rates: {
        Row: {
          created_at: string
          created_by: string | null
          effective_date: string
          from_currency: string
          id: string
          notes: string | null
          rate: number
          tenant_id: string
          to_currency: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effective_date?: string
          from_currency: string
          id?: string
          notes?: string | null
          rate: number
          tenant_id: string
          to_currency: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effective_date?: string
          from_currency?: string
          id?: string
          notes?: string | null
          rate?: number
          tenant_id?: string
          to_currency?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_fx_rates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_inventory_links: {
        Row: {
          created_at: string
          currency: string
          id: string
          inventory_item_id: string | null
          inventory_kind: string | null
          notes: string | null
          quantity: number | null
          source_id: string
          source_type: string
          tenant_id: string
          unit_cost: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          inventory_item_id?: string | null
          inventory_kind?: string | null
          notes?: string | null
          quantity?: number | null
          source_id: string
          source_type: string
          tenant_id: string
          unit_cost?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          inventory_item_id?: string | null
          inventory_kind?: string | null
          notes?: string | null
          quantity?: number | null
          source_id?: string
          source_type?: string
          tenant_id?: string
          unit_cost?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_inventory_links_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_notifications: {
        Row: {
          amount: number
          created_at: string
          currency: string
          due_date: string
          id: string
          notes: string | null
          party_name: string
          reference_id: string
          reference_type: string
          remind_at: string
          reminder_offset_days: number
          sent_at: string | null
          status: string
          tenant_id: string
          type: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string
          due_date: string
          id?: string
          notes?: string | null
          party_name?: string
          reference_id: string
          reference_type: string
          remind_at: string
          reminder_offset_days?: number
          sent_at?: string | null
          status?: string
          tenant_id: string
          type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          due_date?: string
          id?: string
          notes?: string | null
          party_name?: string
          reference_id?: string
          reference_type?: string
          remind_at?: string
          reminder_offset_days?: number
          sent_at?: string | null
          status?: string
          tenant_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_opening_balances: {
        Row: {
          accounting_entry_id: string | null
          accounting_last_error: string | null
          accounting_posted_at: string | null
          accounting_status: string
          amount: number
          category: string
          created_at: string
          created_by: string | null
          currency: string
          customer_id: string | null
          id: string
          label: string
          notes: string | null
          supplier_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          accounting_entry_id?: string | null
          accounting_last_error?: string | null
          accounting_posted_at?: string | null
          accounting_status?: string
          amount?: number
          category: string
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string | null
          id?: string
          label: string
          notes?: string | null
          supplier_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          accounting_entry_id?: string | null
          accounting_last_error?: string | null
          accounting_posted_at?: string | null
          accounting_status?: string
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string | null
          id?: string
          label?: string
          notes?: string | null
          supplier_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_opening_balances_accounting_entry_id_fkey"
            columns: ["accounting_entry_id"]
            isOneToOne: false
            referencedRelation: "accounting_journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_opening_balances_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_order_suppliers: {
        Row: {
          created_at: string
          currency: string
          due_date: string | null
          id: string
          notes: string | null
          order_id: string
          paid_amount: number
          payment_status: string
          supplier_cost: number
          supplier_id: string | null
          supplier_name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          order_id: string
          paid_amount?: number
          payment_status?: string
          supplier_cost?: number
          supplier_id?: string | null
          supplier_name?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          order_id?: string
          paid_amount?: number
          payment_status?: string
          supplier_cost?: number
          supplier_id?: string | null
          supplier_name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_order_suppliers_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "finance_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_order_suppliers_supplier_fk"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_order_suppliers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_orders: {
        Row: {
          created_at: string
          created_by_account_id: string | null
          currency: string
          customer_id: string | null
          customer_name: string
          expected_profit: number | null
          financial_charges: number
          id: string
          linked_invoice_id: string | null
          linked_quotation_id: string | null
          notes: string | null
          order_date: string
          order_no: string
          payment_due_date: string | null
          payment_status: string
          selling_price: number
          status: string
          tax_refund_pct: number
          tax_refund_value: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_account_id?: string | null
          currency?: string
          customer_id?: string | null
          customer_name?: string
          expected_profit?: number | null
          financial_charges?: number
          id?: string
          linked_invoice_id?: string | null
          linked_quotation_id?: string | null
          notes?: string | null
          order_date?: string
          order_no: string
          payment_due_date?: string | null
          payment_status?: string
          selling_price?: number
          status?: string
          tax_refund_pct?: number
          tax_refund_value?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_account_id?: string | null
          currency?: string
          customer_id?: string | null
          customer_name?: string
          expected_profit?: number | null
          financial_charges?: number
          id?: string
          linked_invoice_id?: string | null
          linked_quotation_id?: string | null
          notes?: string | null
          order_date?: string
          order_no?: string
          payment_due_date?: string | null
          payment_status?: string
          selling_price?: number
          status?: string
          tax_refund_pct?: number
          tax_refund_value?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_orders_created_by_account_id_fkey"
            columns: ["created_by_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_orders_customer_fk"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_payments: {
        Row: {
          accounting_entry_id: string | null
          accounting_last_error: string | null
          accounting_posted_at: string | null
          accounting_status: string
          actual_amount: number | null
          amount: number
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          bank_account: string | null
          bank_account_id: string | null
          bank_reference: string | null
          base_amount: number | null
          base_currency: string | null
          created_at: string
          created_by_account_id: string | null
          currency: string
          difference_amount: number | null
          direction: string
          expected_amount: number | null
          fx_conversion_date: string | null
          fx_rate: number | null
          has_payment_evidence: boolean
          id: string
          last_evidence_at: string | null
          linked_expense_id: string | null
          linked_invoice_id: string | null
          linked_order_id: string | null
          linked_order_supplier_id: string | null
          movement_status: string | null
          notes: string | null
          party_id: string | null
          party_name: string
          party_type: string
          payment_date: string
          payment_evidence_count: number
          payment_method: string | null
          primary_payment_evidence_url: string | null
          reconciled_at: string | null
          reconciled_by: string | null
          reconciliation_notes: string | null
          reconciliation_status: string
          reference_no: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          requires_changes_reason: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string | null
          submitted_by: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          accounting_entry_id?: string | null
          accounting_last_error?: string | null
          accounting_posted_at?: string | null
          accounting_status?: string
          actual_amount?: number | null
          amount?: number
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          bank_account?: string | null
          bank_account_id?: string | null
          bank_reference?: string | null
          base_amount?: number | null
          base_currency?: string | null
          created_at?: string
          created_by_account_id?: string | null
          currency?: string
          difference_amount?: number | null
          direction: string
          expected_amount?: number | null
          fx_conversion_date?: string | null
          fx_rate?: number | null
          has_payment_evidence?: boolean
          id?: string
          last_evidence_at?: string | null
          linked_expense_id?: string | null
          linked_invoice_id?: string | null
          linked_order_id?: string | null
          linked_order_supplier_id?: string | null
          movement_status?: string | null
          notes?: string | null
          party_id?: string | null
          party_name?: string
          party_type: string
          payment_date?: string
          payment_evidence_count?: number
          payment_method?: string | null
          primary_payment_evidence_url?: string | null
          reconciled_at?: string | null
          reconciled_by?: string | null
          reconciliation_notes?: string | null
          reconciliation_status?: string
          reference_no?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          requires_changes_reason?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          accounting_entry_id?: string | null
          accounting_last_error?: string | null
          accounting_posted_at?: string | null
          accounting_status?: string
          actual_amount?: number | null
          amount?: number
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          bank_account?: string | null
          bank_account_id?: string | null
          bank_reference?: string | null
          base_amount?: number | null
          base_currency?: string | null
          created_at?: string
          created_by_account_id?: string | null
          currency?: string
          difference_amount?: number | null
          direction?: string
          expected_amount?: number | null
          fx_conversion_date?: string | null
          fx_rate?: number | null
          has_payment_evidence?: boolean
          id?: string
          last_evidence_at?: string | null
          linked_expense_id?: string | null
          linked_invoice_id?: string | null
          linked_order_id?: string | null
          linked_order_supplier_id?: string | null
          movement_status?: string | null
          notes?: string | null
          party_id?: string | null
          party_name?: string
          party_type?: string
          payment_date?: string
          payment_evidence_count?: number
          payment_method?: string | null
          primary_payment_evidence_url?: string | null
          reconciled_at?: string | null
          reconciled_by?: string | null
          reconciliation_notes?: string | null
          reconciliation_status?: string
          reference_no?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          requires_changes_reason?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_payments_accounting_entry_id_fkey"
            columns: ["accounting_entry_id"]
            isOneToOne: false
            referencedRelation: "accounting_journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_payments_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "finance_bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_payments_created_by_account_id_fkey"
            columns: ["created_by_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_payments_linked_expense_id_fkey"
            columns: ["linked_expense_id"]
            isOneToOne: false
            referencedRelation: "finance_expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_payments_linked_invoice_id_fkey"
            columns: ["linked_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_payments_linked_order_id_fkey"
            columns: ["linked_order_id"]
            isOneToOne: false
            referencedRelation: "finance_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_payments_linked_order_supplier_id_fkey"
            columns: ["linked_order_supplier_id"]
            isOneToOne: false
            referencedRelation: "finance_order_suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_reconciliation_candidates: {
        Row: {
          candidate_type: string
          cash_movement_id: string
          confidence: number
          confidence_level: string
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          id: string
          match_reason_summary: string
          matched_factors: Json
          metadata: Json
          payment_id: string
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          status: string
          suggested_at: string
          tenant_id: string
          updated_at: string
          warnings: Json
        }
        Insert: {
          candidate_type: string
          cash_movement_id: string
          confidence: number
          confidence_level: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          id?: string
          match_reason_summary: string
          matched_factors?: Json
          metadata?: Json
          payment_id: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          status?: string
          suggested_at?: string
          tenant_id: string
          updated_at?: string
          warnings?: Json
        }
        Update: {
          candidate_type?: string
          cash_movement_id?: string
          confidence?: number
          confidence_level?: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          id?: string
          match_reason_summary?: string
          matched_factors?: Json
          metadata?: Json
          payment_id?: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          status?: string
          suggested_at?: string
          tenant_id?: string
          updated_at?: string
          warnings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "finance_reconciliation_candidates_cash_movement_id_fkey"
            columns: ["cash_movement_id"]
            isOneToOne: false
            referencedRelation: "finance_cash_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_reconciliation_candidates_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "finance_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_report_exports: {
        Row: {
          channel: string
          currency: string | null
          file_path: string | null
          filters: Json
          generated_at: string
          generated_by: string | null
          id: string
          metadata: Json
          report_type: string
          row_count: number
          target_entity_id: string | null
          target_entity_type: string | null
          tenant_id: string
          total_amount: number | null
          visibility: string
        }
        Insert: {
          channel: string
          currency?: string | null
          file_path?: string | null
          filters?: Json
          generated_at?: string
          generated_by?: string | null
          id?: string
          metadata?: Json
          report_type: string
          row_count?: number
          target_entity_id?: string | null
          target_entity_type?: string | null
          tenant_id: string
          total_amount?: number | null
          visibility: string
        }
        Update: {
          channel?: string
          currency?: string | null
          file_path?: string | null
          filters?: Json
          generated_at?: string
          generated_by?: string | null
          id?: string
          metadata?: Json
          report_type?: string
          row_count?: number
          target_entity_id?: string | null
          target_entity_type?: string | null
          tenant_id?: string
          total_amount?: number | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_report_exports_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_report_exports_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_supplier_accounts: {
        Row: {
          created_at: string
          default_currency: string
          id: string
          notes: string | null
          payment_terms: string | null
          supplier_id: string
          supplier_name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_currency?: string
          id?: string
          notes?: string | null
          payment_terms?: string | null
          supplier_id: string
          supplier_name?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_currency?: string
          id?: string
          notes?: string | null
          payment_terms?: string | null
          supplier_id?: string
          supplier_name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_supplier_accounts_supplier_fk"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_supplier_accounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_treasury_plan_reviews: {
        Row: {
          created_at: string
          decision: string
          id: string
          notes: string | null
          plan_id: string
          reviewer: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          decision: string
          id?: string
          notes?: string | null
          plan_id: string
          reviewer?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          decision?: string
          id?: string
          notes?: string | null
          plan_id?: string
          reviewer?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_treasury_plan_reviews_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "finance_treasury_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_treasury_plan_versions: {
        Row: {
          changed_at: string
          changed_by: string | null
          diff_summary: Json
          id: string
          plan_id: string
          previous_assumptions: Json
          previous_metrics: Json
          tenant_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          diff_summary?: Json
          id?: string
          plan_id: string
          previous_assumptions?: Json
          previous_metrics?: Json
          tenant_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          diff_summary?: Json
          id?: string
          plan_id?: string
          previous_assumptions?: Json
          previous_metrics?: Json
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_treasury_plan_versions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "finance_treasury_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_treasury_plans: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          base_forecast_snapshot: Json
          confidence: number | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          forecast_window_days: number
          id: string
          metadata: Json
          name: string
          projected_metrics: Json
          review_notes: string | null
          reviewed_by: string | null
          scenario_assumptions: Json
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          base_forecast_snapshot?: Json
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          forecast_window_days?: number
          id?: string
          metadata?: Json
          name: string
          projected_metrics?: Json
          review_notes?: string | null
          reviewed_by?: string | null
          scenario_assumptions?: Json
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          base_forecast_snapshot?: Json
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          forecast_window_days?: number
          id?: string
          metadata?: Json
          name?: string
          projected_metrics?: Json
          review_notes?: string | null
          reviewed_by?: string | null
          scenario_assumptions?: Json
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      hr_applicants: {
        Row: {
          assigned_to: string | null
          cover_letter: string | null
          created_at: string | null
          email: string | null
          full_name: string
          id: string
          job_posting_id: string
          notes: string | null
          phone: string | null
          rating: number | null
          resume_url: string | null
          source: string | null
          stage: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          cover_letter?: string | null
          created_at?: string | null
          email?: string | null
          full_name: string
          id?: string
          job_posting_id: string
          notes?: string | null
          phone?: string | null
          rating?: number | null
          resume_url?: string | null
          source?: string | null
          stage?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          cover_letter?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          job_posting_id?: string
          notes?: string | null
          phone?: string | null
          rating?: number | null
          resume_url?: string | null
          source?: string | null
          stage?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_applicants_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "koleex_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_applicants_job_posting_id_fkey"
            columns: ["job_posting_id"]
            isOneToOne: false
            referencedRelation: "hr_job_postings"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_appraisal_cycles: {
        Row: {
          created_at: string | null
          description: string | null
          end_date: string
          id: string
          name: string
          notes: string | null
          start_date: string
          status: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          end_date: string
          id?: string
          name: string
          notes?: string | null
          start_date: string
          status?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          end_date?: string
          id?: string
          name?: string
          notes?: string | null
          start_date?: string
          status?: string | null
        }
        Relationships: []
      }
      hr_appraisals: {
        Row: {
          completed_at: string | null
          created_at: string | null
          cycle_id: string
          employee_id: string
          goals_met: string | null
          id: string
          improvements: string | null
          overall_score: number | null
          reviewer_comments: string | null
          reviewer_id: string | null
          reviewer_rating: number | null
          self_comments: string | null
          self_rating: number | null
          status: string | null
          strengths: string | null
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          cycle_id: string
          employee_id: string
          goals_met?: string | null
          id?: string
          improvements?: string | null
          overall_score?: number | null
          reviewer_comments?: string | null
          reviewer_id?: string | null
          reviewer_rating?: number | null
          self_comments?: string | null
          self_rating?: number | null
          status?: string | null
          strengths?: string | null
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          cycle_id?: string
          employee_id?: string
          goals_met?: string | null
          id?: string
          improvements?: string | null
          overall_score?: number | null
          reviewer_comments?: string | null
          reviewer_id?: string | null
          reviewer_rating?: number | null
          self_comments?: string | null
          self_rating?: number | null
          status?: string | null
          strengths?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_appraisals_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "hr_appraisal_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_appraisals_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "koleex_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_appraisals_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "koleex_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_attendance_corrections: {
        Row: {
          after: Json | null
          before: Json | null
          break_minutes: number | null
          clock_in: string | null
          clock_out: string | null
          created_at: string
          date: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          employee_id: string
          id: string
          kind: string
          reason: string
          requested_by: string | null
          status: string
          tenant_id: string | null
        }
        Insert: {
          after?: Json | null
          before?: Json | null
          break_minutes?: number | null
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string
          date: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          employee_id: string
          id?: string
          kind: string
          reason: string
          requested_by?: string | null
          status?: string
          tenant_id?: string | null
        }
        Update: {
          after?: Json | null
          before?: Json | null
          break_minutes?: number | null
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string
          date?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          employee_id?: string
          id?: string
          kind?: string
          reason?: string
          requested_by?: string | null
          status?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_attendance_corrections_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "koleex_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_attendance_policies: {
        Row: {
          country: string | null
          created_at: string | null
          id: string
          is_default: boolean | null
          late_threshold_min: number | null
          min_hours: number | null
          name: string
          timezone: string
          tracking_from: string | null
          weekend_days: string[] | null
          work_end: string | null
          work_start: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          late_threshold_min?: number | null
          min_hours?: number | null
          name: string
          timezone?: string
          tracking_from?: string | null
          weekend_days?: string[] | null
          work_end?: string | null
          work_start?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          late_threshold_min?: number | null
          min_hours?: number | null
          name?: string
          timezone?: string
          tracking_from?: string | null
          weekend_days?: string[] | null
          work_end?: string | null
          work_start?: string | null
        }
        Relationships: []
      }
      hr_attendance_records: {
        Row: {
          auto_closed: boolean
          break_minutes: number | null
          clock_in: string | null
          clock_out: string | null
          corrected: boolean
          created_at: string | null
          date: string
          employee_id: string
          id: string
          notes: string | null
          overtime_approved_minutes: number | null
          overtime_decided_at: string | null
          overtime_decided_by: string | null
          overtime_status: string | null
          reminded_at: string | null
          remote: boolean
          source: string | null
          status: string | null
          total_hours: number | null
          updated_at: string | null
        }
        Insert: {
          auto_closed?: boolean
          break_minutes?: number | null
          clock_in?: string | null
          clock_out?: string | null
          corrected?: boolean
          created_at?: string | null
          date: string
          employee_id: string
          id?: string
          notes?: string | null
          overtime_approved_minutes?: number | null
          overtime_decided_at?: string | null
          overtime_decided_by?: string | null
          overtime_status?: string | null
          reminded_at?: string | null
          remote?: boolean
          source?: string | null
          status?: string | null
          total_hours?: number | null
          updated_at?: string | null
        }
        Update: {
          auto_closed?: boolean
          break_minutes?: number | null
          clock_in?: string | null
          clock_out?: string | null
          corrected?: boolean
          created_at?: string | null
          date?: string
          employee_id?: string
          id?: string
          notes?: string | null
          overtime_approved_minutes?: number | null
          overtime_decided_at?: string | null
          overtime_decided_by?: string | null
          overtime_status?: string | null
          reminded_at?: string | null
          remote?: boolean
          source?: string | null
          status?: string | null
          total_hours?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_attendance_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "koleex_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_checklist_instances: {
        Row: {
          checklist_id: string
          completed_at: string | null
          created_at: string | null
          employee_id: string
          id: string
          items_status: Json
          start_date: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          checklist_id: string
          completed_at?: string | null
          created_at?: string | null
          employee_id: string
          id?: string
          items_status?: Json
          start_date: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          checklist_id?: string
          completed_at?: string | null
          created_at?: string | null
          employee_id?: string
          id?: string
          items_status?: Json
          start_date?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_checklist_instances_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "hr_checklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_checklist_instances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "koleex_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_checklists: {
        Row: {
          created_at: string | null
          department_id: string | null
          id: string
          is_active: boolean | null
          items: Json
          name: string
          type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          department_id?: string | null
          id?: string
          is_active?: boolean | null
          items?: Json
          name: string
          type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          department_id?: string | null
          id?: string
          is_active?: boolean | null
          items?: Json
          name?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_checklists_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "koleex_departments"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_courses: {
        Row: {
          created_at: string | null
          department_id: string | null
          description: string | null
          duration_hours: number | null
          id: string
          is_active: boolean | null
          is_mandatory: boolean | null
          name: string
          provider: string | null
        }
        Insert: {
          created_at?: string | null
          department_id?: string | null
          description?: string | null
          duration_hours?: number | null
          id?: string
          is_active?: boolean | null
          is_mandatory?: boolean | null
          name: string
          provider?: string | null
        }
        Update: {
          created_at?: string | null
          department_id?: string | null
          description?: string | null
          duration_hours?: number | null
          id?: string
          is_active?: boolean | null
          is_mandatory?: boolean | null
          name?: string
          provider?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_courses_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "koleex_departments"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_documents: {
        Row: {
          category: string
          created_at: string | null
          employee_id: string
          expiry_date: string | null
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          name: string
          notes: string | null
          reminder_days: number | null
          updated_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          employee_id: string
          expiry_date?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          name: string
          notes?: string | null
          reminder_days?: number | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          employee_id?: string
          expiry_date?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          name?: string
          notes?: string | null
          reminder_days?: number | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "koleex_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "koleex_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_goals: {
        Row: {
          actual_value: string | null
          appraisal_id: string | null
          created_at: string | null
          description: string | null
          due_date: string | null
          employee_id: string
          id: string
          progress: number | null
          status: string | null
          target_value: string | null
          title: string
          updated_at: string | null
          weight: number | null
        }
        Insert: {
          actual_value?: string | null
          appraisal_id?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          employee_id: string
          id?: string
          progress?: number | null
          status?: string | null
          target_value?: string | null
          title: string
          updated_at?: string | null
          weight?: number | null
        }
        Update: {
          actual_value?: string | null
          appraisal_id?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          employee_id?: string
          id?: string
          progress?: number | null
          status?: string | null
          target_value?: string | null
          title?: string
          updated_at?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_goals_appraisal_id_fkey"
            columns: ["appraisal_id"]
            isOneToOne: false
            referencedRelation: "hr_appraisals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_goals_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "koleex_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_interview_rounds: {
        Row: {
          applicant_id: string
          created_at: string | null
          duration_min: number | null
          feedback: string | null
          id: string
          interviewer_id: string | null
          location: string | null
          round_number: number | null
          scheduled_at: string | null
          score: number | null
          status: string | null
        }
        Insert: {
          applicant_id: string
          created_at?: string | null
          duration_min?: number | null
          feedback?: string | null
          id?: string
          interviewer_id?: string | null
          location?: string | null
          round_number?: number | null
          scheduled_at?: string | null
          score?: number | null
          status?: string | null
        }
        Update: {
          applicant_id?: string
          created_at?: string | null
          duration_min?: number | null
          feedback?: string | null
          id?: string
          interviewer_id?: string | null
          location?: string | null
          round_number?: number | null
          scheduled_at?: string | null
          score?: number | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_interview_rounds_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "hr_applicants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_interview_rounds_interviewer_id_fkey"
            columns: ["interviewer_id"]
            isOneToOne: false
            referencedRelation: "koleex_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_job_postings: {
        Row: {
          closes_at: string | null
          created_at: string | null
          created_by: string | null
          department_id: string | null
          description: string | null
          employment_type: string | null
          id: string
          location: string | null
          position_id: string | null
          published_at: string | null
          requirements: string | null
          salary_currency: string | null
          salary_max: number | null
          salary_min: number | null
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          closes_at?: string | null
          created_at?: string | null
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          employment_type?: string | null
          id?: string
          location?: string | null
          position_id?: string | null
          published_at?: string | null
          requirements?: string | null
          salary_currency?: string | null
          salary_max?: number | null
          salary_min?: number | null
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          closes_at?: string | null
          created_at?: string | null
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          employment_type?: string | null
          id?: string
          location?: string | null
          position_id?: string | null
          published_at?: string | null
          requirements?: string | null
          salary_currency?: string | null
          salary_max?: number | null
          salary_min?: number | null
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_job_postings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "koleex_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_job_postings_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "koleex_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_job_postings_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "koleex_positions"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_leave_balances: {
        Row: {
          adjustment: number | null
          carried_over: number | null
          created_at: string | null
          employee_id: string
          entitled: number | null
          id: string
          leave_type_id: string
          updated_at: string | null
          used: number | null
          year: number
        }
        Insert: {
          adjustment?: number | null
          carried_over?: number | null
          created_at?: string | null
          employee_id: string
          entitled?: number | null
          id?: string
          leave_type_id: string
          updated_at?: string | null
          used?: number | null
          year: number
        }
        Update: {
          adjustment?: number | null
          carried_over?: number | null
          created_at?: string | null
          employee_id?: string
          entitled?: number | null
          id?: string
          leave_type_id?: string
          updated_at?: string | null
          used?: number | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "hr_leave_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "koleex_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_leave_balances_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "hr_leave_types"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_leave_requests: {
        Row: {
          attachment_url: string | null
          contact_address: string | null
          contact_phone: string | null
          created_at: string | null
          days: number
          destination: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          employee_id: string
          end_date: string
          half_day: boolean | null
          half_day_period: string | null
          handover_notes: string | null
          handover_to: string | null
          id: string
          leave_type_id: string
          manager_notes: string | null
          manager_reviewed_at: string | null
          manager_reviewed_by: string | null
          reason: string | null
          requested_by: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          start_date: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          attachment_url?: string | null
          contact_address?: string | null
          contact_phone?: string | null
          created_at?: string | null
          days: number
          destination?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employee_id: string
          end_date: string
          half_day?: boolean | null
          half_day_period?: string | null
          handover_notes?: string | null
          handover_to?: string | null
          id?: string
          leave_type_id: string
          manager_notes?: string | null
          manager_reviewed_at?: string | null
          manager_reviewed_by?: string | null
          reason?: string | null
          requested_by?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          attachment_url?: string | null
          contact_address?: string | null
          contact_phone?: string | null
          created_at?: string | null
          days?: number
          destination?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employee_id?: string
          end_date?: string
          half_day?: boolean | null
          half_day_period?: string | null
          handover_notes?: string | null
          handover_to?: string | null
          id?: string
          leave_type_id?: string
          manager_notes?: string | null
          manager_reviewed_at?: string | null
          manager_reviewed_by?: string | null
          reason?: string | null
          requested_by?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "koleex_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_leave_requests_handover_to_fkey"
            columns: ["handover_to"]
            isOneToOne: false
            referencedRelation: "koleex_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_leave_requests_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "hr_leave_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_leave_requests_manager_reviewed_by_fkey"
            columns: ["manager_reviewed_by"]
            isOneToOne: false
            referencedRelation: "koleex_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_leave_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "koleex_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_leave_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "koleex_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_leave_types: {
        Row: {
          carry_over: boolean | null
          code: string
          color: string | null
          created_at: string | null
          default_days: number | null
          id: string
          is_active: boolean | null
          is_paid: boolean | null
          name: string
          requires_doc: boolean | null
        }
        Insert: {
          carry_over?: boolean | null
          code: string
          color?: string | null
          created_at?: string | null
          default_days?: number | null
          id?: string
          is_active?: boolean | null
          is_paid?: boolean | null
          name: string
          requires_doc?: boolean | null
        }
        Update: {
          carry_over?: boolean | null
          code?: string
          color?: string | null
          created_at?: string | null
          default_days?: number | null
          id?: string
          is_active?: boolean | null
          is_paid?: boolean | null
          name?: string
          requires_doc?: boolean | null
        }
        Relationships: []
      }
      hr_payroll_rules: {
        Row: {
          base: string
          bracket_from: number | null
          bracket_to: number | null
          cap: number | null
          country: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          kind: string
          name: string
          rate: number
          sort_order: number | null
        }
        Insert: {
          base?: string
          bracket_from?: number | null
          bracket_to?: number | null
          cap?: number | null
          country?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          kind: string
          name: string
          rate?: number
          sort_order?: number | null
        }
        Update: {
          base?: string
          bracket_from?: number | null
          bracket_to?: number | null
          cap?: number | null
          country?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          kind?: string
          name?: string
          rate?: number
          sort_order?: number | null
        }
        Relationships: []
      }
      hr_payroll_runs: {
        Row: {
          accounting_entry_id: string | null
          accounting_last_error: string | null
          accounting_posted_at: string | null
          accounting_status: string
          approved_at: string | null
          approved_by: string | null
          country: string | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          employees: number | null
          id: string
          notes: string | null
          paid_at: string | null
          period: string
          status: string
          tenant_id: string | null
          total_employer: number | null
          total_gross: number | null
          total_net: number | null
          updated_at: string | null
        }
        Insert: {
          accounting_entry_id?: string | null
          accounting_last_error?: string | null
          accounting_posted_at?: string | null
          accounting_status?: string
          approved_at?: string | null
          approved_by?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          employees?: number | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          period: string
          status?: string
          tenant_id?: string | null
          total_employer?: number | null
          total_gross?: number | null
          total_net?: number | null
          updated_at?: string | null
        }
        Update: {
          accounting_entry_id?: string | null
          accounting_last_error?: string | null
          accounting_posted_at?: string | null
          accounting_status?: string
          approved_at?: string | null
          approved_by?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          employees?: number | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          period?: string
          status?: string
          tenant_id?: string | null
          total_employer?: number | null
          total_gross?: number | null
          total_net?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_payroll_runs_accounting_entry_id_fkey"
            columns: ["accounting_entry_id"]
            isOneToOne: false
            referencedRelation: "accounting_journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_payroll_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_payslips: {
        Row: {
          breakdown: Json | null
          created_at: string | null
          currency: string | null
          deductions: Json | null
          employee_id: string
          employer_contributions: Json | null
          gross_amount: number | null
          id: string
          net_amount: number | null
          notes: string | null
          paid_at: string | null
          payroll_run_id: string | null
          period_end: string
          period_start: string
          salary_record_id: string | null
          status: string | null
        }
        Insert: {
          breakdown?: Json | null
          created_at?: string | null
          currency?: string | null
          deductions?: Json | null
          employee_id: string
          employer_contributions?: Json | null
          gross_amount?: number | null
          id?: string
          net_amount?: number | null
          notes?: string | null
          paid_at?: string | null
          payroll_run_id?: string | null
          period_end: string
          period_start: string
          salary_record_id?: string | null
          status?: string | null
        }
        Update: {
          breakdown?: Json | null
          created_at?: string | null
          currency?: string | null
          deductions?: Json | null
          employee_id?: string
          employer_contributions?: Json | null
          gross_amount?: number | null
          id?: string
          net_amount?: number | null
          notes?: string | null
          paid_at?: string | null
          payroll_run_id?: string | null
          period_end?: string
          period_start?: string
          salary_record_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_payslips_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "koleex_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_payslips_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "hr_payroll_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_payslips_salary_record_id_fkey"
            columns: ["salary_record_id"]
            isOneToOne: false
            referencedRelation: "hr_salary_records"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_salary_records: {
        Row: {
          allowances: Json | null
          base_salary: number
          created_at: string | null
          currency: string | null
          deductions: Json | null
          effective_from: string
          effective_to: string | null
          employee_id: string
          id: string
          notes: string | null
          pay_frequency: string | null
        }
        Insert: {
          allowances?: Json | null
          base_salary: number
          created_at?: string | null
          currency?: string | null
          deductions?: Json | null
          effective_from: string
          effective_to?: string | null
          employee_id: string
          id?: string
          notes?: string | null
          pay_frequency?: string | null
        }
        Update: {
          allowances?: Json | null
          base_salary?: number
          created_at?: string | null
          currency?: string | null
          deductions?: Json | null
          effective_from?: string
          effective_to?: string | null
          employee_id?: string
          id?: string
          notes?: string | null
          pay_frequency?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_salary_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "koleex_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_training_records: {
        Row: {
          certificate_url: string | null
          completed_at: string | null
          course_id: string
          created_at: string | null
          employee_id: string
          enrolled_at: string | null
          expiry_date: string | null
          id: string
          notes: string | null
          score: number | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          certificate_url?: string | null
          completed_at?: string | null
          course_id: string
          created_at?: string | null
          employee_id: string
          enrolled_at?: string | null
          expiry_date?: string | null
          id?: string
          notes?: string | null
          score?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          certificate_url?: string | null
          completed_at?: string | null
          course_id?: string
          created_at?: string | null
          employee_id?: string
          enrolled_at?: string | null
          expiry_date?: string | null
          id?: string
          notes?: string | null
          score?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_training_records_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "hr_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_training_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "koleex_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      inbox_messages: {
        Row: {
          archived_at: string | null
          body: string | null
          category: string
          created_at: string
          id: string
          link: string | null
          metadata: Json | null
          read_at: string | null
          recipient_account_id: string
          sender_account_id: string | null
          snoozed_until: string | null
          subject: string
          tenant_id: string | null
        }
        Insert: {
          archived_at?: string | null
          body?: string | null
          category?: string
          created_at?: string
          id?: string
          link?: string | null
          metadata?: Json | null
          read_at?: string | null
          recipient_account_id: string
          sender_account_id?: string | null
          snoozed_until?: string | null
          subject: string
          tenant_id?: string | null
        }
        Update: {
          archived_at?: string | null
          body?: string | null
          category?: string
          created_at?: string
          id?: string
          link?: string | null
          metadata?: Json | null
          read_at?: string | null
          recipient_account_id?: string
          sender_account_id?: string | null
          snoozed_until?: string | null
          subject?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inbox_messages_recipient_account_id_fkey"
            columns: ["recipient_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_messages_sender_account_id_fkey"
            columns: ["sender_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      incoterms: {
        Row: {
          code: string
          created_at: string | null
          created_by: string | null
          effort_score: number | null
          id: string
          includes_export_clearance: boolean | null
          includes_import_clearance: boolean | null
          includes_import_duty: boolean | null
          includes_insurance: boolean | null
          includes_main_carriage: boolean | null
          includes_unloading_at_dest: boolean | null
          is_active: boolean | null
          is_default: boolean | null
          is_obsolete: boolean | null
          is_system: boolean | null
          name: string
          named_location_label: string | null
          named_location_required: boolean | null
          notes: string | null
          risk_transfer_point: string | null
          short_name: string | null
          sort_order: number | null
          standing: string
          tenant_id: string | null
          transport_mode: string
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          created_by?: string | null
          effort_score?: number | null
          id?: string
          includes_export_clearance?: boolean | null
          includes_import_clearance?: boolean | null
          includes_import_duty?: boolean | null
          includes_insurance?: boolean | null
          includes_main_carriage?: boolean | null
          includes_unloading_at_dest?: boolean | null
          is_active?: boolean | null
          is_default?: boolean | null
          is_obsolete?: boolean | null
          is_system?: boolean | null
          name: string
          named_location_label?: string | null
          named_location_required?: boolean | null
          notes?: string | null
          risk_transfer_point?: string | null
          short_name?: string | null
          sort_order?: number | null
          standing?: string
          tenant_id?: string | null
          transport_mode: string
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          created_by?: string | null
          effort_score?: number | null
          id?: string
          includes_export_clearance?: boolean | null
          includes_import_clearance?: boolean | null
          includes_import_duty?: boolean | null
          includes_insurance?: boolean | null
          includes_main_carriage?: boolean | null
          includes_unloading_at_dest?: boolean | null
          is_active?: boolean | null
          is_default?: boolean | null
          is_obsolete?: boolean | null
          is_system?: boolean | null
          name?: string
          named_location_label?: string | null
          named_location_required?: boolean | null
          notes?: string | null
          risk_transfer_point?: string | null
          short_name?: string | null
          sort_order?: number | null
          standing?: string
          tenant_id?: string | null
          transport_mode?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      intel_visibility_registry: {
        Row: {
          created_at: string
          entity: string
          field_key: string
          id: string
          min_tier: Database["public"]["Enums"]["visibility_tier"]
          notes: string | null
          surface_block: string[]
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          entity: string
          field_key: string
          id?: string
          min_tier: Database["public"]["Enums"]["visibility_tier"]
          notes?: string | null
          surface_block?: string[]
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          entity?: string
          field_key?: string
          id?: string
          min_tier?: Database["public"]["Enums"]["visibility_tier"]
          notes?: string | null
          surface_block?: string[]
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "intel_visibility_registry_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
          tenant_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
          tenant_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_batches: {
        Row: {
          batch_no: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          expiry_date: string | null
          id: string
          inventory_item_id: string
          manufacture_date: string | null
          metadata: Json
          notes: string | null
          quantity_initial: number
          quantity_remaining: number
          status: string
          supplier_batch_no: string | null
          tenant_id: string
          updated_at: string
          variant_id: string | null
          warehouse_id: string
        }
        Insert: {
          batch_no: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          expiry_date?: string | null
          id?: string
          inventory_item_id: string
          manufacture_date?: string | null
          metadata?: Json
          notes?: string | null
          quantity_initial: number
          quantity_remaining: number
          status?: string
          supplier_batch_no?: string | null
          tenant_id: string
          updated_at?: string
          variant_id?: string | null
          warehouse_id: string
        }
        Update: {
          batch_no?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          expiry_date?: string | null
          id?: string
          inventory_item_id?: string
          manufacture_date?: string | null
          metadata?: Json
          notes?: string | null
          quantity_initial?: number
          quantity_remaining?: number
          status?: string
          supplier_batch_no?: string | null
          tenant_id?: string
          updated_at?: string
          variant_id?: string | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_batches_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_batches_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_batches_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "inventory_item_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_batches_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "inventory_warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_item_categories: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          is_active: boolean
          name: string
          parent_id: string | null
          sort_order: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          parent_id?: string | null
          sort_order?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          parent_id?: string | null
          sort_order?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_item_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "inventory_item_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_item_categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_item_code_sequences: {
        Row: {
          id: string
          last_number: number
          prefix: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          id?: string
          last_number?: number
          prefix: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          id?: string
          last_number?: number
          prefix?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_item_code_sequences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_item_types: {
        Row: {
          code_prefix: string
          color: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          icon: string
          id: string
          is_active: boolean
          is_system: boolean
          requires_product: boolean
          sort_order: number
          tenant_id: string | null
          type_key: string
          type_name: string
          updated_at: string
          usage_scope: string
        }
        Insert: {
          code_prefix: string
          color?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          icon?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          requires_product?: boolean
          sort_order?: number
          tenant_id?: string | null
          type_key: string
          type_name: string
          updated_at?: string
          usage_scope?: string
        }
        Update: {
          code_prefix?: string
          color?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          icon?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          requires_product?: boolean
          sort_order?: number
          tenant_id?: string | null
          type_key?: string
          type_name?: string
          updated_at?: string
          usage_scope?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_item_types_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_item_variants: {
        Row: {
          attributes: Json
          barcode: string | null
          cost_price: number | null
          created_at: string
          created_by: string | null
          currency: string | null
          deleted_at: string | null
          dimensions: string | null
          id: string
          inventory_item_id: string
          metadata: Json
          qr_code: string | null
          sku_suffix: string | null
          status: string
          tenant_id: string
          updated_at: string
          variant_code: string
          variant_name: string
          weight: number | null
        }
        Insert: {
          attributes?: Json
          barcode?: string | null
          cost_price?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          deleted_at?: string | null
          dimensions?: string | null
          id?: string
          inventory_item_id: string
          metadata?: Json
          qr_code?: string | null
          sku_suffix?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
          variant_code: string
          variant_name: string
          weight?: number | null
        }
        Update: {
          attributes?: Json
          barcode?: string | null
          cost_price?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          deleted_at?: string | null
          dimensions?: string | null
          id?: string
          inventory_item_id?: string
          metadata?: Json
          qr_code?: string | null
          sku_suffix?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
          variant_code?: string
          variant_name?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_item_variants_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_item_variants_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          barcode: string | null
          brand: string | null
          category_id: string | null
          cost_price: number | null
          created_at: string
          created_by: string | null
          currency: string | null
          default_warehouse_id: string | null
          deleted_at: string | null
          description: string | null
          dimensions: string | null
          id: string
          image_url: string | null
          is_consumable: boolean
          is_purchasable: boolean
          is_sellable: boolean
          item_code: string
          item_name: string
          item_type_id: string
          linked_product_id: string | null
          max_stock: number | null
          metadata: Json
          min_stock: number | null
          notes: string | null
          preferred_supplier_id: string | null
          qr_code: string | null
          reorder_point: number | null
          sku: string | null
          status: string
          subcategory: string | null
          tenant_id: string
          track_serials: boolean
          track_stock: boolean
          unit_of_measure: string
          updated_at: string
          weight: number | null
        }
        Insert: {
          barcode?: string | null
          brand?: string | null
          category_id?: string | null
          cost_price?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          default_warehouse_id?: string | null
          deleted_at?: string | null
          description?: string | null
          dimensions?: string | null
          id?: string
          image_url?: string | null
          is_consumable?: boolean
          is_purchasable?: boolean
          is_sellable?: boolean
          item_code: string
          item_name: string
          item_type_id: string
          linked_product_id?: string | null
          max_stock?: number | null
          metadata?: Json
          min_stock?: number | null
          notes?: string | null
          preferred_supplier_id?: string | null
          qr_code?: string | null
          reorder_point?: number | null
          sku?: string | null
          status?: string
          subcategory?: string | null
          tenant_id: string
          track_serials?: boolean
          track_stock?: boolean
          unit_of_measure?: string
          updated_at?: string
          weight?: number | null
        }
        Update: {
          barcode?: string | null
          brand?: string | null
          category_id?: string | null
          cost_price?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          default_warehouse_id?: string | null
          deleted_at?: string | null
          description?: string | null
          dimensions?: string | null
          id?: string
          image_url?: string | null
          is_consumable?: boolean
          is_purchasable?: boolean
          is_sellable?: boolean
          item_code?: string
          item_name?: string
          item_type_id?: string
          linked_product_id?: string | null
          max_stock?: number | null
          metadata?: Json
          min_stock?: number | null
          notes?: string | null
          preferred_supplier_id?: string | null
          qr_code?: string | null
          reorder_point?: number | null
          sku?: string | null
          status?: string
          subcategory?: string | null
          tenant_id?: string
          track_serials?: boolean
          track_stock?: boolean
          unit_of_measure?: string
          updated_at?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "inventory_item_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_default_warehouse_id_fkey"
            columns: ["default_warehouse_id"]
            isOneToOne: false
            referencedRelation: "inventory_warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_item_type_id_fkey"
            columns: ["item_type_id"]
            isOneToOne: false
            referencedRelation: "inventory_item_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_linked_product_id_fkey"
            columns: ["linked_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_return_items: {
        Row: {
          condition_status: string
          created_at: string
          disposition: string
          id: string
          inventory_item_id: string
          notes: string | null
          quantity: number
          return_id: string
          tenant_id: string
          unit_of_measure: string
          updated_at: string
        }
        Insert: {
          condition_status: string
          created_at?: string
          disposition: string
          id?: string
          inventory_item_id: string
          notes?: string | null
          quantity: number
          return_id: string
          tenant_id: string
          unit_of_measure: string
          updated_at?: string
        }
        Update: {
          condition_status?: string
          created_at?: string
          disposition?: string
          id?: string
          inventory_item_id?: string
          notes?: string | null
          quantity?: number
          return_id?: string
          tenant_id?: string
          unit_of_measure?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_return_items_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_return_items_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "inventory_returns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_return_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_return_movements: {
        Row: {
          created_at: string
          id: string
          movement_id: string
          return_id: string
          return_item_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          movement_id: string
          return_id: string
          return_item_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          movement_id?: string
          return_id?: string
          return_item_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_return_movements_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: false
            referencedRelation: "inventory_stock_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_return_movements_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "inventory_returns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_return_movements_return_item_id_fkey"
            columns: ["return_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_return_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_return_movements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_returns: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          deleted_at: string | null
          id: string
          metadata: Json
          notes: string | null
          processed_at: string | null
          processed_by: string | null
          reason_code: string
          reason_notes: string | null
          requested_at: string | null
          requested_by: string | null
          return_no: string
          return_type: string
          source_document_id: string | null
          source_document_type: string | null
          status: string
          supplier_id: string | null
          tenant_id: string
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
          warehouse_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          deleted_at?: string | null
          id?: string
          metadata?: Json
          notes?: string | null
          processed_at?: string | null
          processed_by?: string | null
          reason_code: string
          reason_notes?: string | null
          requested_at?: string | null
          requested_by?: string | null
          return_no: string
          return_type: string
          source_document_id?: string | null
          source_document_type?: string | null
          status?: string
          supplier_id?: string | null
          tenant_id: string
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
          warehouse_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          deleted_at?: string | null
          id?: string
          metadata?: Json
          notes?: string | null
          processed_at?: string | null
          processed_by?: string | null
          reason_code?: string
          reason_notes?: string | null
          requested_at?: string | null
          requested_by?: string | null
          return_no?: string
          return_type?: string
          source_document_id?: string | null
          source_document_type?: string | null
          status?: string
          supplier_id?: string | null
          tenant_id?: string
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_returns_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_returns_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_returns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_returns_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_returns_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_returns_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_returns_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_returns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_returns_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_returns_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "inventory_warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_serials: {
        Row: {
          batch_id: string | null
          condition_status: string | null
          created_at: string
          current_movement_id: string | null
          customer_id: string | null
          id: string
          inventory_item_id: string
          metadata: Json
          notes: string | null
          purchase_date: string | null
          serial_no: string
          sold_date: string | null
          source_movement_id: string | null
          status: string
          supplier_id: string | null
          tenant_id: string
          updated_at: string
          variant_id: string | null
          warehouse_id: string | null
        }
        Insert: {
          batch_id?: string | null
          condition_status?: string | null
          created_at?: string
          current_movement_id?: string | null
          customer_id?: string | null
          id?: string
          inventory_item_id: string
          metadata?: Json
          notes?: string | null
          purchase_date?: string | null
          serial_no: string
          sold_date?: string | null
          source_movement_id?: string | null
          status?: string
          supplier_id?: string | null
          tenant_id: string
          updated_at?: string
          variant_id?: string | null
          warehouse_id?: string | null
        }
        Update: {
          batch_id?: string | null
          condition_status?: string | null
          created_at?: string
          current_movement_id?: string | null
          customer_id?: string | null
          id?: string
          inventory_item_id?: string
          metadata?: Json
          notes?: string | null
          purchase_date?: string | null
          serial_no?: string
          sold_date?: string | null
          source_movement_id?: string | null
          status?: string
          supplier_id?: string | null
          tenant_id?: string
          updated_at?: string
          variant_id?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_serials_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "inventory_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_serials_current_movement_id_fkey"
            columns: ["current_movement_id"]
            isOneToOne: false
            referencedRelation: "inventory_stock_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_serials_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_serials_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_serials_source_movement_id_fkey"
            columns: ["source_movement_id"]
            isOneToOne: false
            referencedRelation: "inventory_stock_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_serials_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_serials_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_serials_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "inventory_item_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_serials_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "inventory_warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_stock_balances: {
        Row: {
          created_at: string
          id: string
          inventory_item_id: string
          last_movement_at: string | null
          last_movement_id: string | null
          metadata: Json
          qty_on_hand: number
          qty_reserved: number
          tenant_id: string
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          inventory_item_id: string
          last_movement_at?: string | null
          last_movement_id?: string | null
          metadata?: Json
          qty_on_hand?: number
          qty_reserved?: number
          tenant_id: string
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          created_at?: string
          id?: string
          inventory_item_id?: string
          last_movement_at?: string | null
          last_movement_id?: string | null
          metadata?: Json
          qty_on_hand?: number
          qty_reserved?: number
          tenant_id?: string
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_stock_balances_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_stock_balances_last_movement_id_fkey"
            columns: ["last_movement_id"]
            isOneToOne: false
            referencedRelation: "inventory_stock_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_stock_balances_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_stock_balances_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "inventory_warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_stock_movements: {
        Row: {
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          batch_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          direction: string
          id: string
          inventory_item_id: string
          metadata: Json
          movement_date: string
          movement_no: string
          movement_type: string
          notes: string | null
          posted_at: string | null
          posted_by: string | null
          quantity: number
          reference: string | null
          rejection_reason: string | null
          related_movement_id: string | null
          reverses_movement_id: string | null
          serial_ids: string[] | null
          source_id: string | null
          source_type: string | null
          status: string
          tenant_id: string
          total_cost: number | null
          unit: string
          unit_cost: number | null
          updated_at: string
          variant_id: string | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
          warehouse_id: string
        }
        Insert: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          batch_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          direction: string
          id?: string
          inventory_item_id: string
          metadata?: Json
          movement_date?: string
          movement_no: string
          movement_type: string
          notes?: string | null
          posted_at?: string | null
          posted_by?: string | null
          quantity: number
          reference?: string | null
          rejection_reason?: string | null
          related_movement_id?: string | null
          reverses_movement_id?: string | null
          serial_ids?: string[] | null
          source_id?: string | null
          source_type?: string | null
          status?: string
          tenant_id: string
          total_cost?: number | null
          unit?: string
          unit_cost?: number | null
          updated_at?: string
          variant_id?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
          warehouse_id: string
        }
        Update: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          batch_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          direction?: string
          id?: string
          inventory_item_id?: string
          metadata?: Json
          movement_date?: string
          movement_no?: string
          movement_type?: string
          notes?: string | null
          posted_at?: string | null
          posted_by?: string | null
          quantity?: number
          reference?: string | null
          rejection_reason?: string | null
          related_movement_id?: string | null
          reverses_movement_id?: string | null
          serial_ids?: string[] | null
          source_id?: string | null
          source_type?: string | null
          status?: string
          tenant_id?: string
          total_cost?: number | null
          unit?: string
          unit_cost?: number | null
          updated_at?: string
          variant_id?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_stock_movements_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_stock_movements_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "inventory_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_stock_movements_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_stock_movements_related_movement_id_fkey"
            columns: ["related_movement_id"]
            isOneToOne: false
            referencedRelation: "inventory_stock_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_stock_movements_reverses_movement_id_fkey"
            columns: ["reverses_movement_id"]
            isOneToOne: false
            referencedRelation: "inventory_stock_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_stock_movements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_stock_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "inventory_item_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_stock_movements_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "inventory_warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_transfer_items: {
        Row: {
          created_at: string
          id: string
          inventory_item_id: string
          notes: string | null
          quantity: number
          tenant_id: string
          transfer_id: string
          unit_of_measure: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          inventory_item_id: string
          notes?: string | null
          quantity: number
          tenant_id: string
          transfer_id: string
          unit_of_measure: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          inventory_item_id?: string
          notes?: string | null
          quantity?: number
          tenant_id?: string
          transfer_id?: string
          unit_of_measure?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transfer_items_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfer_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfer_items_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "inventory_transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_transfer_movements: {
        Row: {
          created_at: string
          id: string
          tenant_id: string
          transfer_id: string
          transfer_in_movement_id: string | null
          transfer_item_id: string
          transfer_out_movement_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          tenant_id: string
          transfer_id: string
          transfer_in_movement_id?: string | null
          transfer_item_id: string
          transfer_out_movement_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          tenant_id?: string
          transfer_id?: string
          transfer_in_movement_id?: string | null
          transfer_item_id?: string
          transfer_out_movement_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transfer_movements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfer_movements_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "inventory_transfers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfer_movements_transfer_in_movement_id_fkey"
            columns: ["transfer_in_movement_id"]
            isOneToOne: false
            referencedRelation: "inventory_stock_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfer_movements_transfer_item_id_fkey"
            columns: ["transfer_item_id"]
            isOneToOne: true
            referencedRelation: "inventory_transfer_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfer_movements_transfer_out_movement_id_fkey"
            columns: ["transfer_out_movement_id"]
            isOneToOne: false
            referencedRelation: "inventory_stock_movements"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_transfers: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          destination_warehouse_id: string
          id: string
          metadata: Json
          notes: string | null
          received_at: string | null
          received_by: string | null
          requested_at: string | null
          requested_by: string | null
          shipped_at: string | null
          shipped_by: string | null
          source_warehouse_id: string
          status: string
          tenant_id: string
          transfer_no: string
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          destination_warehouse_id: string
          id?: string
          metadata?: Json
          notes?: string | null
          received_at?: string | null
          received_by?: string | null
          requested_at?: string | null
          requested_by?: string | null
          shipped_at?: string | null
          shipped_by?: string | null
          source_warehouse_id: string
          status?: string
          tenant_id: string
          transfer_no: string
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          destination_warehouse_id?: string
          id?: string
          metadata?: Json
          notes?: string | null
          received_at?: string | null
          received_by?: string | null
          requested_at?: string | null
          requested_by?: string | null
          shipped_at?: string | null
          shipped_by?: string | null
          source_warehouse_id?: string
          status?: string
          tenant_id?: string
          transfer_no?: string
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transfers_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfers_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfers_destination_warehouse_id_fkey"
            columns: ["destination_warehouse_id"]
            isOneToOne: false
            referencedRelation: "inventory_warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfers_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfers_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfers_shipped_by_fkey"
            columns: ["shipped_by"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfers_source_warehouse_id_fkey"
            columns: ["source_warehouse_id"]
            isOneToOne: false
            referencedRelation: "inventory_warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfers_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_valuation: {
        Row: {
          average_cost: number
          currency: string
          id: string
          inventory_item_id: string
          inventory_value: number
          last_in_cost: number | null
          last_movement_id: string | null
          qty_on_hand: number
          tenant_id: string
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          average_cost?: number
          currency?: string
          id?: string
          inventory_item_id: string
          inventory_value?: number
          last_in_cost?: number | null
          last_movement_id?: string | null
          qty_on_hand?: number
          tenant_id: string
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          average_cost?: number
          currency?: string
          id?: string
          inventory_item_id?: string
          inventory_value?: number
          last_in_cost?: number | null
          last_movement_id?: string | null
          qty_on_hand?: number
          tenant_id?: string
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_valuation_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_valuation_last_movement_id_fkey"
            columns: ["last_movement_id"]
            isOneToOne: false
            referencedRelation: "inventory_stock_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_valuation_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_valuation_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "inventory_warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_warehouses: {
        Row: {
          address: string | null
          code: string
          contact_person: string | null
          contact_phone: string | null
          created_at: string
          customer_id: string | null
          deleted_at: string | null
          id: string
          is_active: boolean
          is_default: boolean
          is_virtual: boolean
          kind: string
          location: string | null
          location_type: string
          metadata: Json
          name: string
          notes: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          code: string
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          customer_id?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          is_virtual?: boolean
          kind?: string
          location?: string | null
          location_type?: string
          metadata?: Json
          name: string
          notes?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          code?: string
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          customer_id?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          is_virtual?: boolean
          kind?: string
          location?: string | null
          location_type?: string
          metadata?: Json
          name?: string
          notes?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_warehouses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invitation_letters: {
        Row: {
          arrival_city: string | null
          arrival_date: string
          cities: string[]
          contact_id: string | null
          created_at: string
          created_by: string | null
          departure_date: string
          duration_days: number | null
          exhibition_name: string | null
          extra_note: string | null
          id: string
          issued_at: string | null
          letter_date: string
          pdf_url: string | null
          purpose: string
          reference: string
          status: string
          tenant_id: string
          updated_at: string
          visa_type: string
          visitor_company: string | null
          visitor_country: string | null
          visitor_country_code: string | null
          visitor_dob: string | null
          visitor_gender: string | null
          visitor_name: string
          visitor_nationality: string | null
          visitor_nationality_code: string | null
          visitor_passport_expiry: string | null
          visitor_passport_issue: string | null
          visitor_passport_no: string | null
          visitor_position: string | null
        }
        Insert: {
          arrival_city?: string | null
          arrival_date: string
          cities?: string[]
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          departure_date: string
          duration_days?: number | null
          exhibition_name?: string | null
          extra_note?: string | null
          id?: string
          issued_at?: string | null
          letter_date?: string
          pdf_url?: string | null
          purpose: string
          reference: string
          status?: string
          tenant_id: string
          updated_at?: string
          visa_type?: string
          visitor_company?: string | null
          visitor_country?: string | null
          visitor_country_code?: string | null
          visitor_dob?: string | null
          visitor_gender?: string | null
          visitor_name: string
          visitor_nationality?: string | null
          visitor_nationality_code?: string | null
          visitor_passport_expiry?: string | null
          visitor_passport_issue?: string | null
          visitor_passport_no?: string | null
          visitor_position?: string | null
        }
        Update: {
          arrival_city?: string | null
          arrival_date?: string
          cities?: string[]
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          departure_date?: string
          duration_days?: number | null
          exhibition_name?: string | null
          extra_note?: string | null
          id?: string
          issued_at?: string | null
          letter_date?: string
          pdf_url?: string | null
          purpose?: string
          reference?: string
          status?: string
          tenant_id?: string
          updated_at?: string
          visa_type?: string
          visitor_company?: string | null
          visitor_country?: string | null
          visitor_country_code?: string | null
          visitor_dob?: string | null
          visitor_gender?: string | null
          visitor_name?: string
          visitor_nationality?: string | null
          visitor_nationality_code?: string | null
          visitor_passport_expiry?: string | null
          visitor_passport_issue?: string | null
          visitor_passport_no?: string | null
          visitor_position?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invitation_letters_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitation_letters_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invitation_settings: {
        Row: {
          address_cn: string | null
          address_en: string | null
          company_name_cn: string | null
          company_name_en: string | null
          credit_code: string | null
          inviter_name: string | null
          inviter_phone: string | null
          inviter_position_cn: string | null
          inviter_position_en: string | null
          licence_doc_url: string | null
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address_cn?: string | null
          address_en?: string | null
          company_name_cn?: string | null
          company_name_en?: string | null
          credit_code?: string | null
          inviter_name?: string | null
          inviter_phone?: string | null
          inviter_position_cn?: string | null
          inviter_position_en?: string | null
          licence_doc_url?: string | null
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address_cn?: string | null
          address_en?: string | null
          company_name_cn?: string | null
          company_name_en?: string | null
          credit_code?: string | null
          inviter_name?: string | null
          inviter_phone?: string | null
          inviter_position_cn?: string | null
          inviter_position_en?: string | null
          licence_doc_url?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invitation_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          description: string | null
          id: string
          invoice_id: string
          line_discount_percent: number
          line_total: number
          product_id: string | null
          qty: number
          sort_order: number
          tax_rate: number
          unit_price: number
        }
        Insert: {
          description?: string | null
          id?: string
          invoice_id: string
          line_discount_percent?: number
          line_total?: number
          product_id?: string | null
          qty?: number
          sort_order?: number
          tax_rate?: number
          unit_price?: number
        }
        Update: {
          description?: string | null
          id?: string
          invoice_id?: string
          line_discount_percent?: number
          line_total?: number
          product_id?: string | null
          qty?: number
          sort_order?: number
          tax_rate?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          invoice_id: string
          method: string | null
          notes: string | null
          received_at: string
          recorded_by_account_id: string | null
          reference: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          invoice_id: string
          method?: string | null
          notes?: string | null
          received_at?: string
          recorded_by_account_id?: string | null
          reference?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          invoice_id?: string
          method?: string | null
          notes?: string | null
          received_at?: string
          recorded_by_account_id?: string | null
          reference?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          accounting_entry_id: string | null
          accounting_last_error: string | null
          accounting_posted_at: string | null
          accounting_status: string | null
          amount_paid: number
          balance: number
          base_amount: number | null
          base_currency: string | null
          cancelled_at: string | null
          created_at: string
          created_by_account_id: string | null
          currency: string
          customer_id: string | null
          deal_no: number | null
          discount_percent: number
          discount_total: number
          doc: Json
          due_date: string | null
          fx_conversion_date: string | null
          fx_rate: number | null
          id: string
          inv_no: string | null
          issue_date: string
          issued_at: string | null
          linked_project_id: string | null
          linked_quotation_id: string | null
          notes: string | null
          order_id: string | null
          paid_at: string | null
          payment_terms: string | null
          pdf_path: string | null
          sales_order_id: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          tax_rate: number
          tax_total: number
          tenant_id: string
          terms: string | null
          total: number
          updated_at: string
        }
        Insert: {
          accounting_entry_id?: string | null
          accounting_last_error?: string | null
          accounting_posted_at?: string | null
          accounting_status?: string | null
          amount_paid?: number
          balance?: number
          base_amount?: number | null
          base_currency?: string | null
          cancelled_at?: string | null
          created_at?: string
          created_by_account_id?: string | null
          currency?: string
          customer_id?: string | null
          deal_no?: number | null
          discount_percent?: number
          discount_total?: number
          doc?: Json
          due_date?: string | null
          fx_conversion_date?: string | null
          fx_rate?: number | null
          id?: string
          inv_no?: string | null
          issue_date?: string
          issued_at?: string | null
          linked_project_id?: string | null
          linked_quotation_id?: string | null
          notes?: string | null
          order_id?: string | null
          paid_at?: string | null
          payment_terms?: string | null
          pdf_path?: string | null
          sales_order_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_rate?: number
          tax_total?: number
          tenant_id: string
          terms?: string | null
          total?: number
          updated_at?: string
        }
        Update: {
          accounting_entry_id?: string | null
          accounting_last_error?: string | null
          accounting_posted_at?: string | null
          accounting_status?: string | null
          amount_paid?: number
          balance?: number
          base_amount?: number | null
          base_currency?: string | null
          cancelled_at?: string | null
          created_at?: string
          created_by_account_id?: string | null
          currency?: string
          customer_id?: string | null
          deal_no?: number | null
          discount_percent?: number
          discount_total?: number
          doc?: Json
          due_date?: string | null
          fx_conversion_date?: string | null
          fx_rate?: number | null
          id?: string
          inv_no?: string | null
          issue_date?: string
          issued_at?: string | null
          linked_project_id?: string | null
          linked_quotation_id?: string | null
          notes?: string | null
          order_id?: string | null
          paid_at?: string | null
          payment_terms?: string | null
          pdf_path?: string | null
          sales_order_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_rate?: number
          tax_total?: number
          tenant_id?: string
          terms?: string | null
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_accounting_entry_id_fkey"
            columns: ["accounting_entry_id"]
            isOneToOne: false
            referencedRelation: "accounting_journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      koleex_app_favorites: {
        Row: {
          account_id: string
          app_id: string
          created_at: string | null
          id: string
        }
        Insert: {
          account_id: string
          app_id: string
          created_at?: string | null
          id?: string
        }
        Update: {
          account_id?: string
          app_id?: string
          created_at?: string | null
          id?: string
        }
        Relationships: []
      }
      koleex_app_recent: {
        Row: {
          account_id: string
          app_id: string
          id: string
          opened_at: string | null
        }
        Insert: {
          account_id: string
          app_id: string
          id?: string
          opened_at?: string | null
        }
        Update: {
          account_id?: string
          app_id?: string
          id?: string
          opened_at?: string | null
        }
        Relationships: []
      }
      koleex_assignments: {
        Row: {
          created_at: string | null
          department_id: string
          end_date: string | null
          id: string
          is_active: boolean | null
          is_primary: boolean | null
          person_id: string
          position_id: string
          start_date: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          department_id: string
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          person_id: string
          position_id: string
          start_date?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          department_id?: string
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          person_id?: string
          position_id?: string
          start_date?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "koleex_assignments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "koleex_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "koleex_assignments_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "koleex_positions"
            referencedColumns: ["id"]
          },
        ]
      }
      koleex_calendar_event_attendees: {
        Row: {
          account_id: string
          created_at: string | null
          event_id: string
          id: string
          status: string
          tenant_id: string | null
        }
        Insert: {
          account_id: string
          created_at?: string | null
          event_id: string
          id?: string
          status?: string
          tenant_id?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string | null
          event_id?: string
          id?: string
          status?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "koleex_calendar_event_attendees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "koleex_calendar_events"
            referencedColumns: ["id"]
          },
        ]
      }
      koleex_calendar_event_exceptions: {
        Row: {
          created_at: string
          description: string | null
          end_at: string | null
          event_id: string
          id: string
          kind: string
          location: string | null
          meeting_url: string | null
          occurrence_start: string
          start_at: string | null
          tenant_id: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_at?: string | null
          event_id: string
          id?: string
          kind: string
          location?: string | null
          meeting_url?: string | null
          occurrence_start: string
          start_at?: string | null
          tenant_id?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_at?: string | null
          event_id?: string
          id?: string
          kind?: string
          location?: string | null
          meeting_url?: string | null
          occurrence_start?: string
          start_at?: string | null
          tenant_id?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "koleex_calendar_event_exceptions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "koleex_calendar_events"
            referencedColumns: ["id"]
          },
        ]
      }
      koleex_calendar_events: {
        Row: {
          account_id: string
          all_day: boolean
          color: string | null
          created_at: string
          description: string | null
          end_at: string
          event_type: string
          id: string
          is_private: boolean
          location: string | null
          meeting_url: string | null
          recurrence: string | null
          recurrence_until: string | null
          reminded_at: string | null
          reminder_minutes: number | null
          start_at: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          account_id: string
          all_day?: boolean
          color?: string | null
          created_at?: string
          description?: string | null
          end_at: string
          event_type?: string
          id?: string
          is_private?: boolean
          location?: string | null
          meeting_url?: string | null
          recurrence?: string | null
          recurrence_until?: string | null
          reminded_at?: string | null
          reminder_minutes?: number | null
          start_at: string
          tenant_id?: string
          title: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          all_day?: boolean
          color?: string | null
          created_at?: string
          description?: string | null
          end_at?: string
          event_type?: string
          id?: string
          is_private?: boolean
          location?: string | null
          meeting_url?: string | null
          recurrence?: string | null
          recurrence_until?: string | null
          reminded_at?: string | null
          reminder_minutes?: number | null
          start_at?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "koleex_calendar_events_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "koleex_calendar_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      koleex_departments: {
        Row: {
          created_at: string | null
          description: string | null
          icon: string | null
          icon_type: string | null
          icon_value: string | null
          id: string
          is_active: boolean | null
          name: string
          parent_id: string | null
          sort_order: number | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          icon_type?: string | null
          icon_value?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          parent_id?: string | null
          sort_order?: number | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          icon_type?: string | null
          icon_value?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          parent_id?: string | null
          sort_order?: number | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "koleex_departments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "koleex_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "koleex_departments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      koleex_employees: {
        Row: {
          account_id: string | null
          bank_account_holder: string | null
          bank_account_number: string | null
          bank_currency: string | null
          bank_iban: string | null
          bank_name: string | null
          bank_swift: string | null
          birth_date: string | null
          blood_type: string | null
          contract_end_date: string | null
          created_at: string
          department: string | null
          driving_license_expiry: string | null
          driving_license_number: string | null
          driving_license_type: string | null
          education_degree: string | null
          education_field: string | null
          education_graduation_year: string | null
          education_institution: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relationship: string | null
          emergency_contact2_name: string | null
          emergency_contact2_phone: string | null
          emergency_contact2_relationship: string | null
          employee_number: string | null
          employment_status: string | null
          employment_type: string | null
          gender: string | null
          hire_date: string | null
          id: string
          identification_id: string | null
          initial_salary: number | null
          insurance_class: string | null
          insurance_expiry_date: string | null
          insurance_policy_number: string | null
          insurance_provider: string | null
          languages: string | null
          manager_id: string | null
          marital_status: string | null
          national_id_back_doc_url: string | null
          national_id_doc_url: string | null
          nationality: string | null
          notes: string | null
          number_of_children: number | null
          passport_doc_url: string | null
          passport_number: string | null
          person_id: string | null
          position: string | null
          probation_end_date: string | null
          punch_method: string
          religion: string | null
          salary_currency: string | null
          social_accounts: Json | null
          social_security_number: string | null
          tax_id: string | null
          tenant_id: string | null
          updated_at: string
          visa_doc_url: string | null
          visa_expiry_date: string | null
          visa_number: string | null
          wechat_id: string | null
          wechat_qr_url: string | null
          work_country: string | null
          work_email: string | null
          work_location: string | null
          work_phone: string | null
          works_remote: boolean
        }
        Insert: {
          account_id?: string | null
          bank_account_holder?: string | null
          bank_account_number?: string | null
          bank_currency?: string | null
          bank_iban?: string | null
          bank_name?: string | null
          bank_swift?: string | null
          birth_date?: string | null
          blood_type?: string | null
          contract_end_date?: string | null
          created_at?: string
          department?: string | null
          driving_license_expiry?: string | null
          driving_license_number?: string | null
          driving_license_type?: string | null
          education_degree?: string | null
          education_field?: string | null
          education_graduation_year?: string | null
          education_institution?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          emergency_contact2_name?: string | null
          emergency_contact2_phone?: string | null
          emergency_contact2_relationship?: string | null
          employee_number?: string | null
          employment_status?: string | null
          employment_type?: string | null
          gender?: string | null
          hire_date?: string | null
          id?: string
          identification_id?: string | null
          initial_salary?: number | null
          insurance_class?: string | null
          insurance_expiry_date?: string | null
          insurance_policy_number?: string | null
          insurance_provider?: string | null
          languages?: string | null
          manager_id?: string | null
          marital_status?: string | null
          national_id_back_doc_url?: string | null
          national_id_doc_url?: string | null
          nationality?: string | null
          notes?: string | null
          number_of_children?: number | null
          passport_doc_url?: string | null
          passport_number?: string | null
          person_id?: string | null
          position?: string | null
          probation_end_date?: string | null
          punch_method?: string
          religion?: string | null
          salary_currency?: string | null
          social_accounts?: Json | null
          social_security_number?: string | null
          tax_id?: string | null
          tenant_id?: string | null
          updated_at?: string
          visa_doc_url?: string | null
          visa_expiry_date?: string | null
          visa_number?: string | null
          wechat_id?: string | null
          wechat_qr_url?: string | null
          work_country?: string | null
          work_email?: string | null
          work_location?: string | null
          work_phone?: string | null
          works_remote?: boolean
        }
        Update: {
          account_id?: string | null
          bank_account_holder?: string | null
          bank_account_number?: string | null
          bank_currency?: string | null
          bank_iban?: string | null
          bank_name?: string | null
          bank_swift?: string | null
          birth_date?: string | null
          blood_type?: string | null
          contract_end_date?: string | null
          created_at?: string
          department?: string | null
          driving_license_expiry?: string | null
          driving_license_number?: string | null
          driving_license_type?: string | null
          education_degree?: string | null
          education_field?: string | null
          education_graduation_year?: string | null
          education_institution?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          emergency_contact2_name?: string | null
          emergency_contact2_phone?: string | null
          emergency_contact2_relationship?: string | null
          employee_number?: string | null
          employment_status?: string | null
          employment_type?: string | null
          gender?: string | null
          hire_date?: string | null
          id?: string
          identification_id?: string | null
          initial_salary?: number | null
          insurance_class?: string | null
          insurance_expiry_date?: string | null
          insurance_policy_number?: string | null
          insurance_provider?: string | null
          languages?: string | null
          manager_id?: string | null
          marital_status?: string | null
          national_id_back_doc_url?: string | null
          national_id_doc_url?: string | null
          nationality?: string | null
          notes?: string | null
          number_of_children?: number | null
          passport_doc_url?: string | null
          passport_number?: string | null
          person_id?: string | null
          position?: string | null
          probation_end_date?: string | null
          punch_method?: string
          religion?: string | null
          salary_currency?: string | null
          social_accounts?: Json | null
          social_security_number?: string | null
          tax_id?: string | null
          tenant_id?: string | null
          updated_at?: string
          visa_doc_url?: string | null
          visa_expiry_date?: string | null
          visa_number?: string | null
          wechat_id?: string | null
          wechat_qr_url?: string | null
          work_country?: string | null
          work_email?: string | null
          work_location?: string | null
          work_phone?: string | null
          works_remote?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "koleex_employees_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "koleex_employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "koleex_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "koleex_employees_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "koleex_employees_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      koleex_event_agenda_items: {
        Row: {
          created_at: string
          description: string | null
          ends_at: string | null
          event_id: string
          id: string
          location: string | null
          sort_order: number
          speaker: string | null
          starts_at: string | null
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          ends_at?: string | null
          event_id: string
          id?: string
          location?: string | null
          sort_order?: number
          speaker?: string | null
          starts_at?: string | null
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          ends_at?: string | null
          event_id?: string
          id?: string
          location?: string | null
          sort_order?: number
          speaker?: string | null
          starts_at?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "koleex_event_agenda_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "koleex_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "koleex_event_agenda_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      koleex_event_budget_lines: {
        Row: {
          actual: number
          category: string
          created_at: string
          event_id: string
          id: string
          label: string
          notes: string | null
          planned: number
          sort_order: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          actual?: number
          category?: string
          created_at?: string
          event_id: string
          id?: string
          label: string
          notes?: string | null
          planned?: number
          sort_order?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          actual?: number
          category?: string
          created_at?: string
          event_id?: string
          id?: string
          label?: string
          notes?: string | null
          planned?: number
          sort_order?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "koleex_event_budget_lines_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "koleex_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "koleex_event_budget_lines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      koleex_event_guests: {
        Row: {
          account_id: string | null
          category: string
          checked_in_at: string | null
          checked_in_by: string | null
          company: string | null
          contact_id: string | null
          created_at: string
          email: string | null
          event_id: string
          id: string
          invited_at: string | null
          name: string
          notes: string | null
          phone: string | null
          responded_at: string | null
          source: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          category?: string
          checked_in_at?: string | null
          checked_in_by?: string | null
          company?: string | null
          contact_id?: string | null
          created_at?: string
          email?: string | null
          event_id: string
          id?: string
          invited_at?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          responded_at?: string | null
          source?: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          category?: string
          checked_in_at?: string | null
          checked_in_by?: string | null
          company?: string | null
          contact_id?: string | null
          created_at?: string
          email?: string | null
          event_id?: string
          id?: string
          invited_at?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          responded_at?: string | null
          source?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "koleex_event_guests_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "koleex_event_guests_checked_in_by_fkey"
            columns: ["checked_in_by"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "koleex_event_guests_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "koleex_event_guests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "koleex_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "koleex_event_guests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      koleex_event_invitations: {
        Row: {
          answered_at: string | null
          channel: string
          created_at: string
          event_id: string
          guest_id: string
          id: string
          note: string | null
          sent_at: string | null
          sent_by: string | null
          status: string
          tenant_id: string
          token: string
          updated_at: string
          viewed_at: string | null
        }
        Insert: {
          answered_at?: string | null
          channel?: string
          created_at?: string
          event_id: string
          guest_id: string
          id?: string
          note?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          tenant_id: string
          token?: string
          updated_at?: string
          viewed_at?: string | null
        }
        Update: {
          answered_at?: string | null
          channel?: string
          created_at?: string
          event_id?: string
          guest_id?: string
          id?: string
          note?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          tenant_id?: string
          token?: string
          updated_at?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "koleex_event_invitations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "koleex_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "koleex_event_invitations_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: true
            referencedRelation: "koleex_event_guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "koleex_event_invitations_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "koleex_event_invitations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      koleex_events: {
        Row: {
          booth: string | null
          budget_total: number | null
          city: string | null
          country: string | null
          created_at: string
          created_by: string | null
          description: string | null
          end_at: string | null
          expected_guests: number | null
          id: string
          location: string | null
          owner_account_id: string
          start_at: string | null
          status: string
          tenant_id: string
          title: string
          type: string
          updated_at: string
          website: string | null
        }
        Insert: {
          booth?: string | null
          budget_total?: number | null
          city?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_at?: string | null
          expected_guests?: number | null
          id?: string
          location?: string | null
          owner_account_id: string
          start_at?: string | null
          status?: string
          tenant_id: string
          title: string
          type?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          booth?: string | null
          budget_total?: number | null
          city?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_at?: string | null
          expected_guests?: number | null
          id?: string
          location?: string | null
          owner_account_id?: string
          start_at?: string | null
          status?: string
          tenant_id?: string
          title?: string
          type?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "koleex_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "koleex_events_owner_account_id_fkey"
            columns: ["owner_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "koleex_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      koleex_holidays: {
        Row: {
          country: string | null
          created_at: string
          customer_id: string | null
          holiday_date: string | null
          holiday_type: string
          id: string
          is_active: boolean
          name: string
          recurs_annually: boolean
          scope_type: string
          tenant_id: string
          updated_at: string
          weekday: number | null
        }
        Insert: {
          country?: string | null
          created_at?: string
          customer_id?: string | null
          holiday_date?: string | null
          holiday_type?: string
          id?: string
          is_active?: boolean
          name: string
          recurs_annually?: boolean
          scope_type?: string
          tenant_id: string
          updated_at?: string
          weekday?: number | null
        }
        Update: {
          country?: string | null
          created_at?: string
          customer_id?: string | null
          holiday_date?: string | null
          holiday_type?: string
          id?: string
          is_active?: boolean
          name?: string
          recurs_annually?: boolean
          scope_type?: string
          tenant_id?: string
          updated_at?: string
          weekday?: number | null
        }
        Relationships: []
      }
      koleex_permissions: {
        Row: {
          can_create: boolean | null
          can_delete: boolean | null
          can_edit: boolean | null
          can_view: boolean | null
          created_at: string | null
          data_scope: string
          id: string
          module_name: string
          role_id: string
        }
        Insert: {
          can_create?: boolean | null
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          data_scope?: string
          id?: string
          module_name: string
          role_id: string
        }
        Update: {
          can_create?: boolean | null
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          data_scope?: string
          id?: string
          module_name?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "koleex_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "koleex_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      koleex_position_history: {
        Row: {
          action: string
          changed_by_account_id: string | null
          created_at: string | null
          department_id: string | null
          from_position_id: string | null
          id: string
          notes: string | null
          person_id: string
          position_id: string
          to_position_id: string | null
        }
        Insert: {
          action: string
          changed_by_account_id?: string | null
          created_at?: string | null
          department_id?: string | null
          from_position_id?: string | null
          id?: string
          notes?: string | null
          person_id: string
          position_id: string
          to_position_id?: string | null
        }
        Update: {
          action?: string
          changed_by_account_id?: string | null
          created_at?: string | null
          department_id?: string | null
          from_position_id?: string | null
          id?: string
          notes?: string | null
          person_id?: string
          position_id?: string
          to_position_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "koleex_position_history_changed_by_account_id_fkey"
            columns: ["changed_by_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "koleex_position_history_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "koleex_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "koleex_position_history_from_position_id_fkey"
            columns: ["from_position_id"]
            isOneToOne: false
            referencedRelation: "koleex_positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "koleex_position_history_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "koleex_position_history_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "koleex_positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "koleex_position_history_to_position_id_fkey"
            columns: ["to_position_id"]
            isOneToOne: false
            referencedRelation: "koleex_positions"
            referencedColumns: ["id"]
          },
        ]
      }
      koleex_positions: {
        Row: {
          created_at: string | null
          department_id: string
          description: string | null
          id: string
          is_active: boolean | null
          level: number | null
          reports_to_position_id: string | null
          requirements: string | null
          responsibilities: string | null
          role_id: string | null
          sort_order: number | null
          tenant_id: string | null
          title: string
          title_ar: string | null
          title_zh: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          department_id: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          level?: number | null
          reports_to_position_id?: string | null
          requirements?: string | null
          responsibilities?: string | null
          role_id?: string | null
          sort_order?: number | null
          tenant_id?: string | null
          title: string
          title_ar?: string | null
          title_zh?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          department_id?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          level?: number | null
          reports_to_position_id?: string | null
          requirements?: string | null
          responsibilities?: string | null
          role_id?: string | null
          sort_order?: number | null
          tenant_id?: string | null
          title?: string
          title_ar?: string | null
          title_zh?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_positions_role"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "koleex_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "koleex_positions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "koleex_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "koleex_positions_reports_to_position_id_fkey"
            columns: ["reports_to_position_id"]
            isOneToOne: false
            referencedRelation: "koleex_positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "koleex_positions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      koleex_private_access_log: {
        Row: {
          access_reason: string | null
          accessed_at: string
          account_id: string
          id: string
          ip_address: string | null
          module_name: string
          record_id: string | null
          record_type: string
          role_id: string | null
          tenant_id: string | null
          user_agent: string | null
        }
        Insert: {
          access_reason?: string | null
          accessed_at?: string
          account_id: string
          id?: string
          ip_address?: string | null
          module_name: string
          record_id?: string | null
          record_type: string
          role_id?: string | null
          tenant_id?: string | null
          user_agent?: string | null
        }
        Update: {
          access_reason?: string | null
          accessed_at?: string
          account_id?: string
          id?: string
          ip_address?: string | null
          module_name?: string
          record_id?: string | null
          record_type?: string
          role_id?: string | null
          tenant_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "koleex_private_access_log_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "koleex_private_access_log_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "koleex_private_access_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      koleex_recycle_bin: {
        Row: {
          account_id: string | null
          deleted_at: string
          deleted_by: string | null
          id: string
          kind: string
          label: string | null
          person_id: string | null
          restored_at: string | null
          snapshot: Json
          tenant_id: string | null
        }
        Insert: {
          account_id?: string | null
          deleted_at?: string
          deleted_by?: string | null
          id?: string
          kind: string
          label?: string | null
          person_id?: string | null
          restored_at?: string | null
          snapshot: Json
          tenant_id?: string | null
        }
        Update: {
          account_id?: string | null
          deleted_at?: string
          deleted_by?: string | null
          id?: string
          kind?: string
          label?: string | null
          person_id?: string | null
          restored_at?: string | null
          snapshot?: Json
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "koleex_recycle_bin_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "koleex_recycle_bin_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      koleex_roles: {
        Row: {
          can_view_private: boolean
          created_at: string | null
          description: string | null
          id: string
          is_super_admin: boolean
          name: string
          updated_at: string | null
        }
        Insert: {
          can_view_private?: boolean
          created_at?: string | null
          description?: string | null
          id?: string
          is_super_admin?: boolean
          name: string
          updated_at?: string | null
        }
        Update: {
          can_view_private?: boolean
          created_at?: string | null
          description?: string | null
          id?: string
          is_super_admin?: boolean
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      koleex_security_audit: {
        Row: {
          action: string
          actor_account_id: string
          created_at: string
          details: Json | null
          id: string
          ip: string | null
          target_account_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_account_id: string
          created_at?: string
          details?: Json | null
          id?: string
          ip?: string | null
          target_account_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_account_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip?: string | null
          target_account_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      koleex_todo_assignees: {
        Row: {
          account_id: string
          assigned_at: string
          id: string
          todo_id: string
        }
        Insert: {
          account_id: string
          assigned_at?: string
          id?: string
          todo_id: string
        }
        Update: {
          account_id?: string
          assigned_at?: string
          id?: string
          todo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "koleex_todo_assignees_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "koleex_todo_assignees_todo_id_fkey"
            columns: ["todo_id"]
            isOneToOne: false
            referencedRelation: "koleex_todos"
            referencedColumns: ["id"]
          },
        ]
      }
      koleex_todo_labels: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          tenant_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          tenant_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          tenant_id?: string | null
        }
        Relationships: []
      }
      koleex_todo_notes: {
        Row: {
          author_account_id: string | null
          body: string
          created_at: string
          id: string
          todo_id: string
          updated_at: string
        }
        Insert: {
          author_account_id?: string | null
          body: string
          created_at?: string
          id?: string
          todo_id: string
          updated_at?: string
        }
        Update: {
          author_account_id?: string | null
          body?: string
          created_at?: string
          id?: string
          todo_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "koleex_todo_notes_author_account_id_fkey"
            columns: ["author_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "koleex_todo_notes_todo_id_fkey"
            columns: ["todo_id"]
            isOneToOne: false
            referencedRelation: "koleex_todos"
            referencedColumns: ["id"]
          },
        ]
      }
      koleex_todos: {
        Row: {
          approval_state: string | null
          approved_at: string | null
          approved_by_account_id: string | null
          assign_to_all: boolean
          assigned_by_account_id: string | null
          assigned_department: string | null
          completed: boolean
          completed_at: string | null
          created_at: string
          created_by_account_id: string | null
          description: string | null
          due_date: string | null
          id: string
          is_private: boolean
          label: string | null
          metadata: Json
          priority: string
          recurrence: string | null
          recurrence_parent_id: string | null
          recurrence_spawned_for: string | null
          recurrence_until: string | null
          remind_at: string | null
          reminded_at: string | null
          source: string
          source_id: string | null
          start_date: string | null
          status: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          approval_state?: string | null
          approved_at?: string | null
          approved_by_account_id?: string | null
          assign_to_all?: boolean
          assigned_by_account_id?: string | null
          assigned_department?: string | null
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          created_by_account_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_private?: boolean
          label?: string | null
          metadata?: Json
          priority?: string
          recurrence?: string | null
          recurrence_parent_id?: string | null
          recurrence_spawned_for?: string | null
          recurrence_until?: string | null
          remind_at?: string | null
          reminded_at?: string | null
          source?: string
          source_id?: string | null
          start_date?: string | null
          status?: string
          tenant_id?: string
          title: string
          updated_at?: string
        }
        Update: {
          approval_state?: string | null
          approved_at?: string | null
          approved_by_account_id?: string | null
          assign_to_all?: boolean
          assigned_by_account_id?: string | null
          assigned_department?: string | null
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          created_by_account_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_private?: boolean
          label?: string | null
          metadata?: Json
          priority?: string
          recurrence?: string | null
          recurrence_parent_id?: string | null
          recurrence_spawned_for?: string | null
          recurrence_until?: string | null
          remind_at?: string | null
          reminded_at?: string | null
          source?: string
          source_id?: string | null
          start_date?: string | null
          status?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "koleex_todos_assigned_by_account_id_fkey"
            columns: ["assigned_by_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "koleex_todos_created_by_account_id_fkey"
            columns: ["created_by_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "koleex_todos_recurrence_parent_id_fkey"
            columns: ["recurrence_parent_id"]
            isOneToOne: false
            referencedRelation: "koleex_todos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "koleex_todos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      landed_cost_calculations: {
        Row: {
          actual_price_usd: number | null
          arrival_port: string | null
          bank_commission_percent: number | null
          bank_fx_rate: number | null
          calculation_name: string | null
          city_id: string | null
          company_type: string | null
          container_freight_usd: number | null
          container_size: string | null
          cost_per_unit: number | null
          created_at: string | null
          created_by: string | null
          departure_port: string | null
          hs_code: string | null
          id: string
          import_duty_percent: number | null
          import_method: string | null
          inland_trucking_usd: number | null
          low_value_invoice: boolean | null
          machine_cbm: number | null
          market_id: string | null
          port_clearance_usd: number | null
          port_id: string | null
          product_name: string | null
          total_landed_cost: number | null
          vat_percent: number | null
        }
        Insert: {
          actual_price_usd?: number | null
          arrival_port?: string | null
          bank_commission_percent?: number | null
          bank_fx_rate?: number | null
          calculation_name?: string | null
          city_id?: string | null
          company_type?: string | null
          container_freight_usd?: number | null
          container_size?: string | null
          cost_per_unit?: number | null
          created_at?: string | null
          created_by?: string | null
          departure_port?: string | null
          hs_code?: string | null
          id?: string
          import_duty_percent?: number | null
          import_method?: string | null
          inland_trucking_usd?: number | null
          low_value_invoice?: boolean | null
          machine_cbm?: number | null
          market_id?: string | null
          port_clearance_usd?: number | null
          port_id?: string | null
          product_name?: string | null
          total_landed_cost?: number | null
          vat_percent?: number | null
        }
        Update: {
          actual_price_usd?: number | null
          arrival_port?: string | null
          bank_commission_percent?: number | null
          bank_fx_rate?: number | null
          calculation_name?: string | null
          city_id?: string | null
          company_type?: string | null
          container_freight_usd?: number | null
          container_size?: string | null
          cost_per_unit?: number | null
          created_at?: string | null
          created_by?: string | null
          departure_port?: string | null
          hs_code?: string | null
          id?: string
          import_duty_percent?: number | null
          import_method?: string | null
          inland_trucking_usd?: number | null
          low_value_invoice?: boolean | null
          machine_cbm?: number | null
          market_id?: string | null
          port_clearance_usd?: number | null
          port_id?: string | null
          product_name?: string | null
          total_landed_cost?: number | null
          vat_percent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "landed_cost_calculations_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "market_cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landed_cost_calculations_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landed_cost_calculations_port_id_fkey"
            columns: ["port_id"]
            isOneToOne: false
            referencedRelation: "market_ports"
            referencedColumns: ["id"]
          },
        ]
      }
      landed_cost_simulations: {
        Row: {
          actuals: Json | null
          brand: string | null
          commercial: Json | null
          confidence: string | null
          country_of_origin: string | null
          created_at: string | null
          currencies: Json | null
          currency: string | null
          customer_city: string | null
          customer_company: string | null
          customer_country: string | null
          customer_name: string | null
          customs_profile: Json | null
          export_costs: Json | null
          financial: Json | null
          hs_code: string | null
          id: string
          import_costs: Json | null
          inland_delivery: Json | null
          model_id: string | null
          model_name: string | null
          name: string
          notes: string | null
          price_basis: string | null
          product_id: string | null
          product_info: Json | null
          product_name: string | null
          quantity: number | null
          responsibility: Json | null
          results: Json | null
          shipping: Json | null
          sku: string | null
          status: string
          unit_price: number | null
          updated_at: string | null
          warehouse_destination: string | null
        }
        Insert: {
          actuals?: Json | null
          brand?: string | null
          commercial?: Json | null
          confidence?: string | null
          country_of_origin?: string | null
          created_at?: string | null
          currencies?: Json | null
          currency?: string | null
          customer_city?: string | null
          customer_company?: string | null
          customer_country?: string | null
          customer_name?: string | null
          customs_profile?: Json | null
          export_costs?: Json | null
          financial?: Json | null
          hs_code?: string | null
          id?: string
          import_costs?: Json | null
          inland_delivery?: Json | null
          model_id?: string | null
          model_name?: string | null
          name?: string
          notes?: string | null
          price_basis?: string | null
          product_id?: string | null
          product_info?: Json | null
          product_name?: string | null
          quantity?: number | null
          responsibility?: Json | null
          results?: Json | null
          shipping?: Json | null
          sku?: string | null
          status?: string
          unit_price?: number | null
          updated_at?: string | null
          warehouse_destination?: string | null
        }
        Update: {
          actuals?: Json | null
          brand?: string | null
          commercial?: Json | null
          confidence?: string | null
          country_of_origin?: string | null
          created_at?: string | null
          currencies?: Json | null
          currency?: string | null
          customer_city?: string | null
          customer_company?: string | null
          customer_country?: string | null
          customer_name?: string | null
          customs_profile?: Json | null
          export_costs?: Json | null
          financial?: Json | null
          hs_code?: string | null
          id?: string
          import_costs?: Json | null
          inland_delivery?: Json | null
          model_id?: string | null
          model_name?: string | null
          name?: string
          notes?: string | null
          price_basis?: string | null
          product_id?: string | null
          product_info?: Json | null
          product_name?: string | null
          quantity?: number | null
          responsibility?: Json | null
          results?: Json | null
          shipping?: Json | null
          sku?: string | null
          status?: string
          unit_price?: number | null
          updated_at?: string | null
          warehouse_destination?: string | null
        }
        Relationships: []
      }
      login_attempts: {
        Row: {
          account_id: string | null
          created_at: string
          id: string
          identifier: string
          identifier_hash: string | null
          ip_address: string
          metadata: Json
          outcome: string
          reason: string | null
          tenant_id: string | null
          user_agent: string | null
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          id?: string
          identifier: string
          identifier_hash?: string | null
          ip_address: string
          metadata?: Json
          outcome: string
          reason?: string | null
          tenant_id?: string | null
          user_agent?: string | null
        }
        Update: {
          account_id?: string | null
          created_at?: string
          id?: string
          identifier?: string
          identifier_hash?: string | null
          ip_address?: string
          metadata?: Json
          outcome?: string
          reason?: string | null
          tenant_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "login_attempts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "login_attempts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      market_cities: {
        Row: {
          city_name: string
          created_at: string
          id: string
          market_id: string
        }
        Insert: {
          city_name: string
          created_at?: string
          id?: string
          market_id: string
        }
        Update: {
          city_name?: string
          created_at?: string
          id?: string
          market_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_cities_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
        ]
      }
      market_ports: {
        Row: {
          city_id: string | null
          created_at: string
          id: string
          market_id: string
          port_name: string
          port_type: string | null
        }
        Insert: {
          city_id?: string | null
          created_at?: string
          id?: string
          market_id: string
          port_name: string
          port_type?: string | null
        }
        Update: {
          city_id?: string | null
          created_at?: string
          id?: string
          market_id?: string
          port_name?: string
          port_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "market_ports_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "market_cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_ports_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_account_days: {
        Row: {
          account_id: string
          audience: number | null
          day: string
          engagement: number | null
          posts: number | null
          tenant_id: string
        }
        Insert: {
          account_id: string
          audience?: number | null
          day: string
          engagement?: number | null
          posts?: number | null
          tenant_id: string
        }
        Update: {
          account_id?: string
          audience?: number | null
          day?: string
          engagement?: number | null
          posts?: number | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_account_days_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "marketing_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_accounts: {
        Row: {
          audience: number | null
          avatar_url: string | null
          connected_by: string | null
          connection: string
          created_at: string
          external_id: string | null
          handle: string | null
          id: string
          last_error: string | null
          last_synced_at: string | null
          name: string
          platform: string
          profile_url: string | null
          scopes: string[]
          space: string
          status: string
          sync_state: Json
          tenant_id: string
          token_encrypted: string | null
          token_expires_at: string | null
          updated_at: string
          user_token_encrypted: string | null
          user_token_expires_at: string | null
        }
        Insert: {
          audience?: number | null
          avatar_url?: string | null
          connected_by?: string | null
          connection?: string
          created_at?: string
          external_id?: string | null
          handle?: string | null
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          name: string
          platform: string
          profile_url?: string | null
          scopes?: string[]
          space?: string
          status?: string
          sync_state?: Json
          tenant_id: string
          token_encrypted?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_token_encrypted?: string | null
          user_token_expires_at?: string | null
        }
        Update: {
          audience?: number | null
          avatar_url?: string | null
          connected_by?: string | null
          connection?: string
          created_at?: string
          external_id?: string | null
          handle?: string | null
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          name?: string
          platform?: string
          profile_url?: string | null
          scopes?: string[]
          space?: string
          status?: string
          sync_state?: Json
          tenant_id?: string
          token_encrypted?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_token_encrypted?: string | null
          user_token_expires_at?: string | null
        }
        Relationships: []
      }
      marketing_ad_posts: {
        Row: {
          account_id: string
          comments: number | null
          comments_seen: number | null
          created_at: string
          external_id: string
          id: string
          media: Json
          message: string | null
          permalink: string | null
          posted_at: string | null
          seen_at: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          account_id: string
          comments?: number | null
          comments_seen?: number | null
          created_at?: string
          external_id: string
          id?: string
          media?: Json
          message?: string | null
          permalink?: string | null
          posted_at?: string | null
          seen_at?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          comments?: number | null
          comments_seen?: number | null
          created_at?: string
          external_id?: string
          id?: string
          media?: Json
          message?: string | null
          permalink?: string | null
          posted_at?: string | null
          seen_at?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_ad_posts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "marketing_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_comments: {
        Row: {
          account_id: string
          ad_post_id: string | null
          author_avatar_url: string | null
          author_external_id: string | null
          author_name: string | null
          commented_at: string | null
          created_at: string
          external_id: string
          handled_at: string | null
          handled_by: string | null
          hidden: boolean
          id: string
          is_ours: boolean
          message: string | null
          notified_at: string | null
          parent_external_id: string | null
          remote_post_id: string | null
          replied_at: string | null
          replied_by: string | null
          tenant_id: string
        }
        Insert: {
          account_id: string
          ad_post_id?: string | null
          author_avatar_url?: string | null
          author_external_id?: string | null
          author_name?: string | null
          commented_at?: string | null
          created_at?: string
          external_id: string
          handled_at?: string | null
          handled_by?: string | null
          hidden?: boolean
          id?: string
          is_ours?: boolean
          message?: string | null
          notified_at?: string | null
          parent_external_id?: string | null
          remote_post_id?: string | null
          replied_at?: string | null
          replied_by?: string | null
          tenant_id: string
        }
        Update: {
          account_id?: string
          ad_post_id?: string | null
          author_avatar_url?: string | null
          author_external_id?: string | null
          author_name?: string | null
          commented_at?: string | null
          created_at?: string
          external_id?: string
          handled_at?: string | null
          handled_by?: string | null
          hidden?: boolean
          id?: string
          is_ours?: boolean
          message?: string | null
          notified_at?: string | null
          parent_external_id?: string | null
          remote_post_id?: string | null
          replied_at?: string | null
          replied_by?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_comments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "marketing_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_comments_ad_post_id_fkey"
            columns: ["ad_post_id"]
            isOneToOne: false
            referencedRelation: "marketing_ad_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_comments_remote_post_id_fkey"
            columns: ["remote_post_id"]
            isOneToOne: false
            referencedRelation: "marketing_remote_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_conversations: {
        Row: {
          account_id: string
          created_at: string
          customer_avatar_at: string | null
          customer_avatar_url: string | null
          customer_external_id: string | null
          customer_name: string | null
          customer_username: string | null
          external_id: string
          handled_at: string | null
          handled_by: string | null
          id: string
          last_customer_at: string | null
          last_from_us: boolean
          last_message_at: string | null
          notified_at: string | null
          snippet: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          customer_avatar_at?: string | null
          customer_avatar_url?: string | null
          customer_external_id?: string | null
          customer_name?: string | null
          customer_username?: string | null
          external_id: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          last_customer_at?: string | null
          last_from_us?: boolean
          last_message_at?: string | null
          notified_at?: string | null
          snippet?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          customer_avatar_at?: string | null
          customer_avatar_url?: string | null
          customer_external_id?: string | null
          customer_name?: string | null
          customer_username?: string | null
          external_id?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          last_customer_at?: string | null
          last_from_us?: boolean
          last_message_at?: string | null
          notified_at?: string | null
          snippet?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_conversations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "marketing_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_insight_days: {
        Row: {
          account_id: string
          day: string
          metrics: Json
          synced_at: string
          tenant_id: string
        }
        Insert: {
          account_id: string
          day: string
          metrics?: Json
          synced_at?: string
          tenant_id: string
        }
        Update: {
          account_id?: string
          day?: string
          metrics?: Json
          synced_at?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_insight_days_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "marketing_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_links: {
        Row: {
          clicks: number
          code: string
          created_at: string
          created_by: string | null
          id: string
          last_clicked_at: string | null
          target_url: string
          tenant_id: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          clicks?: number
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          last_clicked_at?: string | null
          target_url: string
          tenant_id: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          clicks?: number
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          last_clicked_at?: string | null
          target_url?: string
          tenant_id?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: []
      }
      marketing_messages: {
        Row: {
          account_id: string
          attachments: Json
          conversation_id: string
          created_at: string
          external_id: string
          from_us: boolean
          id: string
          sent_at: string | null
          sent_by: string | null
          tenant_id: string
          text: string | null
        }
        Insert: {
          account_id: string
          attachments?: Json
          conversation_id: string
          created_at?: string
          external_id: string
          from_us?: boolean
          id?: string
          sent_at?: string | null
          sent_by?: string | null
          tenant_id: string
          text?: string | null
        }
        Update: {
          account_id?: string
          attachments?: Json
          conversation_id?: string
          created_at?: string
          external_id?: string
          from_us?: boolean
          id?: string
          sent_at?: string | null
          sent_by?: string | null
          tenant_id?: string
          text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_messages_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "marketing_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "marketing_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_post_targets: {
        Row: {
          account_id: string
          attempts: number
          body_override: string | null
          created_at: string
          error: string | null
          external_post_id: string | null
          id: string
          next_attempt_at: string | null
          permalink: string | null
          post_id: string
          publish_state: Json
          published_at: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          account_id: string
          attempts?: number
          body_override?: string | null
          created_at?: string
          error?: string | null
          external_post_id?: string | null
          id?: string
          next_attempt_at?: string | null
          permalink?: string | null
          post_id: string
          publish_state?: Json
          published_at?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          attempts?: number
          body_override?: string | null
          created_at?: string
          error?: string | null
          external_post_id?: string | null
          id?: string
          next_attempt_at?: string | null
          permalink?: string | null
          post_id?: string
          publish_state?: Json
          published_at?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_post_targets_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "marketing_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_post_targets_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "marketing_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_posts: {
        Row: {
          body: string
          capture: Json | null
          content_check: Json | null
          created_at: string
          created_by: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          id: string
          link_id: string | null
          media: Json
          published_at: string | null
          scheduled_at: string | null
          space: string
          status: string
          submitted_at: string | null
          tenant_id: string
          updated_at: string
          version: number
        }
        Insert: {
          body?: string
          capture?: Json | null
          content_check?: Json | null
          created_at?: string
          created_by: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          link_id?: string | null
          media?: Json
          published_at?: string | null
          scheduled_at?: string | null
          space?: string
          status?: string
          submitted_at?: string | null
          tenant_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          body?: string
          capture?: Json | null
          content_check?: Json | null
          created_at?: string
          created_by?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          link_id?: string | null
          media?: Json
          published_at?: string | null
          scheduled_at?: string | null
          space?: string
          status?: string
          submitted_at?: string | null
          tenant_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "marketing_posts_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "marketing_links"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_remote_posts: {
        Row: {
          account_id: string
          created_at: string
          external_id: string
          id: string
          media: Json
          message: string | null
          metrics: Json
          metrics_at: string | null
          permalink: string | null
          posted_at: string | null
          target_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          external_id: string
          id?: string
          media?: Json
          message?: string | null
          metrics?: Json
          metrics_at?: string | null
          permalink?: string | null
          posted_at?: string | null
          target_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          external_id?: string
          id?: string
          media?: Json
          message?: string | null
          metrics?: Json
          metrics_at?: string | null
          permalink?: string | null
          posted_at?: string | null
          target_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_remote_posts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "marketing_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_remote_posts_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "marketing_post_targets"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_week_plans: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          closed_at: string | null
          created_at: string
          id: string
          result: Json | null
          space: string
          status: string
          summary: Json | null
          tasks: Json
          tenant_id: string
          updated_at: string
          version: number
          week_start: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          closed_at?: string | null
          created_at?: string
          id?: string
          result?: Json | null
          space?: string
          status?: string
          summary?: Json | null
          tasks?: Json
          tenant_id: string
          updated_at?: string
          version?: number
          week_start: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          closed_at?: string | null
          created_at?: string
          id?: string
          result?: Json | null
          space?: string
          status?: string
          summary?: Json | null
          tasks?: Json
          tenant_id?: string
          updated_at?: string
          version?: number
          week_start?: string
        }
        Relationships: []
      }
      markets: {
        Row: {
          adjustment_percent: number
          created_at: string
          currency_code: string | null
          id: string
          name: string
          notes: string | null
          region: string | null
          status: string
        }
        Insert: {
          adjustment_percent?: number
          created_at?: string
          currency_code?: string | null
          id?: string
          name: string
          notes?: string | null
          region?: string | null
          status?: string
        }
        Update: {
          adjustment_percent?: number
          created_at?: string
          currency_code?: string | null
          id?: string
          name?: string
          notes?: string | null
          region?: string | null
          status?: string
        }
        Relationships: []
      }
      media: {
        Row: {
          created_at: string | null
          file_path: string
          id: string
          name: string
          size: number | null
          type: string
          url: string
        }
        Insert: {
          created_at?: string | null
          file_path: string
          id?: string
          name: string
          size?: number | null
          type?: string
          url: string
        }
        Update: {
          created_at?: string | null
          file_path?: string
          id?: string
          name?: string
          size?: number | null
          type?: string
          url?: string
        }
        Relationships: []
      }
      membership_requests: {
        Row: {
          company: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          message: string | null
          metadata: Json | null
          ref: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source: string | null
          status: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          message?: string | null
          metadata?: Json | null
          ref?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string | null
          status?: string
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          message?: string | null
          metadata?: Json | null
          ref?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      model_translations: {
        Row: {
          created_at: string | null
          id: string
          locale: string
          model_id: string
          model_name: string
          tagline: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          locale: string
          model_id: string
          model_name: string
          tagline?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          locale?: string
          model_id?: string
          model_name?: string
          tagline?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "model_translations_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "product_models"
            referencedColumns: ["id"]
          },
        ]
      }
      note_links: {
        Row: {
          created_at: string
          from_note_id: string
          tenant_id: string
          to_note_id: string
        }
        Insert: {
          created_at?: string
          from_note_id: string
          tenant_id: string
          to_note_id: string
        }
        Update: {
          created_at?: string
          from_note_id?: string
          tenant_id?: string
          to_note_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_links_from_note_id_fkey"
            columns: ["from_note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_links_to_note_id_fkey"
            columns: ["to_note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      note_shares: {
        Row: {
          created_at: string
          id: string
          last_opened_at: string | null
          note_id: string
          permission: string
          shared_by_account_id: string
          shared_with_account_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_opened_at?: string | null
          note_id: string
          permission?: string
          shared_by_account_id: string
          shared_with_account_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_opened_at?: string | null
          note_id?: string
          permission?: string
          shared_by_account_id?: string
          shared_with_account_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_shares_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      note_versions: {
        Row: {
          account_id: string | null
          body_json: Json | null
          created_at: string
          id: string
          note_id: string
          tenant_id: string
          title: string
        }
        Insert: {
          account_id?: string | null
          body_json?: Json | null
          created_at?: string
          id?: string
          note_id: string
          tenant_id: string
          title?: string
        }
        Update: {
          account_id?: string | null
          body_json?: Json | null
          created_at?: string
          id?: string
          note_id?: string
          tenant_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_versions_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          account_id: string
          body_json: Json | null
          body_plain: string
          color: string | null
          created_at: string
          deleted_at: string | null
          folder_id: string | null
          id: string
          is_locked: boolean
          is_pinned: boolean
          reminder_at: string | null
          tags: string[]
          tenant_id: string
          title: string
          updated_at: string
          yjs_state: string | null
        }
        Insert: {
          account_id: string
          body_json?: Json | null
          body_plain?: string
          color?: string | null
          created_at?: string
          deleted_at?: string | null
          folder_id?: string | null
          id?: string
          is_locked?: boolean
          is_pinned?: boolean
          reminder_at?: string | null
          tags?: string[]
          tenant_id: string
          title?: string
          updated_at?: string
          yjs_state?: string | null
        }
        Update: {
          account_id?: string
          body_json?: Json | null
          body_plain?: string
          color?: string | null
          created_at?: string
          deleted_at?: string | null
          folder_id?: string | null
          id?: string
          is_locked?: boolean
          is_pinned?: boolean
          reminder_at?: string | null
          tags?: string[]
          tenant_id?: string
          title?: string
          updated_at?: string
          yjs_state?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notes_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "notes_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notes_folders: {
        Row: {
          account_id: string
          created_at: string
          icon: string | null
          id: string
          is_system: boolean
          name: string
          parent_id: string | null
          sort_order: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          icon?: string | null
          id?: string
          is_system?: boolean
          name: string
          parent_id?: string | null
          sort_order?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          icon?: string | null
          id?: string
          is_system?: boolean
          name?: string
          parent_id?: string | null
          sort_order?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_folders_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "notes_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_folders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_logs: {
        Row: {
          actor_account_id: string | null
          body: string | null
          channel: string
          created_at: string
          endpoint: string | null
          error: string | null
          id: string
          kind: string
          metadata: Json
          recipient_account_id: string | null
          status: string
          title: string
        }
        Insert: {
          actor_account_id?: string | null
          body?: string | null
          channel?: string
          created_at?: string
          endpoint?: string | null
          error?: string | null
          id?: string
          kind: string
          metadata?: Json
          recipient_account_id?: string | null
          status?: string
          title: string
        }
        Update: {
          actor_account_id?: string | null
          body?: string | null
          channel?: string
          created_at?: string
          endpoint?: string | null
          error?: string | null
          id?: string
          kind?: string
          metadata?: Json
          recipient_account_id?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_logs_recipient_account_id_fkey"
            columns: ["recipient_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_mutes: {
        Row: {
          account_id: string
          app: string | null
          created_at: string
          field: string
          id: string
          label: string | null
          tenant_id: string | null
          tpl: Json | null
          types: string[]
          value: string
        }
        Insert: {
          account_id: string
          app?: string | null
          created_at?: string
          field: string
          id?: string
          label?: string | null
          tenant_id?: string | null
          tpl?: Json | null
          types: string[]
          value: string
        }
        Update: {
          account_id?: string
          app?: string | null
          created_at?: string
          field?: string
          id?: string
          label?: string | null
          tenant_id?: string | null
          tpl?: Json | null
          types?: string[]
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_mutes_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          account_id: string
          created_at: string
          id: string
          prefs: Json
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          prefs?: Json
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          prefs?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          company_name: string | null
          created_at: string
          created_by: string | null
          currency: string | null
          customer_code: string | null
          customer_id: string | null
          customer_name: string | null
          deal_no: number
          id: string
          notes: string | null
          order_no: string
          status: string
          tenant_id: string
          total: number | null
          updated_at: string
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          customer_code?: string | null
          customer_id?: string | null
          customer_name?: string | null
          deal_no: number
          id?: string
          notes?: string | null
          order_no: string
          status?: string
          tenant_id: string
          total?: number | null
          updated_at?: string
        }
        Update: {
          company_name?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          customer_code?: string | null
          customer_id?: string | null
          customer_name?: string | null
          deal_no?: number
          id?: string
          notes?: string | null
          order_no?: string
          status?: string
          tenant_id?: string
          total?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      page_versions: {
        Row: {
          doc: Json
          id: string
          page_id: string
          published_at: string
          published_by: string | null
          version: number
        }
        Insert: {
          doc: Json
          id?: string
          page_id: string
          published_at?: string
          published_by?: string | null
          version: number
        }
        Update: {
          doc?: Json
          id?: string
          page_id?: string
          published_at?: string
          published_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "page_versions_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
        ]
      }
      pages: {
        Row: {
          created_at: string | null
          description: string | null
          draft: Json | null
          draft_updated_at: string | null
          draft_updated_by: string | null
          id: string
          name: string
          published: Json | null
          published_at: string | null
          published_by: string | null
          slug: string
          title: string | null
          updated_at: string | null
          version: number
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          draft?: Json | null
          draft_updated_at?: string | null
          draft_updated_by?: string | null
          id?: string
          name: string
          published?: Json | null
          published_at?: string | null
          published_by?: string | null
          slug: string
          title?: string | null
          updated_at?: string | null
          version?: number
        }
        Update: {
          created_at?: string | null
          description?: string | null
          draft?: Json | null
          draft_updated_at?: string | null
          draft_updated_by?: string | null
          id?: string
          name?: string
          published?: Json | null
          published_at?: string | null
          published_by?: string | null
          slug?: string
          title?: string | null
          updated_at?: string | null
          version?: number
        }
        Relationships: []
      }
      payment_method_categories: {
        Row: {
          code: string
          created_at: string | null
          default_risk_level: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_advance: boolean | null
          is_bank_mediated: boolean | null
          is_credit: boolean | null
          name: string
          short_name: string | null
          sort_order: number | null
        }
        Insert: {
          code: string
          created_at?: string | null
          default_risk_level?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_advance?: boolean | null
          is_bank_mediated?: boolean | null
          is_credit?: boolean | null
          name: string
          short_name?: string | null
          sort_order?: number | null
        }
        Update: {
          code?: string
          created_at?: string | null
          default_risk_level?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_advance?: boolean | null
          is_bank_mediated?: boolean | null
          is_credit?: boolean | null
          name?: string
          short_name?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
      payment_term_defaults: {
        Row: {
          country_code: string | null
          created_at: string | null
          credit_level: string | null
          customer_type: string | null
          id: string
          is_active: boolean | null
          market_band: string | null
          payment_term_id: string
          priority: number | null
          tenant_id: string
        }
        Insert: {
          country_code?: string | null
          created_at?: string | null
          credit_level?: string | null
          customer_type?: string | null
          id?: string
          is_active?: boolean | null
          market_band?: string | null
          payment_term_id: string
          priority?: number | null
          tenant_id: string
        }
        Update: {
          country_code?: string | null
          created_at?: string | null
          credit_level?: string | null
          customer_type?: string | null
          id?: string
          is_active?: boolean | null
          market_band?: string | null
          payment_term_id?: string
          priority?: number | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_term_defaults_payment_term_id_fkey"
            columns: ["payment_term_id"]
            isOneToOne: false
            referencedRelation: "payment_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_term_templates: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          override_structure: Json | null
          payment_term_id: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          override_structure?: Json | null
          payment_term_id?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          override_structure?: Json | null
          payment_term_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_term_templates_payment_term_id_fkey"
            columns: ["payment_term_id"]
            isOneToOne: false
            referencedRelation: "payment_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_terms: {
        Row: {
          buyer_risk: string | null
          category_id: string
          code: string
          created_at: string | null
          created_by: string | null
          days_basis: string | null
          exporter_risk: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          is_system: boolean | null
          label: string
          notes: string | null
          short_label: string | null
          sort_order: number | null
          structure: Json
          suitable_for: string[] | null
          tenant_id: string | null
          total_days: number | null
          updated_at: string | null
        }
        Insert: {
          buyer_risk?: string | null
          category_id: string
          code: string
          created_at?: string | null
          created_by?: string | null
          days_basis?: string | null
          exporter_risk?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          is_system?: boolean | null
          label: string
          notes?: string | null
          short_label?: string | null
          sort_order?: number | null
          structure?: Json
          suitable_for?: string[] | null
          tenant_id?: string | null
          total_days?: number | null
          updated_at?: string | null
        }
        Update: {
          buyer_risk?: string | null
          category_id?: string
          code?: string
          created_at?: string | null
          created_by?: string | null
          days_basis?: string | null
          exporter_risk?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          is_system?: boolean | null
          label?: string
          notes?: string | null
          short_label?: string | null
          sort_order?: number | null
          structure?: Json
          suitable_for?: string[] | null
          tenant_id?: string | null
          total_days?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_terms_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "payment_method_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      people: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          avatar_url: string | null
          city: string | null
          company_id: string | null
          country: string | null
          created_at: string
          created_by: string | null
          display_name: string | null
          email: string | null
          first_name: string | null
          first_name_alt: string | null
          full_name: string
          id: string
          job_title: string | null
          language: string | null
          last_name: string | null
          last_name_alt: string | null
          mobile: string | null
          name_alt: string | null
          notes: string | null
          phone: string | null
          postal_code: string | null
          state: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          avatar_url?: string | null
          city?: string | null
          company_id?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          email?: string | null
          first_name?: string | null
          first_name_alt?: string | null
          full_name: string
          id?: string
          job_title?: string | null
          language?: string | null
          last_name?: string | null
          last_name_alt?: string | null
          mobile?: string | null
          name_alt?: string | null
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          avatar_url?: string | null
          city?: string | null
          company_id?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          email?: string | null
          first_name?: string | null
          first_name_alt?: string | null
          full_name?: string
          id?: string
          job_title?: string | null
          language?: string | null
          last_name?: string | null
          last_name_alt?: string | null
          mobile?: string | null
          name_alt?: string | null
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      perf_samples: {
        Row: {
          account_id: string | null
          created_at: string
          env: string | null
          id: number
          metric: string
          route: string | null
          sid: string | null
          value: number
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          env?: string | null
          id?: number
          metric: string
          route?: string | null
          sid?: string | null
          value: number
        }
        Update: {
          account_id?: string | null
          created_at?: string
          env?: string | null
          id?: number
          metric?: string
          route?: string | null
          sid?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "perf_samples_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      planning_items: {
        Row: {
          allocated_hours: number | null
          allocated_pct: number | null
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          created_by_account_id: string | null
          end_at: string
          hourly_rate: number | null
          id: string
          is_billable: boolean
          linked_entity_id: string | null
          linked_entity_label: string | null
          linked_entity_type: string | null
          notes: string | null
          published_at: string | null
          recurrence_parent_id: string | null
          recurrence_rule: string | null
          resource_id: string | null
          role_id: string | null
          start_at: string
          status: string
          tenant_id: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          allocated_hours?: number | null
          allocated_pct?: number | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by_account_id?: string | null
          end_at: string
          hourly_rate?: number | null
          id?: string
          is_billable?: boolean
          linked_entity_id?: string | null
          linked_entity_label?: string | null
          linked_entity_type?: string | null
          notes?: string | null
          published_at?: string | null
          recurrence_parent_id?: string | null
          recurrence_rule?: string | null
          resource_id?: string | null
          role_id?: string | null
          start_at: string
          status?: string
          tenant_id: string
          title?: string
          type?: string
          updated_at?: string
        }
        Update: {
          allocated_hours?: number | null
          allocated_pct?: number | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by_account_id?: string | null
          end_at?: string
          hourly_rate?: number | null
          id?: string
          is_billable?: boolean
          linked_entity_id?: string | null
          linked_entity_label?: string | null
          linked_entity_type?: string | null
          notes?: string | null
          published_at?: string | null
          recurrence_parent_id?: string | null
          recurrence_rule?: string | null
          resource_id?: string | null
          role_id?: string | null
          start_at?: string
          status?: string
          tenant_id?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "planning_items_created_by_account_id_fkey"
            columns: ["created_by_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_items_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "planning_resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_items_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "planning_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      planning_resources: {
        Row: {
          account_id: string | null
          capacity_hours_per_day: number | null
          color: string | null
          created_at: string
          description: string | null
          hourly_cost: number | null
          icon: string | null
          id: string
          is_active: boolean
          name: string
          tenant_id: string
          type: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          capacity_hours_per_day?: number | null
          color?: string | null
          created_at?: string
          description?: string | null
          hourly_cost?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          tenant_id: string
          type?: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          capacity_hours_per_day?: number | null
          color?: string | null
          created_at?: string
          description?: string | null
          hourly_cost?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          tenant_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "planning_resources_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_resources_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      planning_roles: {
        Row: {
          color: string | null
          created_at: string
          hourly_rate: number | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          hourly_rate?: number | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          hourly_rate?: number | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "planning_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      planning_switch_requests: {
        Row: {
          created_at: string
          id: string
          item_id: string
          message: string | null
          requester_id: string
          responded_at: string | null
          responded_by_id: string | null
          status: string
          target_id: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          message?: string | null
          requester_id: string
          responded_at?: string | null
          responded_by_id?: string | null
          status?: string
          target_id?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          message?: string | null
          requester_id?: string
          responded_at?: string | null
          responded_by_id?: string | null
          status?: string
          target_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planning_switch_requests_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "planning_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_switch_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_switch_requests_responded_by_id_fkey"
            columns: ["responded_by_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_switch_requests_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_switch_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      planning_templates: {
        Row: {
          color: string | null
          created_at: string
          created_by_account_id: string | null
          default_note: string | null
          duration_hours: number | null
          id: string
          name: string
          resource_id: string | null
          role_id: string | null
          start_time: string | null
          tenant_id: string
          type: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by_account_id?: string | null
          default_note?: string | null
          duration_hours?: number | null
          id?: string
          name: string
          resource_id?: string | null
          role_id?: string | null
          start_time?: string | null
          tenant_id: string
          type?: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by_account_id?: string | null
          default_note?: string | null
          duration_hours?: number | null
          id?: string
          name?: string
          resource_id?: string | null
          role_id?: string | null
          start_time?: string | null
          tenant_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "planning_templates_created_by_account_id_fkey"
            columns: ["created_by_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_templates_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "planning_resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_templates_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "planning_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      position_behavior_requirements: {
        Row: {
          behavior_indicator_id: string
          created_at: string
          id: string
          is_critical: boolean
          is_mandatory: boolean
          notes: string | null
          position_id: string
          required_score: number
          sort_order: number
          tenant_id: string
          updated_at: string
          weight: number
        }
        Insert: {
          behavior_indicator_id: string
          created_at?: string
          id?: string
          is_critical?: boolean
          is_mandatory?: boolean
          notes?: string | null
          position_id: string
          required_score?: number
          sort_order?: number
          tenant_id: string
          updated_at?: string
          weight?: number
        }
        Update: {
          behavior_indicator_id?: string
          created_at?: string
          id?: string
          is_critical?: boolean
          is_mandatory?: boolean
          notes?: string | null
          position_id?: string
          required_score?: number
          sort_order?: number
          tenant_id?: string
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "position_behavior_requirements_behavior_indicator_id_fkey"
            columns: ["behavior_indicator_id"]
            isOneToOne: false
            referencedRelation: "behavior_indicators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "position_behavior_requirements_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "koleex_positions"
            referencedColumns: ["id"]
          },
        ]
      }
      position_skill_requirements: {
        Row: {
          created_at: string
          id: string
          is_mandatory: boolean
          notes: string | null
          position_id: string
          required_score: number
          skill_id: string
          sort_order: number
          tenant_id: string
          updated_at: string
          weight: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_mandatory?: boolean
          notes?: string | null
          position_id: string
          required_score?: number
          skill_id: string
          sort_order?: number
          tenant_id: string
          updated_at?: string
          weight?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_mandatory?: boolean
          notes?: string | null
          position_id?: string
          required_score?: number
          skill_id?: string
          sort_order?: number
          tenant_id?: string
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "position_skill_requirements_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "koleex_positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "position_skill_requirements_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      price_list_items: {
        Row: {
          id: string
          price: number
          price_list_id: string
          product_id: string
        }
        Insert: {
          id?: string
          price: number
          price_list_id: string
          product_id: string
        }
        Update: {
          id?: string
          price?: number
          price_list_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_list_items_price_list_id_fkey"
            columns: ["price_list_id"]
            isOneToOne: false
            referencedRelation: "price_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      price_lists: {
        Row: {
          created_at: string
          currency: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      pricing_customer_types: {
        Row: {
          created_at: string
          customer_type: string
          discount_percent: number
          id: string
          is_active: boolean
          margin_percent: number
          market_id: string
          max_discount_percent: number | null
          min_margin_percent: number | null
          notes: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_type: string
          discount_percent?: number
          id?: string
          is_active?: boolean
          margin_percent?: number
          market_id: string
          max_discount_percent?: number | null
          min_margin_percent?: number | null
          notes?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_type?: string
          discount_percent?: number
          id?: string
          is_active?: boolean
          margin_percent?: number
          market_id?: string
          max_discount_percent?: number | null
          min_margin_percent?: number | null
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_customer_types_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_markets: {
        Row: {
          created_at: string
          currency_code: string
          default_insurance_cost: number
          default_local_cost: number
          default_shipping_cost: number
          id: string
          import_duty_percent: number
          is_active: boolean
          market_adjustment_percent: number
          market_id: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency_code?: string
          default_insurance_cost?: number
          default_local_cost?: number
          default_shipping_cost?: number
          id?: string
          import_duty_percent?: number
          is_active?: boolean
          market_adjustment_percent?: number
          market_id: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency_code?: string
          default_insurance_cost?: number
          default_local_cost?: number
          default_shipping_cost?: number
          id?: string
          import_duty_percent?: number
          is_active?: boolean
          market_adjustment_percent?: number
          market_id?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_markets_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: true
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_tiers: {
        Row: {
          approval_threshold: number | null
          code: string
          created_at: string | null
          created_by: string | null
          customer_types: string[] | null
          default_discount_pct: number | null
          description: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          is_internal_only: boolean | null
          is_system: boolean | null
          min_margin_pct: number | null
          name: string
          notes: string | null
          requires_approval: boolean | null
          short_name: string | null
          sort_order: number | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          approval_threshold?: number | null
          code: string
          created_at?: string | null
          created_by?: string | null
          customer_types?: string[] | null
          default_discount_pct?: number | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          is_internal_only?: boolean | null
          is_system?: boolean | null
          min_margin_pct?: number | null
          name: string
          notes?: string | null
          requires_approval?: boolean | null
          short_name?: string | null
          sort_order?: number | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          approval_threshold?: number | null
          code?: string
          created_at?: string | null
          created_by?: string | null
          customer_types?: string[] | null
          default_discount_pct?: number | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          is_internal_only?: boolean | null
          is_system?: boolean | null
          min_margin_pct?: number | null
          name?: string
          notes?: string | null
          requires_approval?: boolean | null
          short_name?: string | null
          sort_order?: number | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      product_accessory_options: {
        Row: {
          accessory_product_id: string
          created_at: string
          id: string
          is_default: boolean
          role: string
          sort_order: number
          subcategory_slug: string
          tenant_id: string
        }
        Insert: {
          accessory_product_id: string
          created_at?: string
          id?: string
          is_default?: boolean
          role?: string
          sort_order?: number
          subcategory_slug: string
          tenant_id: string
        }
        Update: {
          accessory_product_id?: string
          created_at?: string
          id?: string
          is_default?: boolean
          role?: string
          sort_order?: number
          subcategory_slug?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_accessory_options_accessory_product_id_fkey"
            columns: ["accessory_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_assets: {
        Row: {
          asset_group: string
          asset_name: string
          created_at: string | null
          file_type: string | null
          file_url: string | null
          id: number
          product_id: string
          sort_order: number | null
        }
        Insert: {
          asset_group: string
          asset_name: string
          created_at?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: number
          product_id: string
          sort_order?: number | null
        }
        Update: {
          asset_group?: string
          asset_name?: string
          created_at?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: number
          product_id?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          created_at: string
          description: string | null
          division_id: string
          id: string
          is_active: boolean
          name: string
          slug: string | null
          sort_order: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          division_id: string
          id?: string
          is_active?: boolean
          name: string
          slug?: string | null
          sort_order?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          division_id?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "product_divisions"
            referencedColumns: ["id"]
          },
        ]
      }
      product_certifications: {
        Row: {
          cert_number: string | null
          cert_type: string
          certified_standard: string | null
          country_scope: string | null
          created_at: string
          expiry_date: string | null
          file_url: string | null
          id: string
          issued_date: string | null
          issuer: string | null
          model_ids: string[]
          notes: string | null
          product_id: string
          reminder_days: number | null
          status: string
          tenant_id: string
          verification_url: string | null
        }
        Insert: {
          cert_number?: string | null
          cert_type: string
          certified_standard?: string | null
          country_scope?: string | null
          created_at?: string
          expiry_date?: string | null
          file_url?: string | null
          id?: string
          issued_date?: string | null
          issuer?: string | null
          model_ids?: string[]
          notes?: string | null
          product_id: string
          reminder_days?: number | null
          status?: string
          tenant_id: string
          verification_url?: string | null
        }
        Update: {
          cert_number?: string | null
          cert_type?: string
          certified_standard?: string | null
          country_scope?: string | null
          created_at?: string
          expiry_date?: string | null
          file_url?: string | null
          id?: string
          issued_date?: string | null
          issuer?: string | null
          model_ids?: string[]
          notes?: string | null
          product_id?: string
          reminder_days?: number | null
          status?: string
          tenant_id?: string
          verification_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_certifications_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_cost_history: {
        Row: {
          change_type: string
          created_at: string
          id: string
          model_id: string | null
          model_number: string | null
          new_head_cost: number | null
          note: string | null
          previous_head_cost: number | null
          product_id: string | null
          quotation_id: string | null
          source: string
          tenant_id: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          change_type?: string
          created_at?: string
          id?: string
          model_id?: string | null
          model_number?: string | null
          new_head_cost?: number | null
          note?: string | null
          previous_head_cost?: number | null
          product_id?: string | null
          quotation_id?: string | null
          source?: string
          tenant_id?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          change_type?: string
          created_at?: string
          id?: string
          model_id?: string | null
          model_number?: string | null
          new_head_cost?: number | null
          note?: string | null
          previous_head_cost?: number | null
          product_id?: string | null
          quotation_id?: string | null
          source?: string
          tenant_id?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_cost_history_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "product_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_cost_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_cost_history_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      product_divisions: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          slug: string | null
          sort_order: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug?: string | null
          sort_order?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
      product_documents: {
        Row: {
          doc_type: string
          file_name: string | null
          file_size_kb: number | null
          file_url: string
          id: string
          language: string | null
          model_ids: string[]
          product_id: string
          sort_order: number
          tenant_id: string
          title: string | null
          uploaded_at: string
          version: string | null
        }
        Insert: {
          doc_type: string
          file_name?: string | null
          file_size_kb?: number | null
          file_url: string
          id?: string
          language?: string | null
          model_ids?: string[]
          product_id: string
          sort_order?: number
          tenant_id: string
          title?: string | null
          uploaded_at?: string
          version?: string | null
        }
        Update: {
          doc_type?: string
          file_name?: string | null
          file_size_kb?: number | null
          file_url?: string
          id?: string
          language?: string | null
          model_ids?: string[]
          product_id?: string
          sort_order?: number
          tenant_id?: string
          title?: string | null
          uploaded_at?: string
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_documents_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_feature_highlights: {
        Row: {
          created_at: string
          description: string | null
          description_ar: string | null
          description_zh: string | null
          id: string
          image_url: string | null
          model_id: string | null
          product_id: string
          sort: number
          title: string
          title_ar: string | null
          title_zh: string | null
          translations: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          description_ar?: string | null
          description_zh?: string | null
          id?: string
          image_url?: string | null
          model_id?: string | null
          product_id: string
          sort?: number
          title: string
          title_ar?: string | null
          title_zh?: string | null
          translations?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          description_ar?: string | null
          description_zh?: string | null
          id?: string
          image_url?: string | null
          model_id?: string | null
          product_id?: string
          sort?: number
          title?: string
          title_ar?: string | null
          title_zh?: string | null
          translations?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_feature_highlights_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "product_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_feature_highlights_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_field_values: {
        Row: {
          created_at: string
          field_id: string
          id: string
          model_id: string | null
          product_id: string
          updated_at: string
          value_json: Json | null
        }
        Insert: {
          created_at?: string
          field_id: string
          id?: string
          model_id?: string | null
          product_id: string
          updated_at?: string
          value_json?: Json | null
        }
        Update: {
          created_at?: string
          field_id?: string
          id?: string
          model_id?: string | null
          product_id?: string
          updated_at?: string
          value_json?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "product_field_values_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "product_template_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_field_values_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "product_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_field_values_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_lines: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          slug: string | null
          sort_order: number | null
          subcategory_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug?: string | null
          sort_order?: number | null
          subcategory_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string | null
          sort_order?: number | null
          subcategory_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_lines_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "product_subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      product_market_prices: {
        Row: {
          complete_set_price: number | null
          country_code: string
          created_at: string | null
          currency: string
          head_only_price: number | null
          id: string
          market_price: number
          model_id: string
        }
        Insert: {
          complete_set_price?: number | null
          country_code: string
          created_at?: string | null
          currency?: string
          head_only_price?: number | null
          id?: string
          market_price: number
          model_id: string
        }
        Update: {
          complete_set_price?: number | null
          country_code?: string
          created_at?: string | null
          currency?: string
          head_only_price?: number | null
          id?: string
          market_price?: number
          model_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_market_prices_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "product_models"
            referencedColumns: ["id"]
          },
        ]
      }
      product_media: {
        Row: {
          alt_text: string | null
          created_at: string | null
          file_path: string | null
          id: string
          model_id: string | null
          order: number
          product_id: string
          role: string
          type: string
          url: string
        }
        Insert: {
          alt_text?: string | null
          created_at?: string | null
          file_path?: string | null
          id?: string
          model_id?: string | null
          order?: number
          product_id: string
          role?: string
          type: string
          url: string
        }
        Update: {
          alt_text?: string | null
          created_at?: string | null
          file_path?: string | null
          id?: string
          model_id?: string | null
          order?: number
          product_id?: string
          role?: string
          type?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_media_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "product_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_media_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_models: {
        Row: {
          barcode: string | null
          box_include: string | null
          carton_dimensions: string | null
          cbm: number | null
          code_prefix: string | null
          coding_status: string | null
          complete_set_price: number | null
          container_20ft_qty: number | null
          container_40ft_qty: number | null
          container_40hq_qty: number | null
          cost_price: number | null
          cost_source: string | null
          cost_updated_at: string | null
          cost_updated_by: string | null
          cost_updated_by_name: string | null
          created_at: string | null
          created_source: string | null
          extra_accessories: string | null
          global_price: number | null
          head_only_price: number | null
          id: string
          lead_time: string | null
          logistics_overrides: Json | null
          model_name: string
          moq: number | null
          name_i18n: Json | null
          net_weight: number | null
          order: number
          packing_type: string | null
          price_note: string | null
          pricing_mode: string
          primary_model: string | null
          product_id: string
          reference_model: string | null
          search_text: string | null
          sku: string
          slug: string
          specs_overrides: Json | null
          status: string | null
          stock_status: string | null
          supplier: string | null
          supplier_overrides: Json | null
          supports_complete_set: boolean | null
          supports_head_only: boolean | null
          tagline: string | null
          tagline_i18n: Json | null
          template_id: string | null
          updated_at: string | null
          visible: boolean
          weight: number | null
        }
        Insert: {
          barcode?: string | null
          box_include?: string | null
          carton_dimensions?: string | null
          cbm?: number | null
          code_prefix?: string | null
          coding_status?: string | null
          complete_set_price?: number | null
          container_20ft_qty?: number | null
          container_40ft_qty?: number | null
          container_40hq_qty?: number | null
          cost_price?: number | null
          cost_source?: string | null
          cost_updated_at?: string | null
          cost_updated_by?: string | null
          cost_updated_by_name?: string | null
          created_at?: string | null
          created_source?: string | null
          extra_accessories?: string | null
          global_price?: number | null
          head_only_price?: number | null
          id?: string
          lead_time?: string | null
          logistics_overrides?: Json | null
          model_name: string
          moq?: number | null
          name_i18n?: Json | null
          net_weight?: number | null
          order?: number
          packing_type?: string | null
          price_note?: string | null
          pricing_mode?: string
          primary_model?: string | null
          product_id: string
          reference_model?: string | null
          search_text?: string | null
          sku: string
          slug: string
          specs_overrides?: Json | null
          status?: string | null
          stock_status?: string | null
          supplier?: string | null
          supplier_overrides?: Json | null
          supports_complete_set?: boolean | null
          supports_head_only?: boolean | null
          tagline?: string | null
          tagline_i18n?: Json | null
          template_id?: string | null
          updated_at?: string | null
          visible?: boolean
          weight?: number | null
        }
        Update: {
          barcode?: string | null
          box_include?: string | null
          carton_dimensions?: string | null
          cbm?: number | null
          code_prefix?: string | null
          coding_status?: string | null
          complete_set_price?: number | null
          container_20ft_qty?: number | null
          container_40ft_qty?: number | null
          container_40hq_qty?: number | null
          cost_price?: number | null
          cost_source?: string | null
          cost_updated_at?: string | null
          cost_updated_by?: string | null
          cost_updated_by_name?: string | null
          created_at?: string | null
          created_source?: string | null
          extra_accessories?: string | null
          global_price?: number | null
          head_only_price?: number | null
          id?: string
          lead_time?: string | null
          logistics_overrides?: Json | null
          model_name?: string
          moq?: number | null
          name_i18n?: Json | null
          net_weight?: number | null
          order?: number
          packing_type?: string | null
          price_note?: string | null
          pricing_mode?: string
          primary_model?: string | null
          product_id?: string
          reference_model?: string | null
          search_text?: string | null
          sku?: string
          slug?: string
          specs_overrides?: Json | null
          status?: string | null
          stock_status?: string | null
          supplier?: string | null
          supplier_overrides?: Json | null
          supports_complete_set?: boolean | null
          supports_head_only?: boolean | null
          tagline?: string | null
          tagline_i18n?: Json | null
          template_id?: string | null
          updated_at?: string | null
          visible?: boolean
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_models_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_models_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "product_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      product_models_costsnapshot_20260613: {
        Row: {
          barcode: string | null
          box_include: string | null
          carton_dimensions: string | null
          cbm: number | null
          code_prefix: string | null
          coding_status: string | null
          complete_set_price: number | null
          container_20ft_qty: number | null
          container_40ft_qty: number | null
          cost_price: number | null
          created_at: string | null
          extra_accessories: string | null
          global_price: number | null
          head_only_price: number | null
          id: string | null
          lead_time: string | null
          model_name: string | null
          moq: number | null
          net_weight: number | null
          order: number | null
          packing_type: string | null
          primary_model: string | null
          product_id: string | null
          reference_model: string | null
          sku: string | null
          slug: string | null
          status: string | null
          stock_status: string | null
          supplier: string | null
          supports_complete_set: boolean | null
          supports_head_only: boolean | null
          tagline: string | null
          template_id: string | null
          updated_at: string | null
          visible: boolean | null
          weight: number | null
        }
        Insert: {
          barcode?: string | null
          box_include?: string | null
          carton_dimensions?: string | null
          cbm?: number | null
          code_prefix?: string | null
          coding_status?: string | null
          complete_set_price?: number | null
          container_20ft_qty?: number | null
          container_40ft_qty?: number | null
          cost_price?: number | null
          created_at?: string | null
          extra_accessories?: string | null
          global_price?: number | null
          head_only_price?: number | null
          id?: string | null
          lead_time?: string | null
          model_name?: string | null
          moq?: number | null
          net_weight?: number | null
          order?: number | null
          packing_type?: string | null
          primary_model?: string | null
          product_id?: string | null
          reference_model?: string | null
          sku?: string | null
          slug?: string | null
          status?: string | null
          stock_status?: string | null
          supplier?: string | null
          supports_complete_set?: boolean | null
          supports_head_only?: boolean | null
          tagline?: string | null
          template_id?: string | null
          updated_at?: string | null
          visible?: boolean | null
          weight?: number | null
        }
        Update: {
          barcode?: string | null
          box_include?: string | null
          carton_dimensions?: string | null
          cbm?: number | null
          code_prefix?: string | null
          coding_status?: string | null
          complete_set_price?: number | null
          container_20ft_qty?: number | null
          container_40ft_qty?: number | null
          cost_price?: number | null
          created_at?: string | null
          extra_accessories?: string | null
          global_price?: number | null
          head_only_price?: number | null
          id?: string | null
          lead_time?: string | null
          model_name?: string | null
          moq?: number | null
          net_weight?: number | null
          order?: number | null
          packing_type?: string | null
          primary_model?: string | null
          product_id?: string | null
          reference_model?: string | null
          sku?: string | null
          slug?: string | null
          status?: string | null
          stock_status?: string | null
          supplier?: string | null
          supports_complete_set?: boolean | null
          supports_head_only?: boolean | null
          tagline?: string | null
          template_id?: string | null
          updated_at?: string | null
          visible?: boolean | null
          weight?: number | null
        }
        Relationships: []
      }
      product_option_values: {
        Row: {
          active: boolean
          cbm_delta: number | null
          created_at: string
          id: string
          image_url: string | null
          is_default: boolean
          label: string
          label_i18n: Json
          linked_model_id: string | null
          linked_product_id: string | null
          option_id: string
          price_delta_cny: number | null
          sort_order: number
          weight_delta_kg: number | null
        }
        Insert: {
          active?: boolean
          cbm_delta?: number | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_default?: boolean
          label: string
          label_i18n?: Json
          linked_model_id?: string | null
          linked_product_id?: string | null
          option_id: string
          price_delta_cny?: number | null
          sort_order?: number
          weight_delta_kg?: number | null
        }
        Update: {
          active?: boolean
          cbm_delta?: number | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_default?: boolean
          label?: string
          label_i18n?: Json
          linked_model_id?: string | null
          linked_product_id?: string | null
          option_id?: string
          price_delta_cny?: number | null
          sort_order?: number
          weight_delta_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_option_values_linked_model_id_fkey"
            columns: ["linked_model_id"]
            isOneToOne: false
            referencedRelation: "product_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_option_values_linked_product_id_fkey"
            columns: ["linked_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_option_values_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "product_options"
            referencedColumns: ["id"]
          },
        ]
      }
      product_options: {
        Row: {
          active: boolean
          created_at: string
          depends_on_value_id: string | null
          id: string
          kind: string
          product_id: string
          required: boolean
          sort_order: number
          title: string
          title_i18n: Json
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          depends_on_value_id?: string | null
          id?: string
          kind?: string
          product_id: string
          required?: boolean
          sort_order?: number
          title: string
          title_i18n?: Json
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          depends_on_value_id?: string | null
          id?: string
          kind?: string
          product_id?: string
          required?: boolean
          sort_order?: number
          title?: string
          title_i18n?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_options_depends_on_value_fkey"
            columns: ["depends_on_value_id"]
            isOneToOne: false
            referencedRelation: "product_option_values"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_options_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_set_template_items: {
        Row: {
          accessory_product_id: string
          id: string
          role: string
          selected_options: Json
          set_template_id: string
        }
        Insert: {
          accessory_product_id: string
          id?: string
          role?: string
          selected_options?: Json
          set_template_id: string
        }
        Update: {
          accessory_product_id?: string
          id?: string
          role?: string
          selected_options?: Json
          set_template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_set_template_items_accessory_product_id_fkey"
            columns: ["accessory_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_set_template_items_set_template_id_fkey"
            columns: ["set_template_id"]
            isOneToOne: false
            referencedRelation: "product_set_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      product_set_templates: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          subcategory_slug: string
          tenant_id: string
          tier: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          subcategory_slug: string
          tenant_id: string
          tier?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          subcategory_slug?: string
          tenant_id?: string
          tier?: string
        }
        Relationships: []
      }
      product_sewing_specs: {
        Row: {
          common_specs: Json | null
          created_at: string | null
          id: string
          product_id: string
          template_slug: string
          template_specs: Json | null
          updated_at: string | null
        }
        Insert: {
          common_specs?: Json | null
          created_at?: string | null
          id?: string
          product_id: string
          template_slug: string
          template_specs?: Json | null
          updated_at?: string | null
        }
        Update: {
          common_specs?: Json | null
          created_at?: string | null
          id?: string
          product_id?: string
          template_slug?: string
          template_specs?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_sewing_specs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_subcategories: {
        Row: {
          category_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          slug: string | null
          sort_order: number | null
        }
        Insert: {
          category_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug?: string | null
          sort_order?: number | null
        }
        Update: {
          category_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      product_suppliers: {
        Row: {
          cost_basis: string
          cost_extras: Json | null
          cost_includes_tax: boolean
          created_at: string
          currency: string | null
          id: string
          incoterms: string | null
          is_primary: boolean
          lead_time_days: number | null
          min_order_value: number | null
          moq: number | null
          notes: string | null
          notes_i18n: Json | null
          payment_terms: string | null
          preferred_reason: string | null
          price_options: Json | null
          price_quoted_on: string | null
          price_tiers: Json | null
          price_valid_until: string | null
          product_id: string
          quotation_file_name: string | null
          quotation_file_url: string | null
          sample_available: boolean | null
          sample_cost: number | null
          search_text: string | null
          show_in_catalog: boolean
          sourcing_status: string | null
          supplier_id: string
          supplier_product_code: string | null
          supplier_product_name: string | null
          supplier_product_name_i18n: Json | null
          supplier_product_photo: string | null
          supplier_warranty_months: number | null
          supply_type: string | null
          tooling_cost: number | null
          tooling_owner: string | null
          unit_cost_cny: number | null
        }
        Insert: {
          cost_basis?: string
          cost_extras?: Json | null
          cost_includes_tax?: boolean
          created_at?: string
          currency?: string | null
          id?: string
          incoterms?: string | null
          is_primary?: boolean
          lead_time_days?: number | null
          min_order_value?: number | null
          moq?: number | null
          notes?: string | null
          notes_i18n?: Json | null
          payment_terms?: string | null
          preferred_reason?: string | null
          price_options?: Json | null
          price_quoted_on?: string | null
          price_tiers?: Json | null
          price_valid_until?: string | null
          product_id: string
          quotation_file_name?: string | null
          quotation_file_url?: string | null
          sample_available?: boolean | null
          sample_cost?: number | null
          search_text?: string | null
          show_in_catalog?: boolean
          sourcing_status?: string | null
          supplier_id: string
          supplier_product_code?: string | null
          supplier_product_name?: string | null
          supplier_product_name_i18n?: Json | null
          supplier_product_photo?: string | null
          supplier_warranty_months?: number | null
          supply_type?: string | null
          tooling_cost?: number | null
          tooling_owner?: string | null
          unit_cost_cny?: number | null
        }
        Update: {
          cost_basis?: string
          cost_extras?: Json | null
          cost_includes_tax?: boolean
          created_at?: string
          currency?: string | null
          id?: string
          incoterms?: string | null
          is_primary?: boolean
          lead_time_days?: number | null
          min_order_value?: number | null
          moq?: number | null
          notes?: string | null
          notes_i18n?: Json | null
          payment_terms?: string | null
          preferred_reason?: string | null
          price_options?: Json | null
          price_quoted_on?: string | null
          price_tiers?: Json | null
          price_valid_until?: string | null
          product_id?: string
          quotation_file_name?: string | null
          quotation_file_url?: string | null
          sample_available?: boolean | null
          sample_cost?: number | null
          search_text?: string | null
          show_in_catalog?: boolean
          sourcing_status?: string | null
          supplier_id?: string
          supplier_product_code?: string | null
          supplier_product_name?: string | null
          supplier_product_name_i18n?: Json | null
          supplier_product_photo?: string | null
          supplier_warranty_months?: number | null
          supply_type?: string | null
          tooling_cost?: number | null
          tooling_owner?: string | null
          unit_cost_cny?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_suppliers_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      product_template_fields: {
        Row: {
          ai_readable: boolean
          created_at: string
          field_key: string
          field_label: string
          field_type: string
          help_text: string | null
          icon: string | null
          id: string
          is_active: boolean
          is_public: boolean
          is_required: boolean
          is_searchable: boolean
          options_json: Json | null
          placeholder: string | null
          section_id: string
          show_in_brochure: boolean
          show_in_catalog: boolean
          show_in_quotation: boolean
          sort_order: number
          template_id: string
          unit: string | null
        }
        Insert: {
          ai_readable?: boolean
          created_at?: string
          field_key: string
          field_label: string
          field_type: string
          help_text?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          is_public?: boolean
          is_required?: boolean
          is_searchable?: boolean
          options_json?: Json | null
          placeholder?: string | null
          section_id: string
          show_in_brochure?: boolean
          show_in_catalog?: boolean
          show_in_quotation?: boolean
          sort_order?: number
          template_id: string
          unit?: string | null
        }
        Update: {
          ai_readable?: boolean
          created_at?: string
          field_key?: string
          field_label?: string
          field_type?: string
          help_text?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          is_public?: boolean
          is_required?: boolean
          is_searchable?: boolean
          options_json?: Json | null
          placeholder?: string | null
          section_id?: string
          show_in_brochure?: boolean
          show_in_catalog?: boolean
          show_in_quotation?: boolean
          sort_order?: number
          template_id?: string
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_template_fields_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "product_template_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_template_fields_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "product_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      product_template_sections: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          is_public: boolean
          slug: string
          sort_order: number
          template_id: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          is_public?: boolean
          slug: string
          sort_order?: number
          template_id: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          is_public?: boolean
          slug?: string
          sort_order?: number
          template_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_template_sections_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "product_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      product_templates: {
        Row: {
          category_slug: string | null
          created_at: string
          description: string | null
          division_slug: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          subcategory_slug: string | null
          updated_at: string
        }
        Insert: {
          category_slug?: string | null
          created_at?: string
          description?: string | null
          division_slug?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          subcategory_slug?: string | null
          updated_at?: string
        }
        Update: {
          category_slug?: string | null
          created_at?: string
          description?: string | null
          division_slug?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          subcategory_slug?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      product_translations: {
        Row: {
          created_at: string | null
          description: string | null
          excerpt: string | null
          id: string
          locale: string
          product_id: string
          product_name: string
          search_text: string | null
          tagline: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          excerpt?: string | null
          id?: string
          locale: string
          product_id: string
          product_name: string
          search_text?: string | null
          tagline?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          excerpt?: string | null
          id?: string
          locale?: string
          product_id?: string
          product_name?: string
          search_text?: string | null
          tagline?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_translations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          alternate_names: string[] | null
          available_from: string | null
          brand: string | null
          brand_mark_url: string | null
          category_slug: string
          ce_certified: boolean | null
          colors: string[] | null
          content_updated_at: string | null
          country_of_origin: string | null
          created_at: string | null
          description: string | null
          division_slug: string
          eol_date: string | null
          excerpt: string | null
          family: string | null
          feature_cards: Json | null
          featured: boolean
          frequency_hz: string[] | null
          generation: string | null
          gtin: string | null
          hero_poster_url: string | null
          highlights: string[]
          hs_code: string | null
          id: string
          installation_service: boolean | null
          internal_sku: string | null
          ip_rating: string | null
          last_order_date: string | null
          launch_date: string | null
          lead_time: string | null
          legacy_code: string | null
          level: string | null
          logistics: Json
          machine_dimensions: string | null
          machine_weight_kg: number | null
          maintenance_interval: string | null
          manufacturer: string | null
          meta_description: string | null
          meta_title: string | null
          model_year: string | null
          moq: number | null
          motor_power_w: number | null
          mpn: string | null
          og_image_url: string | null
          oil_mist_filter: boolean | null
          operating_temp: string | null
          phase: string | null
          plug_types: string[] | null
          pneumatic_supply: boolean | null
          power_consumption_w: number | null
          price_updated_at: string | null
          product_name: string
          published_at: string | null
          returns_policy: string | null
          revision_history: Json
          rohs_compliant: boolean | null
          schema_id: string | null
          schema_knowledge: Json
          schema_specs: Json
          schema_version: string | null
          schema_visibility: Json
          search_text: string | null
          service_life: string | null
          slug: string
          spare_parts_availability: string | null
          spare_parts_stock: string | null
          specs: Json | null
          status: string | null
          status_reason: string | null
          subcategory_slug: string
          support_channels: string[] | null
          supports_complete_set: boolean | null
          supports_head_only: boolean | null
          tags: string[] | null
          technical_support: string | null
          template_id: string | null
          tenant_id: string
          training_available: boolean | null
          updated_at: string | null
          visible: boolean
          voltage: string[] | null
          warranty: string | null
          warranty_coverage: string | null
          warranty_exclusions: string | null
          warranty_months: number | null
          warranty_start_from: string | null
          warranty_type: string | null
          watt: string | null
        }
        Insert: {
          alternate_names?: string[] | null
          available_from?: string | null
          brand?: string | null
          brand_mark_url?: string | null
          category_slug: string
          ce_certified?: boolean | null
          colors?: string[] | null
          content_updated_at?: string | null
          country_of_origin?: string | null
          created_at?: string | null
          description?: string | null
          division_slug: string
          eol_date?: string | null
          excerpt?: string | null
          family?: string | null
          feature_cards?: Json | null
          featured?: boolean
          frequency_hz?: string[] | null
          generation?: string | null
          gtin?: string | null
          hero_poster_url?: string | null
          highlights?: string[]
          hs_code?: string | null
          id?: string
          installation_service?: boolean | null
          internal_sku?: string | null
          ip_rating?: string | null
          last_order_date?: string | null
          launch_date?: string | null
          lead_time?: string | null
          legacy_code?: string | null
          level?: string | null
          logistics?: Json
          machine_dimensions?: string | null
          machine_weight_kg?: number | null
          maintenance_interval?: string | null
          manufacturer?: string | null
          meta_description?: string | null
          meta_title?: string | null
          model_year?: string | null
          moq?: number | null
          motor_power_w?: number | null
          mpn?: string | null
          og_image_url?: string | null
          oil_mist_filter?: boolean | null
          operating_temp?: string | null
          phase?: string | null
          plug_types?: string[] | null
          pneumatic_supply?: boolean | null
          power_consumption_w?: number | null
          price_updated_at?: string | null
          product_name: string
          published_at?: string | null
          returns_policy?: string | null
          revision_history?: Json
          rohs_compliant?: boolean | null
          schema_id?: string | null
          schema_knowledge?: Json
          schema_specs?: Json
          schema_version?: string | null
          schema_visibility?: Json
          search_text?: string | null
          service_life?: string | null
          slug: string
          spare_parts_availability?: string | null
          spare_parts_stock?: string | null
          specs?: Json | null
          status?: string | null
          status_reason?: string | null
          subcategory_slug: string
          support_channels?: string[] | null
          supports_complete_set?: boolean | null
          supports_head_only?: boolean | null
          tags?: string[] | null
          technical_support?: string | null
          template_id?: string | null
          tenant_id: string
          training_available?: boolean | null
          updated_at?: string | null
          visible?: boolean
          voltage?: string[] | null
          warranty?: string | null
          warranty_coverage?: string | null
          warranty_exclusions?: string | null
          warranty_months?: number | null
          warranty_start_from?: string | null
          warranty_type?: string | null
          watt?: string | null
        }
        Update: {
          alternate_names?: string[] | null
          available_from?: string | null
          brand?: string | null
          brand_mark_url?: string | null
          category_slug?: string
          ce_certified?: boolean | null
          colors?: string[] | null
          content_updated_at?: string | null
          country_of_origin?: string | null
          created_at?: string | null
          description?: string | null
          division_slug?: string
          eol_date?: string | null
          excerpt?: string | null
          family?: string | null
          feature_cards?: Json | null
          featured?: boolean
          frequency_hz?: string[] | null
          generation?: string | null
          gtin?: string | null
          hero_poster_url?: string | null
          highlights?: string[]
          hs_code?: string | null
          id?: string
          installation_service?: boolean | null
          internal_sku?: string | null
          ip_rating?: string | null
          last_order_date?: string | null
          launch_date?: string | null
          lead_time?: string | null
          legacy_code?: string | null
          level?: string | null
          logistics?: Json
          machine_dimensions?: string | null
          machine_weight_kg?: number | null
          maintenance_interval?: string | null
          manufacturer?: string | null
          meta_description?: string | null
          meta_title?: string | null
          model_year?: string | null
          moq?: number | null
          motor_power_w?: number | null
          mpn?: string | null
          og_image_url?: string | null
          oil_mist_filter?: boolean | null
          operating_temp?: string | null
          phase?: string | null
          plug_types?: string[] | null
          pneumatic_supply?: boolean | null
          power_consumption_w?: number | null
          price_updated_at?: string | null
          product_name?: string
          published_at?: string | null
          returns_policy?: string | null
          revision_history?: Json
          rohs_compliant?: boolean | null
          schema_id?: string | null
          schema_knowledge?: Json
          schema_specs?: Json
          schema_version?: string | null
          schema_visibility?: Json
          search_text?: string | null
          service_life?: string | null
          slug?: string
          spare_parts_availability?: string | null
          spare_parts_stock?: string | null
          specs?: Json | null
          status?: string | null
          status_reason?: string | null
          subcategory_slug?: string
          support_channels?: string[] | null
          supports_complete_set?: boolean | null
          supports_head_only?: boolean | null
          tags?: string[] | null
          technical_support?: string | null
          template_id?: string | null
          tenant_id?: string
          training_available?: boolean | null
          updated_at?: string | null
          visible?: boolean
          voltage?: string[] | null
          warranty?: string | null
          warranty_coverage?: string | null
          warranty_exclusions?: string | null
          warranty_months?: number | null
          warranty_start_from?: string | null
          warranty_type?: string | null
          watt?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "product_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: []
      }
      project_members: {
        Row: {
          account_id: string
          added_by: string | null
          created_at: string
          id: string
          project_id: string
          role: string
          source: string
          tenant_id: string
        }
        Insert: {
          account_id: string
          added_by?: string | null
          created_at?: string
          id?: string
          project_id: string
          role?: string
          source?: string
          tenant_id: string
        }
        Update: {
          account_id?: string
          added_by?: string | null
          created_at?: string
          id?: string
          project_id?: string
          role?: string
          source?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_milestones: {
        Row: {
          color: string | null
          created_at: string
          due_date: string | null
          id: string
          is_reached: boolean
          name: string
          project_id: string
          sort_order: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          is_reached?: boolean
          name: string
          project_id: string
          sort_order?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          is_reached?: boolean
          name?: string
          project_id?: string
          sort_order?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_stages: {
        Row: {
          color: string | null
          created_at: string
          id: string
          is_closed: boolean
          is_default_new: boolean
          name: string
          project_id: string
          sort_order: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          is_closed?: boolean
          is_default_new?: boolean
          name: string
          project_id: string
          sort_order?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          is_closed?: boolean
          is_default_new?: boolean
          name?: string
          project_id?: string
          sort_order?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_stages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_tags: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          sort_order: number
          tenant_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          tenant_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          tenant_id?: string
        }
        Relationships: []
      }
      project_task_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          task_id: string
          tenant_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          task_id: string
          tenant_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          task_id?: string
          tenant_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "project_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      project_task_checklist_items: {
        Row: {
          created_at: string
          id: string
          is_done: boolean
          sort_order: number
          task_id: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_done?: boolean
          sort_order?: number
          task_id: string
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_done?: boolean
          sort_order?: number
          task_id?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_task_checklist_items_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "project_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      project_task_comments: {
        Row: {
          author_account_id: string | null
          body: string
          created_at: string
          id: string
          task_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          author_account_id?: string | null
          body: string
          created_at?: string
          id?: string
          task_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          author_account_id?: string | null
          body?: string
          created_at?: string
          id?: string
          task_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "project_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      project_tasks: {
        Row: {
          assignee_account_id: string | null
          blocked_by_task_ids: string[]
          closed_at: string | null
          created_at: string
          created_by_account_id: string | null
          description: string | null
          due_date: string | null
          estimated_hours: number | null
          followers_account_ids: string[]
          id: string
          linked_entity_id: string | null
          linked_entity_label: string | null
          linked_entity_type: string | null
          linked_planning_item_id: string | null
          logged_hours: number
          parent_task_id: string | null
          priority: string
          progress_pct: number
          project_id: string
          sort_order: number
          stage_id: string | null
          start_date: string | null
          status: string
          tag_ids: string[]
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          assignee_account_id?: string | null
          blocked_by_task_ids?: string[]
          closed_at?: string | null
          created_at?: string
          created_by_account_id?: string | null
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          followers_account_ids?: string[]
          id?: string
          linked_entity_id?: string | null
          linked_entity_label?: string | null
          linked_entity_type?: string | null
          linked_planning_item_id?: string | null
          logged_hours?: number
          parent_task_id?: string | null
          priority?: string
          progress_pct?: number
          project_id: string
          sort_order?: number
          stage_id?: string | null
          start_date?: string | null
          status?: string
          tag_ids?: string[]
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          assignee_account_id?: string | null
          blocked_by_task_ids?: string[]
          closed_at?: string | null
          created_at?: string
          created_by_account_id?: string | null
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          followers_account_ids?: string[]
          id?: string
          linked_entity_id?: string | null
          linked_entity_label?: string | null
          linked_entity_type?: string | null
          linked_planning_item_id?: string | null
          logged_hours?: number
          parent_task_id?: string | null
          priority?: string
          progress_pct?: number
          project_id?: string
          sort_order?: number
          stage_id?: string | null
          start_date?: string | null
          status?: string
          tag_ids?: string[]
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_project_tasks_assignee"
            columns: ["assignee_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "project_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "project_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      project_time_entries: {
        Row: {
          account_id: string | null
          created_at: string
          entry_date: string
          id: string
          invoiced_invoice_id: string | null
          minutes: number
          note: string | null
          planning_item_id: string | null
          project_id: string
          task_id: string | null
          tenant_id: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          entry_date?: string
          id?: string
          invoiced_invoice_id?: string | null
          minutes?: number
          note?: string | null
          planning_item_id?: string | null
          project_id: string
          task_id?: string | null
          tenant_id: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          entry_date?: string
          id?: string
          invoiced_invoice_id?: string | null
          minutes?: number
          note?: string | null
          planning_item_id?: string | null
          project_id?: string
          task_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_time_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_time_entries_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "project_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          archived_at: string | null
          billing_rate: number | null
          budget_amount: number | null
          budget_hours: number | null
          code: string | null
          color: string | null
          created_at: string
          created_by_account_id: string | null
          currency: string | null
          customer_id: string | null
          description: string | null
          icon: string | null
          id: string
          is_billable: boolean
          is_favorite: boolean
          is_template: boolean
          manager_account_id: string | null
          name: string
          planned_end: string | null
          planned_start: string | null
          progress_pct: number | null
          sort_order: number
          source_quotation_id: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          billing_rate?: number | null
          budget_amount?: number | null
          budget_hours?: number | null
          code?: string | null
          color?: string | null
          created_at?: string
          created_by_account_id?: string | null
          currency?: string | null
          customer_id?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_billable?: boolean
          is_favorite?: boolean
          is_template?: boolean
          manager_account_id?: string | null
          name: string
          planned_end?: string | null
          planned_start?: string | null
          progress_pct?: number | null
          sort_order?: number
          source_quotation_id?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          billing_rate?: number | null
          budget_amount?: number | null
          budget_hours?: number | null
          code?: string | null
          color?: string | null
          created_at?: string
          created_by_account_id?: string | null
          currency?: string | null
          customer_id?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_billable?: boolean
          is_favorite?: boolean
          is_template?: boolean
          manager_account_id?: string | null
          name?: string
          planned_end?: string | null
          planned_start?: string | null
          progress_pct?: number | null
          sort_order?: number
          source_quotation_id?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_projects_customer"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_projects_manager"
            columns: ["manager_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_source_quotation_id_fkey"
            columns: ["source_quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_approval_rules: {
        Row: {
          applies_to: string
          approver_role: string | null
          code: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          max_amount_usd: number | null
          min_amount_usd: number | null
          name: string
          sort_order: number | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          applies_to?: string
          approver_role?: string | null
          code?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          max_amount_usd?: number | null
          min_amount_usd?: number | null
          name: string
          sort_order?: number | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          applies_to?: string
          approver_role?: string | null
          code?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          max_amount_usd?: number | null
          min_amount_usd?: number | null
          name?: string
          sort_order?: number | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      purchase_categories: {
        Row: {
          code: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          kind: Database["public"]["Enums"]["purchase_category_kind"]
          name: string
          parent_id: string | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          kind?: Database["public"]["Enums"]["purchase_category_kind"]
          name: string
          parent_id?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          kind?: Database["public"]["Enums"]["purchase_category_kind"]
          name?: string
          parent_id?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "purchase_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          category_id: string | null
          created_at: string | null
          description: string | null
          discount_percent: number | null
          expected_delivery_date: string | null
          id: string
          inventory_item_id: string | null
          line_total: number | null
          notes: string | null
          po_id: string
          product_id: string | null
          qty: number
          qty_billed: number | null
          qty_received: number | null
          sort_order: number | null
          tax_percent: number | null
          unit: string | null
          unit_cost: number
        }
        Insert: {
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          discount_percent?: number | null
          expected_delivery_date?: string | null
          id?: string
          inventory_item_id?: string | null
          line_total?: number | null
          notes?: string | null
          po_id: string
          product_id?: string | null
          qty?: number
          qty_billed?: number | null
          qty_received?: number | null
          sort_order?: number | null
          tax_percent?: number | null
          unit?: string | null
          unit_cost?: number
        }
        Update: {
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          discount_percent?: number | null
          expected_delivery_date?: string | null
          id?: string
          inventory_item_id?: string | null
          line_total?: number | null
          notes?: string | null
          po_id?: string
          product_id?: string | null
          qty?: number
          qty_billed?: number | null
          qty_received?: number | null
          sort_order?: number | null
          tax_percent?: number | null
          unit?: string | null
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "purchase_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          actual_delivery_date: string | null
          approved_at: string | null
          approved_by_account_id: string | null
          base_amount: number | null
          base_currency: string | null
          category_id: string | null
          contract_id: string | null
          created_at: string | null
          created_by_account_id: string | null
          currency: string | null
          deal_no: number | null
          exchange_rate: number | null
          expected_delivery_date: string | null
          fx_conversion_date: string | null
          fx_rate: number | null
          id: string
          incoterms: string | null
          internal_notes: string | null
          notes: string | null
          order_date: string | null
          order_id: string | null
          other_charges: number | null
          payment_terms: string | null
          po_no: string | null
          requisition_id: string | null
          rfq_id: string | null
          ship_to_address: string | null
          ship_to_warehouse: string | null
          shipping_cost: number | null
          status: Database["public"]["Enums"]["purchase_order_status"]
          subtotal: number | null
          supplier_id: string
          tax_total: number | null
          tenant_id: string | null
          total: number | null
          updated_at: string | null
        }
        Insert: {
          actual_delivery_date?: string | null
          approved_at?: string | null
          approved_by_account_id?: string | null
          base_amount?: number | null
          base_currency?: string | null
          category_id?: string | null
          contract_id?: string | null
          created_at?: string | null
          created_by_account_id?: string | null
          currency?: string | null
          deal_no?: number | null
          exchange_rate?: number | null
          expected_delivery_date?: string | null
          fx_conversion_date?: string | null
          fx_rate?: number | null
          id?: string
          incoterms?: string | null
          internal_notes?: string | null
          notes?: string | null
          order_date?: string | null
          order_id?: string | null
          other_charges?: number | null
          payment_terms?: string | null
          po_no?: string | null
          requisition_id?: string | null
          rfq_id?: string | null
          ship_to_address?: string | null
          ship_to_warehouse?: string | null
          shipping_cost?: number | null
          status?: Database["public"]["Enums"]["purchase_order_status"]
          subtotal?: number | null
          supplier_id: string
          tax_total?: number | null
          tenant_id?: string | null
          total?: number | null
          updated_at?: string | null
        }
        Update: {
          actual_delivery_date?: string | null
          approved_at?: string | null
          approved_by_account_id?: string | null
          base_amount?: number | null
          base_currency?: string | null
          category_id?: string | null
          contract_id?: string | null
          created_at?: string | null
          created_by_account_id?: string | null
          currency?: string | null
          deal_no?: number | null
          exchange_rate?: number | null
          expected_delivery_date?: string | null
          fx_conversion_date?: string | null
          fx_rate?: number | null
          id?: string
          incoterms?: string | null
          internal_notes?: string | null
          notes?: string | null
          order_date?: string | null
          order_id?: string | null
          other_charges?: number | null
          payment_terms?: string | null
          po_no?: string | null
          requisition_id?: string | null
          rfq_id?: string | null
          ship_to_address?: string | null
          ship_to_warehouse?: string | null
          shipping_cost?: number | null
          status?: Database["public"]["Enums"]["purchase_order_status"]
          subtotal?: number | null
          supplier_id?: string
          tax_total?: number | null
          tenant_id?: string | null
          total?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "purchase_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "supplier_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_requisition_id_fkey"
            columns: ["requisition_id"]
            isOneToOne: false
            referencedRelation: "purchase_requisitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "purchase_rfqs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_receipt_items: {
        Row: {
          condition_notes: string | null
          created_at: string | null
          currency: string
          description: string | null
          id: string
          inventory_item_id: string | null
          inventory_movement_id: string | null
          po_item_id: string | null
          product_id: string | null
          qty_accepted: number | null
          qty_received: number
          qty_rejected: number | null
          receipt_id: string
          tenant_id: string | null
          unit: string | null
          unit_cost: number | null
          warehouse_id: string | null
        }
        Insert: {
          condition_notes?: string | null
          created_at?: string | null
          currency?: string
          description?: string | null
          id?: string
          inventory_item_id?: string | null
          inventory_movement_id?: string | null
          po_item_id?: string | null
          product_id?: string | null
          qty_accepted?: number | null
          qty_received?: number
          qty_rejected?: number | null
          receipt_id: string
          tenant_id?: string | null
          unit?: string | null
          unit_cost?: number | null
          warehouse_id?: string | null
        }
        Update: {
          condition_notes?: string | null
          created_at?: string | null
          currency?: string
          description?: string | null
          id?: string
          inventory_item_id?: string | null
          inventory_movement_id?: string | null
          po_item_id?: string | null
          product_id?: string | null
          qty_accepted?: number | null
          qty_received?: number
          qty_rejected?: number | null
          receipt_id?: string
          tenant_id?: string | null
          unit?: string | null
          unit_cost?: number | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_receipt_items_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_receipt_items_inventory_movement_id_fkey"
            columns: ["inventory_movement_id"]
            isOneToOne: false
            referencedRelation: "inventory_stock_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_receipt_items_po_item_id_fkey"
            columns: ["po_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_receipt_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_receipt_items_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "purchase_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_receipt_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_receipt_items_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "inventory_warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_receipts: {
        Row: {
          accounting_entry_id: string | null
          accounting_last_error: string | null
          accounting_posted_at: string | null
          accounting_status: string
          carrier: string | null
          container_no: string | null
          created_at: string | null
          customer_id: string | null
          destination_location_id: string | null
          destination_mode: string
          expected_arrival_date: string | null
          expected_ship_date: string | null
          forwarder_name: string | null
          gr_no: string | null
          id: string
          notes: string | null
          po_id: string | null
          port_name: string | null
          posted_at: string | null
          posted_by: string | null
          received_at: string | null
          received_by_account_id: string | null
          shipment_reference: string | null
          status: Database["public"]["Enums"]["purchase_receipt_status"]
          supplier_id: string | null
          tenant_id: string | null
          tracking_no: string | null
          updated_at: string | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
          warehouse_id: string | null
        }
        Insert: {
          accounting_entry_id?: string | null
          accounting_last_error?: string | null
          accounting_posted_at?: string | null
          accounting_status?: string
          carrier?: string | null
          container_no?: string | null
          created_at?: string | null
          customer_id?: string | null
          destination_location_id?: string | null
          destination_mode?: string
          expected_arrival_date?: string | null
          expected_ship_date?: string | null
          forwarder_name?: string | null
          gr_no?: string | null
          id?: string
          notes?: string | null
          po_id?: string | null
          port_name?: string | null
          posted_at?: string | null
          posted_by?: string | null
          received_at?: string | null
          received_by_account_id?: string | null
          shipment_reference?: string | null
          status?: Database["public"]["Enums"]["purchase_receipt_status"]
          supplier_id?: string | null
          tenant_id?: string | null
          tracking_no?: string | null
          updated_at?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
          warehouse_id?: string | null
        }
        Update: {
          accounting_entry_id?: string | null
          accounting_last_error?: string | null
          accounting_posted_at?: string | null
          accounting_status?: string
          carrier?: string | null
          container_no?: string | null
          created_at?: string | null
          customer_id?: string | null
          destination_location_id?: string | null
          destination_mode?: string
          expected_arrival_date?: string | null
          expected_ship_date?: string | null
          forwarder_name?: string | null
          gr_no?: string | null
          id?: string
          notes?: string | null
          po_id?: string | null
          port_name?: string | null
          posted_at?: string | null
          posted_by?: string | null
          received_at?: string | null
          received_by_account_id?: string | null
          shipment_reference?: string | null
          status?: Database["public"]["Enums"]["purchase_receipt_status"]
          supplier_id?: string | null
          tenant_id?: string | null
          tracking_no?: string | null
          updated_at?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_receipts_accounting_entry_id_fkey"
            columns: ["accounting_entry_id"]
            isOneToOne: false
            referencedRelation: "accounting_journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_receipts_destination_location_id_fkey"
            columns: ["destination_location_id"]
            isOneToOne: false
            referencedRelation: "inventory_warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_receipts_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_receipts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_receipts_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "inventory_warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_requisition_items: {
        Row: {
          category_id: string | null
          created_at: string | null
          description: string | null
          estimated_price: number | null
          id: string
          notes: string | null
          product_id: string | null
          qty: number
          requisition_id: string
          unit: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          estimated_price?: number | null
          id?: string
          notes?: string | null
          product_id?: string | null
          qty?: number
          requisition_id: string
          unit?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          estimated_price?: number | null
          id?: string
          notes?: string | null
          product_id?: string | null
          qty?: number
          requisition_id?: string
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_requisition_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "purchase_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_requisition_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_requisition_items_requisition_id_fkey"
            columns: ["requisition_id"]
            isOneToOne: false
            referencedRelation: "purchase_requisitions"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_requisitions: {
        Row: {
          approved_at: string | null
          approved_by_account_id: string | null
          created_at: string | null
          currency: string | null
          department: string | null
          id: string
          justification: string | null
          needed_by: string | null
          pr_no: string | null
          priority: number | null
          rejected_reason: string | null
          requestor_account_id: string | null
          status: Database["public"]["Enums"]["purchase_req_status"]
          tenant_id: string | null
          total_estimated: number | null
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by_account_id?: string | null
          created_at?: string | null
          currency?: string | null
          department?: string | null
          id?: string
          justification?: string | null
          needed_by?: string | null
          pr_no?: string | null
          priority?: number | null
          rejected_reason?: string | null
          requestor_account_id?: string | null
          status?: Database["public"]["Enums"]["purchase_req_status"]
          tenant_id?: string | null
          total_estimated?: number | null
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by_account_id?: string | null
          created_at?: string | null
          currency?: string | null
          department?: string | null
          id?: string
          justification?: string | null
          needed_by?: string | null
          pr_no?: string | null
          priority?: number | null
          rejected_reason?: string | null
          requestor_account_id?: string | null
          status?: Database["public"]["Enums"]["purchase_req_status"]
          tenant_id?: string | null
          total_estimated?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      purchase_return_items: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          po_item_id: string | null
          product_id: string | null
          qty: number
          reason: string | null
          return_id: string
          unit: string | null
          unit_cost: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          po_item_id?: string | null
          product_id?: string | null
          qty?: number
          reason?: string | null
          return_id: string
          unit?: string | null
          unit_cost?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          po_item_id?: string | null
          product_id?: string | null
          qty?: number
          reason?: string | null
          return_id?: string
          unit?: string | null
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_return_items_po_item_id_fkey"
            columns: ["po_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_return_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_return_items_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "purchase_returns"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_returns: {
        Row: {
          bill_id: string | null
          created_at: string | null
          created_by_account_id: string | null
          currency: string | null
          id: string
          notes: string | null
          po_id: string | null
          reason: string | null
          receipt_id: string | null
          refund_amount: number | null
          refund_received_at: string | null
          return_date: string | null
          return_no: string | null
          status: Database["public"]["Enums"]["purchase_return_status"]
          supplier_id: string
          tenant_id: string | null
          total_value: number | null
          updated_at: string | null
        }
        Insert: {
          bill_id?: string | null
          created_at?: string | null
          created_by_account_id?: string | null
          currency?: string | null
          id?: string
          notes?: string | null
          po_id?: string | null
          reason?: string | null
          receipt_id?: string | null
          refund_amount?: number | null
          refund_received_at?: string | null
          return_date?: string | null
          return_no?: string | null
          status?: Database["public"]["Enums"]["purchase_return_status"]
          supplier_id: string
          tenant_id?: string | null
          total_value?: number | null
          updated_at?: string | null
        }
        Update: {
          bill_id?: string | null
          created_at?: string | null
          created_by_account_id?: string | null
          currency?: string | null
          id?: string
          notes?: string | null
          po_id?: string | null
          reason?: string | null
          receipt_id?: string | null
          refund_amount?: number | null
          refund_received_at?: string | null
          return_date?: string | null
          return_no?: string | null
          status?: Database["public"]["Enums"]["purchase_return_status"]
          supplier_id?: string
          tenant_id?: string | null
          total_value?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_returns_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "vendor_bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_returns_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_returns_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "purchase_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_returns_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_rfq_items: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          notes: string | null
          product_id: string | null
          qty: number
          quoted_price: number | null
          rfq_id: string
          target_price: number | null
          unit: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          product_id?: string | null
          qty?: number
          quoted_price?: number | null
          rfq_id: string
          target_price?: number | null
          unit?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          product_id?: string | null
          qty?: number
          quoted_price?: number | null
          rfq_id?: string
          target_price?: number | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_rfq_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_rfq_items_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "purchase_rfqs"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_rfqs: {
        Row: {
          created_at: string | null
          created_by_account_id: string | null
          currency: string | null
          id: string
          incoterms: string | null
          notes: string | null
          payment_terms: string | null
          requisition_id: string | null
          response_due: string | null
          rfq_no: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["purchase_rfq_status"]
          supplier_id: string | null
          tenant_id: string | null
          total_estimated: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by_account_id?: string | null
          currency?: string | null
          id?: string
          incoterms?: string | null
          notes?: string | null
          payment_terms?: string | null
          requisition_id?: string | null
          response_due?: string | null
          rfq_no?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["purchase_rfq_status"]
          supplier_id?: string | null
          tenant_id?: string | null
          total_estimated?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by_account_id?: string | null
          currency?: string | null
          id?: string
          incoterms?: string | null
          notes?: string | null
          payment_terms?: string | null
          requisition_id?: string | null
          response_due?: string | null
          rfq_no?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["purchase_rfq_status"]
          supplier_id?: string | null
          tenant_id?: string | null
          total_estimated?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_rfqs_requisition_id_fkey"
            columns: ["requisition_id"]
            isOneToOne: false
            referencedRelation: "purchase_requisitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_rfqs_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          account_id: string
          auth: string
          browser: string | null
          created_at: string
          device_id: string | null
          device_name: string | null
          endpoint: string
          id: string
          is_active: boolean
          last_used_at: string | null
          os: string | null
          p256dh: string
          revoked_at: string | null
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          account_id: string
          auth: string
          browser?: string | null
          created_at?: string
          device_id?: string | null
          device_name?: string | null
          endpoint: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          os?: string | null
          p256dh: string
          revoked_at?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          account_id?: string
          auth?: string
          browser?: string | null
          created_at?: string
          device_id?: string | null
          device_name?: string | null
          endpoint?: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          os?: string | null
          p256dh?: string
          revoked_at?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_ai_sessions: {
        Row: {
          account_id: string | null
          created_at: string
          error: string | null
          id: string
          issue_id: string
          latency_ms: number | null
          model: string | null
          prompt: string | null
          provider: string | null
          response: string | null
          response_markdown: string | null
          status: string
          tenant_id: string
          tokens_input: number | null
          tokens_output: number | null
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          issue_id: string
          latency_ms?: number | null
          model?: string | null
          prompt?: string | null
          provider?: string | null
          response?: string | null
          response_markdown?: string | null
          status?: string
          tenant_id: string
          tokens_input?: number | null
          tokens_output?: number | null
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          account_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          issue_id?: string
          latency_ms?: number | null
          model?: string | null
          prompt?: string | null
          provider?: string | null
          response?: string | null
          response_markdown?: string | null
          status?: string
          tenant_id?: string
          tokens_input?: number | null
          tokens_output?: number | null
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qa_ai_sessions_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "qa_issue_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qa_ai_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qa_ai_sessions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "qa_debug_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_debug_workspaces: {
        Row: {
          ai_ready: boolean
          created_at: string
          created_by: string | null
          debug_context: Json
          environment_snapshot: Json
          exported_at: string | null
          generated_prompt: string | null
          generation_version: string | null
          id: string
          issue_id: string
          issue_snapshot: Json
          last_opened_at: string | null
          related_components: Json
          related_issues: Json
          related_routes: Json
          reproduction_summary: string | null
          tenant_id: string
          updated_at: string
          workspace_status: string
        }
        Insert: {
          ai_ready?: boolean
          created_at?: string
          created_by?: string | null
          debug_context?: Json
          environment_snapshot?: Json
          exported_at?: string | null
          generated_prompt?: string | null
          generation_version?: string | null
          id?: string
          issue_id: string
          issue_snapshot?: Json
          last_opened_at?: string | null
          related_components?: Json
          related_issues?: Json
          related_routes?: Json
          reproduction_summary?: string | null
          tenant_id: string
          updated_at?: string
          workspace_status?: string
        }
        Update: {
          ai_ready?: boolean
          created_at?: string
          created_by?: string | null
          debug_context?: Json
          environment_snapshot?: Json
          exported_at?: string | null
          generated_prompt?: string | null
          generation_version?: string | null
          id?: string
          issue_id?: string
          issue_snapshot?: Json
          last_opened_at?: string | null
          related_components?: Json
          related_issues?: Json
          related_routes?: Json
          reproduction_summary?: string | null
          tenant_id?: string
          updated_at?: string
          workspace_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "qa_debug_workspaces_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qa_debug_workspaces_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: true
            referencedRelation: "qa_issue_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qa_debug_workspaces_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_fix_evidence: {
        Row: {
          after_attachments: Json
          commit_hash: string | null
          created_at: string
          created_by: string | null
          created_by_name: string | null
          cycle_number: number
          id: string
          issue_id: string
          pr_link: string | null
          summary: string | null
          tenant_id: string
        }
        Insert: {
          after_attachments?: Json
          commit_hash?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          cycle_number?: number
          id?: string
          issue_id: string
          pr_link?: string | null
          summary?: string | null
          tenant_id: string
        }
        Update: {
          after_attachments?: Json
          commit_hash?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          cycle_number?: number
          id?: string
          issue_id?: string
          pr_link?: string | null
          summary?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qa_fix_evidence_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "qa_issue_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_investigation_reports: {
        Row: {
          analysis_version: string | null
          confidence_score: number
          created_at: string
          generated_at: string
          generated_summary: string | null
          hotspot_flags: Json
          id: string
          investigation_notes: Json
          issue_id: string
          module_health_snapshot: Json
          possible_causes: Json
          regression_flags: Json
          related_patterns: Json
          risk_score: number
          stale: boolean
          suggested_files: Json
          tenant_id: string
          workspace_id: string | null
        }
        Insert: {
          analysis_version?: string | null
          confidence_score?: number
          created_at?: string
          generated_at?: string
          generated_summary?: string | null
          hotspot_flags?: Json
          id?: string
          investigation_notes?: Json
          issue_id: string
          module_health_snapshot?: Json
          possible_causes?: Json
          regression_flags?: Json
          related_patterns?: Json
          risk_score?: number
          stale?: boolean
          suggested_files?: Json
          tenant_id: string
          workspace_id?: string | null
        }
        Update: {
          analysis_version?: string | null
          confidence_score?: number
          created_at?: string
          generated_at?: string
          generated_summary?: string | null
          hotspot_flags?: Json
          id?: string
          investigation_notes?: Json
          issue_id?: string
          module_health_snapshot?: Json
          possible_causes?: Json
          regression_flags?: Json
          related_patterns?: Json
          risk_score?: number
          stale?: boolean
          suggested_files?: Json
          tenant_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qa_investigation_reports_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: true
            referencedRelation: "qa_issue_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qa_investigation_reports_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qa_investigation_reports_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "qa_debug_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_issue_activity: {
        Row: {
          activity_type: string
          actor_id: string | null
          actor_name: string | null
          created_at: string
          id: string
          issue_id: string
          metadata: Json
          new_value: string | null
          old_value: string | null
          tenant_id: string
        }
        Insert: {
          activity_type: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          id?: string
          issue_id: string
          metadata?: Json
          new_value?: string | null
          old_value?: string | null
          tenant_id: string
        }
        Update: {
          activity_type?: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          id?: string
          issue_id?: string
          metadata?: Json
          new_value?: string | null
          old_value?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qa_issue_activity_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "qa_issue_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_issue_comments: {
        Row: {
          attachments: Json
          created_at: string
          edited_at: string | null
          id: string
          is_internal_note: boolean
          issue_id: string
          message: string
          tenant_id: string
          user_id: string | null
          user_name: string | null
          user_role: string | null
        }
        Insert: {
          attachments?: Json
          created_at?: string
          edited_at?: string | null
          id?: string
          is_internal_note?: boolean
          issue_id: string
          message: string
          tenant_id: string
          user_id?: string | null
          user_name?: string | null
          user_role?: string | null
        }
        Update: {
          attachments?: Json
          created_at?: string
          edited_at?: string | null
          id?: string
          is_internal_note?: boolean
          issue_id?: string
          message?: string
          tenant_id?: string
          user_id?: string | null
          user_name?: string | null
          user_role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qa_issue_comments_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "qa_issue_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_issue_reports: {
        Row: {
          app_module: string | null
          assigned_at: string | null
          assigned_by: string | null
          assigned_to: string | null
          browser_info: string | null
          claude_ready: boolean | null
          component_module: string | null
          component_name: string | null
          component_path: string | null
          component_record_id: string | null
          component_rect: Json | null
          component_section: string | null
          component_styles: Json | null
          components: Json | null
          created_at: string
          data_entity: string | null
          db_table: string | null
          description: string | null
          developer_notes: string | null
          device_info: string | null
          duplicate_of_issue_id: string | null
          expected_result: string | null
          fixed_commit: string | null
          id: string
          issue_type: string
          language: string | null
          page_title: string | null
          priority: string
          reopen_count: number
          reopen_reason: string | null
          reopened_at: string | null
          reporter_email: string | null
          reporter_id: string | null
          reporter_name: string | null
          repro_steps: string | null
          resolution_summary: string | null
          resolved_at: string | null
          route: string | null
          screen_size: string | null
          screenshot_url: string | null
          screenshot_urls: Json | null
          session_id: string | null
          severity: string
          status: string
          suggested_solution: string | null
          tags: string[]
          tenant_id: string
          timezone: string | null
          title: string
          updated_at: string
        }
        Insert: {
          app_module?: string | null
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_to?: string | null
          browser_info?: string | null
          claude_ready?: boolean | null
          component_module?: string | null
          component_name?: string | null
          component_path?: string | null
          component_record_id?: string | null
          component_rect?: Json | null
          component_section?: string | null
          component_styles?: Json | null
          components?: Json | null
          created_at?: string
          data_entity?: string | null
          db_table?: string | null
          description?: string | null
          developer_notes?: string | null
          device_info?: string | null
          duplicate_of_issue_id?: string | null
          expected_result?: string | null
          fixed_commit?: string | null
          id?: string
          issue_type?: string
          language?: string | null
          page_title?: string | null
          priority?: string
          reopen_count?: number
          reopen_reason?: string | null
          reopened_at?: string | null
          reporter_email?: string | null
          reporter_id?: string | null
          reporter_name?: string | null
          repro_steps?: string | null
          resolution_summary?: string | null
          resolved_at?: string | null
          route?: string | null
          screen_size?: string | null
          screenshot_url?: string | null
          screenshot_urls?: Json | null
          session_id?: string | null
          severity?: string
          status?: string
          suggested_solution?: string | null
          tags?: string[]
          tenant_id: string
          timezone?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          app_module?: string | null
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_to?: string | null
          browser_info?: string | null
          claude_ready?: boolean | null
          component_module?: string | null
          component_name?: string | null
          component_path?: string | null
          component_record_id?: string | null
          component_rect?: Json | null
          component_section?: string | null
          component_styles?: Json | null
          components?: Json | null
          created_at?: string
          data_entity?: string | null
          db_table?: string | null
          description?: string | null
          developer_notes?: string | null
          device_info?: string | null
          duplicate_of_issue_id?: string | null
          expected_result?: string | null
          fixed_commit?: string | null
          id?: string
          issue_type?: string
          language?: string | null
          page_title?: string | null
          priority?: string
          reopen_count?: number
          reopen_reason?: string | null
          reopened_at?: string | null
          reporter_email?: string | null
          reporter_id?: string | null
          reporter_name?: string | null
          repro_steps?: string | null
          resolution_summary?: string | null
          resolved_at?: string | null
          route?: string | null
          screen_size?: string | null
          screenshot_url?: string | null
          screenshot_urls?: Json | null
          session_id?: string | null
          severity?: string
          status?: string
          suggested_solution?: string | null
          tags?: string[]
          tenant_id?: string
          timezone?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qa_issue_reports_duplicate_of_issue_id_fkey"
            columns: ["duplicate_of_issue_id"]
            isOneToOne: false
            referencedRelation: "qa_issue_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_issue_watchers: {
        Row: {
          account_id: string
          created_at: string
          id: string
          issue_id: string
          tenant_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          issue_id: string
          tenant_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          issue_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qa_issue_watchers_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qa_issue_watchers_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "qa_issue_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qa_issue_watchers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_items: {
        Row: {
          id: string
          line_discount_percent: number
          product_id: string
          qty: number
          quotation_id: string
          unit_price: number
        }
        Insert: {
          id?: string
          line_discount_percent?: number
          product_id: string
          qty?: number
          quotation_id: string
          unit_price?: number
        }
        Update: {
          id?: string
          line_discount_percent?: number
          product_id?: string
          qty?: number
          quotation_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotation_items_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_preorders: {
        Row: {
          created_at: string | null
          created_by: string | null
          currency: string | null
          customer_ar: string | null
          doc: Json
          id: string
          reference: string | null
          status: string | null
          tenant_id: string
          title: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          customer_ar?: string | null
          doc?: Json
          id?: string
          reference?: string | null
          status?: string | null
          tenant_id: string
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          customer_ar?: string | null
          doc?: Json
          id?: string
          reference?: string | null
          status?: string | null
          tenant_id?: string
          title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      quotations: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          customer_id: string | null
          deal_no: number | null
          discount_percent: number
          doc: Json
          id: string
          issue_date: string
          notes: string | null
          order_id: string | null
          pdf_path: string | null
          quote_no: string | null
          status: Database["public"]["Enums"]["doc_status"]
          tenant_id: string
          total: number
          updated_at: string
          updated_by: string | null
          updated_by_name: string | null
          valid_till: string | null
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string | null
          deal_no?: number | null
          discount_percent?: number
          doc?: Json
          id?: string
          issue_date?: string
          notes?: string | null
          order_id?: string | null
          pdf_path?: string | null
          quote_no?: string | null
          status?: Database["public"]["Enums"]["doc_status"]
          tenant_id?: string
          total?: number
          updated_at?: string
          updated_by?: string | null
          updated_by_name?: string | null
          valid_till?: string | null
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string | null
          deal_no?: number | null
          discount_percent?: number
          doc?: Json
          id?: string
          issue_date?: string
          notes?: string | null
          order_id?: string | null
          pdf_path?: string | null
          quote_no?: string | null
          status?: Database["public"]["Enums"]["doc_status"]
          tenant_id?: string
          total?: number
          updated_at?: string
          updated_by?: string | null
          updated_by_name?: string | null
          valid_till?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      quotations_collabsnapshot_20260613: {
        Row: {
          created_at: string | null
          created_by: string | null
          currency: string | null
          customer_id: string | null
          discount_percent: number | null
          doc: Json | null
          id: string | null
          issue_date: string | null
          notes: string | null
          pdf_path: string | null
          quote_no: string | null
          status: Database["public"]["Enums"]["doc_status"] | null
          tenant_id: string | null
          total: number | null
          updated_at: string | null
          valid_till: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          customer_id?: string | null
          discount_percent?: number | null
          doc?: Json | null
          id?: string | null
          issue_date?: string | null
          notes?: string | null
          pdf_path?: string | null
          quote_no?: string | null
          status?: Database["public"]["Enums"]["doc_status"] | null
          tenant_id?: string | null
          total?: number | null
          updated_at?: string | null
          valid_till?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          customer_id?: string | null
          discount_percent?: number | null
          doc?: Json | null
          id?: string | null
          issue_date?: string | null
          notes?: string | null
          pdf_path?: string | null
          quote_no?: string | null
          status?: Database["public"]["Enums"]["doc_status"] | null
          tenant_id?: string | null
          total?: number | null
          updated_at?: string | null
          valid_till?: string | null
        }
        Relationships: []
      }
      quotations_recovery_snapshot_20260610: {
        Row: {
          created_at: string | null
          created_by: string | null
          currency: string | null
          customer_id: string | null
          discount_percent: number | null
          doc: Json | null
          id: string | null
          issue_date: string | null
          notes: string | null
          pdf_path: string | null
          quote_no: string | null
          snapshot_at: string | null
          status: Database["public"]["Enums"]["doc_status"] | null
          tenant_id: string | null
          total: number | null
          updated_at: string | null
          valid_till: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          customer_id?: string | null
          discount_percent?: number | null
          doc?: Json | null
          id?: string | null
          issue_date?: string | null
          notes?: string | null
          pdf_path?: string | null
          quote_no?: string | null
          snapshot_at?: string | null
          status?: Database["public"]["Enums"]["doc_status"] | null
          tenant_id?: string | null
          total?: number | null
          updated_at?: string | null
          valid_till?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          customer_id?: string | null
          discount_percent?: number | null
          doc?: Json | null
          id?: string | null
          issue_date?: string | null
          notes?: string | null
          pdf_path?: string | null
          quote_no?: string | null
          snapshot_at?: string | null
          status?: Database["public"]["Enums"]["doc_status"] | null
          tenant_id?: string | null
          total?: number | null
          updated_at?: string | null
          valid_till?: string | null
        }
        Relationships: []
      }
      related_products: {
        Row: {
          order: number
          product_id: string
          related_id: string
          relation_type: string
        }
        Insert: {
          order?: number
          product_id: string
          related_id: string
          relation_type?: string
        }
        Update: {
          order?: number
          product_id?: string
          related_id?: string
          relation_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "related_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "related_products_related_id_fkey"
            columns: ["related_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          can_approve_adjustments: boolean
          can_view_private: boolean
          can_void_movements: boolean
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_super_admin: boolean
          name: string
          scope: string
          slug: string
        }
        Insert: {
          can_approve_adjustments?: boolean
          can_view_private?: boolean
          can_void_movements?: boolean
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_super_admin?: boolean
          name: string
          scope?: string
          slug: string
        }
        Update: {
          can_approve_adjustments?: boolean
          can_view_private?: boolean
          can_void_movements?: boolean
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_super_admin?: boolean
          name?: string
          scope?: string
          slug?: string
        }
        Relationships: []
      }
      sales_contracts: {
        Row: {
          amends_id: string | null
          contract_date: string | null
          contract_no: string
          created_at: string
          created_by: string | null
          currency: string | null
          customer_id: string | null
          deal_no: number
          id: string
          invoice_id: string | null
          notes: string | null
          order_id: string | null
          place_of_signing: string | null
          signed_at: string | null
          signed_by: string | null
          snapshot: Json | null
          status: string
          tenant_id: string
          terms: Json
          terms_version: string
          total: number | null
          updated_at: string
        }
        Insert: {
          amends_id?: string | null
          contract_date?: string | null
          contract_no: string
          created_at?: string
          created_by?: string | null
          currency?: string | null
          customer_id?: string | null
          deal_no: number
          id?: string
          invoice_id?: string | null
          notes?: string | null
          order_id?: string | null
          place_of_signing?: string | null
          signed_at?: string | null
          signed_by?: string | null
          snapshot?: Json | null
          status?: string
          tenant_id: string
          terms?: Json
          terms_version?: string
          total?: number | null
          updated_at?: string
        }
        Update: {
          amends_id?: string | null
          contract_date?: string | null
          contract_no?: string
          created_at?: string
          created_by?: string | null
          currency?: string | null
          customer_id?: string | null
          deal_no?: number
          id?: string
          invoice_id?: string | null
          notes?: string | null
          order_id?: string | null
          place_of_signing?: string | null
          signed_at?: string | null
          signed_by?: string | null
          snapshot?: Json | null
          status?: string
          tenant_id?: string
          terms?: Json
          terms_version?: string
          total?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_contracts_amends_id_fkey"
            columns: ["amends_id"]
            isOneToOne: false
            referencedRelation: "sales_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_contracts_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_contracts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_order_items: {
        Row: {
          description: string | null
          id: string
          inventory_item_id: string | null
          product_id: string | null
          qty: number
          qty_shipped: number
          sales_order_id: string
          total: number
          unit_price: number
        }
        Insert: {
          description?: string | null
          id?: string
          inventory_item_id?: string | null
          product_id?: string | null
          qty?: number
          qty_shipped?: number
          sales_order_id: string
          total?: number
          unit_price?: number
        }
        Update: {
          description?: string | null
          id?: string
          inventory_item_id?: string | null
          product_id?: string | null
          qty?: number
          qty_shipped?: number
          sales_order_id?: string
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_items_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_items_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_orders: {
        Row: {
          base_amount: number | null
          base_currency: string | null
          created_at: string
          created_by: string | null
          currency: string
          customer_id: string | null
          fx_conversion_date: string | null
          fx_rate: number | null
          id: string
          notes: string | null
          quotation_id: string | null
          so_no: string | null
          status: Database["public"]["Enums"]["so_status"]
          tenant_id: string | null
        }
        Insert: {
          base_amount?: number | null
          base_currency?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string | null
          fx_conversion_date?: string | null
          fx_rate?: number | null
          id?: string
          notes?: string | null
          quotation_id?: string | null
          so_no?: string | null
          status?: Database["public"]["Enums"]["so_status"]
          tenant_id?: string | null
        }
        Update: {
          base_amount?: number | null
          base_currency?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string | null
          fx_conversion_date?: string | null
          fx_rate?: number | null
          id?: string
          notes?: string | null
          quotation_id?: string | null
          so_no?: string | null
          status?: Database["public"]["Enums"]["so_status"]
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_shipment_items: {
        Row: {
          created_at: string
          id: string
          inventory_item_id: string | null
          inventory_movement_id: string | null
          qty: number
          sales_order_item_id: string
          shipment_id: string
          tenant_id: string
          unit: string
        }
        Insert: {
          created_at?: string
          id?: string
          inventory_item_id?: string | null
          inventory_movement_id?: string | null
          qty: number
          sales_order_item_id: string
          shipment_id: string
          tenant_id: string
          unit?: string
        }
        Update: {
          created_at?: string
          id?: string
          inventory_item_id?: string | null
          inventory_movement_id?: string | null
          qty?: number
          sales_order_item_id?: string
          shipment_id?: string
          tenant_id?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_shipment_items_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_shipment_items_inventory_movement_id_fkey"
            columns: ["inventory_movement_id"]
            isOneToOne: false
            referencedRelation: "inventory_stock_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_shipment_items_sales_order_item_id_fkey"
            columns: ["sales_order_item_id"]
            isOneToOne: false
            referencedRelation: "sales_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_shipment_items_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "sales_shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_shipment_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_shipments: {
        Row: {
          accounting_entry_id: string | null
          accounting_last_error: string | null
          accounting_posted_at: string | null
          accounting_status: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          id: string
          metadata: Json
          notes: string | null
          sales_order_id: string
          shipment_no: string
          shipped_at: string | null
          shipped_by: string | null
          source_location_id: string | null
          status: string
          tenant_id: string
          tracking_no: string | null
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          accounting_entry_id?: string | null
          accounting_last_error?: string | null
          accounting_posted_at?: string | null
          accounting_status?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          metadata?: Json
          notes?: string | null
          sales_order_id: string
          shipment_no: string
          shipped_at?: string | null
          shipped_by?: string | null
          source_location_id?: string | null
          status?: string
          tenant_id: string
          tracking_no?: string | null
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          accounting_entry_id?: string | null
          accounting_last_error?: string | null
          accounting_posted_at?: string | null
          accounting_status?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          metadata?: Json
          notes?: string | null
          sales_order_id?: string
          shipment_no?: string
          shipped_at?: string | null
          shipped_by?: string | null
          source_location_id?: string | null
          status?: string
          tenant_id?: string
          tracking_no?: string | null
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_shipments_accounting_entry_id_fkey"
            columns: ["accounting_entry_id"]
            isOneToOne: false
            referencedRelation: "accounting_journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_shipments_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_shipments_source_location_id_fkey"
            columns: ["source_location_id"]
            isOneToOne: false
            referencedRelation: "inventory_warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_shipments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sections: {
        Row: {
          background: string | null
          button_link: string | null
          button_text: string | null
          button2_link: string | null
          button2_text: string | null
          content: string | null
          created_at: string | null
          id: string
          image_alt: string | null
          image_url: string | null
          items: Json | null
          layout: string
          order: number
          page_id: string
          section_key: string
          subtitle: string | null
          title: string | null
          updated_at: string | null
          video_url: string | null
          visible: boolean
        }
        Insert: {
          background?: string | null
          button_link?: string | null
          button_text?: string | null
          button2_link?: string | null
          button2_text?: string | null
          content?: string | null
          created_at?: string | null
          id?: string
          image_alt?: string | null
          image_url?: string | null
          items?: Json | null
          layout?: string
          order?: number
          page_id: string
          section_key: string
          subtitle?: string | null
          title?: string | null
          updated_at?: string | null
          video_url?: string | null
          visible?: boolean
        }
        Update: {
          background?: string | null
          button_link?: string | null
          button_text?: string | null
          button2_link?: string | null
          button2_text?: string | null
          content?: string | null
          created_at?: string | null
          id?: string
          image_alt?: string | null
          image_url?: string | null
          items?: Json | null
          layout?: string
          order?: number
          page_id?: string
          section_key?: string
          subtitle?: string | null
          title?: string | null
          updated_at?: string | null
          video_url?: string | null
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "sections_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_airports: {
        Row: {
          country_code: string
          created_at: string
          iata: string
          icao: string | null
          id: string
          is_active: boolean
          lat: number | null
          lng: number | null
          locode: string | null
          municipality: string | null
          name: string
          size: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          country_code: string
          created_at?: string
          iata: string
          icao?: string | null
          id?: string
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          locode?: string | null
          municipality?: string | null
          name: string
          size: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          country_code?: string
          created_at?: string
          iata?: string
          icao?: string | null
          id?: string
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          locode?: string | null
          municipality?: string | null
          name?: string
          size?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      shipping_documents: {
        Row: {
          applies_to_modes: string[] | null
          category: string
          code: string
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_customs_required: boolean | null
          is_default: boolean | null
          is_lc_required: boolean | null
          is_mandatory_export: boolean | null
          is_system: boolean | null
          issued_by: string | null
          name: string
          notes: string | null
          short_name: string | null
          sort_order: number | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          applies_to_modes?: string[] | null
          category: string
          code: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_customs_required?: boolean | null
          is_default?: boolean | null
          is_lc_required?: boolean | null
          is_mandatory_export?: boolean | null
          is_system?: boolean | null
          issued_by?: string | null
          name: string
          notes?: string | null
          short_name?: string | null
          sort_order?: number | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          applies_to_modes?: string[] | null
          category?: string
          code?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_customs_required?: boolean | null
          is_default?: boolean | null
          is_lc_required?: boolean | null
          is_mandatory_export?: boolean | null
          is_system?: boolean | null
          issued_by?: string | null
          name?: string
          notes?: string | null
          short_name?: string | null
          sort_order?: number | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      shipping_favorite_routes: {
        Row: {
          account_id: string
          created_at: string
          created_by: string | null
          destination_code: string
          destination_label: string | null
          id: string
          label: string | null
          mode: string | null
          origin_code: string
          origin_label: string | null
          params: Json
          sort_order: number
          tenant_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          created_by?: string | null
          destination_code: string
          destination_label?: string | null
          id?: string
          label?: string | null
          mode?: string | null
          origin_code: string
          origin_label?: string | null
          params?: Json
          sort_order?: number
          tenant_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          created_by?: string | null
          destination_code?: string
          destination_label?: string | null
          id?: string
          label?: string | null
          mode?: string | null
          origin_code?: string
          origin_label?: string | null
          params?: Json
          sort_order?: number
          tenant_id?: string
        }
        Relationships: []
      }
      shipping_methods: {
        Row: {
          code: string
          common_carriers: string[] | null
          common_lanes: string[] | null
          cost_tier: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          documents: string[] | null
          has_tracking: boolean | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          is_system: boolean | null
          mode: string
          name: string
          notes: string | null
          short_name: string | null
          sort_order: number | null
          speed_tier: string | null
          sub_type: string | null
          supports_dangerous_goods: boolean | null
          supports_hazmat: boolean | null
          supports_oversized: boolean | null
          supports_refrigerated: boolean | null
          tenant_id: string | null
          tracking_url_template: string | null
          typical_transit_days_max: number | null
          typical_transit_days_min: number | null
          updated_at: string | null
        }
        Insert: {
          code: string
          common_carriers?: string[] | null
          common_lanes?: string[] | null
          cost_tier?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          documents?: string[] | null
          has_tracking?: boolean | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          is_system?: boolean | null
          mode: string
          name: string
          notes?: string | null
          short_name?: string | null
          sort_order?: number | null
          speed_tier?: string | null
          sub_type?: string | null
          supports_dangerous_goods?: boolean | null
          supports_hazmat?: boolean | null
          supports_oversized?: boolean | null
          supports_refrigerated?: boolean | null
          tenant_id?: string | null
          tracking_url_template?: string | null
          typical_transit_days_max?: number | null
          typical_transit_days_min?: number | null
          updated_at?: string | null
        }
        Update: {
          code?: string
          common_carriers?: string[] | null
          common_lanes?: string[] | null
          cost_tier?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          documents?: string[] | null
          has_tracking?: boolean | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          is_system?: boolean | null
          mode?: string
          name?: string
          notes?: string | null
          short_name?: string | null
          sort_order?: number | null
          speed_tier?: string | null
          sub_type?: string | null
          supports_dangerous_goods?: boolean | null
          supports_hazmat?: boolean | null
          supports_oversized?: boolean | null
          supports_refrigerated?: boolean | null
          tenant_id?: string | null
          tracking_url_template?: string | null
          typical_transit_days_max?: number | null
          typical_transit_days_min?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      shipping_place_names: {
        Row: {
          airport_id: string | null
          created_at: string
          id: string
          lang: string
          name: string
          port_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          search_key: string
          source: string
          source_ref: string | null
          status: string
          updated_at: string
        }
        Insert: {
          airport_id?: string | null
          created_at?: string
          id?: string
          lang: string
          name: string
          port_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          search_key: string
          source: string
          source_ref?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          airport_id?: string | null
          created_at?: string
          id?: string
          lang?: string
          name?: string
          port_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          search_key?: string
          source?: string
          source_ref?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_place_names_airport_id_fkey"
            columns: ["airport_id"]
            isOneToOne: false
            referencedRelation: "shipping_airports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_place_names_port_id_fkey"
            columns: ["port_id"]
            isOneToOne: false
            referencedRelation: "shipping_ports"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_port_aliases: {
        Row: {
          alias: string
          created_at: string
          id: string
          kind: string
          port_id: string
          raw: string | null
        }
        Insert: {
          alias: string
          created_at?: string
          id?: string
          kind: string
          port_id: string
          raw?: string | null
        }
        Update: {
          alias?: string
          created_at?: string
          id?: string
          kind?: string
          port_id?: string
          raw?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipping_port_aliases_port_id_fkey"
            columns: ["port_id"]
            isOneToOne: false
            referencedRelation: "shipping_ports"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_ports: {
        Row: {
          country_code: string
          country_name: string | null
          created_at: string
          harbor_size: string | null
          harbor_type: string | null
          id: string
          in_koleex_list: boolean
          is_active: boolean
          is_container: boolean | null
          lat: number | null
          lng: number | null
          locode: string | null
          name: string
          name_official: string | null
          sea_region: string | null
          source: string
          subdivision: string | null
          tenant_id: string | null
          updated_at: string
          wpi_number: number | null
        }
        Insert: {
          country_code: string
          country_name?: string | null
          created_at?: string
          harbor_size?: string | null
          harbor_type?: string | null
          id?: string
          in_koleex_list?: boolean
          is_active?: boolean
          is_container?: boolean | null
          lat?: number | null
          lng?: number | null
          locode?: string | null
          name: string
          name_official?: string | null
          sea_region?: string | null
          source?: string
          subdivision?: string | null
          tenant_id?: string | null
          updated_at?: string
          wpi_number?: number | null
        }
        Update: {
          country_code?: string
          country_name?: string | null
          created_at?: string
          harbor_size?: string | null
          harbor_type?: string | null
          id?: string
          in_koleex_list?: boolean
          is_active?: boolean
          is_container?: boolean | null
          lat?: number | null
          lng?: number | null
          locode?: string | null
          name?: string
          name_official?: string | null
          sea_region?: string | null
          source?: string
          subdivision?: string | null
          tenant_id?: string | null
          updated_at?: string
          wpi_number?: number | null
        }
        Relationships: []
      }
      shipping_rate_quotes: {
        Row: {
          amount: number | null
          amount_high: number | null
          amount_low: number | null
          carrier: string | null
          confidence: string | null
          confidence_score: number | null
          created_at: string
          created_by: string | null
          currency: string
          destination_airport_id: string | null
          destination_code: string
          destination_code_system: string | null
          destination_port_id: string | null
          equipment: string | null
          eta: string | null
          etd: string | null
          expires_at: string | null
          id: string
          includes_customs: boolean | null
          includes_destination_charges: boolean | null
          includes_origin_charges: boolean | null
          incoterm: string | null
          is_estimate: boolean
          min_charge: number | null
          mode: string
          notes: string | null
          origin_airport_id: string | null
          origin_code: string
          origin_code_system: string | null
          origin_port_id: string | null
          rate_kind: string
          raw: Json | null
          retrieved_at: string
          service_scope: string
          source_cadence: string | null
          source_id: string
          source_label: string | null
          surcharges: Json
          tenant_id: string
          total_estimate: number | null
          transit_days_max: number | null
          transit_days_min: number | null
          unit: string
          updated_at: string
          valid_from: string | null
          valid_until: string | null
          vessel: string | null
          voyage: string | null
          weight_break: string | null
        }
        Insert: {
          amount?: number | null
          amount_high?: number | null
          amount_low?: number | null
          carrier?: string | null
          confidence?: string | null
          confidence_score?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          destination_airport_id?: string | null
          destination_code: string
          destination_code_system?: string | null
          destination_port_id?: string | null
          equipment?: string | null
          eta?: string | null
          etd?: string | null
          expires_at?: string | null
          id?: string
          includes_customs?: boolean | null
          includes_destination_charges?: boolean | null
          includes_origin_charges?: boolean | null
          incoterm?: string | null
          is_estimate?: boolean
          min_charge?: number | null
          mode: string
          notes?: string | null
          origin_airport_id?: string | null
          origin_code: string
          origin_code_system?: string | null
          origin_port_id?: string | null
          rate_kind: string
          raw?: Json | null
          retrieved_at?: string
          service_scope?: string
          source_cadence?: string | null
          source_id: string
          source_label?: string | null
          surcharges?: Json
          tenant_id: string
          total_estimate?: number | null
          transit_days_max?: number | null
          transit_days_min?: number | null
          unit: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
          vessel?: string | null
          voyage?: string | null
          weight_break?: string | null
        }
        Update: {
          amount?: number | null
          amount_high?: number | null
          amount_low?: number | null
          carrier?: string | null
          confidence?: string | null
          confidence_score?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          destination_airport_id?: string | null
          destination_code?: string
          destination_code_system?: string | null
          destination_port_id?: string | null
          equipment?: string | null
          eta?: string | null
          etd?: string | null
          expires_at?: string | null
          id?: string
          includes_customs?: boolean | null
          includes_destination_charges?: boolean | null
          includes_origin_charges?: boolean | null
          incoterm?: string | null
          is_estimate?: boolean
          min_charge?: number | null
          mode?: string
          notes?: string | null
          origin_airport_id?: string | null
          origin_code?: string
          origin_code_system?: string | null
          origin_port_id?: string | null
          rate_kind?: string
          raw?: Json | null
          retrieved_at?: string
          service_scope?: string
          source_cadence?: string | null
          source_id?: string
          source_label?: string | null
          surcharges?: Json
          tenant_id?: string
          total_estimate?: number | null
          transit_days_max?: number | null
          transit_days_min?: number | null
          unit?: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
          vessel?: string | null
          voyage?: string | null
          weight_break?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipping_rate_quotes_destination_airport_id_fkey"
            columns: ["destination_airport_id"]
            isOneToOne: false
            referencedRelation: "shipping_airports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_rate_quotes_destination_port_id_fkey"
            columns: ["destination_port_id"]
            isOneToOne: false
            referencedRelation: "shipping_ports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_rate_quotes_origin_airport_id_fkey"
            columns: ["origin_airport_id"]
            isOneToOne: false
            referencedRelation: "shipping_airports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_rate_quotes_origin_port_id_fkey"
            columns: ["origin_port_id"]
            isOneToOne: false
            referencedRelation: "shipping_ports"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_searches: {
        Row: {
          account_id: string
          created_at: string
          destination_code: string
          destination_label: string | null
          id: string
          last_run_at: string
          mode: string
          origin_code: string
          origin_label: string | null
          params: Json
          run_count: number
          tenant_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          destination_code: string
          destination_label?: string | null
          id?: string
          last_run_at?: string
          mode: string
          origin_code: string
          origin_label?: string | null
          params?: Json
          run_count?: number
          tenant_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          destination_code?: string
          destination_label?: string | null
          id?: string
          last_run_at?: string
          mode?: string
          origin_code?: string
          origin_label?: string | null
          params?: Json
          run_count?: number
          tenant_id?: string
        }
        Relationships: []
      }
      skill_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          name_ar: string | null
          name_zh: string | null
          sort_order: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          name_ar?: string | null
          name_zh?: string | null
          sort_order?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          name_ar?: string | null
          name_zh?: string | null
          sort_order?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      skills: {
        Row: {
          category_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          name_ar: string | null
          name_zh: string | null
          sort_order: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          name_ar?: string | null
          name_zh?: string | null
          sort_order?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          name_ar?: string | null
          name_zh?: string | null
          sort_order?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "skills_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "skill_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      sourcing_watchlists: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          filters: Json
          id: string
          kind: string
          name: string
          supplier_ids: string[]
          tenant_id: string
          updated_at: string
          visibility_tier: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          filters?: Json
          id?: string
          kind?: string
          name: string
          supplier_ids?: string[]
          tenant_id: string
          updated_at?: string
          visibility_tier?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          filters?: Json
          id?: string
          kind?: string
          name?: string
          supplier_ids?: string[]
          tenant_id?: string
          updated_at?: string
          visibility_tier?: string
        }
        Relationships: [
          {
            foreignKeyName: "sourcing_watchlists_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      subcategories: {
        Row: {
          category_id: string
          code: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          name_ar: string | null
          name_zh: string | null
          order: number
          slug: string
        }
        Insert: {
          category_id: string
          code?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          name_ar?: string | null
          name_zh?: string | null
          order?: number
          slug: string
        }
        Update: {
          category_id?: string
          code?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          name_ar?: string | null
          name_zh?: string | null
          order?: number
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_assets: {
        Row: {
          asset_type: string
          contact_id: string | null
          created_at: string
          id: string
          storage_bucket: string
          storage_path: string
          supplier_id: string
        }
        Insert: {
          asset_type: string
          contact_id?: string | null
          created_at?: string
          id?: string
          storage_bucket?: string
          storage_path: string
          supplier_id: string
        }
        Update: {
          asset_type?: string
          contact_id?: string | null
          created_at?: string
          id?: string
          storage_bucket?: string
          storage_path?: string
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_assets_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "supplier_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_assets_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_classifications: {
        Row: {
          classification: string
          confidence: number | null
          created_at: string
          created_by: string | null
          id: string
          is_primary: boolean
          source: string
          supplier_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          classification: string
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_primary?: boolean
          source?: string
          supplier_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          classification?: string
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_primary?: boolean
          source?: string
          supplier_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_classifications_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_classifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_contact_channels: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          is_primary: boolean
          type: string
          value: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          is_primary?: boolean
          type: string
          value: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          type?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_contact_channels_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "supplier_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_contact_person_channels: {
        Row: {
          channel_type: string
          created_at: string
          id: string
          is_primary: boolean
          is_verified: boolean
          label: string | null
          person_id: string
          supplier_id: string
          tenant_id: string
          value: string
        }
        Insert: {
          channel_type: string
          created_at?: string
          id?: string
          is_primary?: boolean
          is_verified?: boolean
          label?: string | null
          person_id: string
          supplier_id: string
          tenant_id: string
          value: string
        }
        Update: {
          channel_type?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          is_verified?: boolean
          label?: string | null
          person_id?: string
          supplier_id?: string
          tenant_id?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_contact_person_channels_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "supplier_contact_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_contact_person_channels_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_contact_person_channels_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_contact_persons: {
        Row: {
          available_hours: Json | null
          avg_response_hours: number | null
          created_at: string
          department: string | null
          email: string | null
          full_name: string
          id: string
          id_image: string | null
          is_active: boolean
          is_decision_maker: boolean
          is_primary: boolean
          last_interaction_at: string | null
          line_id: string | null
          mobile: string | null
          name_cn: string | null
          notes: string | null
          position: string | null
          preferred_channel: string | null
          preferred_language: string | null
          reliability: string | null
          reliability_score: number | null
          response_speed: string | null
          role: string | null
          role_category: string | null
          skype_id: string | null
          supplier_id: string
          telegram: string | null
          tenant_id: string
          timezone: string | null
          updated_at: string
          visibility_tier: string
          wechat_id: string | null
          wecom_id: string | null
          whatsapp: string | null
        }
        Insert: {
          available_hours?: Json | null
          avg_response_hours?: number | null
          created_at?: string
          department?: string | null
          email?: string | null
          full_name: string
          id?: string
          id_image?: string | null
          is_active?: boolean
          is_decision_maker?: boolean
          is_primary?: boolean
          last_interaction_at?: string | null
          line_id?: string | null
          mobile?: string | null
          name_cn?: string | null
          notes?: string | null
          position?: string | null
          preferred_channel?: string | null
          preferred_language?: string | null
          reliability?: string | null
          reliability_score?: number | null
          response_speed?: string | null
          role?: string | null
          role_category?: string | null
          skype_id?: string | null
          supplier_id: string
          telegram?: string | null
          tenant_id: string
          timezone?: string | null
          updated_at?: string
          visibility_tier?: string
          wechat_id?: string | null
          wecom_id?: string | null
          whatsapp?: string | null
        }
        Update: {
          available_hours?: Json | null
          avg_response_hours?: number | null
          created_at?: string
          department?: string | null
          email?: string | null
          full_name?: string
          id?: string
          id_image?: string | null
          is_active?: boolean
          is_decision_maker?: boolean
          is_primary?: boolean
          last_interaction_at?: string | null
          line_id?: string | null
          mobile?: string | null
          name_cn?: string | null
          notes?: string | null
          position?: string | null
          preferred_channel?: string | null
          preferred_language?: string | null
          reliability?: string | null
          reliability_score?: number | null
          response_speed?: string | null
          role?: string | null
          role_category?: string | null
          skype_id?: string | null
          supplier_id?: string
          telegram?: string | null
          tenant_id?: string
          timezone?: string | null
          updated_at?: string
          visibility_tier?: string
          wechat_id?: string | null
          wecom_id?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_contact_persons_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_contact_persons_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_contacts: {
        Row: {
          created_at: string
          full_name: string
          id: string
          is_primary: boolean
          supplier_id: string
          title: string | null
        }
        Insert: {
          created_at?: string
          full_name: string
          id?: string
          is_primary?: boolean
          supplier_id: string
          title?: string | null
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          is_primary?: boolean
          supplier_id?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_contacts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_contracts: {
        Row: {
          category_id: string | null
          contract_no: string | null
          created_at: string | null
          created_by_account_id: string | null
          currency: string | null
          end_date: string | null
          id: string
          incoterms: string | null
          notes: string | null
          payment_terms: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["supplier_contract_status"]
          supplier_id: string
          tenant_id: string | null
          title: string
          total_value: number | null
          updated_at: string | null
        }
        Insert: {
          category_id?: string | null
          contract_no?: string | null
          created_at?: string | null
          created_by_account_id?: string | null
          currency?: string | null
          end_date?: string | null
          id?: string
          incoterms?: string | null
          notes?: string | null
          payment_terms?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["supplier_contract_status"]
          supplier_id: string
          tenant_id?: string | null
          title: string
          total_value?: number | null
          updated_at?: string | null
        }
        Update: {
          category_id?: string | null
          contract_no?: string | null
          created_at?: string | null
          created_by_account_id?: string | null
          currency?: string | null
          end_date?: string | null
          id?: string
          incoterms?: string | null
          notes?: string | null
          payment_terms?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["supplier_contract_status"]
          supplier_id?: string
          tenant_id?: string | null
          title?: string
          total_value?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_contracts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "purchase_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_contracts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_coverage: {
        Row: {
          category_slug: string
          created_at: string
          created_by: string | null
          division_slug: string
          id: string
          is_main_supplier: boolean
          notes: string | null
          sourcing_priority: number | null
          sourcing_role: string
          subcategory_code: string
          subcategory_label: string | null
          supplier_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          category_slug: string
          created_at?: string
          created_by?: string | null
          division_slug: string
          id?: string
          is_main_supplier?: boolean
          notes?: string | null
          sourcing_priority?: number | null
          sourcing_role?: string
          subcategory_code: string
          subcategory_label?: string | null
          supplier_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          category_slug?: string
          created_at?: string
          created_by?: string | null
          division_slug?: string
          id?: string
          is_main_supplier?: boolean
          notes?: string | null
          sourcing_priority?: number | null
          sourcing_role?: string
          subcategory_code?: string
          subcategory_label?: string | null
          supplier_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_coverage_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_coverage_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_digital_presence: {
        Row: {
          alibaba_gold_supplier: boolean
          alibaba_trade_assurance: boolean
          alibaba_url: string | null
          alibaba_verified: boolean
          created_at: string
          data_source: string | null
          dhgate_url: string | null
          digital_trust_score: number | null
          domain_age_years: number | null
          douyin_url: string | null
          facebook_url: string | null
          global_sources_url: string | null
          id: string
          instagram_url: string | null
          last_scanned_at: string | null
          linkedin_url: string | null
          made_in_china_audited: boolean
          made_in_china_url: string | null
          notes: string | null
          social_activity_score: number | null
          supplier_id: string
          tenant_id: string
          tiktok_url: string | null
          updated_at: string
          verification_level: string | null
          verified_badges: Json | null
          website_quality_score: number | null
          website_ssl_valid: boolean | null
          wechat_official: string | null
          x_twitter_url: string | null
          youtube_url: string | null
        }
        Insert: {
          alibaba_gold_supplier?: boolean
          alibaba_trade_assurance?: boolean
          alibaba_url?: string | null
          alibaba_verified?: boolean
          created_at?: string
          data_source?: string | null
          dhgate_url?: string | null
          digital_trust_score?: number | null
          domain_age_years?: number | null
          douyin_url?: string | null
          facebook_url?: string | null
          global_sources_url?: string | null
          id?: string
          instagram_url?: string | null
          last_scanned_at?: string | null
          linkedin_url?: string | null
          made_in_china_audited?: boolean
          made_in_china_url?: string | null
          notes?: string | null
          social_activity_score?: number | null
          supplier_id: string
          tenant_id: string
          tiktok_url?: string | null
          updated_at?: string
          verification_level?: string | null
          verified_badges?: Json | null
          website_quality_score?: number | null
          website_ssl_valid?: boolean | null
          wechat_official?: string | null
          x_twitter_url?: string | null
          youtube_url?: string | null
        }
        Update: {
          alibaba_gold_supplier?: boolean
          alibaba_trade_assurance?: boolean
          alibaba_url?: string | null
          alibaba_verified?: boolean
          created_at?: string
          data_source?: string | null
          dhgate_url?: string | null
          digital_trust_score?: number | null
          domain_age_years?: number | null
          douyin_url?: string | null
          facebook_url?: string | null
          global_sources_url?: string | null
          id?: string
          instagram_url?: string | null
          last_scanned_at?: string | null
          linkedin_url?: string | null
          made_in_china_audited?: boolean
          made_in_china_url?: string | null
          notes?: string | null
          social_activity_score?: number | null
          supplier_id?: string
          tenant_id?: string
          tiktok_url?: string | null
          updated_at?: string
          verification_level?: string | null
          verified_badges?: Json | null
          website_quality_score?: number | null
          website_ssl_valid?: boolean | null
          wechat_official?: string | null
          x_twitter_url?: string | null
          youtube_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_digital_presence_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_digital_presence_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_factory_profile: {
        Row: {
          annual_output: number | null
          capacity_unit: string | null
          created_at: string
          employee_count: number | null
          export_percentage: number | null
          factory_name: string | null
          factory_size_sqm: number | null
          factory_type: string | null
          id: string
          lead_time_days: number | null
          low_moq_supported: boolean | null
          main_export_markets: string[]
          monthly_capacity: number | null
          notes: string | null
          odm_supported: boolean | null
          output_unit: string | null
          peak_season_months: string[]
          private_label_supported: boolean | null
          production_categories: string[]
          production_lines: number | null
          qc_staff_count: number | null
          rd_staff_count: number | null
          supplier_id: string
          supported_materials: string[]
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          annual_output?: number | null
          capacity_unit?: string | null
          created_at?: string
          employee_count?: number | null
          export_percentage?: number | null
          factory_name?: string | null
          factory_size_sqm?: number | null
          factory_type?: string | null
          id?: string
          lead_time_days?: number | null
          low_moq_supported?: boolean | null
          main_export_markets?: string[]
          monthly_capacity?: number | null
          notes?: string | null
          odm_supported?: boolean | null
          output_unit?: string | null
          peak_season_months?: string[]
          private_label_supported?: boolean | null
          production_categories?: string[]
          production_lines?: number | null
          qc_staff_count?: number | null
          rd_staff_count?: number | null
          supplier_id: string
          supported_materials?: string[]
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          annual_output?: number | null
          capacity_unit?: string | null
          created_at?: string
          employee_count?: number | null
          export_percentage?: number | null
          factory_name?: string | null
          factory_size_sqm?: number | null
          factory_type?: string | null
          id?: string
          lead_time_days?: number | null
          low_moq_supported?: boolean | null
          main_export_markets?: string[]
          monthly_capacity?: number | null
          notes?: string | null
          odm_supported?: boolean | null
          output_unit?: string | null
          peak_season_months?: string[]
          private_label_supported?: boolean | null
          production_categories?: string[]
          production_lines?: number | null
          qc_staff_count?: number | null
          rd_staff_count?: number | null
          supplier_id?: string
          supported_materials?: string[]
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_factory_profile_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_factory_profile_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_media: {
        Row: {
          category: string
          cert_type: string | null
          contact_id: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          doc_number: string | null
          expiry_date: string | null
          file_ext: string | null
          file_name: string | null
          file_size: number | null
          file_url: string
          id: string
          is_downloadable: boolean
          is_primary: boolean
          issued_date: string | null
          issuer: string | null
          language: string | null
          lifecycle_status: string
          markets_covered: string[]
          media_class: string
          metadata: Json
          mime_type: string | null
          preview_url: string | null
          product_id: string | null
          sort_order: number
          storage_bucket: string | null
          storage_path: string | null
          supplier_id: string
          tags: string[]
          tenant_id: string
          title: string | null
          updated_at: string
          uploaded_by: string | null
          verified_at: string | null
          verified_by: string | null
          visibility: string
        }
        Insert: {
          category?: string
          cert_type?: string | null
          contact_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          doc_number?: string | null
          expiry_date?: string | null
          file_ext?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url: string
          id?: string
          is_downloadable?: boolean
          is_primary?: boolean
          issued_date?: string | null
          issuer?: string | null
          language?: string | null
          lifecycle_status?: string
          markets_covered?: string[]
          media_class?: string
          metadata?: Json
          mime_type?: string | null
          preview_url?: string | null
          product_id?: string | null
          sort_order?: number
          storage_bucket?: string | null
          storage_path?: string | null
          supplier_id: string
          tags?: string[]
          tenant_id: string
          title?: string | null
          updated_at?: string
          uploaded_by?: string | null
          verified_at?: string | null
          verified_by?: string | null
          visibility?: string
        }
        Update: {
          category?: string
          cert_type?: string | null
          contact_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          doc_number?: string | null
          expiry_date?: string | null
          file_ext?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string
          id?: string
          is_downloadable?: boolean
          is_primary?: boolean
          issued_date?: string | null
          issuer?: string | null
          language?: string | null
          lifecycle_status?: string
          markets_covered?: string[]
          media_class?: string
          metadata?: Json
          mime_type?: string | null
          preview_url?: string | null
          product_id?: string | null
          sort_order?: number
          storage_bucket?: string | null
          storage_path?: string | null
          supplier_id?: string
          tags?: string[]
          tenant_id?: string
          title?: string | null
          updated_at?: string
          uploaded_by?: string | null
          verified_at?: string | null
          verified_by?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_media_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "supplier_contact_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_media_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_media_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_media_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_negotiation_intel: {
        Row: {
          ai_last_generated_at: string | null
          ai_summary: string | null
          assessed_at: string | null
          assessed_by_account_id: string | null
          communication_flexibility: string | null
          contract_willingness: string | null
          created_at: string
          customization_openness: string | null
          exclusivity_openness: string | null
          id: string
          internal_notes: string | null
          leadtime_flexibility: string | null
          leverage_points: Json
          moq_flexibility: string | null
          negotiation_difficulty: string | null
          negotiation_score: number | null
          payment_flexibility: string | null
          preferred_tactics: Json
          price_flexibility: string | null
          sample_turnaround_speed: string | null
          supplier_id: string
          tenant_id: string
          updated_at: string
          volume_discount: string | null
        }
        Insert: {
          ai_last_generated_at?: string | null
          ai_summary?: string | null
          assessed_at?: string | null
          assessed_by_account_id?: string | null
          communication_flexibility?: string | null
          contract_willingness?: string | null
          created_at?: string
          customization_openness?: string | null
          exclusivity_openness?: string | null
          id?: string
          internal_notes?: string | null
          leadtime_flexibility?: string | null
          leverage_points?: Json
          moq_flexibility?: string | null
          negotiation_difficulty?: string | null
          negotiation_score?: number | null
          payment_flexibility?: string | null
          preferred_tactics?: Json
          price_flexibility?: string | null
          sample_turnaround_speed?: string | null
          supplier_id: string
          tenant_id: string
          updated_at?: string
          volume_discount?: string | null
        }
        Update: {
          ai_last_generated_at?: string | null
          ai_summary?: string | null
          assessed_at?: string | null
          assessed_by_account_id?: string | null
          communication_flexibility?: string | null
          contract_willingness?: string | null
          created_at?: string
          customization_openness?: string | null
          exclusivity_openness?: string | null
          id?: string
          internal_notes?: string | null
          leadtime_flexibility?: string | null
          leverage_points?: Json
          moq_flexibility?: string | null
          negotiation_difficulty?: string | null
          negotiation_score?: number | null
          payment_flexibility?: string | null
          preferred_tactics?: Json
          price_flexibility?: string | null
          sample_turnaround_speed?: string | null
          supplier_id?: string
          tenant_id?: string
          updated_at?: string
          volume_discount?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_negotiation_intel_assessed_by_account_id_fkey"
            columns: ["assessed_by_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_negotiation_intel_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_negotiation_intel_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_negotiation_rounds: {
        Row: {
          behavior_notes: string | null
          created_at: string
          created_by: string | null
          discount_pct: number | null
          exclusivity_discussed: boolean
          id: string
          leverage_notes: string | null
          moq_concession: string | null
          occurred_on: string | null
          outcome: string | null
          payment_terms_concession: string | null
          price_concession: string | null
          red_flags: string | null
          round_no: number | null
          supplier_id: string
          tenant_id: string
          territory_discussed: boolean
          topic: string | null
          updated_at: string
          visibility_tier: string
        }
        Insert: {
          behavior_notes?: string | null
          created_at?: string
          created_by?: string | null
          discount_pct?: number | null
          exclusivity_discussed?: boolean
          id?: string
          leverage_notes?: string | null
          moq_concession?: string | null
          occurred_on?: string | null
          outcome?: string | null
          payment_terms_concession?: string | null
          price_concession?: string | null
          red_flags?: string | null
          round_no?: number | null
          supplier_id: string
          tenant_id: string
          territory_discussed?: boolean
          topic?: string | null
          updated_at?: string
          visibility_tier?: string
        }
        Update: {
          behavior_notes?: string | null
          created_at?: string
          created_by?: string | null
          discount_pct?: number | null
          exclusivity_discussed?: boolean
          id?: string
          leverage_notes?: string | null
          moq_concession?: string | null
          occurred_on?: string | null
          outcome?: string | null
          payment_terms_concession?: string | null
          price_concession?: string | null
          red_flags?: string | null
          round_no?: number | null
          supplier_id?: string
          tenant_id?: string
          territory_discussed?: boolean
          topic?: string | null
          updated_at?: string
          visibility_tier?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_negotiation_rounds_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_negotiation_rounds_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_price_list_items: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          lead_time_days: number | null
          min_qty: number | null
          notes: string | null
          price_list_id: string
          product_id: string | null
          unit: string | null
          unit_price: number
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          lead_time_days?: number | null
          min_qty?: number | null
          notes?: string | null
          price_list_id: string
          product_id?: string | null
          unit?: string | null
          unit_price?: number
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          lead_time_days?: number | null
          min_qty?: number | null
          notes?: string | null
          price_list_id?: string
          product_id?: string | null
          unit?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "supplier_price_list_items_price_list_id_fkey"
            columns: ["price_list_id"]
            isOneToOne: false
            referencedRelation: "supplier_price_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_price_list_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_price_lists: {
        Row: {
          created_at: string | null
          currency: string | null
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          supplier_id: string | null
          tenant_id: string | null
          updated_at: string | null
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          created_at?: string | null
          currency?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          supplier_id?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          created_at?: string | null
          currency?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          supplier_id?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_price_lists_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_product_links: {
        Row: {
          capacity: string | null
          capacity_unit: string | null
          component_label: string | null
          component_scope: string | null
          created_at: string
          id: string
          is_exclusive: boolean
          lead_time_days: number | null
          moq: string | null
          notes: string | null
          product_id: string | null
          quality_level: string | null
          risk_notes: string | null
          sourcing_priority: number | null
          sourcing_role: string | null
          supplied_components: Json
          supplier_id: string
          supports_branding: boolean | null
          supports_customization: boolean | null
          supports_packaging_customization: boolean | null
          supports_samples: boolean | null
          supports_spare_parts: boolean | null
          target_price: string | null
          tenant_id: string
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          capacity?: string | null
          capacity_unit?: string | null
          component_label?: string | null
          component_scope?: string | null
          created_at?: string
          id?: string
          is_exclusive?: boolean
          lead_time_days?: number | null
          moq?: string | null
          notes?: string | null
          product_id?: string | null
          quality_level?: string | null
          risk_notes?: string | null
          sourcing_priority?: number | null
          sourcing_role?: string | null
          supplied_components?: Json
          supplier_id: string
          supports_branding?: boolean | null
          supports_customization?: boolean | null
          supports_packaging_customization?: boolean | null
          supports_samples?: boolean | null
          supports_spare_parts?: boolean | null
          target_price?: string | null
          tenant_id: string
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          capacity?: string | null
          capacity_unit?: string | null
          component_label?: string | null
          component_scope?: string | null
          created_at?: string
          id?: string
          is_exclusive?: boolean
          lead_time_days?: number | null
          moq?: string | null
          notes?: string | null
          product_id?: string | null
          quality_level?: string | null
          risk_notes?: string | null
          sourcing_priority?: number | null
          sourcing_role?: string | null
          supplied_components?: Json
          supplier_id?: string
          supports_branding?: boolean | null
          supports_customization?: boolean | null
          supports_packaging_customization?: boolean | null
          supports_samples?: boolean | null
          supports_spare_parts?: boolean | null
          target_price?: string | null
          tenant_id?: string
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_product_links_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_product_links_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_product_links_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_product_specializations: {
        Row: {
          category_id: string | null
          category_label: string | null
          created_at: string
          evidence: Json
          id: string
          is_primary: boolean
          notes: string | null
          specialization_rank: number | null
          strength_score: number | null
          supplier_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          category_label?: string | null
          created_at?: string
          evidence?: Json
          id?: string
          is_primary?: boolean
          notes?: string | null
          specialization_rank?: number | null
          strength_score?: number | null
          supplier_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          category_label?: string | null
          created_at?: string
          evidence?: Json
          id?: string
          is_primary?: boolean
          notes?: string | null
          specialization_rank?: number | null
          strength_score?: number | null
          supplier_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_product_specializations_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_product_specializations_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_product_specializations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_qr_codes: {
        Row: {
          created_at: string
          decoded_value: string | null
          file_size: number | null
          file_url: string
          id: string
          is_active: boolean
          is_primary: boolean
          label: string | null
          mime_type: string | null
          person_id: string | null
          platform: string
          preview_url: string | null
          qr_kind: string
          sort_order: number
          storage_bucket: string | null
          storage_path: string | null
          supplier_id: string
          tenant_id: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          decoded_value?: string | null
          file_size?: number | null
          file_url: string
          id?: string
          is_active?: boolean
          is_primary?: boolean
          label?: string | null
          mime_type?: string | null
          person_id?: string | null
          platform?: string
          preview_url?: string | null
          qr_kind: string
          sort_order?: number
          storage_bucket?: string | null
          storage_path?: string | null
          supplier_id: string
          tenant_id: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          decoded_value?: string | null
          file_size?: number | null
          file_url?: string
          id?: string
          is_active?: boolean
          is_primary?: boolean
          label?: string | null
          mime_type?: string | null
          person_id?: string | null
          platform?: string
          preview_url?: string | null
          qr_kind?: string
          sort_order?: number
          storage_bucket?: string | null
          storage_path?: string | null
          supplier_id?: string
          tenant_id?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_qr_codes_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "supplier_contact_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_qr_codes_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_qr_codes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_readiness_snapshots: {
        Row: {
          computed_at: string
          computed_by: string
          dimensions: Json
          id: string
          score: number
          supplier_id: string
          tenant_id: string
        }
        Insert: {
          computed_at?: string
          computed_by?: string
          dimensions?: Json
          id?: string
          score: number
          supplier_id: string
          tenant_id: string
        }
        Update: {
          computed_at?: string
          computed_by?: string
          dimensions?: Json
          id?: string
          score?: number
          supplier_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_readiness_snapshots_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_readiness_snapshots_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_risk_items: {
        Row: {
          created_at: string
          description: string | null
          dimension: string
          id: string
          metadata: Json
          mitigation: string | null
          raised_by: string | null
          resolved_at: string | null
          severity: string
          status: string
          supplier_id: string
          tenant_id: string
          title: string
          updated_at: string
          visibility_tier: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          dimension: string
          id?: string
          metadata?: Json
          mitigation?: string | null
          raised_by?: string | null
          resolved_at?: string | null
          severity?: string
          status?: string
          supplier_id: string
          tenant_id: string
          title: string
          updated_at?: string
          visibility_tier?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          dimension?: string
          id?: string
          metadata?: Json
          mitigation?: string | null
          raised_by?: string | null
          resolved_at?: string | null
          severity?: string
          status?: string
          supplier_id?: string
          tenant_id?: string
          title?: string
          updated_at?: string
          visibility_tier?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_risk_items_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_risk_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_risk_profile: {
        Row: {
          assessment_notes: string | null
          backup_supplier_exists: boolean | null
          capacity_level: string | null
          communication_quality: string | null
          compliance_level: string | null
          created_at: string
          delivery_stability: string | null
          dependency_level: string | null
          financial_stability: string | null
          geographic_risk: string | null
          id: string
          internal_evaluation_score: number | null
          last_assessed_at: string | null
          last_assessed_by: string | null
          negotiation_flexibility: string | null
          quality_stability: string | null
          response_speed: string | null
          risk_level: string | null
          supplier_id: string
          tenant_id: string
          trust_level: string | null
          updated_at: string
        }
        Insert: {
          assessment_notes?: string | null
          backup_supplier_exists?: boolean | null
          capacity_level?: string | null
          communication_quality?: string | null
          compliance_level?: string | null
          created_at?: string
          delivery_stability?: string | null
          dependency_level?: string | null
          financial_stability?: string | null
          geographic_risk?: string | null
          id?: string
          internal_evaluation_score?: number | null
          last_assessed_at?: string | null
          last_assessed_by?: string | null
          negotiation_flexibility?: string | null
          quality_stability?: string | null
          response_speed?: string | null
          risk_level?: string | null
          supplier_id: string
          tenant_id: string
          trust_level?: string | null
          updated_at?: string
        }
        Update: {
          assessment_notes?: string | null
          backup_supplier_exists?: boolean | null
          capacity_level?: string | null
          communication_quality?: string | null
          compliance_level?: string | null
          created_at?: string
          delivery_stability?: string | null
          dependency_level?: string | null
          financial_stability?: string | null
          geographic_risk?: string | null
          id?: string
          internal_evaluation_score?: number | null
          last_assessed_at?: string | null
          last_assessed_by?: string | null
          negotiation_flexibility?: string | null
          quality_stability?: string | null
          response_speed?: string | null
          risk_level?: string | null
          supplier_id?: string
          tenant_id?: string
          trust_level?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_risk_profile_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_risk_profile_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_section_audit: {
        Row: {
          dept_key: string
          edited_at: string
          edited_by_account_id: string | null
          edited_by_name: string
          supplier_id: string
          tenant_id: string
        }
        Insert: {
          dept_key: string
          edited_at?: string
          edited_by_account_id?: string | null
          edited_by_name?: string
          supplier_id: string
          tenant_id: string
        }
        Update: {
          dept_key?: string
          edited_at?: string
          edited_by_account_id?: string | null
          edited_by_name?: string
          supplier_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_section_audit_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_sourcing_profile: {
        Row: {
          created_at: string
          diversification_note: string | null
          id: string
          sourcing_notes: string | null
          sourcing_priority: number | null
          sourcing_score_override: number | null
          supplier_id: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          diversification_note?: string | null
          id?: string
          sourcing_notes?: string | null
          sourcing_priority?: number | null
          sourcing_score_override?: number | null
          supplier_id: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          diversification_note?: string | null
          id?: string
          sourcing_notes?: string | null
          sourcing_priority?: number | null
          sourcing_score_override?: number | null
          supplier_id?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_sourcing_profile_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_sourcing_profile_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          from_status: string | null
          id: string
          reason: string | null
          supplier_id: string
          tenant_id: string
          to_status: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          from_status?: string | null
          id?: string
          reason?: string | null
          supplier_id: string
          tenant_id: string
          to_status: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          from_status?: string | null
          id?: string
          reason?: string | null
          supplier_id?: string
          tenant_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_status_history_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_status_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_timeline_events: {
        Row: {
          actor_id: string | null
          actor_name: string | null
          created_at: string
          description: string | null
          event_category: string
          event_type: string
          id: string
          importance: string
          is_manual: boolean
          metadata: Json
          related_entity_id: string | null
          related_entity_type: string | null
          source_module: string | null
          supplier_id: string
          tenant_id: string
          title: string
          visibility_tier: string
        }
        Insert: {
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          description?: string | null
          event_category: string
          event_type: string
          id?: string
          importance?: string
          is_manual?: boolean
          metadata?: Json
          related_entity_id?: string | null
          related_entity_type?: string | null
          source_module?: string | null
          supplier_id: string
          tenant_id: string
          title: string
          visibility_tier?: string
        }
        Update: {
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          description?: string | null
          event_category?: string
          event_type?: string
          id?: string
          importance?: string
          is_manual?: boolean
          metadata?: Json
          related_entity_id?: string | null
          related_entity_type?: string | null
          source_module?: string | null
          supplier_id?: string
          tenant_id?: string
          title?: string
          visibility_tier?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_timeline_events_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_timeline_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address_1: string | null
          address_2: string | null
          city: string | null
          company_name: string | null
          contact_id: string | null
          contact_name: string | null
          country: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          supplier_type: Database["public"]["Enums"]["supplier_type"]
          tel: string | null
          tenant_id: string | null
          website: string | null
        }
        Insert: {
          address_1?: string | null
          address_2?: string | null
          city?: string | null
          company_name?: string | null
          contact_id?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          supplier_type?: Database["public"]["Enums"]["supplier_type"]
          tel?: string | null
          tenant_id?: string | null
          website?: string | null
        }
        Update: {
          address_1?: string | null
          address_2?: string | null
          city?: string | null
          company_name?: string | null
          contact_id?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          supplier_type?: Database["public"]["Enums"]["supplier_type"]
          tel?: string | null
          tenant_id?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppliers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      support_requests: {
        Row: {
          category: string
          company: string | null
          country_code: string | null
          created_at: string
          email: string
          full_name: string
          handled_at: string | null
          handled_by: string | null
          id: string
          message: string | null
          phone: string | null
          phone_code: string | null
          ref: string
          reported_language: string | null
          status: string
          user_agent: string | null
          username: string | null
        }
        Insert: {
          category: string
          company?: string | null
          country_code?: string | null
          created_at?: string
          email: string
          full_name: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          message?: string | null
          phone?: string | null
          phone_code?: string | null
          ref: string
          reported_language?: string | null
          status?: string
          user_agent?: string | null
          username?: string | null
        }
        Update: {
          category?: string
          company?: string | null
          country_code?: string | null
          created_at?: string
          email?: string
          full_name?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          message?: string | null
          phone?: string | null
          phone_code?: string | null
          ref?: string
          reported_language?: string | null
          status?: string
          user_agent?: string | null
          username?: string | null
        }
        Relationships: []
      }
      tenants: {
        Row: {
          active: boolean
          country: string | null
          created_at: string
          default_currency: string | null
          id: string
          is_host: boolean
          name: string
          parent_tenant_id: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          country?: string | null
          created_at?: string
          default_currency?: string | null
          id?: string
          is_host?: boolean
          name: string
          parent_tenant_id?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          country?: string | null
          created_at?: string
          default_currency?: string | null
          id?: string
          is_host?: boolean
          name?: string
          parent_tenant_id?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenants_parent_tenant_id_fkey"
            columns: ["parent_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      translation_cache: {
        Row: {
          created_at: string
          hit_count: number
          id: string
          last_used_at: string
          provider: string
          source_hash: string
          source_lang: string
          source_text: string
          target_lang: string
          tenant_id: string
          translated_text: string
        }
        Insert: {
          created_at?: string
          hit_count?: number
          id?: string
          last_used_at?: string
          provider: string
          source_hash: string
          source_lang: string
          source_text: string
          target_lang: string
          tenant_id: string
          translated_text: string
        }
        Update: {
          created_at?: string
          hit_count?: number
          id?: string
          last_used_at?: string
          provider?: string
          source_hash?: string
          source_lang?: string
          source_text?: string
          target_lang?: string
          tenant_id?: string
          translated_text?: string
        }
        Relationships: []
      }
      usage_daily: {
        Row: {
          account_id: string
          active_seconds: number
          day: string
          id: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          active_seconds?: number
          day: string
          id?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          active_seconds?: number
          day?: string
          id?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_devices: {
        Row: {
          account_id: string
          browser: string | null
          created_at: string
          device_id: string
          device_type: string | null
          first_seen_at: string
          id: string
          is_blocked: boolean
          is_trusted: boolean
          last_country: string | null
          last_ip: string | null
          last_seen_at: string
          metadata: Json
          os: string | null
          tenant_id: string | null
          user_agent_hash: string | null
        }
        Insert: {
          account_id: string
          browser?: string | null
          created_at?: string
          device_id: string
          device_type?: string | null
          first_seen_at?: string
          id?: string
          is_blocked?: boolean
          is_trusted?: boolean
          last_country?: string | null
          last_ip?: string | null
          last_seen_at?: string
          metadata?: Json
          os?: string | null
          tenant_id?: string | null
          user_agent_hash?: string | null
        }
        Update: {
          account_id?: string
          browser?: string | null
          created_at?: string
          device_id?: string
          device_type?: string | null
          first_seen_at?: string
          id?: string
          is_blocked?: boolean
          is_trusted?: boolean
          last_country?: string | null
          last_ip?: string | null
          last_seen_at?: string
          metadata?: Json
          os?: string | null
          tenant_id?: string | null
          user_agent_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_devices_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_bill_items: {
        Row: {
          bill_id: string
          category_id: string | null
          created_at: string | null
          description: string | null
          id: string
          line_total: number | null
          po_item_id: string | null
          product_id: string | null
          qty: number
          sort_order: number | null
          tax_percent: number | null
          unit: string | null
          unit_price: number
        }
        Insert: {
          bill_id: string
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          line_total?: number | null
          po_item_id?: string | null
          product_id?: string | null
          qty?: number
          sort_order?: number | null
          tax_percent?: number | null
          unit?: string | null
          unit_price?: number
        }
        Update: {
          bill_id?: string
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          line_total?: number | null
          po_item_id?: string | null
          product_id?: string | null
          qty?: number
          sort_order?: number | null
          tax_percent?: number | null
          unit?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "vendor_bill_items_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "vendor_bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_bill_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "purchase_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_bill_items_po_item_id_fkey"
            columns: ["po_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_bill_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_bills: {
        Row: {
          accounting_entry_id: string | null
          accounting_last_error: string | null
          accounting_posted_at: string | null
          accounting_status: string
          amount_paid: number | null
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          attachment_url: string | null
          balance: number | null
          base_amount: number | null
          base_currency: string | null
          bill_date: string | null
          bill_no: string | null
          created_at: string | null
          created_by_account_id: string | null
          currency: string | null
          due_date: string | null
          exchange_rate: number | null
          fx_conversion_date: string | null
          fx_rate: number | null
          id: string
          notes: string | null
          other_charges: number | null
          paid_at: string | null
          payment_terms: string | null
          po_id: string | null
          posted_at: string | null
          receipt_id: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          shipping_cost: number | null
          status: Database["public"]["Enums"]["vendor_bill_status"]
          submitted_at: string | null
          submitted_by: string | null
          subtotal: number | null
          supplier_id: string
          supplier_invoice_no: string | null
          tax_total: number | null
          tenant_id: string | null
          total: number | null
          updated_at: string | null
        }
        Insert: {
          accounting_entry_id?: string | null
          accounting_last_error?: string | null
          accounting_posted_at?: string | null
          accounting_status?: string
          amount_paid?: number | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          attachment_url?: string | null
          balance?: number | null
          base_amount?: number | null
          base_currency?: string | null
          bill_date?: string | null
          bill_no?: string | null
          created_at?: string | null
          created_by_account_id?: string | null
          currency?: string | null
          due_date?: string | null
          exchange_rate?: number | null
          fx_conversion_date?: string | null
          fx_rate?: number | null
          id?: string
          notes?: string | null
          other_charges?: number | null
          paid_at?: string | null
          payment_terms?: string | null
          po_id?: string | null
          posted_at?: string | null
          receipt_id?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          shipping_cost?: number | null
          status?: Database["public"]["Enums"]["vendor_bill_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          subtotal?: number | null
          supplier_id: string
          supplier_invoice_no?: string | null
          tax_total?: number | null
          tenant_id?: string | null
          total?: number | null
          updated_at?: string | null
        }
        Update: {
          accounting_entry_id?: string | null
          accounting_last_error?: string | null
          accounting_posted_at?: string | null
          accounting_status?: string
          amount_paid?: number | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          attachment_url?: string | null
          balance?: number | null
          base_amount?: number | null
          base_currency?: string | null
          bill_date?: string | null
          bill_no?: string | null
          created_at?: string | null
          created_by_account_id?: string | null
          currency?: string | null
          due_date?: string | null
          exchange_rate?: number | null
          fx_conversion_date?: string | null
          fx_rate?: number | null
          id?: string
          notes?: string | null
          other_charges?: number | null
          paid_at?: string | null
          payment_terms?: string | null
          po_id?: string | null
          posted_at?: string | null
          receipt_id?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          shipping_cost?: number | null
          status?: Database["public"]["Enums"]["vendor_bill_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          subtotal?: number | null
          supplier_id?: string
          supplier_invoice_no?: string | null
          tax_total?: number | null
          tenant_id?: string | null
          total?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_bills_accounting_entry_id_fkey"
            columns: ["accounting_entry_id"]
            isOneToOne: false
            referencedRelation: "accounting_journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_bills_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_bills_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_bills_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "purchase_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_bills_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_bills_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_bills_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_payments: {
        Row: {
          amount: number
          bill_id: string | null
          created_at: string | null
          currency: string | null
          exchange_rate: number | null
          id: string
          method: string | null
          notes: string | null
          paid_at: string | null
          payment_no: string | null
          recorded_by_account_id: string | null
          reference: string | null
          supplier_id: string
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount?: number
          bill_id?: string | null
          created_at?: string | null
          currency?: string | null
          exchange_rate?: number | null
          id?: string
          method?: string | null
          notes?: string | null
          paid_at?: string | null
          payment_no?: string | null
          recorded_by_account_id?: string | null
          reference?: string | null
          supplier_id: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          bill_id?: string | null
          created_at?: string | null
          currency?: string | null
          exchange_rate?: number | null
          id?: string
          method?: string | null
          notes?: string | null
          paid_at?: string | null
          payment_no?: string | null
          recorded_by_account_id?: string | null
          reference?: string | null
          supplier_id?: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_payments_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "vendor_bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      visual_asset_events: {
        Row: {
          actor_id: string | null
          actor_name: string | null
          asset_id: string
          created_at: string
          event_type: string
          id: string
          metadata: Json
          summary: string | null
          tenant_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_name?: string | null
          asset_id: string
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          summary?: string | null
          tenant_id: string
        }
        Update: {
          actor_id?: string | null
          actor_name?: string | null
          asset_id?: string
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          summary?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visual_asset_events_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "visual_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visual_asset_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      visual_asset_quality: {
        Row: {
          ai_notes: string | null
          asset_id: string
          collection_match_score: number
          complexity_level: string | null
          computed_at: string
          corner_style: string | null
          created_at: string
          dark_background_compatibility: number | null
          dark_mode_score: number
          duplicate_group_id: string | null
          duplicate_risk_score: number
          id: string
          manual_notes: string | null
          monochrome_compatibility: number | null
          optical_balance_score: number | null
          outdated_risk_score: number
          overall_status: string
          padding_ratio: number | null
          quality_score: number
          readability_score: number
          reviewed_at: string | null
          reviewed_by: string | null
          scalability_score: number
          shape_language: string | null
          simplicity_score: number
          small_size_readability: number | null
          spacing_score: number
          stroke_consistency_score: number
          stroke_style: string | null
          stroke_width: string | null
          style_consistency_score: number
          symmetry_score: number | null
          tenant_id: string
          uniqueness_score: number
          updated_at: string
          visual_density: number | null
          visual_noise_score: number
          visually_similar_to: string[]
        }
        Insert: {
          ai_notes?: string | null
          asset_id: string
          collection_match_score?: number
          complexity_level?: string | null
          computed_at?: string
          corner_style?: string | null
          created_at?: string
          dark_background_compatibility?: number | null
          dark_mode_score?: number
          duplicate_group_id?: string | null
          duplicate_risk_score?: number
          id?: string
          manual_notes?: string | null
          monochrome_compatibility?: number | null
          optical_balance_score?: number | null
          outdated_risk_score?: number
          overall_status?: string
          padding_ratio?: number | null
          quality_score?: number
          readability_score?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          scalability_score?: number
          shape_language?: string | null
          simplicity_score?: number
          small_size_readability?: number | null
          spacing_score?: number
          stroke_consistency_score?: number
          stroke_style?: string | null
          stroke_width?: string | null
          style_consistency_score?: number
          symmetry_score?: number | null
          tenant_id: string
          uniqueness_score?: number
          updated_at?: string
          visual_density?: number | null
          visual_noise_score?: number
          visually_similar_to?: string[]
        }
        Update: {
          ai_notes?: string | null
          asset_id?: string
          collection_match_score?: number
          complexity_level?: string | null
          computed_at?: string
          corner_style?: string | null
          created_at?: string
          dark_background_compatibility?: number | null
          dark_mode_score?: number
          duplicate_group_id?: string | null
          duplicate_risk_score?: number
          id?: string
          manual_notes?: string | null
          monochrome_compatibility?: number | null
          optical_balance_score?: number | null
          outdated_risk_score?: number
          overall_status?: string
          padding_ratio?: number | null
          quality_score?: number
          readability_score?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          scalability_score?: number
          shape_language?: string | null
          simplicity_score?: number
          small_size_readability?: number | null
          spacing_score?: number
          stroke_consistency_score?: number
          stroke_style?: string | null
          stroke_width?: string | null
          style_consistency_score?: number
          symmetry_score?: number | null
          tenant_id?: string
          uniqueness_score?: number
          updated_at?: string
          visual_density?: number | null
          visual_noise_score?: number
          visually_similar_to?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "visual_asset_quality_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: true
            referencedRelation: "visual_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visual_asset_quality_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      visual_asset_relationships: {
        Row: {
          confidence_score: number
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          origin: string
          relationship_type: string
          source_asset_id: string
          status: string
          target_asset_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          confidence_score?: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          origin?: string
          relationship_type: string
          source_asset_id: string
          status?: string
          target_asset_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          confidence_score?: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          origin?: string
          relationship_type?: string
          source_asset_id?: string
          status?: string
          target_asset_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "visual_asset_relationships_source_asset_id_fkey"
            columns: ["source_asset_id"]
            isOneToOne: false
            referencedRelation: "visual_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visual_asset_relationships_target_asset_id_fkey"
            columns: ["target_asset_id"]
            isOneToOne: false
            referencedRelation: "visual_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visual_asset_relationships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      visual_asset_reviews: {
        Row: {
          ai_detected_issues: string[]
          ai_review_confidence: number | null
          ai_review_notes: string | null
          ai_review_score: number | null
          ai_suggested_replacement: string | null
          approval_score: number
          asset_id: string
          board_id: string | null
          created_at: string
          expires_at: string | null
          id: string
          internal_notes: string | null
          production_ready: boolean
          recommendation: string | null
          redesign_reason: string | null
          redesign_required: boolean
          replacement_asset_id: string | null
          review_priority: string
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_notes: string | null
          risk_level: string
          tenant_id: string
          updated_at: string
          usage_blocked: boolean
        }
        Insert: {
          ai_detected_issues?: string[]
          ai_review_confidence?: number | null
          ai_review_notes?: string | null
          ai_review_score?: number | null
          ai_suggested_replacement?: string | null
          approval_score?: number
          asset_id: string
          board_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          internal_notes?: string | null
          production_ready?: boolean
          recommendation?: string | null
          redesign_reason?: string | null
          redesign_required?: boolean
          replacement_asset_id?: string | null
          review_priority?: string
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          risk_level?: string
          tenant_id: string
          updated_at?: string
          usage_blocked?: boolean
        }
        Update: {
          ai_detected_issues?: string[]
          ai_review_confidence?: number | null
          ai_review_notes?: string | null
          ai_review_score?: number | null
          ai_suggested_replacement?: string | null
          approval_score?: number
          asset_id?: string
          board_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          internal_notes?: string | null
          production_ready?: boolean
          recommendation?: string | null
          redesign_reason?: string | null
          redesign_required?: boolean
          replacement_asset_id?: string | null
          review_priority?: string
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          risk_level?: string
          tenant_id?: string
          updated_at?: string
          usage_blocked?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "visual_asset_reviews_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: true
            referencedRelation: "visual_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visual_asset_reviews_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "visual_review_boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visual_asset_reviews_replacement_asset_id_fkey"
            columns: ["replacement_asset_id"]
            isOneToOne: false
            referencedRelation: "visual_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visual_asset_reviews_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      visual_assets: {
        Row: {
          ai_confidence: number | null
          ai_prompt_description: string | null
          ai_recommended_contexts: string[]
          ai_rejected_contexts: string[]
          ai_style_vector: Json
          ai_usage_priority: number
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          asset_type: string
          category: string | null
          collections: string[]
          corner_radius_family: string | null
          created_at: string
          created_by: string | null
          derived_from_id: string | null
          description: string | null
          file_size: number | null
          file_type: string | null
          flaticon_folder: string | null
          height: number | null
          id: string
          is_active: boolean
          is_multipath: boolean
          is_variant: boolean
          keywords: string[]
          last_used_at: string | null
          linked_apps: string[]
          linked_modules: string[]
          mime_type: string | null
          notes: string | null
          original_file: string | null
          parent_asset_id: string | null
          preview_path: string | null
          search_aliases: string[]
          semantic_meaning: string | null
          shape_language: string | null
          slug: string | null
          source: string | null
          source_name: string | null
          status: string
          storage_bucket: string | null
          stroke_family: string | null
          style: string | null
          subcategory: string | null
          svg_path: string | null
          synonyms: string[]
          tags: string[]
          tenant_id: string
          theme: string | null
          title: string
          title_ar: string | null
          title_cn: string | null
          updated_at: string
          usage: string[]
          usage_count: number
          used_in_dashboards: string[]
          used_in_modules: string[]
          used_in_pages: string[]
          used_in_products: string[]
          used_in_templates: string[]
          variant_of: string | null
          version: number
          viewbox: string | null
          visual_asset_code: string
          visual_family: string | null
          visual_style_description: string | null
          width: number | null
        }
        Insert: {
          ai_confidence?: number | null
          ai_prompt_description?: string | null
          ai_recommended_contexts?: string[]
          ai_rejected_contexts?: string[]
          ai_style_vector?: Json
          ai_usage_priority?: number
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          asset_type?: string
          category?: string | null
          collections?: string[]
          corner_radius_family?: string | null
          created_at?: string
          created_by?: string | null
          derived_from_id?: string | null
          description?: string | null
          file_size?: number | null
          file_type?: string | null
          flaticon_folder?: string | null
          height?: number | null
          id?: string
          is_active?: boolean
          is_multipath?: boolean
          is_variant?: boolean
          keywords?: string[]
          last_used_at?: string | null
          linked_apps?: string[]
          linked_modules?: string[]
          mime_type?: string | null
          notes?: string | null
          original_file?: string | null
          parent_asset_id?: string | null
          preview_path?: string | null
          search_aliases?: string[]
          semantic_meaning?: string | null
          shape_language?: string | null
          slug?: string | null
          source?: string | null
          source_name?: string | null
          status?: string
          storage_bucket?: string | null
          stroke_family?: string | null
          style?: string | null
          subcategory?: string | null
          svg_path?: string | null
          synonyms?: string[]
          tags?: string[]
          tenant_id: string
          theme?: string | null
          title: string
          title_ar?: string | null
          title_cn?: string | null
          updated_at?: string
          usage?: string[]
          usage_count?: number
          used_in_dashboards?: string[]
          used_in_modules?: string[]
          used_in_pages?: string[]
          used_in_products?: string[]
          used_in_templates?: string[]
          variant_of?: string | null
          version?: number
          viewbox?: string | null
          visual_asset_code: string
          visual_family?: string | null
          visual_style_description?: string | null
          width?: number | null
        }
        Update: {
          ai_confidence?: number | null
          ai_prompt_description?: string | null
          ai_recommended_contexts?: string[]
          ai_rejected_contexts?: string[]
          ai_style_vector?: Json
          ai_usage_priority?: number
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          asset_type?: string
          category?: string | null
          collections?: string[]
          corner_radius_family?: string | null
          created_at?: string
          created_by?: string | null
          derived_from_id?: string | null
          description?: string | null
          file_size?: number | null
          file_type?: string | null
          flaticon_folder?: string | null
          height?: number | null
          id?: string
          is_active?: boolean
          is_multipath?: boolean
          is_variant?: boolean
          keywords?: string[]
          last_used_at?: string | null
          linked_apps?: string[]
          linked_modules?: string[]
          mime_type?: string | null
          notes?: string | null
          original_file?: string | null
          parent_asset_id?: string | null
          preview_path?: string | null
          search_aliases?: string[]
          semantic_meaning?: string | null
          shape_language?: string | null
          slug?: string | null
          source?: string | null
          source_name?: string | null
          status?: string
          storage_bucket?: string | null
          stroke_family?: string | null
          style?: string | null
          subcategory?: string | null
          svg_path?: string | null
          synonyms?: string[]
          tags?: string[]
          tenant_id?: string
          theme?: string | null
          title?: string
          title_ar?: string | null
          title_cn?: string | null
          updated_at?: string
          usage?: string[]
          usage_count?: number
          used_in_dashboards?: string[]
          used_in_modules?: string[]
          used_in_pages?: string[]
          used_in_products?: string[]
          used_in_templates?: string[]
          variant_of?: string | null
          version?: number
          viewbox?: string | null
          visual_asset_code?: string
          visual_family?: string | null
          visual_style_description?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "visual_assets_derived_from_id_fkey"
            columns: ["derived_from_id"]
            isOneToOne: false
            referencedRelation: "visual_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visual_assets_parent_asset_id_fkey"
            columns: ["parent_asset_id"]
            isOneToOne: false
            referencedRelation: "visual_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visual_assets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visual_assets_variant_of_fkey"
            columns: ["variant_of"]
            isOneToOne: false
            referencedRelation: "visual_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      visual_collection_assets: {
        Row: {
          asset_id: string
          collection_id: string
          created_at: string
          id: string
          notes: string | null
          role: string
          sort_order: number
          tenant_id: string
        }
        Insert: {
          asset_id: string
          collection_id: string
          created_at?: string
          id?: string
          notes?: string | null
          role?: string
          sort_order?: number
          tenant_id: string
        }
        Update: {
          asset_id?: string
          collection_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          role?: string
          sort_order?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visual_collection_assets_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "visual_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visual_collection_assets_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "visual_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visual_collection_assets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      visual_collections: {
        Row: {
          approval_status: string
          category: string | null
          code: string | null
          collection_purity_score: number | null
          collection_type: string
          cover_asset_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          design_system_level: string | null
          dominant_geometry: string | null
          dominant_style: string | null
          icon_asset_id: string | null
          id: string
          name: string
          preferred_corner_radius: string | null
          preferred_fill: string | null
          preferred_monochrome: boolean | null
          preferred_stroke: string | null
          preferred_style: string | null
          slug: string
          style_drift_count: number
          style_type: string | null
          target_modules: string[]
          target_platforms: string[]
          tenant_id: string
          updated_at: string
          usage_context: Json
          visibility: string
          visual_consistency_score: number | null
        }
        Insert: {
          approval_status?: string
          category?: string | null
          code?: string | null
          collection_purity_score?: number | null
          collection_type?: string
          cover_asset_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          design_system_level?: string | null
          dominant_geometry?: string | null
          dominant_style?: string | null
          icon_asset_id?: string | null
          id?: string
          name: string
          preferred_corner_radius?: string | null
          preferred_fill?: string | null
          preferred_monochrome?: boolean | null
          preferred_stroke?: string | null
          preferred_style?: string | null
          slug: string
          style_drift_count?: number
          style_type?: string | null
          target_modules?: string[]
          target_platforms?: string[]
          tenant_id: string
          updated_at?: string
          usage_context?: Json
          visibility?: string
          visual_consistency_score?: number | null
        }
        Update: {
          approval_status?: string
          category?: string | null
          code?: string | null
          collection_purity_score?: number | null
          collection_type?: string
          cover_asset_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          design_system_level?: string | null
          dominant_geometry?: string | null
          dominant_style?: string | null
          icon_asset_id?: string | null
          id?: string
          name?: string
          preferred_corner_radius?: string | null
          preferred_fill?: string | null
          preferred_monochrome?: boolean | null
          preferred_stroke?: string | null
          preferred_style?: string | null
          slug?: string
          style_drift_count?: number
          style_type?: string | null
          target_modules?: string[]
          target_platforms?: string[]
          tenant_id?: string
          updated_at?: string
          usage_context?: Json
          visibility?: string
          visual_consistency_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "visual_collections_cover_asset_id_fkey"
            columns: ["cover_asset_id"]
            isOneToOne: false
            referencedRelation: "visual_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visual_collections_icon_asset_id_fkey"
            columns: ["icon_asset_id"]
            isOneToOne: false
            referencedRelation: "visual_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visual_collections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      visual_context_rules: {
        Row: {
          context_id: string
          created_at: string
          created_by: string | null
          entity_id: string
          entity_type: string
          id: string
          notes: string | null
          rule: string
          tenant_id: string
        }
        Insert: {
          context_id: string
          created_at?: string
          created_by?: string | null
          entity_id: string
          entity_type: string
          id?: string
          notes?: string | null
          rule: string
          tenant_id: string
        }
        Update: {
          context_id?: string
          created_at?: string
          created_by?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          notes?: string | null
          rule?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visual_context_rules_context_id_fkey"
            columns: ["context_id"]
            isOneToOne: false
            referencedRelation: "visual_usage_contexts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visual_context_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      visual_icon_bindings: {
        Row: {
          domain: string
          icon_url: string
          id: string
          label_ar: string | null
          label_en: string | null
          label_zh: string | null
          semantic_key: string
          source: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          domain: string
          icon_url: string
          id?: string
          label_ar?: string | null
          label_en?: string | null
          label_zh?: string | null
          semantic_key: string
          source?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          domain?: string
          icon_url?: string
          id?: string
          label_ar?: string | null
          label_en?: string | null
          label_zh?: string | null
          semantic_key?: string
          source?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visual_icon_bindings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      visual_icon_categories: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          key: string
          label: string
          sort_order: number
          tenant_id: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          key: string
          label: string
          sort_order?: number
          tenant_id: string
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          key?: string
          label?: string
          sort_order?: number
          tenant_id?: string
        }
        Relationships: []
      }
      visual_review_boards: {
        Row: {
          assigned_to: string[]
          board_type: string
          code: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          status: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string[]
          board_type?: string
          code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          status?: string
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string[]
          board_type?: string
          code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          status?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "visual_review_boards_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      visual_review_checklists: {
        Row: {
          category: string | null
          created_at: string
          id: string
          name: string
          required: boolean
          sort_order: number
          tenant_id: string
          weight: number
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          name: string
          required?: boolean
          sort_order?: number
          tenant_id: string
          weight?: number
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          name?: string
          required?: boolean
          sort_order?: number
          tenant_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "visual_review_checklists_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      visual_review_comments: {
        Row: {
          comment: string
          comment_type: string
          created_at: string
          id: string
          review_id: string
          tenant_id: string
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          comment: string
          comment_type?: string
          created_at?: string
          id?: string
          review_id: string
          tenant_id: string
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          comment?: string
          comment_type?: string
          created_at?: string
          id?: string
          review_id?: string
          tenant_id?: string
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visual_review_comments_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "visual_asset_reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visual_review_comments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      visual_review_scores: {
        Row: {
          checklist_id: string
          created_at: string
          id: string
          notes: string | null
          passed: boolean
          review_id: string
          score: number
          tenant_id: string
        }
        Insert: {
          checklist_id: string
          created_at?: string
          id?: string
          notes?: string | null
          passed?: boolean
          review_id: string
          score?: number
          tenant_id: string
        }
        Update: {
          checklist_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          passed?: boolean
          review_id?: string
          score?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visual_review_scores_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "visual_review_checklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visual_review_scores_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "visual_asset_reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visual_review_scores_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      visual_usage_contexts: {
        Row: {
          code: string | null
          color: string | null
          context_type: string
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          parent_context_id: string | null
          slug: string
          sort_order: number
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          color?: string | null
          context_type?: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          parent_context_id?: string | null
          slug: string
          sort_order?: number
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          color?: string | null
          context_type?: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          parent_context_id?: string | null
          slug?: string
          sort_order?: number
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "visual_usage_contexts_parent_context_id_fkey"
            columns: ["parent_context_id"]
            isOneToOne: false
            referencedRelation: "visual_usage_contexts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visual_usage_contexts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      website_catalogs: {
        Row: {
          cover_url: string | null
          created_at: string
          created_by: string | null
          description: Json | null
          file_path: string
          file_size: number | null
          id: string
          sort: number
          title: Json
          updated_at: string
          visible: boolean
          year: number | null
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: Json | null
          file_path: string
          file_size?: number | null
          id?: string
          sort?: number
          title: Json
          updated_at?: string
          visible?: boolean
          year?: number | null
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: Json | null
          file_path?: string
          file_size?: number | null
          id?: string
          sort?: number
          title?: Json
          updated_at?: string
          visible?: boolean
          year?: number | null
        }
        Relationships: []
      }
      website_leads: {
        Row: {
          company: string | null
          contact_id: string | null
          country: string | null
          created_at: string
          email: string
          id: string
          ip_hash: string | null
          kind: string
          lang: string | null
          matched: boolean
          message: string
          name: string
          page: string | null
          phone: string | null
          product_slug: string | null
          tenant_id: string
        }
        Insert: {
          company?: string | null
          contact_id?: string | null
          country?: string | null
          created_at?: string
          email: string
          id?: string
          ip_hash?: string | null
          kind: string
          lang?: string | null
          matched?: boolean
          message: string
          name: string
          page?: string | null
          phone?: string | null
          product_slug?: string | null
          tenant_id: string
        }
        Update: {
          company?: string | null
          contact_id?: string | null
          country?: string | null
          created_at?: string
          email?: string
          id?: string
          ip_hash?: string | null
          kind?: string
          lang?: string | null
          matched?: boolean
          message?: string
          name?: string
          page?: string | null
          phone?: string | null
          product_slug?: string | null
          tenant_id?: string
        }
        Relationships: []
      }
      work_report_attachments: {
        Row: {
          caption: string
          created_at: string
          file_name: string
          height: number | null
          id: string
          mime_type: string
          position: number
          report_id: string
          size_bytes: number
          storage_path: string
          tenant_id: string | null
          thumb_path: string | null
          uploaded_by: string
          width: number | null
        }
        Insert: {
          caption?: string
          created_at?: string
          file_name: string
          height?: number | null
          id?: string
          mime_type: string
          position?: number
          report_id: string
          size_bytes: number
          storage_path: string
          tenant_id?: string | null
          thumb_path?: string | null
          uploaded_by: string
          width?: number | null
        }
        Update: {
          caption?: string
          created_at?: string
          file_name?: string
          height?: number | null
          id?: string
          mime_type?: string
          position?: number
          report_id?: string
          size_bytes?: number
          storage_path?: string
          tenant_id?: string | null
          thumb_path?: string | null
          uploaded_by?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "work_report_attachments_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "work_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      work_report_comments: {
        Row: {
          account_id: string
          body: string
          created_at: string
          id: string
          kind: string
          report_id: string
        }
        Insert: {
          account_id: string
          body: string
          created_at?: string
          id?: string
          kind?: string
          report_id: string
        }
        Update: {
          account_id?: string
          body?: string
          created_at?: string
          id?: string
          kind?: string
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_report_comments_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "work_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      work_report_hidden_templates: {
        Row: {
          hidden_at: string
          hidden_by: string
          id: string
          template_key: string
          tenant_id: string | null
        }
        Insert: {
          hidden_at?: string
          hidden_by: string
          id?: string
          template_key: string
          tenant_id?: string | null
        }
        Update: {
          hidden_at?: string
          hidden_by?: string
          id?: string
          template_key?: string
          tenant_id?: string | null
        }
        Relationships: []
      }
      work_report_links: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          label: string
          report_id: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          label?: string
          report_id: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          label?: string
          report_id?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_report_links_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "work_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      work_report_nudges: {
        Row: {
          account_id: string
          created_at: string
          id: string
          kind: string
          notified: string[]
          period_key: string
          template_key: string
          tenant_id: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          kind: string
          notified?: string[]
          period_key: string
          template_key: string
          tenant_id?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          kind?: string
          notified?: string[]
          period_key?: string
          template_key?: string
          tenant_id?: string | null
        }
        Relationships: []
      }
      work_report_obligations: {
        Row: {
          account_id: string
          id: string
          required: boolean
          template_key: string
          tenant_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_id: string
          id?: string
          required: boolean
          template_key: string
          tenant_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_id?: string
          id?: string
          required?: boolean
          template_key?: string
          tenant_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      work_report_recipients: {
        Row: {
          account_id: string
          acknowledged_at: string | null
          created_at: string
          forward_note: string | null
          forwarded_at: string | null
          forwarded_by: string | null
          id: string
          read_at: string | null
          report_id: string
          role: string
        }
        Insert: {
          account_id: string
          acknowledged_at?: string | null
          created_at?: string
          forward_note?: string | null
          forwarded_at?: string | null
          forwarded_by?: string | null
          id?: string
          read_at?: string | null
          report_id: string
          role?: string
        }
        Update: {
          account_id?: string
          acknowledged_at?: string | null
          created_at?: string
          forward_note?: string | null
          forwarded_at?: string | null
          forwarded_by?: string | null
          id?: string
          read_at?: string | null
          report_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_report_recipients_forwarded_by_fkey"
            columns: ["forwarded_by"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_report_recipients_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "work_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      work_report_requests: {
        Row: {
          account_id: string
          created_at: string
          due_at: string
          due_day: string
          escalated_at: string | null
          escalated_to: string[]
          event_day: string
          id: string
          prefill: Json
          reminded_at: string | null
          report_id: string | null
          rule_key: string
          sent_at: string | null
          source_key: string
          status: string
          subject: string
          subject_account_id: string | null
          template_key: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          due_at: string
          due_day: string
          escalated_at?: string | null
          escalated_to?: string[]
          event_day: string
          id?: string
          prefill?: Json
          reminded_at?: string | null
          report_id?: string | null
          rule_key: string
          sent_at?: string | null
          source_key: string
          status?: string
          subject?: string
          subject_account_id?: string | null
          template_key: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          due_at?: string
          due_day?: string
          escalated_at?: string | null
          escalated_to?: string[]
          event_day?: string
          id?: string
          prefill?: Json
          reminded_at?: string | null
          report_id?: string | null
          rule_key?: string
          sent_at?: string | null
          source_key?: string
          status?: string
          subject?: string
          subject_account_id?: string | null
          template_key?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      work_report_schedules: {
        Row: {
          account_id: string
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          last_period: string | null
          last_report_id: string | null
          template_key: string
          tenant_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_id: string
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          last_period?: string | null
          last_report_id?: string | null
          template_key: string
          tenant_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_id?: string
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          last_period?: string | null
          last_report_id?: string | null
          template_key?: string
          tenant_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_report_schedules_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_report_schedules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_report_schedules_last_report_id_fkey"
            columns: ["last_report_id"]
            isOneToOne: false
            referencedRelation: "work_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_report_schedules_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      work_report_settings: {
        Row: {
          escalations: boolean
          reminders: boolean
          tenant_id: string
          tracking_from: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          escalations?: boolean
          reminders?: boolean
          tenant_id: string
          tracking_from?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          escalations?: boolean
          reminders?: boolean
          tenant_id?: string
          tracking_from?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      work_report_templates: {
        Row: {
          created_at: string
          created_by: string
          def: Json
          id: string
          key: string
          status: string
          tenant_id: string | null
          updated_at: string
          updated_by: string | null
          version: number
          words: Json
        }
        Insert: {
          created_at?: string
          created_by: string
          def: Json
          id?: string
          key: string
          status?: string
          tenant_id?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
          words: Json
        }
        Update: {
          created_at?: string
          created_by?: string
          def?: Json
          id?: string
          key?: string
          status?: string
          tenant_id?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
          words?: Json
        }
        Relationships: []
      }
      work_reports: {
        Row: {
          author_account_id: string
          confidential: boolean
          created_at: string
          decided_at: string | null
          decided_by: string | null
          doc_no: string | null
          id: string
          period_end: string | null
          period_key: string | null
          period_start: string | null
          previous_id: string | null
          review_required: boolean
          search_text: string | null
          sections: Json
          status: string
          submitted_at: string | null
          superseded: boolean
          template_key: string
          template_snapshot: Json | null
          tenant_id: string | null
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          author_account_id: string
          confidential?: boolean
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          doc_no?: string | null
          id?: string
          period_end?: string | null
          period_key?: string | null
          period_start?: string | null
          previous_id?: string | null
          review_required?: boolean
          search_text?: string | null
          sections?: Json
          status?: string
          submitted_at?: string | null
          superseded?: boolean
          template_key: string
          template_snapshot?: Json | null
          tenant_id?: string | null
          title?: string
          updated_at?: string
          version?: number
        }
        Update: {
          author_account_id?: string
          confidential?: boolean
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          doc_no?: string | null
          id?: string
          period_end?: string | null
          period_key?: string | null
          period_start?: string | null
          previous_id?: string | null
          review_required?: boolean
          search_text?: string | null
          sections?: Json
          status?: string
          submitted_at?: string | null
          superseded?: boolean
          template_key?: string
          template_snapshot?: Json | null
          tenant_id?: string | null
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "work_reports_previous_id_fkey"
            columns: ["previous_id"]
            isOneToOne: false
            referencedRelation: "work_reports"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      account_prefs_merge: {
        Args: { p_account_id: string; p_patch: Json }
        Returns: Json
      }
      account_prefs_merge_nested: {
        Args: { p_account_id: string; p_deep: string[]; p_patch: Json }
        Returns: Json
      }
      ai_memories_cap: {
        Args: { p_account_id: string; p_keep: number }
        Returns: undefined
      }
      ai_rate_limit_hit: {
        Args: { p_bucket: string; p_subject: string; p_window: string }
        Returns: {
          count: number
        }[]
      }
      calculate_market_final_price: {
        Args: {
          p_customer_type: string
          p_market: string
          p_product_id: string
        }
        Returns: {
          customer_type: string
          final_price: number
          market: string
          product_cost: number
          product_id: string
        }[]
      }
      calculate_market_price: {
        Args: {
          p_customer_type: string
          p_market_name: string
          p_product_id: string
        }
        Returns: {
          customer_type: string
          final_price: number
          market: string
          product_cost: number
          product_id: string
        }[]
      }
      calculate_price_by_model: {
        Args: { p_customer_type: string; p_market: string; p_model: string }
        Returns: {
          customer_type: string
          final_price: number
          market: string
          product_cost: number
          product_id: string
        }[]
      }
      current_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      discuss_last_messages: {
        Args: { p_channel_ids: string[] }
        Returns: {
          author_account_id: string
          author_username: string
          body: string
          channel_id: string
          created_at: string
          id: string
          kind: string
        }[]
      }
      find_or_create_customer_channel: {
        Args: {
          p_contact_id: string
          p_created_by: string
          p_display_name: string
        }
        Returns: string
      }
      find_or_create_direct_channel: {
        Args: { p_account_a: string; p_account_b: string }
        Returns: string
      }
      fn_accounting_account_balances: {
        Args: { p_from?: string; p_tenant_id: string; p_to?: string }
        Returns: {
          account_id: string
          credit_total: number
          debit_total: number
        }[]
      }
      fn_accounting_adopt_bank_lines: {
        Args: { p_bank_account_id: string; p_tenant_id: string }
        Returns: number
      }
      fn_accounting_assert_balanced: {
        Args: { p_entry_id: string }
        Returns: undefined
      }
      fn_accounting_bank_balances: {
        Args: { p_tenant_id: string }
        Returns: {
          bank_account_id: string
          currency: string
          difference: number
          foreign_lines: number
          gl_account_id: string
          gl_code: string
          last_entry_date: string
          ledger_base: number
          ledger_native: number
          statement_balance: number
        }[]
      }
      fn_accounting_cash_flow_lines: {
        Args: { p_from: string; p_tenant_id: string; p_to: string }
        Returns: {
          contra_codes: string[]
          contra_types: string[]
          entry_date: string
          entry_id: string
          impact: number
          source_type: string
        }[]
      }
      fn_accounting_close_period: {
        Args: { p_by: string; p_tenant_id: string; p_through: string }
        Returns: Json
      }
      fn_accounting_depreciation_catch_up: {
        Args: { p_by: string; p_tenant_id: string; p_through: string }
        Returns: Json
      }
      fn_accounting_depreciation_run: {
        Args: { p_by: string; p_month: string; p_tenant_id: string }
        Returns: Json
      }
      fn_accounting_ensure_bank_accounts: {
        Args: { p_tenant_id: string }
        Returns: number
      }
      fn_accounting_ensure_coa: {
        Args: { p_tenant_id: string }
        Returns: undefined
      }
      fn_accounting_fx_revalue: {
        Args: { p_as_of: string; p_by: string; p_tenant_id: string }
        Returns: Json
      }
      fn_accounting_gl_page: {
        Args: {
          p_account_id: string
          p_from: string
          p_limit: number
          p_offset: number
          p_tenant_id: string
          p_to: string
        }
        Returns: {
          credit: number
          currency: string
          debit: number
          entry_date: string
          entry_description: string
          entry_id: string
          exchange_rate: number
          journal_no: string
          line_description: string
          party_id: string
          party_type: string
          reference: string
          source_type: string
          status: string
          total_count: number
        }[]
      }
      fn_accounting_locked_through: {
        Args: { p_tenant_id: string }
        Returns: string
      }
      fn_accounting_next_journal_no: {
        Args: { p_prefix: string; p_tenant_id: string }
        Returns: string
      }
      fn_accounting_post_bank_openings: {
        Args: { p_by: string; p_date?: string; p_tenant_id: string }
        Returns: Json
      }
      fn_accounting_post_entry: {
        Args: { p_entry_id: string; p_posted_by: string; p_tenant_id: string }
        Returns: Json
      }
      fn_accounting_rate: {
        Args: {
          p_date: string
          p_from: string
          p_tenant_id: string
          p_to: string
        }
        Returns: number
      }
      fn_accounting_vat: {
        Args: { p_from: string; p_tenant_id: string; p_to: string }
        Returns: {
          amount_base: number
          entries: number
          kind: string
          month: string
        }[]
      }
      fn_accounting_void_entry: {
        Args: {
          p_entry_id: string
          p_reason: string
          p_tenant_id: string
          p_voided_by: string
        }
        Returns: Json
      }
      fn_bank_import_confirm: {
        Args: { p_actor_id: string; p_import_id: string; p_tenant_id: string }
        Returns: Json
      }
      fn_bank_import_replace_rows: {
        Args: {
          p_duplicate_count: number
          p_error_count: number
          p_import_id: string
          p_metadata: Json
          p_row_count: number
          p_rows: Json
          p_tenant_id: string
        }
        Returns: Json
      }
      fn_inventory_backfill_link_to_product: {
        Args: {
          p_allow_create_product?: boolean
          p_inventory_item_id: string
          p_tenant_id: string
        }
        Returns: string
      }
      fn_inventory_ensure_default_warehouse: {
        Args: { p_tenant_id: string }
        Returns: string
      }
      fn_inventory_ensure_item_for_product: {
        Args: { p_product_id: string; p_tenant_id: string }
        Returns: string
      }
      fn_inventory_ensure_special_location:
        | {
            Args: { p_code: string; p_name: string; p_tenant_id: string }
            Returns: string
          }
        | {
            Args: {
              p_customer_id?: string
              p_location_type: string
              p_name?: string
              p_tenant_id: string
            }
            Returns: string
          }
      fn_inventory_link_item_to_product: {
        Args: {
          p_inventory_item_id: string
          p_product_id: string
          p_tenant_id: string
        }
        Returns: boolean
      }
      fn_inventory_next_item_code: {
        Args: { p_prefix: string; p_tenant_id: string }
        Returns: string
      }
      fn_inventory_post_movement: {
        Args: {
          p_movement_id: string
          p_posted_by?: string
          p_tenant_id: string
        }
        Returns: Json
      }
      fn_inventory_void_movement: {
        Args: {
          p_movement_id: string
          p_reason?: string
          p_tenant_id: string
          p_voided_by?: string
        }
        Returns: Json
      }
      fn_payment_reconcile_transition: {
        Args: {
          p_action: string
          p_actor_id: string
          p_actual_amount: number
          p_bank_account: string
          p_bank_reference: string
          p_notes: string
          p_payment_id: string
          p_target_status: string
          p_tenant_id: string
        }
        Returns: Json
      }
      fn_purchase_recompute_po_status: {
        Args: { p_po_id: string; p_tenant_id: string }
        Returns: Json
      }
      fn_quotations_inline_images: {
        Args: { p_limit?: number; p_tenant_id: string }
        Returns: {
          id: string
          quote_no: string
        }[]
      }
      fn_quotations_inline_images_count: {
        Args: { p_tenant_id: string }
        Returns: number
      }
      fn_recon_confirm_candidate: {
        Args: {
          p_actor_id: string
          p_candidate_id: string
          p_notes: string
          p_tenant_id: string
        }
        Returns: Json
      }
      fn_recon_reject_candidate: {
        Args: {
          p_actor_id: string
          p_candidate_id: string
          p_reason: string
          p_tenant_id: string
        }
        Returns: Json
      }
      fn_sales_recompute_order_status: {
        Args: { p_so_id: string; p_tenant_id: string }
        Returns: Json
      }
      fn_treasury_plan_review: {
        Args: {
          p_actor_id: string
          p_decision: string
          p_notes: string
          p_plan_id: string
          p_tenant_id: string
        }
        Returns: Json
      }
      get_product_name: {
        Args: { p_lang: string; p_product_id: string }
        Returns: string
      }
      increment_usage: {
        Args: {
          p_account: string
          p_day: string
          p_seconds: number
          p_tenant: string
        }
        Returns: undefined
      }
      kx_text_join: { Args: { arr: string[] }; Returns: string }
      next_customer_code: {
        Args: { p_country: string; p_tenant: string }
        Returns: string
      }
      next_deal_number: { Args: { p_tenant: string }; Returns: number }
      next_membership_ref: { Args: never; Returns: string }
      next_support_ref: { Args: never; Returns: string }
      products_freshness_bump: {
        Args: { p_kind: string; p_product: string }
        Returns: undefined
      }
      project_member_counts: {
        Args: { p_project_ids: string[]; p_tenant: string }
        Returns: {
          member_count: number
          project_id: string
        }[]
      }
      project_task_counts: {
        Args: { p_project_ids: string[]; p_tenant: string }
        Returns: {
          done_top: number
          open_count: number
          overdue_count: number
          project_id: string
          total_top: number
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      doc_status:
        | "draft"
        | "sent"
        | "accepted"
        | "rejected"
        | "expired"
        | "cancelled"
        | "final"
      invoice_status:
        | "draft"
        | "issued"
        | "paid"
        | "cancelled"
        | "sent"
        | "overdue"
        | "partial"
        | "void"
      purchase_category_kind: "direct" | "indirect" | "services" | "capex"
      purchase_order_status:
        | "draft"
        | "confirmed"
        | "partial"
        | "received"
        | "closed"
        | "cancelled"
      purchase_receipt_status:
        | "draft"
        | "partial"
        | "complete"
        | "cancelled"
        | "posted"
        | "voided"
      purchase_req_status:
        | "draft"
        | "pending"
        | "approved"
        | "rejected"
        | "converted"
        | "cancelled"
      purchase_return_status:
        | "draft"
        | "sent"
        | "refunded"
        | "closed"
        | "cancelled"
      purchase_rfq_status:
        | "draft"
        | "sent"
        | "responded"
        | "closed"
        | "cancelled"
      so_status:
        | "draft"
        | "confirmed"
        | "closed"
        | "cancelled"
        | "partial"
        | "shipped"
      supplier_contract_status: "draft" | "active" | "expired" | "terminated"
      supplier_type: "manufacturer"
      user_role: "admin" | "sales" | "viewer" | "app_user"
      vendor_bill_status:
        | "draft"
        | "posted"
        | "partial"
        | "paid"
        | "overdue"
        | "cancelled"
      visibility_tier:
        | "public"
        | "internal"
        | "procurement"
        | "finance"
        | "management"
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
    Enums: {
      doc_status: [
        "draft",
        "sent",
        "accepted",
        "rejected",
        "expired",
        "cancelled",
        "final",
      ],
      invoice_status: [
        "draft",
        "issued",
        "paid",
        "cancelled",
        "sent",
        "overdue",
        "partial",
        "void",
      ],
      purchase_category_kind: ["direct", "indirect", "services", "capex"],
      purchase_order_status: [
        "draft",
        "confirmed",
        "partial",
        "received",
        "closed",
        "cancelled",
      ],
      purchase_receipt_status: [
        "draft",
        "partial",
        "complete",
        "cancelled",
        "posted",
        "voided",
      ],
      purchase_req_status: [
        "draft",
        "pending",
        "approved",
        "rejected",
        "converted",
        "cancelled",
      ],
      purchase_return_status: [
        "draft",
        "sent",
        "refunded",
        "closed",
        "cancelled",
      ],
      purchase_rfq_status: [
        "draft",
        "sent",
        "responded",
        "closed",
        "cancelled",
      ],
      so_status: [
        "draft",
        "confirmed",
        "closed",
        "cancelled",
        "partial",
        "shipped",
      ],
      supplier_contract_status: ["draft", "active", "expired", "terminated"],
      supplier_type: ["manufacturer"],
      user_role: ["admin", "sales", "viewer", "app_user"],
      vendor_bill_status: [
        "draft",
        "posted",
        "partial",
        "paid",
        "overdue",
        "cancelled",
      ],
      visibility_tier: [
        "public",
        "internal",
        "procurement",
        "finance",
        "management",
      ],
    },
  },
} as const

/* ---------------------------------------------------------------------------
   Hand-written convenience types — carried over from the pre-generation
   supabase.ts (2026-10-07 regeneration). Row aliases, form types and
   relation shapes the apps import directly. The Database type above is
   now generated from production; everything below is curated by hand.
   --------------------------------------------------------------------------- */

export type SectionLayout =
  | "hero"
  | "image-left"
  | "image-right"
  | "cards"
  | "grid"
  | "video"
  | "numbers"
  | "cta"
  | "quote"
  | "timeline"
  | "full-image"
  | "split"
  | "brands"
  | "bg-hero";

export type ButtonStyle = "solid" | "outline" | "ghost";
export type ButtonShape = "pill" | "rounded" | "square";
export type ButtonSize = "small" | "medium" | "large";
export type LinkType = "none" | "page" | "product" | "anchor" | "url" | "file" | "email" | "phone";

export interface ButtonConfig {
  text: string;
  linkType: LinkType;
  link: string;
  newTab: boolean;
  style: ButtonStyle;
  shape: ButtonShape;
  size: ButtonSize;
}

export interface SectionSettings {
  btn1?: ButtonConfig;
  btn2?: ButtonConfig;
  overlayOpacity?: number;
  textAlign?: "left" | "center" | "right";
  textMode?: "dark" | "light";
  contentWidth?: "narrow" | "medium" | "wide" | "full";
  verticalAlign?: "top" | "center" | "bottom";
  columns?: number;
  rows?: number;
  paddingTop?: string;
  paddingBottom?: string;
  gap?: string;
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
  // Layout zones
  zoneLayout?: ZoneLayout;
}

/* ── Layout Zones ── */
export type ZoneLayout =
  | "1-col"
  | "2-col"
  | "3-col"
  | "4-col"
  | "70-30"
  | "30-70"
  | "60-40"
  | "40-60";

/* ── Icon Config ── */
export interface IconConfig {
  type: "emoji" | "lucide" | "svg" | "image";
  value: string; // emoji char, lucide name, svg string, or image URL
  size: "xs" | "sm" | "md" | "lg" | "xl" | "custom";
  customSize?: number;
  color?: string;
  bgShape?: "none" | "circle" | "rounded" | "pill";
  bgColor?: string;
  position?: "left" | "right" | "top" | "bottom" | "center";
  align?: "left" | "center" | "right";
}

/* ── Element Types ── */

export type ElementType =
  | "heading"
  | "paragraph"
  | "image"
  | "button"
  | "icon"
  | "card"
  | "list"
  | "form"
  | "video"
  | "divider"
  | "container"
  | "spacer"
  | "badge"
  | "avatar"
  | "stat"
  | "testimonial"
  | "feature"
  | "pricing"
  | "faq"
  | "social"
  | "logo"
  | "countdown"
  | "progress"
  | "tag-list"
  | "cta-banner"
  | "icon-box"
  | "gallery"
  | "map"
  | "code"
  | "table"
  | "accordion"
  | "tabs"
  | "alert"
  | "breadcrumb";

export interface ElementRow {
  id: string;
  section_id: string;
  type: ElementType;
  content: Record<string, unknown> | null;
  style: Record<string, unknown> | null;
  settings: Record<string, unknown> | null;
  order: number;
  visible: boolean;
  zone?: string; // Virtual field — derived from settings.zone, not a DB column
  created_at: string;
  updated_at: string;
}

/* ── Row types (what comes back from Supabase) ── */

export interface PageRow {
  id: string;
  name: string;
  slug: string;
  title: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface SectionRow {
  id: string;
  page_id: string;
  section_key: string;
  layout: SectionLayout;
  title: string | null;
  subtitle: string | null;
  content: string | null;
  image_url: string | null;
  image_alt: string | null;
  video_url: string | null;
  button_text: string | null;
  button_link: string | null;
  button2_text: string | null;
  button2_link: string | null;
  background: "white" | "light" | "dark" | "black" | "image" | null;
  items: SectionItem[] | null;
  order: number;
  visible: boolean;
  created_at: string;
  updated_at: string;
}

export interface SectionItem {
  title: string;
  description?: string;
  icon?: string;
  image?: string;
  href?: string;
  value?: string;
  label?: string;
}

export interface MediaRow {
  id: string;
  name: string;
  file_path: string;
  url: string;
  type: string;
  size: number;
  created_at: string;
}

/* ── Insert types (what you send to Supabase) ── */

export type PageInsert = Omit<PageRow, "id" | "created_at" | "updated_at">;
export type SectionInsert = Omit<SectionRow, "id" | "created_at" | "updated_at">;
export type MediaInsert = Omit<MediaRow, "id" | "created_at">;

/* ── Update types ── */

export type PageUpdate = Partial<PageInsert>;
export type SectionUpdate = Partial<SectionInsert>;

/* ---------------------------------------------------------------------------
   Product Catalog Types — Maps to the product tables.
   --------------------------------------------------------------------------- */

/* product_media.type is NOT free text: the CHECK constraint valid_media_type
   allows exactly these 13 values (read from pg_constraint, 27/09/2026), and
   the database rejects any other. A new type needs a migration AND this
   union; validate:product-page-images §4 checks that the two lists match and
   that every insert uses one of them. */
export type ProductMediaType =
  | "main_image"
  | "gallery"
  | "packing_photo"
  | "label"
  | "logo_detail"
  | "manual"
  | "ar_3d"
  | "video"
  /* Document types (Phase 2 — Media & Documents): they widen the
     hand-maintained union the form + renderers switch on. */
  /* Per-model hero (family Phase 3): bound via product_media.model_id;
     a model without one inherits the family's main_image. */
  | "model_image"
  | "datasheet"
  | "brochure"
  | "certificate"
  | "parts_list";

export interface DivisionRow {
  id: string;
  name: string;
  name_zh?: string | null;
  name_ar?: string | null;
  slug: string;
  tagline: string | null;
  description: string | null;
  order: number;
  created_at: string;
}

export interface CategoryRow {
  id: string;
  division_id: string;
  name: string;
  name_zh?: string | null;
  name_ar?: string | null;
  slug: string;
  description: string | null;
  order: number;
  created_at: string;
}

export interface SubcategoryRow {
  id: string;
  category_id: string;
  name: string;
  name_zh?: string | null;
  name_ar?: string | null;
  slug: string;
  description: string | null;
  order: number;
  created_at: string;
  /** Stable short KOLEEX prefix (e.g. "XCS"). NULL until the division's
   *  coding grammar lands. Set for every Garment Machinery subcategory
   *  via migration pd_auto_code_v2_subcategory_code_column. */
  code: string | null;
}

/** One "Main Devices & Functions" photo card — universal across all
 *  categories: photo + title + short description, shown as a card grid
 *  on the public product page. */
export interface FeatureCard {
  image_url: string;
  title: string;
  description: string;
}

export interface ProductRow {
  feature_cards?: FeatureCard[] | null;
  /* Catalogue badges as a bitmask (products-freshness.ts): NEW=1,
     Updated=2, Price updated=4. Computed by the list API from three
     timestamps that never reach the browser; absent when 0. */
  fresh?: number;
  id: string;
  product_name: string;
  slug: string;
  division_slug: string;
  category_slug: string;
  subcategory_slug: string;
  brand: string | null;
  tags: string[];
  level: string | null;
  /* Short 1-2 sentence pitch used on cards + SEO + quotes. */
  excerpt: string | null;
  /* 3-5 bullet strings for the public product hero. */
  highlights: string[];
  description: string | null;
  specs: Record<string, unknown>;
  hs_code: string | null;
  voltage: string[];
  plug_types: string[];
  /* Legacy free-text watt — kept for back-compat reads only.
     New writes go to motor_power_w (typed integer). */
  watt: string | null;
  colors: string[];
  /* Electrical / Physical / Compliance (Technical step). Moved out
     of product_sewing_specs.common_specs in the spec-step audit so
     they can be filtered and queried as typed columns. */
  motor_power_w: number | null;
  power_consumption_w: number | null;
  ce_certified: boolean | null;
  rohs_compliant: boolean | null;
  /* Air-purify / oil-mist filter — relevant for cleanrooms and
     light-fabric production. Pneumatic supply requirement —
     relevant for automatic stations and pneumatic presser-foot
     lifters. Both nullable so existing products default to "n/a". */
  oil_mist_filter: boolean | null;
  pneumatic_supply: boolean | null;
  machine_weight_kg: number | null;
  machine_dimensions: string | null;
  /* Technical step v2 audit gap-fill. */
  frequency_hz: string[] | null;
  phase: string | null;
  ip_rating: string | null;
  operating_temp: string | null;
  supports_head_only: boolean;
  supports_complete_set: boolean;
  warranty: string | null;
  /* Phase 4 — structured warranty / after-sales (additive, all nullable). */
  warranty_months: number | null;
  warranty_type: string | null;
  warranty_start_from: string | null;
  warranty_coverage: string | null;
  warranty_exclusions: string | null;
  spare_parts_availability: string | null;
  spare_parts_stock: string | null;
  service_life: string | null;
  maintenance_interval: string | null;
  technical_support: string | null;
  support_channels: string[] | null;
  training_available: boolean | null;
  installation_service: boolean | null;
  returns_policy: string | null;
  /* Phase 5 — Identity identifiers + lifecycle (additive, all nullable). */
  mpn: string | null;
  gtin: string | null;
  manufacturer: string | null;
  generation: string | null;
  internal_sku: string | null;
  launch_date: string | null;
  eol_date: string | null;
  alternate_names: string[] | null;
  /* Identity tab expansion (additive, all nullable). */
  legacy_code: string | null;
  brand_mark_url: string | null;
  hero_poster_url: string | null;
  status_reason: string | null;
  model_year: string | null;
  available_from: string | null;
  last_order_date: string | null;
  meta_title: string | null;
  meta_description: string | null;
  og_image_url: string | null;
  revision_history: { version: string; date: string; note: string }[] | null;
  visible: boolean;
  featured: boolean;
  status: string | null;
  family: string | null;
  country_of_origin: string | null;
  moq: number | null;
  lead_time: string | null;
  /* Product Schema Engine v1 — 5 new columns added in a recent
     migration. All nullable so existing rows keep working untouched. */
  schema_id: string | null;
  schema_version: string | null;
  schema_specs: Record<string, unknown> | null;
  schema_knowledge: unknown[] | null;
  schema_visibility: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface ProductModelRow {
  id: string;
  product_id: string;
  model_name: string;
  slug: string;
  sku: string;
  tagline: string | null;
  /** Per-member packing differences vs products.logistics (partial, same shape). */
  logistics_overrides?: Record<string, unknown> | null;
  supplier: string | null;
  reference_model: string | null;
  /** Commercial KOLEEX code (e.g. "XCS-7800"). Unique when set.
   *  Auto-suggested from subcategory.code + extract(supplier model),
   *  freely editable, persisted alongside reference_model so the
   *  supplier identity is never overwritten. */
  primary_model: string | null;
  /** Denormalised prefix the primary model was built from. */
  code_prefix: string | null;
  /** Workflow: 'auto_suggested' | 'edited' | 'approved' | 'locked'. */
  coding_status: string | null;
  cost_price: number | null;
  global_price: number | null;
  supports_head_only: boolean | null;
  supports_complete_set: boolean | null;
  head_only_price: number | null;
  complete_set_price: number | null;
  /* `weight` is the GROSS / packed weight (kg). `net_weight` is the
     bare-machine weight; both fields exist so a model card can carry
     the standard NW / GW pair shown on every commercial invoice. */
  weight: number | null;
  net_weight: number | null;
  cbm: number | null;
  carton_dimensions: string | null;
  packing_type: string | null;
  box_include: string | null;
  extra_accessories: string | null;
  /* Logistics + availability — added in the Technical+Models v2 audit. */
  container_20ft_qty: number | null;
  container_40ft_qty: number | null;
  container_40hq_qty: number | null;
  stock_status: string | null;
  order: number;
  visible: boolean;
  status: string | null;
  moq: number | null;
  lead_time: string | null;
  barcode: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductMediaRow {
  id: string;
  product_id: string;
  model_id: string | null;
  type: ProductMediaType;
  url: string;
  file_path: string | null;
  alt_text: string | null;
  order: number;
  created_at: string;
}

export interface ProductTranslationRow {
  id: string;
  product_id: string;
  locale: string;
  product_name: string;
  tagline: string | null;
  excerpt: string | null;
  description: string | null;
  created_at: string;
}

export interface ModelTranslationRow {
  id: string;
  model_id: string;
  locale: string;
  model_name: string;
  tagline: string | null;
  created_at: string;
}

export interface ProductMarketPriceRow {
  id: string;
  model_id: string;
  country_code: string;
  currency: string;
  market_price: number;
  head_only_price: number | null;
  complete_set_price: number | null;
  created_at: string;
}

export interface RelatedProductRow {
  product_id: string;
  related_id: string;
  order: number;
}

export interface SewingMachineSpecsRow {
  id: string;
  product_id: string;
  template_slug: string;
  common_specs: Record<string, unknown>;
  template_specs: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type SewingMachineSpecsInsert = Omit<SewingMachineSpecsRow, "id" | "created_at" | "updated_at">;

/* ── Insert types ── */

export type ProductInsert = Omit<ProductRow, "id" | "created_at" | "updated_at">;
export type ProductModelInsert = Omit<ProductModelRow, "id" | "sku" | "created_at" | "updated_at">;
export type ProductMediaInsert = Omit<ProductMediaRow, "id" | "created_at">;
export type ProductTranslationInsert = Omit<ProductTranslationRow, "id" | "created_at">;
export type ModelTranslationInsert = Omit<ModelTranslationRow, "id" | "created_at">;
export type ProductMarketPriceInsert = Omit<ProductMarketPriceRow, "id" | "created_at">;

/* ---------------------------------------------------------------------------
   Accounts Manager v2 — Identity System

   This is the refactored identity layer. It separates five concerns into
   five tables (see supabase/migrations/refactor_accounts_to_identity_system.sql):

     1. people            — Person / contact records (identity + address).
     2. companies         — Organisations. customer_level lives here as the
                            single source of truth for pricing logic.
     3. koleex_employees  — Internal HR records linking people ↔ accounts.
     4. accounts          — Login identity only: username, login email,
                            password, user_type, status, role, links to
                            person + company. No more profile data here.
     5. access_presets    — Role → default permission bundle (placeholder for
                            the future permissions system with overrides).

   Naming note: we use `people` (not `contacts`) and `koleex_employees` (not
   `employees`) because legacy tables with those names already exist. The
   legacy `contacts` table powers /customers, /suppliers, /contacts as a
   flat business directory, and a legacy `employees` table exists too. The
   new `people` + `koleex_employees` tables are identity-layer records.
   --------------------------------------------------------------------------- */

export type UserType = "internal" | "customer";
export type AccountStatus =
  | "invited"
  | "active"
  | "inactive"
  | "suspended"
  | "pending";
export type CustomerLevel = "silver" | "gold" | "platinum" | "diamond";
export type CompanyType = "koleex" | "customer" | "supplier" | "partner";
export type RoleScope = "internal" | "customer" | "all";
export type EmploymentStatus = "active" | "on_leave" | "terminated" | "inactive";
export type EmploymentType = "full_time" | "part_time" | "contract" | "intern" | "freelance";
export type WorkLocation = "office" | "remote" | "hybrid";
export type DataScope = "own" | "department" | "all";

/* Re-export the AccountPreferences type from the access-control catalog so
   supabase types and UI types stay in sync. */
export type {
  AccountPreferences,
  AccessLevel,
} from "@/lib/access-control";
import type { AccountPreferences as _AccountPreferences } from "@/lib/access-control";

/* ── Companies (source of truth for customer level + pricing) ── */
export interface CompanyRow {
  id: string;
  name: string;
  type: CompanyType;
  country: string | null;
  currency: string | null;
  customer_level: CustomerLevel | null;
  tax_id: string | null;
  website: string | null;
  logo_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type CompanyInsert = Omit<CompanyRow, "id" | "created_at" | "updated_at">;
export type CompanyUpdate = Partial<CompanyInsert>;

/* ── Roles ── */
export interface RoleRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  scope: RoleScope;
  display_order: number;
  created_at: string;
}

export type RoleInsert = Omit<RoleRow, "id" | "created_at">;

/* ── People (person records — identity + address) ── */
export interface PersonRow {
  id: string;
  full_name: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  job_title: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  avatar_url: string | null;
  name_alt: string | null;
  first_name_alt: string | null;
  last_name_alt: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postal_code: string | null;
  company_id: string | null;
  language: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export type PersonInsert = Omit<PersonRow, "id" | "created_at" | "updated_at">;
export type PersonUpdate = Partial<PersonInsert>;

/* ── Employees (internal HR record, links person ↔ account) ── */
export interface EmployeeRow {
  id: string;
  person_id: string | null;
  account_id: string | null;
  employee_number: string | null;
  department: string | null;
  position: string | null;
  hire_date: string | null;
  employment_status: EmploymentStatus;
  manager_id: string | null;
  work_email: string | null;
  work_phone: string | null;
  notes: string | null;

  // Private HR fields (added in accounts v2 phase 1)
  // NOTE: private_address_* removed (identity consolidation) — the home address
  // now lives on the shared people record (people.address_*). See
  // docs/identity-data-architecture-plan.md.
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relationship: string | null;
  birth_date: string | null;
  marital_status: string | null;
  nationality: string | null;
  identification_id: string | null;
  passport_number: string | null;
  visa_number: string | null;
  visa_expiry_date: string | null;

  // Employment type & contract (added in management system migration)
  employment_type: EmploymentType;
  contract_end_date: string | null;
  probation_end_date: string | null;
  work_location: WorkLocation;
  /** Phase C: ISO alpha-2 of the country the employee works in (calendar + policy). */
  work_country: string | null;

  // Bank account
  bank_name: string | null;
  bank_account_holder: string | null;
  bank_account_number: string | null;
  bank_iban: string | null;
  bank_swift: string | null;
  bank_currency: string | null;

  // Additional personal
  number_of_children: number | null;
  gender: string | null;
  blood_type: string | null;
  religion: string | null;
  languages: string | null;

  // Salary at hire
  initial_salary: number | null;
  salary_currency: string | null;

  // Insurance
  insurance_provider: string | null;
  insurance_policy_number: string | null;
  insurance_class: string | null;
  insurance_expiry_date: string | null;

  // Social Security / Tax
  social_security_number: string | null;
  tax_id: string | null;

  // Education
  education_degree: string | null;
  education_institution: string | null;
  education_field: string | null;
  education_graduation_year: string | null;

  // Driving License
  driving_license_number: string | null;
  driving_license_type: string | null;
  driving_license_expiry: string | null;

  // Second emergency contact
  emergency_contact2_name: string | null;
  emergency_contact2_phone: string | null;
  emergency_contact2_relationship: string | null;

  /* WeChat identity, social presence, and scans of the legal IDs.
     The three *_doc_url values and wechat_qr_url are PATHS inside the private
     hr-documents bucket — resolve with resolveHrFileUrl, never render it directly. */
  wechat_id: string | null;
  wechat_qr_url: string | null;
  social_accounts: { platform: string; value: string }[] | null;
  national_id_doc_url: string | null;      // front
  national_id_back_doc_url: string | null; // back
  passport_doc_url: string | null;
  visa_doc_url: string | null;

  created_at: string;
  updated_at: string;
}

export type EmployeeInsert = Omit<EmployeeRow, "id" | "created_at" | "updated_at">;
export type EmployeeUpdate = Partial<EmployeeInsert>;

/* ── Management System (org structure, positions, assignments) ── */

export interface DepartmentRow {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  icon_type: string;
  icon_value: string | null;
  parent_id: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type DepartmentInsert = Omit<DepartmentRow, "id" | "created_at" | "updated_at">;
export type DepartmentUpdate = Partial<DepartmentInsert>;

export interface PositionRow {
  id: string;
  title: string;
  department_id: string;
  reports_to_position_id: string | null;
  level: number;
  description: string | null;
  role_id: string | null;
  responsibilities: string | null;
  requirements: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type PositionInsert = Omit<PositionRow, "id" | "created_at" | "updated_at">;
export type PositionUpdate = Partial<PositionInsert>;

export interface AssignmentRow {
  id: string;
  person_id: string;
  position_id: string;
  department_id: string;
  is_primary: boolean;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type AssignmentInsert = Omit<AssignmentRow, "id" | "created_at" | "updated_at">;
export type AssignmentUpdate = Partial<AssignmentInsert>;

export interface OrgRoleRow {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export type OrgRoleInsert = Omit<OrgRoleRow, "id" | "created_at" | "updated_at">;
export type OrgRoleUpdate = Partial<OrgRoleInsert>;

export interface OrgPermissionRow {
  id: string;
  role_id: string;
  module_name: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  data_scope: DataScope;
  sensitive_fields: string[];
}

export type OrgPermissionInsert = Omit<OrgPermissionRow, "id">;
export type OrgPermissionUpdate = Partial<OrgPermissionInsert>;

export interface PositionHistoryRow {
  id: string;
  position_id: string | null;
  person_id: string | null;
  department_id: string | null;
  action: string;
  from_position_id: string | null;
  to_position_id: string | null;
  notes: string | null;
  created_at: string;
}

/* ── Employee with all linked data (convenience type) ── */
export interface EmployeeWithLinks {
  person: PersonRow;
  employee: EmployeeRow;
  /** Skill assessments (may be absent on older cached payloads). */
  skills?: {
    skill_id: string;
    source: "position" | "additional";
    employee_score: number | null;
    years_of_experience: number | null;
    notes: string | null;
    is_verified: boolean;
    last_assessed_at: string | null;
  }[];
  account: AccountRow | null;
  assignment: AssignmentRow | null;
  department: DepartmentRow | null;
  position: PositionRow | null;
}

/* ── Accounts (login identity only) ── */
export interface AccountRow {
  id: string;
  auth_user_id: string | null;

  // Login identity
  username: string;
  login_email: string;
  password_hash: string | null;
  /* Phase 2A S0b — password hashing migration scaffolding (additive).
     'legacy' = reversible tmp$ hash (being phased out); 'argon2id'/'bcrypt'
     = securely hashed. password_changed_at stamps the last (re)hash. */
  password_algo: "legacy" | "argon2id" | "bcrypt";
  password_changed_at: string | null;
  password_rehash_required: boolean;
  force_password_change: boolean;
  two_factor_enabled: boolean;
  last_login_at: string | null;

  // Type / status / role
  user_type: UserType;
  status: AccountStatus;
  role_id: string | null;

  // Linked records
  person_id: string | null;
  company_id: string | null;
  /** Link to the Customers-app contact for customer / supplier logins.
   *  Required for user_type = 'customer' by the per-user_type CHECK. */
  contact_id: string | null;

  /** Multi-tenancy anchor. Auto-set to the host tenant (Koleex) for
   *  internal accounts; customer accounts can be in their own tenant. */
  tenant_id: string;

  /** Per-account Super Admin override. Effective SA = account-level OR
   *  role-level. Grants all-tenant + personal-data-bypass privileges. */
  is_super_admin: boolean;
  /* Super-Admin-granted: this account receives new membership requests. */
  reviews_membership_requests: boolean;

  // Profile
  avatar_url: string | null;

  // Admin-only
  internal_notes: string | null;

  // Preferences bag (language, theme, signature, notifications, calendar)
  preferences: _AccountPreferences;

  created_at: string;
  updated_at: string;
  created_by: string | null;
}

/** Columns that have DB-level defaults and can be omitted on insert. */
/* Columns the DB fills with a default on INSERT — callers may omit them.
   Phase 2A S0b added password_algo/password_changed_at/password_rehash_required
   (DB defaults: 'legacy' / NULL / false), so account-creation callers don't
   need to pass them. */
type AccountInsertDefaulted =
  | "tenant_id"
  | "is_super_admin"
  | "password_algo"
  | "password_changed_at"
  | "password_rehash_required";

export type AccountInsert =
  & Omit<AccountRow, "id" | "created_at" | "updated_at" | AccountInsertDefaulted>
  & Partial<Pick<AccountRow, AccountInsertDefaulted>>;
export type AccountUpdate = Partial<AccountInsert>;

/* ── Access Presets (role → default permission bundle) ── */
export interface AccessPresetRow {
  id: string;
  role_id: string;
  preset_name: string;
  description: string | null;
  can_access_products: boolean;
  can_view_pricing: boolean;
  can_create_quotations: boolean;
  can_place_orders: boolean;
  can_manage_accounts: boolean;
  can_manage_products: boolean;
  can_access_finance: boolean;
  can_access_hr: boolean;
  can_access_marketing: boolean;
  scope_notes: string | null;
  created_at: string;
}

export type AccessPresetInsert = Omit<AccessPresetRow, "id" | "created_at">;
export type AccessPresetUpdate = Partial<AccessPresetInsert>;

/* ── Per-account permission overrides (layers on top of role preset) ── */
export interface AccountPermissionOverrideRow {
  id: string;
  account_id: string;
  module_key: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  data_scope: DataScope;
  access_level: "none" | "user" | "manager" | "admin"; // legacy
  created_at: string;
  updated_at: string;
}

export type AccountPermissionOverrideInsert = Omit<
  AccountPermissionOverrideRow,
  "id" | "created_at" | "updated_at"
>;
export type AccountPermissionOverrideUpdate =
  Partial<AccountPermissionOverrideInsert>;

/* Convenience: an account with its linked person / company / role / preset
   already joined in memory (built client-side after parallel fetches). */
export interface AccountWithLinks extends AccountRow {
  person: PersonRow | null;
  company: CompanyRow | null;
  role: RoleRow | null;
  preset: AccessPresetRow | null;
  employee: EmployeeRow | null;
  overrides: AccountPermissionOverrideRow[];
  /* Display-only password facts derived server-side by GET /api/accounts/[id].
     The password hash itself is NEVER sent to the client. */
  password_state?:
    | "ACTIVE"
    | "TEMPORARY"
    | "RESET_REQUIRED"
    | "NO_PASSWORD"
    | "EXTERNAL_PROVIDER"
    | "PENDING_SETUP";
  has_password?: boolean;
}

/* ── Security infrastructure (Project C: Security tab) ── */

export interface ApiKeyRow {
  id: string;
  account_id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  scopes: string[];
  expires_at: string | null;
  last_used_at: string | null;
  created_at: string;
  revoked_at: string | null;
}
export type ApiKeyInsert = Omit<ApiKeyRow, "id" | "created_at">;
export type ApiKeyUpdate = Partial<ApiKeyInsert>;

export type DeviceType = "desktop" | "mobile" | "tablet" | "other";

export interface AccountSessionRow {
  id: string;
  account_id: string;
  session_token_hash: string;
  device_name: string | null;
  device_type: DeviceType | null;
  os: string | null;
  browser: string | null;
  ip_address: string | null;
  last_active_at: string;
  expires_at: string | null;
  created_at: string;
  revoked_at: string | null;
}
export type AccountSessionInsert = Omit<
  AccountSessionRow,
  "id" | "created_at" | "last_active_at"
> & { last_active_at?: string };
export type AccountSessionUpdate = Partial<AccountSessionInsert>;

export type LoginEventType =
  | "login_success"
  | "login_failed"
  | "logout"
  | "password_reset"
  | "force_reset_enabled"
  | "force_reset_cleared"
  | "two_factor_enabled"
  | "two_factor_disabled"
  | "api_key_created"
  | "api_key_revoked"
  | "session_revoked"
  | "passkey_enrolled"
  | "passkey_revoked";

export interface LoginHistoryRow {
  id: string;
  account_id: string;
  event_type: LoginEventType;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}
export type LoginHistoryInsert = Omit<LoginHistoryRow, "id" | "created_at">;

/* ── Calendar events (Project B: self-contained calendar app) ── */

export type CalendarEventType =
  | "meeting"
  | "task"
  | "reminder"
  | "event"
  | "holiday"
  | "out_of_office";

export type CalendarRecurrence = "daily" | "weekly" | "monthly" | null;

export interface CalendarEventRow {
  id: string;
  account_id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_at: string;   // ISO UTC timestamp
  end_at: string;     // ISO UTC timestamp
  all_day: boolean;
  event_type: CalendarEventType;
  color: string | null;
  created_at: string;
  updated_at: string;
  /* Columns that exist on koleex_calendar_events; optional so older callers
     (and the mirror shims) don't have to supply them. */
  is_private?: boolean | null;
  tenant_id?: string | null;
  /** Minutes before start to alert; null = no reminder. */
  reminder_minutes?: number | null;
  /** Cron dedup: the occurrence-start we last alerted for. Server-managed. */
  reminded_at?: string | null;
  /** null = one-off; otherwise the cadence of the series. */
  recurrence?: CalendarRecurrence;
  /** Optional last date the series repeats until (YYYY-MM-DD). */
  recurrence_until?: string | null;
}

export type CalendarEventInsert = Omit<
  CalendarEventRow,
  "id" | "created_at" | "updated_at" | "reminded_at"
>;
export type CalendarEventUpdate = Partial<CalendarEventInsert>;

/** What GET /api/calendar/events hands the views: real rows, expanded
 *  occurrences of a series, events the viewer is invited to, and read-only
 *  mirrors of other modules. The optional fields say which. */
export type CalendarMirrorSource = "planning" | "todo" | "project" | "leave" | "report" | "events";
export interface CalendarViewEvent extends CalendarEventRow {
  /** Set on each occurrence of a recurring series; the id is `<base>~<i>`. */
  series_base_id?: string;
  /** Owned by someone else; the viewer is on the guest list. */
  invited?: boolean;
  /** Present on mirrors — never editable as an event. */
  source?: CalendarMirrorSource;
  source_kind?: string | null;
  role_name?: string | null;
  linked_entity_label?: string | null;
  todo_id?: string;
  project_task_id?: string;
  leave_request_id?: string;
  /** Report deadlines: the report type, a day inside its period, and the
   *  report to open (the one sent, or the draft started). One an event asked
   *  for also carries its request and what it is about. */
  report_key?: string;
  report_date?: string;
  report_id?: string;
  report_request?: string;
  report_subject?: string;
  /** Events mirrors: the agenda session and its event, for the deep link. */
  event_id?: string;
  agenda_item_id?: string;
}

export type CalendarAttendeeStatus = "invited" | "accepted" | "declined";
export interface CalendarAttendeeRow {
  id: string;
  event_id: string;
  account_id: string;
  status: CalendarAttendeeStatus;
  tenant_id: string | null;
  created_at: string;
}

/* ── Membership requests ("Be a Koleex Member" form) ── */

export type MembershipRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "archived";

export interface MembershipRequestRow {
  id: string;
  full_name: string;
  email: string;
  company: string | null;
  message: string | null;
  status: MembershipRequestStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  source: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export type MembershipRequestInsert = Omit<
  MembershipRequestRow,
  | "id"
  | "created_at"
  | "status"
  | "reviewed_by"
  | "reviewed_at"
  | "source"
  | "metadata"
> & {
  status?: MembershipRequestStatus;
  source?: string | null;
  metadata?: Record<string, unknown>;
};

export type MembershipRequestUpdate = Partial<MembershipRequestInsert> & {
  status?: MembershipRequestStatus;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
};

/* ── Inbox messages (unified notifications + direct messages) ── */

export type InboxMessageCategory =
  | "message"
  | "system"
  | "membership_request"
  | "alert"
  | "external_email"
  | "task"
  | "calendar";

/** Direction an inbox message flowed:
 *   internal — in-app Koleex message (original default)
 *   inbound  — received from an external sender via IMAP
 *   outbound — sent to an external recipient via SMTP
 *
 *  Exists so the UI can render a "Gmail" / "External" badge and the
 *  sync service can filter cleanly between real email and Koleex DMs. */
export type InboxMessageDirection = "internal" | "inbound" | "outbound";

export interface InboxMessageRow {
  id: string;
  recipient_account_id: string;
  sender_account_id: string | null;
  /** Set by tenant-aware producers; NULL on rows written by the crons and
   *  the to-do fan-out, which resolve recipients without a tenant. */
  tenant_id: string | null;
  category: InboxMessageCategory;
  subject: string;
  body: string | null;
  link: string | null;
  metadata: Record<string, unknown>;
  read_at: string | null;
  archived_at: string | null;
  created_at: string;
  /** Put off until then ("Later"; 20260927_inbox_snooze.sql). The slim bell
   *  projection leaves it out — only the center's Later view reads it. */
  snoozed_until?: string | null;

  /* ── External-email fields (all NULL for internal Koleex messages) ── */
  mail_connection_id: string | null;
  direction: InboxMessageDirection;
  external_from: string | null;
  external_from_name: string | null;
  external_to: string[] | null;
  external_cc: string[] | null;
  external_message_id: string | null;
  external_in_reply_to: string | null;
  external_references: string[] | null;
  mail_thread_id: string | null;
  imap_uid: number | null;
  body_html: string | null;
}

export type InboxMessageInsert = Omit<
  InboxMessageRow,
  | "id"
  | "created_at"
  | "read_at"
  | "archived_at"
  | "metadata"
  | "mail_connection_id"
  | "direction"
  | "external_from"
  | "external_from_name"
  | "external_to"
  | "external_cc"
  | "external_message_id"
  | "external_in_reply_to"
  | "external_references"
  | "mail_thread_id"
  | "imap_uid"
  | "body_html"
> & {
  metadata?: Record<string, unknown>;
  mail_connection_id?: string | null;
  direction?: InboxMessageDirection;
  external_from?: string | null;
  external_from_name?: string | null;
  external_to?: string[] | null;
  external_cc?: string[] | null;
  external_message_id?: string | null;
  external_in_reply_to?: string | null;
  external_references?: string[] | null;
  mail_thread_id?: string | null;
  imap_uid?: number | null;
  body_html?: string | null;
};

export type InboxMessageUpdate = Partial<InboxMessageInsert> & {
  read_at?: string | null;
  archived_at?: string | null;
};

/* ── Mail connection (IMAP/SMTP) ────────────────────────────────────── */

export type MailProvider = "zoho" | "gmail" | "outlook" | "yahoo" | "custom";
export type MailConnectionStatus = "active" | "disabled" | "error";

/** One connected external mailbox per account. The `password_encrypted`
 *  field is deliberately excluded from the default `Row` shape — it's
 *  server-only and never sent to the browser. The sync service reads
 *  it through a privileged server helper that explicitly selects it. */
export interface MailConnectionRow {
  id: string;
  account_id: string;
  display_name: string;
  email_address: string;
  provider: MailProvider;

  imap_host: string;
  imap_port: number;
  imap_secure: boolean;
  imap_username: string;

  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_username: string;

  last_uid: number | null;
  last_sync_at: string | null;
  last_error: string | null;
  status: MailConnectionStatus;

  created_at: string;
  updated_at: string;
}

/** Shape used only by the server-side IMAP/SMTP helpers. Adds the
 *  encrypted password blob that the rest of the app must never see. */
export interface MailConnectionWithSecret extends MailConnectionRow {
  password_encrypted: string;
}

export type MailConnectionInsert = Omit<
  MailConnectionRow,
  "id" | "created_at" | "updated_at" | "last_uid" | "last_sync_at" | "last_error" | "status"
> & {
  password_encrypted: string;
  status?: MailConnectionStatus;
};

export type MailConnectionUpdate = Partial<
  Omit<MailConnectionInsert, "account_id">
> & {
  last_uid?: number | null;
  last_sync_at?: string | null;
  last_error?: string | null;
  status?: MailConnectionStatus;
};

/** Joined view used by the bell dropdown + inbox list — includes the
 *  sender's display info so we don't have to round-trip for each row. */
export interface InboxMessageWithSender extends InboxMessageRow {
  sender: {
    id: string;
    username: string;
    avatar_url: string | null;
    full_name: string | null;
    name_alt?: string | null;
  } | null;
}

/* ── Discuss (chat system) ───────────────────────────────────────────
   Mirrors supabase/migrations/create_discuss_chat_system.sql. Every
   table there has a matching Row / Insert / Update trio here, plus a
   few "joined" view types for the common read patterns (sidebar list,
   message with author, etc.). Kept colocated with the Inbox types
   because chat evolved as the real-time counterpart to the static
   inbox — both read from accounts/people for user info. */

export type DiscussChannelKind = "direct" | "group" | "channel" | "customer";

export interface DiscussChannelRow {
  id: string;
  kind: DiscussChannelKind;
  name: string | null;
  description: string | null;
  icon: string | null;
  color: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  last_message_at: string;
  /** For Phase E customer-chat channels only: FK to the CRM contact
   *  this chat is bound to. NULL for every internal channel. */
  linked_contact_id: string | null;
}

export type DiscussChannelInsert = Omit<
  DiscussChannelRow,
  "id" | "created_at" | "updated_at" | "archived_at" | "last_message_at"
> & {
  id?: string;
  last_message_at?: string;
};

export type DiscussChannelUpdate = Partial<
  Omit<DiscussChannelRow, "id" | "created_at">
>;

export type DiscussMemberRole = "admin" | "member" | "guest";
export type DiscussNotificationPref = "all" | "mentions" | "none";

export interface DiscussMemberRow {
  id: string;
  channel_id: string;
  account_id: string;
  role: DiscussMemberRole;
  last_read_at: string;
  notification_pref: DiscussNotificationPref;
  muted: boolean;
  joined_at: string;
  left_at: string | null;
}

export type DiscussMemberInsert = Omit<
  DiscussMemberRow,
  "id" | "joined_at" | "last_read_at" | "left_at"
> & {
  last_read_at?: string;
  notification_pref?: DiscussNotificationPref;
  muted?: boolean;
};

export type DiscussMemberUpdate = Partial<
  Omit<DiscussMemberRow, "id" | "channel_id" | "account_id">
>;

export type DiscussMessageKind = "text" | "image" | "file" | "voice" | "system";

/** Structured attachment record stored in `discuss_messages.metadata.attachments`.
 *  Mirrors InboxAttachment shape so we can share picker UI components. */
export interface DiscussAttachment {
  name: string;
  /** @deprecated LEGACY ONLY — a PUBLIC Supabase Storage URL written before
   *  Unit 2. Present on old rows; NEVER written by new uploads. It MUST NOT be
   *  rendered, linked, or fetched: the ONLY consumer is the server-side
   *  resolver (src/lib/server/discuss-media.ts), which maps it back to an
   *  object path. Delivery goes through the authorized first-party route built
   *  by discussAttachmentUrl(messageId, index).
   *  Optional so new uploads can simply omit it. */
  url?: string;
  /** Bucket-relative object path in the private `discuss-media` bucket. */
  file_path: string;
  size: number;
  type: string;
  /** Client-only, never persisted and never sent to another user: an
   *  object: URL for the SENDER's local preview while a message is still
   *  pending (no canonical id yet ⇒ no protected URL yet). Revoked on
   *  reconcile/unmount. */
  local_preview_url?: string | null;
}

/** Product reference stored in `discuss_messages.metadata.products`.
 *  Same shape as InboxProductRef — keeps rendering components reusable. */
export interface DiscussProductRef {
  id: string;
  name: string;
  slug: string;
  image: string | null;
}

/** Mention record stored in `discuss_messages.metadata.mentions`.
 *  `offset` + `length` let us highlight the mention span inside the
 *  rendered body without re-parsing markdown on every render. */
export interface DiscussMention {
  account_id: string;
  username: string;
  offset: number;
  length: number;
}

/** Voice-note payload stored in `discuss_messages.metadata.voice`.
 *  `waveform` is a downsampled amplitude array (usually 48–64 bars)
 *  rendered as a mini visualizer next to the play button.
 *
 *  Legacy voice notes carry `url` pointing into the public media bucket
 *  (those first 5 recordings — still public). New recordings are
 *  uploaded to the PRIVATE `discuss-voice` bucket and carry
 *  `bucket` + `path` instead — playback mints a signed URL on demand. */
export interface DiscussVoiceMeta {
  /** @deprecated LEGACY ONLY — a PUBLIC Supabase Storage URL on pre-Unit-2
   *  rows. Never written by new uploads; read ONLY by the server-side resolver
   *  to recover the object path. Must never be rendered or fetched. */
  url?: string;
  /** Storage bucket — `discuss-voice` (private) for everything new. */
  bucket?: string;
  /** Bucket-relative object path. */
  path?: string;
  /** MIME type as recorded (iOS Safari yields audio/mp4, Chrome audio/webm). */
  type?: string;
  size?: number;
  duration_ms: number;
  waveform: number[];
}

/** Unfurled OpenGraph preview stored in `discuss_messages.metadata.link_preview`. */
export interface DiscussLinkPreview {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  site_name: string | null;
}

/** Strongly-typed view over the JSONB `metadata` column. All fields are
 *  optional because any given message will only carry the subset
 *  relevant to its kind — a text message never has `voice`, an image
 *  message might not have `products`, etc. */
/** Client-safe media item — the ONLY media shape the browser ever sees.
 *  Produced by sanitizeDiscussMedia() server-side. Carries display fields and
 *  a canonical index; deliberately has no url / path / bucket, so it cannot
 *  locate an object. Access goes through discussAttachmentUrl(id, index). */
export interface DiscussMediaPublic {
  index: number;
  name: string;
  type: string;
  size: number;
  kind: "attachment" | "voice";
  duration_ms?: number;
  waveform?: number[];
  /** A voice note's converted text ("Convert to text") — display data only,
   *  never an object location. */
  transcript?: { text: string; lang: string | null };
}

export interface DiscussMessageMetadata {
  /** WIRE-UP ONLY: the shape the CLIENT SENDS when posting a message (carries
   *  the private file_path so the server can locate the object). It is never
   *  present on a message the server returns — read `media` instead. */
  attachments?: DiscussAttachment[];
  products?: DiscussProductRef[];
  mentions?: DiscussMention[];
  /** WIRE-UP ONLY, same as `attachments`. Never returned to the browser. */
  voice?: DiscussVoiceMeta;
  link_preview?: DiscussLinkPreview;
  /** CLIENT-SAFE media, canonical order. Present on every message returned by
   *  the server and on optimistic bubbles the client builds itself. */
  media?: DiscussMediaPublic[];
  [key: string]: unknown;
}

export interface DiscussMessageRow {
  id: string;
  channel_id: string;
  author_account_id: string | null;
  reply_to_message_id: string | null;
  kind: DiscussMessageKind;
  body: string | null;
  body_html: string | null;
  metadata: DiscussMessageMetadata;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
  /** Client-generated idempotency key for one logical send attempt. NULL on
      legacy rows (pre-migration) and for clients that omit it. Uniqueness is
      enforced per-channel by the partial unique index
      discuss_messages_channel_client_msg_id_key. See
      docs/performance/DISCUSS_MESSAGE_LIFECYCLE.md. */
  client_msg_id: string | null;
}

export type DiscussMessageInsert = Omit<
  DiscussMessageRow,
  "id" | "created_at" | "edited_at" | "deleted_at" | "body_html"
> & {
  body_html?: string | null;
  metadata?: DiscussMessageMetadata;
};

export type DiscussMessageUpdate = Partial<
  Omit<DiscussMessageRow, "id" | "channel_id" | "created_at">
>;

export interface DiscussReactionRow {
  id: string;
  message_id: string;
  account_id: string;
  emoji: string;
  created_at: string;
}

export type DiscussReactionInsert = Omit<DiscussReactionRow, "id" | "created_at">;

export interface DiscussPinnedRow {
  id: string;
  channel_id: string;
  message_id: string;
  pinned_by: string | null;
  pinned_at: string;
}

export type DiscussPinnedInsert = Omit<DiscussPinnedRow, "id" | "pinned_at">;

export interface DiscussStarredRow {
  id: string;
  account_id: string;
  message_id: string;
  starred_at: string;
}

export type DiscussStarredInsert = Omit<DiscussStarredRow, "id" | "starred_at">;

/** The DB row. SERVER-SIDE ONLY — `metadata` is where a storage reference
 *  would live, so this shape must never be returned to a browser. Read paths
 *  return DiscussDraftPublic via serializeDiscussDraftForClient(). */
export interface DiscussDraftRow {
  id: string;
  account_id: string;
  channel_id: string;
  body: string;
  metadata: DiscussMessageMetadata;
  updated_at: string;
}

/** What `state/draft` and `allDrafts` actually return. No id/account_id (the
 *  draft is identified by (session account, channel)), and no `metadata`.
 *  `media` is always [] today — drafts store text only — and exists so the
 *  composer has a stable shape if draft attachments are ever added. */
export interface DiscussDraftPublic {
  channel_id: string;
  body: string;
  updated_at: string;
  media: DiscussMediaPublic[];
  channel?: DiscussChannelRow | null;
}

export type DiscussDraftInsert = Omit<DiscussDraftRow, "id" | "updated_at">;
export type DiscussDraftUpdate = Partial<Omit<DiscussDraftRow, "id" | "account_id" | "channel_id">>;

/* ── Joined / denormalized view types ───────────────────────────── */

/** Short author block attached to a message for render. Matches the
 *  InboxMessageWithSender.sender shape so the same avatar helpers work. */
export interface DiscussAuthor {
  id: string;
  username: string;
  avatar_url: string | null;
  full_name: string | null;
  /** Native/alternate name (people.name_alt), e.g. a Chinese name. */
  name_alt?: string | null;
}

/** Compact preview of a replied-to message, embedded inside a
 *  DiscussMessageWithAuthor when `reply_to_message_id` is populated.
 *  We denormalize the author username + a trimmed body snippet so
 *  the bubble can render the "Replying to X" header without a second
 *  round-trip fetch. */
export interface DiscussReplyPreview {
  id: string;
  body: string | null;
  author_username: string | null;
  author_full_name: string | null;
  kind: DiscussMessageKind;
  deleted_at: string | null;
}

export interface DiscussMessageWithAuthor extends DiscussMessageRow {
  author: DiscussAuthor | null;
  /** Aggregated reactions, grouped by emoji, populated by the data
   *  layer when fetching a message. The UI never groups raw rows. */
  reactions: Array<{
    emoji: string;
    count: number;
    account_ids: string[];
    reacted_by_me: boolean;
  }>;
  /** Populated when the message is a reply-with-quote. */
  reply_preview?: DiscussReplyPreview | null;
  /** Populated when the message has a thread of replies.
   *  Lightweight — just the count and latest reply timestamp so the
   *  "X replies" chip can render without loading the thread itself. */
  thread?: {
    reply_count: number;
    last_reply_at: string | null;
    participant_ids: string[];
  } | null;
}

/** Lightweight CRM contact block attached to a customer-chat channel.
 *  Populated in the sidebar + details pane so we can render the
 *  customer's name, company, and avatar without a second query. */
export interface DiscussLinkedContact {
  id: string;
  display_name: string;
  full_name: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  contact_type: string | null;
}

/** Sidebar channel row — enriched with the current user's read state,
 *  the other member (for DMs), and a snippet of the last message so
 *  the list looks like Slack/WhatsApp right out of the box. */
export interface DiscussChannelWithState extends DiscussChannelRow {
  unread_count: number;
  last_read_at: string | null;
  muted: boolean;
  notification_pref: DiscussNotificationPref;
  /** WeChat-style per-user conversation state (sidebar right-click menu).
   *  `pinned` floats the row to the top of its group; `marked_unread` shows
   *  an unread dot even when there are no new messages. */
  pinned?: boolean;
  pinned_at?: string | null;
  marked_unread?: boolean;
  /** For direct channels, the OTHER account (not the current user).
   *  Null for group/channel kinds. */
  other: DiscussAuthor | null;
  /** For customer-chat channels, the linked CRM contact. NULL for
   *  every internal channel. */
  linked_contact: DiscussLinkedContact | null;
  /** Short preview of the most recent message. */
  last_message: {
    id: string;
    body: string | null;
    kind: DiscussMessageKind;
    author_username: string | null;
    created_at: string;
  } | null;
  /** True when the current user has a non-empty draft saved for
   *  this channel — surfaced so the sidebar can show a draft badge
   *  and the Drafts section can pull it straight from the sidebar
   *  query without a second round-trip. */
  has_draft?: boolean;
}

/** Row returned by the full-text search RPC — a message plus the
 *  channel it lives in so the search panel can group results. */
export interface DiscussSearchResult {
  message_id: string;
  channel_id: string;
  channel_name: string | null;
  channel_kind: DiscussChannelKind;
  author_username: string | null;
  author_full_name: string | null;
  author_avatar_url: string | null;
  body: string | null;
  /** ts_headline()-highlighted snippet with <mark> tags. */
  snippet: string;
  created_at: string;
  rank: number;
}

/* ── Database schema type for createClient<Database> ── */

/* ── Hand-written extras, continued (CRM, todo and inbox shapes that lived
   AFTER the stale Database block in the pre-generation file) ── */

/* ─── CRM ─────────────────────────────────────────────────────────────── */

/** A column in the CRM pipeline kanban. Sorted by `sequence`; `is_won`
 *  flags the terminal won column; `fold` collapses the column. */
export interface CrmStageRow {
  id: string;
  name: string;
  sequence: number;
  is_won: boolean;
  fold: boolean;
  created_at: string;
}
export type CrmStageInsert = Omit<CrmStageRow, "id" | "created_at"> & {
  id?: string;
};
export type CrmStageUpdate = Partial<CrmStageInsert>;

/** A single deal moving through the pipeline. Mirrors Odoo's
 *  crm.lead model — both leads (unqualified) and opportunities live in
 *  the same table, distinguished by stage. `contact_id` links to the
 *  shared contacts book; `company_name` / `contact_name` are
 *  denormalized so brand-new prospects can be created without first
 *  going through the contacts app. */
export interface CrmOpportunityRow {
  id: string;
  name: string;
  description: string | null;
  stage_id: string | null;

  contact_id: string | null;
  company_name: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;

  expected_revenue: number;
  probability: number;
  expected_close_date: string | null;

  priority: number;
  source: string | null;
  tags: string[];
  color: number;

  owner_account_id: string | null;

  lost_reason: string | null;
  won_at: string | null;
  lost_at: string | null;
  archived_at: string | null;

  created_at: string;
  updated_at: string;
}
export type CrmOpportunityInsert = Omit<
  CrmOpportunityRow,
  "id" | "created_at" | "updated_at"
> & {
  id?: string;
};
export type CrmOpportunityUpdate = Partial<CrmOpportunityInsert>;

/** Lightweight to-do attached to an opportunity. Type drives the icon
 *  the CRM card renders next to the activity row. */
export type CrmActivityType = "call" | "meeting" | "task" | "email" | "note";

export interface CrmActivityRow {
  id: string;
  opportunity_id: string;
  type: CrmActivityType;
  title: string;
  notes: string | null;
  due_at: string | null;
  done_at: string | null;
  assignee_account_id: string | null;
  created_by_account_id: string | null;
  created_at: string;
}
export type CrmActivityInsert = Omit<CrmActivityRow, "id" | "created_at"> & {
  id?: string;
};
export type CrmActivityUpdate = Partial<CrmActivityInsert>;

/** Opportunity row enriched with the related stage / contact / owner /
 *  next-activity data the UI needs to render a card without a second
 *  round-trip. The data layer in `lib/crm.ts` builds this. */
export interface CrmOpportunityWithRelations extends CrmOpportunityRow {
  stage: CrmStageRow | null;
  owner: {
    id: string;
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
  contact: {
    id: string;
    display_name: string;
    company: string | null;
    country: string | null;
    country_code: string | null;
  } | null;
  next_activity: CrmActivityRow | null;
  activities_overdue: number;
  activities_pending: number;
}

/* ─── To-do System ───────────────────────────────────────────────────── */

/** "report": made from a line of a report (Reports 6A — source_id = the report). */
export type TodoSource = "manual" | "crm" | "calendar" | "report";
export type TodoPriority = "high" | "medium" | "low";

/** Workflow stage for a task (Phase 2). */
export type TodoStatus = "todo" | "in_progress" | "blocked" | "done";
/** Phase C: recurring-task cadence. null = a one-off task. */
export type TodoRecurrence = "daily" | "weekly" | "monthly" | null;
export interface TodoRow {
  id: string;
  title: string;
  description: string | null;
  completed: boolean;
  priority: TodoPriority;
  label: string | null;
  due_date: string | null;
  /** Phase 2: when work should begin. */
  start_date: string | null;
  /** Phase 2: when to fire a reminder (ISO timestamptz). */
  remind_at: string | null;
  /** Phase 2: workflow stage; kept in sync with `completed`. */
  status: TodoStatus;
  /** Phase C: recurrence cadence. null = one-off task. On the template row
      this is set; spawned instances carry null (they are plain tasks). */
  recurrence: TodoRecurrence;
  /** Phase C: on a spawned instance, points back to the recurring template. */
  recurrence_parent_id: string | null;
  /** Phase C: the period-start date this instance was generated for (dedup). */
  recurrence_spawned_for: string | null;
  /** Phase C: optional last date to keep spawning (inclusive). */
  recurrence_until: string | null;
  /** Approval loop: null = no approval needed; 'pending' = assignee marked
      done, awaiting manager; 'approved' = confirmed; 'rejected' = reopened. */
  approval_state: "pending" | "approved" | "rejected" | null;
  approved_by_account_id: string | null;
  approved_at: string | null;
  created_by_account_id: string | null;
  assigned_by_account_id: string | null;
  source: TodoSource;
  source_id: string | null;
  assigned_department: string | null;
  assign_to_all: boolean;
  /** Visible only to the creator and can_view_private roles. */
  is_private: boolean;
  tenant_id: string | null;
  /** When the reminder cron last fired for the current remind_at. */
  reminded_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  /* Free-form bag for task extras: file attachments, @mentioned accounts,
     and referenced products. All optional / future-safe. */
  metadata: TodoMetadata;
}
/** A file/screenshot attached to a task (stored in the public todo-attachments bucket). */
export interface TodoAttachment {
  path: string;
  url: string;
  name: string;
  type: string;
  size: number;
}
/** An account mentioned on a task. */
export interface TodoMention {
  account_id: string;
  username?: string | null;
  full_name?: string | null;
}
/** A product referenced on a task. */
export interface TodoProductRef {
  id: string;
  name: string;
  code?: string | null;
}
/** A single checklist/subtask item on a task. */
export interface TodoChecklistItem {
  id: string;
  text: string;
  done: boolean;
}
export interface TodoMetadata {
  attachments?: TodoAttachment[];
  project?: { id: string; name: string } | null;
  mentions?: TodoMention[];
  /* Observers: follow the task and may update its situation (status),
     but their "done" still needs the assigner's confirmation. */
  observers?: TodoMention[];
  products?: TodoProductRef[];
  checklist?: TodoChecklistItem[];
  [key: string]: unknown;
}
export type TodoInsert = Omit<TodoRow, "id" | "created_at" | "updated_at" | "completed_at" | "reminded_at">;
export type TodoUpdate = Partial<TodoInsert> & { completed_at?: string | null };

export interface TodoAssigneeRow {
  id: string;
  todo_id: string;
  account_id: string;
  assigned_at: string;
}
export type TodoAssigneeInsert = Omit<TodoAssigneeRow, "id" | "assigned_at">;

export interface TodoNoteRow {
  id: string;
  todo_id: string;
  author_account_id: string;
  body: string;
  created_at: string;
  updated_at: string;
}
export type TodoNoteInsert = Omit<TodoNoteRow, "id" | "created_at" | "updated_at">;

export interface TodoLabelRow {
  id: string;
  name: string;
  color: string | null;
  tenant_id: string | null;
  created_at: string;
}
export type TodoLabelInsert = Omit<TodoLabelRow, "id" | "created_at">;

/** Assignee info resolved via accounts → people + koleex_employees */
export interface TodoAssigneeInfo {
  account_id: string;
  username: string;
  full_name: string | null;
  name_alt?: string | null;
  avatar_url: string | null;
  department: string | null;
  position: string | null;
}

/** Full todo with resolved relations for display */
export interface TodoWithRelations extends TodoRow {
  assignees: TodoAssigneeInfo[];
  assigner: {
    account_id: string;
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
  notes: (TodoNoteRow & {
    author_username: string;
    author_full_name: string | null;
    author_avatar_url: string | null;
  })[];
  /** Derived (not a column): the cadence of the series this row belongs to.
      On a template it equals `recurrence`; on a spawned instance it is the
      PARENT's cadence, so the UI can badge an instance as recurring even
      though its own `recurrence` is null. */
  series_cadence?: TodoRecurrence;
  /** Derived (not a column): which period of the series this row IS, as
      YYYY-MM-DD. Instances carry `recurrence_spawned_for`; the template is
      its own first period, so it falls back to start_date/created_at. Used to
      tell two occurrences of the same recurring task apart in the list. */
  series_period?: string | null;
}

/* ════════════════════════════════════════════════════════════════════════
   HR SYSTEM TYPES
   ════════════════════════════════════════════════════════════════════════ */

/* ── Leave Management ── */
export interface LeaveTypeRow {
  id: string;
  name: string;
  code: string;
  default_days: number;
  carry_over: boolean;
  requires_doc: boolean;
  is_paid: boolean;
  color: string;
  is_active: boolean;
  created_at: string;
}
export type LeaveTypeInsert = Omit<LeaveTypeRow, "id" | "created_at">;

export interface LeaveBalanceRow {
  id: string;
  employee_id: string;
  leave_type_id: string;
  year: number;
  entitled: number;
  used: number;
  carried_over: number;
  adjustment: number;
  created_at: string;
  updated_at: string;
}
export type LeaveBalanceInsert = Omit<LeaveBalanceRow, "id" | "created_at" | "updated_at">;

/** Phase B: `manager_approved` = the direct manager said yes, HR has not yet. */
export type LeaveRequestStatus = "pending" | "manager_approved" | "approved" | "rejected" | "cancelled";

export interface LeaveRequestRow {
  id: string;
  employee_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  days: number;
  half_day: boolean;
  reason: string | null;
  status: LeaveRequestStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  attachment_url: string | null;
  /* ── Request detail (migration hr_leave_request_details, all nullable) ── */
  /** How to reach them while away, and where they will be. */
  contact_phone: string | null;
  contact_address: string | null;
  destination: string | null;
  /** Who covers the work. FK → koleex_employees, ON DELETE SET NULL. */
  handover_to: string | null;
  handover_notes: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  /** "morning" | "afternoon" — only meaningful when half_day is true.
      CHECK-constrained in the DB, so don't widen this without a migration. */
  half_day_period: string | null;
  /** Who filed it — self-service vs HR acting on someone's behalf. */
  requested_by: string | null;
  /* ── Phase B: the manager's step (migration 20260920_leave_manager_review) ── */
  manager_reviewed_by: string | null;
  manager_reviewed_at: string | null;
  manager_notes: string | null;
  created_at: string;
  updated_at: string;
}
export type LeaveRequestInsert = Omit<LeaveRequestRow, "id" | "created_at" | "updated_at" | "manager_reviewed_by" | "manager_reviewed_at" | "manager_notes">;

/** The optional detail block. Every field is nullable in the DB, so callers
 *  may omit the whole thing — used to keep createLeaveRequest's signature
 *  from demanding nine nulls at every call site. */
export type LeaveRequestDetails = Pick<
  LeaveRequestRow,
  | "contact_phone"
  | "contact_address"
  | "destination"
  | "handover_to"
  | "handover_notes"
  | "emergency_contact_name"
  | "emergency_contact_phone"
  | "half_day_period"
  | "requested_by"
>;

/* ── Attendance ── */
export interface AttendancePolicyRow {
  id: string;
  name: string;
  /** Phase C: ISO alpha-2 the policy applies to; null = default. */
  country: string | null;
  /** IANA zone in which work_start / work_end are read. */
  timezone: string;
  work_start: string;
  work_end: string;
  late_threshold_min: number;
  min_hours: number;
  weekend_days: string[];
  is_default: boolean;
  /** Phase 1: first day attendance counts (ISO date); null = not started. */
  tracking_from: string | null;
  created_at: string;
}

export type AttendanceStatus = "present" | "absent" | "late" | "half_day" | "holiday" | "weekend";

export interface AttendanceRecordRow {
  id: string;
  employee_id: string;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  break_minutes: number;
  total_hours: number | null;
  status: AttendanceStatus;
  source: string;
  notes: string | null;
  /** Phase 1 flags: punched from outside the office / closed by the nightly job / changed by HR or an approved request. */
  remote?: boolean;
  auto_closed?: boolean;
  corrected?: boolean;
  created_at: string;
  updated_at: string;
}
export type AttendanceRecordInsert = Omit<AttendanceRecordRow, "id" | "created_at" | "updated_at">;

/* ── Recruitment ── */
export type JobPostingStatus = "draft" | "open" | "paused" | "closed" | "filled";

export interface JobPostingRow {
  id: string;
  title: string;
  department_id: string | null;
  position_id: string | null;
  description: string | null;
  requirements: string | null;
  location: string | null;
  employment_type: string;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string;
  status: JobPostingStatus;
  published_at: string | null;
  closes_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
export type JobPostingInsert = Omit<JobPostingRow, "id" | "created_at" | "updated_at">;

export type ApplicantStage = "new" | "screening" | "interview" | "offer" | "hired" | "rejected";

export interface ApplicantRow {
  id: string;
  job_posting_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  resume_url: string | null;
  cover_letter: string | null;
  source: string | null;
  stage: ApplicantStage;
  rating: number | null;
  notes: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}
export type ApplicantInsert = Omit<ApplicantRow, "id" | "created_at" | "updated_at">;

export interface InterviewRoundRow {
  id: string;
  applicant_id: string;
  round_number: number;
  interviewer_id: string | null;
  scheduled_at: string | null;
  duration_min: number;
  location: string | null;
  status: string;
  feedback: string | null;
  score: number | null;
  created_at: string;
}

/* ── Appraisals ── */
export interface AppraisalCycleRow {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
  /** What the cycle is for, and how it should be scored. Added after the
   *  first version shipped with only a name and two dates. */
  description: string | null;
  notes: string | null;
  created_at: string;
}
export type AppraisalCycleInsert = Omit<AppraisalCycleRow, "id" | "created_at">;

export interface AppraisalRow {
  id: string;
  cycle_id: string;
  employee_id: string;
  reviewer_id: string | null;
  self_rating: number | null;
  reviewer_rating: number | null;
  self_comments: string | null;
  reviewer_comments: string | null;
  goals_met: string | null;
  strengths: string | null;
  improvements: string | null;
  overall_score: number | null;
  status: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}
export type AppraisalInsert = Omit<AppraisalRow, "id" | "created_at" | "updated_at">;

export interface GoalRow {
  id: string;
  employee_id: string;
  appraisal_id: string | null;
  title: string;
  description: string | null;
  target_value: string | null;
  actual_value: string | null;
  weight: number;
  progress: number;
  status: string;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}
export type GoalInsert = Omit<GoalRow, "id" | "created_at" | "updated_at">;

/* ── Onboarding / Offboarding ── */
export interface ChecklistRow {
  id: string;
  name: string;
  type: "onboarding" | "offboarding";
  department_id: string | null;
  items: { title: string; assignee_role: string; due_days: number }[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
export type ChecklistInsert = Omit<ChecklistRow, "id" | "created_at" | "updated_at">;

export interface ChecklistInstanceRow {
  id: string;
  checklist_id: string;
  employee_id: string;
  start_date: string;
  status: string;
  items_status: { item_index: number; completed: boolean; completed_by?: string; completed_at?: string; notes?: string }[];
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}
export type ChecklistInstanceInsert = Omit<ChecklistInstanceRow, "id" | "created_at" | "updated_at">;

/* ── Payroll ── */
export interface SalaryRecordRow {
  id: string;
  employee_id: string;
  base_salary: number;
  currency: string;
  pay_frequency: string;
  effective_from: string;
  effective_to: string | null;
  allowances: Record<string, number>;
  deductions: Record<string, number>;
  notes: string | null;
  created_at: string;
}
export type SalaryRecordInsert = Omit<SalaryRecordRow, "id" | "created_at">;

export interface PayslipRow {
  id: string;
  employee_id: string;
  salary_record_id: string | null;
  period_start: string;
  period_end: string;
  gross_amount: number | null;
  deductions: Record<string, number>;
  net_amount: number | null;
  status: string;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
}
export type PayslipInsert = Omit<PayslipRow, "id" | "created_at">;

/* ── Training ── */
export interface CourseRow {
  id: string;
  name: string;
  description: string | null;
  provider: string | null;
  duration_hours: number | null;
  is_mandatory: boolean;
  department_id: string | null;
  is_active: boolean;
  created_at: string;
}
export type CourseInsert = Omit<CourseRow, "id" | "created_at">;

export interface TrainingRecordRow {
  id: string;
  employee_id: string;
  course_id: string;
  status: string;
  enrolled_at: string;
  completed_at: string | null;
  expiry_date: string | null;
  certificate_url: string | null;
  score: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
export type TrainingRecordInsert = Omit<TrainingRecordRow, "id" | "created_at" | "updated_at">;

/* ── HR Documents ── */
export interface HrDocumentRow {
  id: string;
  employee_id: string;
  name: string;
  category: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  expiry_date: string | null;
  reminder_days: number;
  notes: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}
export type HrDocumentInsert = Omit<HrDocumentRow, "id" | "created_at" | "updated_at">;

/* Phase 2A S2b — login_attempts (rate-limiting / brute-force). Additive table;
   not wired into any code yet (recording = S2c, enforcement = S2d). */
export type LoginAttemptOutcome =
  | "success"
  | "failure"
  | "blocked"
  | "disabled"
  | "unknown_user";

export interface LoginAttemptRow {
  id: string;
  tenant_id: string | null;
  account_id: string | null;
  identifier: string;
  identifier_hash: string | null;
  ip_address: string;
  user_agent: string | null;
  outcome: LoginAttemptOutcome;
  reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}
export type LoginAttemptInsert = Omit<LoginAttemptRow, "id" | "created_at">;
