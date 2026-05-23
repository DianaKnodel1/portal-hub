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
      activity_log: {
        Row: {
          action: string
          actor_id: string
          comment: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          new_status: string | null
          old_status: string | null
        }
        Insert: {
          action: string
          actor_id: string
          comment?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          new_status?: string | null
          old_status?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          comment?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          new_status?: string | null
          old_status?: string | null
        }
        Relationships: []
      }
      admin_notes: {
        Row: {
          content: string
          created_at: string
          created_by: string
          id: string
          profile_user_id: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          created_by: string
          id?: string
          profile_user_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          profile_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      applications: {
        Row: {
          address: string | null
          birth_date: string | null
          birth_place: string | null
          city: string | null
          created_at: string
          email: string
          first_name: string | null
          full_name: string
          id: string
          last_name: string | null
          message: string | null
          nationality: string | null
          phone: string | null
          postal_code: string | null
          status: string
          tenant_id: string | null
        }
        Insert: {
          address?: string | null
          birth_date?: string | null
          birth_place?: string | null
          city?: string | null
          created_at?: string
          email: string
          first_name?: string | null
          full_name: string
          id?: string
          last_name?: string | null
          message?: string | null
          nationality?: string | null
          phone?: string | null
          postal_code?: string | null
          status?: string
          tenant_id?: string | null
        }
        Update: {
          address?: string | null
          birth_date?: string | null
          birth_place?: string | null
          city?: string | null
          created_at?: string
          email?: string
          first_name?: string | null
          full_name?: string
          id?: string
          last_name?: string | null
          message?: string | null
          nationality?: string | null
          phone?: string | null
          postal_code?: string | null
          status?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "applications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_limits: {
        Row: {
          daily_limit: number
          employment_type: Database["public"]["Enums"]["employment_type"]
          min_pause_days: number
          monthly_limit: number | null
          updated_at: string
        }
        Insert: {
          daily_limit?: number
          employment_type: Database["public"]["Enums"]["employment_type"]
          min_pause_days?: number
          monthly_limit?: number | null
          updated_at?: string
        }
        Update: {
          daily_limit?: number
          employment_type?: Database["public"]["Enums"]["employment_type"]
          min_pause_days?: number
          monthly_limit?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      bookings: {
        Row: {
          admin_override: boolean
          assignment_id: string | null
          booking_date: string | null
          booking_time: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          cancelled_by_role: string | null
          created_at: string
          id: string
          status: Database["public"]["Enums"]["booking_status"]
          time_slot_id: string | null
          user_id: string
        }
        Insert: {
          admin_override?: boolean
          assignment_id?: string | null
          booking_date?: string | null
          booking_time?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cancelled_by_role?: string | null
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["booking_status"]
          time_slot_id?: string | null
          user_id: string
        }
        Update: {
          admin_override?: boolean
          assignment_id?: string | null
          booking_date?: string | null
          booking_time?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cancelled_by_role?: string | null
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["booking_status"]
          time_slot_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "task_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_time_slot_id_fkey"
            columns: ["time_slot_id"]
            isOneToOne: false
            referencedRelation: "time_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_conversations: {
        Row: {
          created_at: string
          escalated_at: string | null
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          escalated_at?: string | null
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          escalated_at?: string | null
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          conversation_id: string | null
          created_at: string
          id: string
          is_ai: boolean
          message: string
          read: boolean
          receiver_id: string
          sender_id: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          id?: string
          is_ai?: boolean
          message: string
          read?: boolean
          receiver_id: string
          sender_id: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          id?: string
          is_ai?: boolean
          message?: string
          read?: boolean
          receiver_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_templates: {
        Row: {
          body_html: string
          content: string
          created_at: string
          employment_type: Database["public"]["Enums"]["employment_type"]
          id: string
          is_active: boolean
          tenant_id: string
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          body_html?: string
          content?: string
          created_at?: string
          employment_type: Database["public"]["Enums"]["employment_type"]
          id?: string
          is_active?: boolean
          tenant_id: string
          title?: string
          updated_at?: string
          version?: number
        }
        Update: {
          body_html?: string
          content?: string
          created_at?: string
          employment_type?: Database["public"]["Enums"]["employment_type"]
          id?: string
          is_active?: boolean
          tenant_id?: string
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "contract_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          company_signature_url: string | null
          created_at: string
          employment_type: Database["public"]["Enums"]["employment_type"]
          generated_content: string
          id: string
          metadata: Json | null
          pdf_url: string | null
          signature_image_url: string | null
          signed_at: string
          signed_name: string
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          company_signature_url?: string | null
          created_at?: string
          employment_type: Database["public"]["Enums"]["employment_type"]
          generated_content: string
          id?: string
          metadata?: Json | null
          pdf_url?: string | null
          signature_image_url?: string | null
          signed_at?: string
          signed_name: string
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          company_signature_url?: string | null
          created_at?: string
          employment_type?: Database["public"]["Enums"]["employment_type"]
          generated_content?: string
          id?: string
          metadata?: Json | null
          pdf_url?: string | null
          signature_image_url?: string | null
          signed_at?: string
          signed_name?: string
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          category: Database["public"]["Enums"]["document_category"]
          created_at: string
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          mime_type: string | null
          notes: string | null
          status: Database["public"]["Enums"]["document_status"]
          tenant_id: string | null
          updated_at: string
          uploaded_by: string
          user_id: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["document_category"]
          created_at?: string
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          mime_type?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          tenant_id?: string | null
          updated_at?: string
          uploaded_by: string
          user_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["document_category"]
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          mime_type?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          tenant_id?: string | null
          updated_at?: string
          uploaded_by?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id: string
          metadata?: Json | null
          recipient_email: string
          status?: string
          template_name?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string | null
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          rate_limited_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          rate_limited_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          rate_limited_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used: boolean
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token?: string
          used?: boolean
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used?: boolean
        }
        Relationships: []
      }
      invitation_tokens: {
        Row: {
          application_id: string | null
          created_at: string
          email: string
          id: string
          tenant_id: string
          token: string
          used: boolean
          used_at: string | null
        }
        Insert: {
          application_id?: string | null
          created_at?: string
          email: string
          id?: string
          tenant_id: string
          token?: string
          used?: boolean
          used_at?: string | null
        }
        Update: {
          application_id?: string | null
          created_at?: string
          email?: string
          id?: string
          tenant_id?: string
          token?: string
          used?: boolean
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invitation_tokens_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitation_tokens_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitation_tokens_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      kyc_verifications: {
        Row: {
          created_at: string
          id: string
          id_back_url: string | null
          id_front_url: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          risk_flag: boolean
          selfie_url: string | null
          status: Database["public"]["Enums"]["kyc_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          id_back_url?: string | null
          id_front_url?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_flag?: boolean
          selfie_url?: string | null
          status?: Database["public"]["Enums"]["kyc_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          id_back_url?: string | null
          id_front_url?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_flag?: boolean
          selfie_url?: string | null
          status?: Database["public"]["Enums"]["kyc_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          admin_notes: string | null
          application_id: string | null
          birth_country: string | null
          birth_date: string | null
          birth_name: string | null
          birth_place: string | null
          city: string | null
          contract_signed_at: string | null
          created_at: string
          current_activity: string | null
          employment_start_date: string | null
          employment_type: Database["public"]["Enums"]["employment_type"] | null
          family_status: string | null
          full_name: string
          health_insurance: string | null
          iban: string | null
          id: string
          last_reminder_sent_at: string | null
          leader_avatar_url: string | null
          leader_online: boolean | null
          leader_title: string | null
          living_since: string | null
          nationality: string | null
          onboarding_status: Database["public"]["Enums"]["onboarding_status"]
          phone: string | null
          previous_address: string | null
          signature_url: string | null
          social_security_number: string | null
          status: Database["public"]["Enums"]["employee_status"]
          street: string | null
          tax_number: string | null
          team_leader_id: string | null
          tenant_id: string | null
          updated_at: string
          user_id: string
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          admin_notes?: string | null
          application_id?: string | null
          birth_country?: string | null
          birth_date?: string | null
          birth_name?: string | null
          birth_place?: string | null
          city?: string | null
          contract_signed_at?: string | null
          created_at?: string
          current_activity?: string | null
          employment_start_date?: string | null
          employment_type?:
            | Database["public"]["Enums"]["employment_type"]
            | null
          family_status?: string | null
          full_name: string
          health_insurance?: string | null
          iban?: string | null
          id?: string
          last_reminder_sent_at?: string | null
          leader_avatar_url?: string | null
          leader_online?: boolean | null
          leader_title?: string | null
          living_since?: string | null
          nationality?: string | null
          onboarding_status?: Database["public"]["Enums"]["onboarding_status"]
          phone?: string | null
          previous_address?: string | null
          signature_url?: string | null
          social_security_number?: string | null
          status?: Database["public"]["Enums"]["employee_status"]
          street?: string | null
          tax_number?: string | null
          team_leader_id?: string | null
          tenant_id?: string | null
          updated_at?: string
          user_id: string
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          admin_notes?: string | null
          application_id?: string | null
          birth_country?: string | null
          birth_date?: string | null
          birth_name?: string | null
          birth_place?: string | null
          city?: string | null
          contract_signed_at?: string | null
          created_at?: string
          current_activity?: string | null
          employment_start_date?: string | null
          employment_type?:
            | Database["public"]["Enums"]["employment_type"]
            | null
          family_status?: string | null
          full_name?: string
          health_insurance?: string | null
          iban?: string | null
          id?: string
          last_reminder_sent_at?: string | null
          leader_avatar_url?: string | null
          leader_online?: boolean | null
          leader_title?: string | null
          living_since?: string | null
          nationality?: string | null
          onboarding_status?: Database["public"]["Enums"]["onboarding_status"]
          phone?: string | null
          previous_address?: string | null
          signature_url?: string | null
          social_security_number?: string | null
          status?: Database["public"]["Enums"]["employee_status"]
          street?: string | null
          tax_number?: string | null
          team_leader_id?: string | null
          tenant_id?: string | null
          updated_at?: string
          user_id?: string
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string
          created_at: string
          id: string
          is_active: boolean
          note: string | null
          sms_channel_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by: string
          created_at?: string
          id?: string
          is_active?: boolean
          note?: string | null
          sms_channel_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string
          created_at?: string
          id?: string
          is_active?: boolean
          note?: string | null
          sms_channel_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_assignments_sms_channel_id_fkey"
            columns: ["sms_channel_id"]
            isOneToOne: false
            referencedRelation: "sms_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_channels: {
        Row: {
          api_key: string | null
          api_secret: string | null
          created_at: string
          id: string
          is_active: boolean
          label: string
          phone_number: string
          provider: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          api_key?: string | null
          api_secret?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          phone_number: string
          provider?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          api_key?: string | null
          api_secret?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          phone_number?: string
          provider?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_channels_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_channels_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_messages: {
        Row: {
          assignment_id: string | null
          body: string
          channel_id: string | null
          created_at: string
          direction: string
          from_number: string
          id: string
          media_url: string | null
          provider_message_id: string | null
          status: string
          tenant_id: string | null
          to_number: string
          user_id: string | null
        }
        Insert: {
          assignment_id?: string | null
          body?: string
          channel_id?: string | null
          created_at?: string
          direction?: string
          from_number?: string
          id?: string
          media_url?: string | null
          provider_message_id?: string | null
          status?: string
          tenant_id?: string | null
          to_number?: string
          user_id?: string | null
        }
        Update: {
          assignment_id?: string | null
          body?: string
          channel_id?: string | null
          created_at?: string
          direction?: string
          from_number?: string
          id?: string
          media_url?: string | null
          provider_message_id?: string | null
          status?: string
          tenant_id?: string | null
          to_number?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_messages_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "task_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "sms_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_settings: {
        Row: {
          api_key: string
          created_at: string
          id: string
          provider: string
          updated_at: string
        }
        Insert: {
          api_key?: string
          created_at?: string
          id?: string
          provider?: string
          updated_at?: string
        }
        Update: {
          api_key?: string
          created_at?: string
          id?: string
          provider?: string
          updated_at?: string
        }
        Relationships: []
      }
      step_feedback: {
        Row: {
          assignment_id: string
          block_id: string | null
          comment: string
          created_at: string
          created_by: string
          id: string
          resolved: boolean
          step_number: number
        }
        Insert: {
          assignment_id: string
          block_id?: string | null
          comment?: string
          created_at?: string
          created_by: string
          id?: string
          resolved?: boolean
          step_number: number
        }
        Update: {
          assignment_id?: string
          block_id?: string | null
          comment?: string
          created_at?: string
          created_by?: string
          id?: string
          resolved?: boolean
          step_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "step_feedback_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "task_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      submission_answers: {
        Row: {
          answer: string
          id: string
          question_id: string
          submission_id: string
        }
        Insert: {
          answer?: string
          id?: string
          question_id: string
          submission_id: string
        }
        Update: {
          answer?: string
          id?: string
          question_id?: string
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "submission_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "task_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submission_answers_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "task_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          reason: string
          source: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          reason: string
          source?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          reason?: string
          source?: string | null
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          id: number
          openai_api_key: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: number
          openai_api_key?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: number
          openai_api_key?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      task_assignments: {
        Row: {
          admin_comment: string | null
          created_at: string
          id: string
          individual_case_number: string | null
          individual_email: string | null
          individual_hint: string | null
          individual_instructions: string | null
          individual_password: string | null
          individual_phone: string | null
          post_ident_pdf_name: string | null
          post_ident_pdf_url: string | null
          release_at: string | null
          sms_channel_id: string | null
          status: Database["public"]["Enums"]["task_assignment_status"]
          task_template_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_comment?: string | null
          created_at?: string
          id?: string
          individual_case_number?: string | null
          individual_email?: string | null
          individual_hint?: string | null
          individual_instructions?: string | null
          individual_password?: string | null
          individual_phone?: string | null
          post_ident_pdf_name?: string | null
          post_ident_pdf_url?: string | null
          release_at?: string | null
          sms_channel_id?: string | null
          status?: Database["public"]["Enums"]["task_assignment_status"]
          task_template_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_comment?: string | null
          created_at?: string
          id?: string
          individual_case_number?: string | null
          individual_email?: string | null
          individual_hint?: string | null
          individual_instructions?: string | null
          individual_password?: string | null
          individual_phone?: string | null
          post_ident_pdf_name?: string | null
          post_ident_pdf_url?: string | null
          release_at?: string | null
          sms_channel_id?: string | null
          status?: Database["public"]["Enums"]["task_assignment_status"]
          task_template_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignments_task_template_id_fkey"
            columns: ["task_template_id"]
            isOneToOne: false
            referencedRelation: "task_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      task_progress: {
        Row: {
          answers: Json
          assignment_id: string
          completed_steps: number[]
          current_step: number
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          answers?: Json
          assignment_id: string
          completed_steps?: number[]
          current_step?: number
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          answers?: Json
          assignment_id?: string
          completed_steps?: number[]
          current_step?: number
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_progress_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: true
            referencedRelation: "task_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      task_questions: {
        Row: {
          created_at: string
          id: string
          is_required: boolean
          options: Json | null
          question: string
          question_type: string
          sort_order: number
          task_template_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_required?: boolean
          options?: Json | null
          question: string
          question_type?: string
          sort_order?: number
          task_template_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_required?: boolean
          options?: Json | null
          question?: string
          question_type?: string
          sort_order?: number
          task_template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_questions_task_template_id_fkey"
            columns: ["task_template_id"]
            isOneToOne: false
            referencedRelation: "task_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      task_steps: {
        Row: {
          button_label: string
          content_blocks: Json
          created_at: string
          description: string
          id: string
          is_required: boolean
          step_number: number
          task_template_id: string
          title: string
          updated_at: string
        }
        Insert: {
          button_label?: string
          content_blocks?: Json
          created_at?: string
          description?: string
          id?: string
          is_required?: boolean
          step_number?: number
          task_template_id: string
          title?: string
          updated_at?: string
        }
        Update: {
          button_label?: string
          content_blocks?: Json
          created_at?: string
          description?: string
          id?: string
          is_required?: boolean
          step_number?: number
          task_template_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_steps_task_template_id_fkey"
            columns: ["task_template_id"]
            isOneToOne: false
            referencedRelation: "task_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      task_submissions: {
        Row: {
          assignment_id: string
          created_at: string
          file_urls: string[]
          id: string
          notes: string | null
          review_comment: string | null
          review_status: string | null
          submitted_at: string
          updated_at: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          file_urls?: string[]
          id?: string
          notes?: string | null
          review_comment?: string | null
          review_status?: string | null
          submitted_at?: string
          updated_at?: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          file_urls?: string[]
          id?: string
          notes?: string | null
          review_comment?: string | null
          review_status?: string | null
          submitted_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "task_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      task_templates: {
        Row: {
          compensation: number
          created_at: string
          created_by: string
          description: string
          id: string
          image_url: string | null
          instructions: string
          is_active: boolean
          is_published: boolean
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          compensation?: number
          created_at?: string
          created_by: string
          description?: string
          id?: string
          image_url?: string | null
          instructions?: string
          is_active?: boolean
          is_published?: boolean
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          compensation?: number
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          image_url?: string | null
          instructions?: string
          is_active?: boolean
          is_published?: boolean
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      tenant_default_tasks: {
        Row: {
          created_at: string
          id: string
          sort_order: number
          task_template_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          sort_order: number
          task_template_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          sort_order?: number
          task_template_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_default_tasks_task_template_id_fkey"
            columns: ["task_template_id"]
            isOneToOne: false
            referencedRelation: "task_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_default_tasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_default_tasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          ai_enabled: boolean
          ai_escalation_keywords: string[] | null
          ai_fallback_text: string | null
          ai_faq_entries: Json | null
          ai_language_style: string | null
          ai_model: string | null
          ai_system_prompt: string | null
          company_address: string | null
          company_ceo_name: string | null
          company_city: string | null
          company_contact_person: string | null
          company_email: string | null
          company_signature_url: string | null
          company_signer_name: string | null
          company_signer_title: string | null
          contract_additions: string | null
          created_at: string
          default_task_template_id: string | null
          domain: string
          email_signature: string | null
          features: Json
          hero_subtitle: string
          hero_title: string
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          primary_color: string | null
          reply_to_email: string | null
          reset_email_body: string | null
          reset_email_subject: string | null
          sender_email: string | null
          sender_name: string | null
          smtp_debug_enabled: boolean
          smtp_host: string | null
          smtp_password: string | null
          smtp_port: number | null
          smtp_username: string | null
          team_leader_avatar_url: string | null
          team_leader_name: string
          team_leader_online: boolean | null
          team_leader_response_time: string
          team_leader_title: string
          updated_at: string
          welcome_email_body: string | null
          welcome_email_subject: string | null
          whatsapp_number: string | null
        }
        Insert: {
          ai_enabled?: boolean
          ai_escalation_keywords?: string[] | null
          ai_fallback_text?: string | null
          ai_faq_entries?: Json | null
          ai_language_style?: string | null
          ai_model?: string | null
          ai_system_prompt?: string | null
          company_address?: string | null
          company_ceo_name?: string | null
          company_city?: string | null
          company_contact_person?: string | null
          company_email?: string | null
          company_signature_url?: string | null
          company_signer_name?: string | null
          company_signer_title?: string | null
          contract_additions?: string | null
          created_at?: string
          default_task_template_id?: string | null
          domain: string
          email_signature?: string | null
          features?: Json
          hero_subtitle?: string
          hero_title?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          primary_color?: string | null
          reply_to_email?: string | null
          reset_email_body?: string | null
          reset_email_subject?: string | null
          sender_email?: string | null
          sender_name?: string | null
          smtp_debug_enabled?: boolean
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_username?: string | null
          team_leader_avatar_url?: string | null
          team_leader_name?: string
          team_leader_online?: boolean | null
          team_leader_response_time?: string
          team_leader_title?: string
          updated_at?: string
          welcome_email_body?: string | null
          welcome_email_subject?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          ai_enabled?: boolean
          ai_escalation_keywords?: string[] | null
          ai_fallback_text?: string | null
          ai_faq_entries?: Json | null
          ai_language_style?: string | null
          ai_model?: string | null
          ai_system_prompt?: string | null
          company_address?: string | null
          company_ceo_name?: string | null
          company_city?: string | null
          company_contact_person?: string | null
          company_email?: string | null
          company_signature_url?: string | null
          company_signer_name?: string | null
          company_signer_title?: string | null
          contract_additions?: string | null
          created_at?: string
          default_task_template_id?: string | null
          domain?: string
          email_signature?: string | null
          features?: Json
          hero_subtitle?: string
          hero_title?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          primary_color?: string | null
          reply_to_email?: string | null
          reset_email_body?: string | null
          reset_email_subject?: string | null
          sender_email?: string | null
          sender_name?: string | null
          smtp_debug_enabled?: boolean
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_username?: string | null
          team_leader_avatar_url?: string | null
          team_leader_name?: string
          team_leader_online?: boolean | null
          team_leader_response_time?: string
          team_leader_title?: string
          updated_at?: string
          welcome_email_body?: string | null
          welcome_email_subject?: string | null
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      time_slots: {
        Row: {
          created_at: string
          created_by: string
          end_time: string
          id: string
          max_participants: number
          slot_date: string
          start_time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          end_time: string
          id?: string
          max_participants?: number
          slot_date: string
          start_time: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          end_time?: string
          id?: string
          max_participants?: number
          slot_date?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_transactions: {
        Row: {
          amount: number
          assignment_id: string
          created_at: string
          id: string
          status: Database["public"]["Enums"]["transaction_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          assignment_id: string
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["transaction_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          assignment_id?: string
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["transaction_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_transactions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "task_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      tenants_public: {
        Row: {
          ai_enabled: boolean | null
          company_address: string | null
          company_ceo_name: string | null
          company_city: string | null
          company_signature_url: string | null
          domain: string | null
          features: Json | null
          hero_subtitle: string | null
          hero_title: string | null
          id: string | null
          is_active: boolean | null
          logo_url: string | null
          name: string | null
          primary_color: string | null
          team_leader_avatar_url: string | null
          team_leader_name: string | null
          team_leader_online: boolean | null
          team_leader_response_time: string | null
          team_leader_title: string | null
          whatsapp_number: string | null
        }
        Insert: {
          ai_enabled?: boolean | null
          company_address?: string | null
          company_ceo_name?: string | null
          company_city?: string | null
          company_signature_url?: string | null
          domain?: string | null
          features?: Json | null
          hero_subtitle?: string | null
          hero_title?: string | null
          id?: string | null
          is_active?: boolean | null
          logo_url?: string | null
          name?: string | null
          primary_color?: string | null
          team_leader_avatar_url?: string | null
          team_leader_name?: string | null
          team_leader_online?: boolean | null
          team_leader_response_time?: string | null
          team_leader_title?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          ai_enabled?: boolean | null
          company_address?: string | null
          company_ceo_name?: string | null
          company_city?: string | null
          company_signature_url?: string | null
          domain?: string | null
          features?: Json | null
          hero_subtitle?: string | null
          hero_title?: string | null
          id?: string | null
          is_active?: boolean | null
          logo_url?: string | null
          name?: string | null
          primary_color?: string | null
          team_leader_avatar_url?: string | null
          team_leader_name?: string | null
          team_leader_online?: boolean | null
          team_leader_response_time?: string | null
          team_leader_title?: string | null
          whatsapp_number?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_get_email_confirmations: {
        Args: never
        Returns: {
          email_confirmed: boolean
          user_id: string
        }[]
      }
      admin_get_user_contact: {
        Args: { _user_id: string }
        Returns: {
          email: string
          phone: string
        }[]
      }
      consume_invitation_token: { Args: { _token: string }; Returns: undefined }
      get_first_active_public_tenant: {
        Args: never
        Returns: {
          ai_enabled: boolean | null
          company_address: string | null
          company_ceo_name: string | null
          company_city: string | null
          company_signature_url: string | null
          domain: string | null
          features: Json | null
          hero_subtitle: string | null
          hero_title: string | null
          id: string | null
          is_active: boolean | null
          logo_url: string | null
          name: string | null
          primary_color: string | null
          team_leader_avatar_url: string | null
          team_leader_name: string | null
          team_leader_online: boolean | null
          team_leader_response_time: string | null
          team_leader_title: string | null
          whatsapp_number: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "tenants_public"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_my_sms_assignments: {
        Args: never
        Returns: {
          assigned_at: string
          assignment_id: string
          channel_id: string
          channel_is_active: boolean
          is_active: boolean
          label: string
          note: string
          phone_number: string
          provider: string
        }[]
      }
      get_public_tenant_by_domain: {
        Args: { _domain: string }
        Returns: {
          ai_enabled: boolean | null
          company_address: string | null
          company_ceo_name: string | null
          company_city: string | null
          company_signature_url: string | null
          domain: string | null
          features: Json | null
          hero_subtitle: string | null
          hero_title: string | null
          id: string | null
          is_active: boolean | null
          logo_url: string | null
          name: string | null
          primary_color: string | null
          team_leader_avatar_url: string | null
          team_leader_name: string | null
          team_leader_online: boolean | null
          team_leader_response_time: string | null
          team_leader_title: string | null
          whatsapp_number: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "tenants_public"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      validate_invitation_token: {
        Args: { _token: string }
        Returns: {
          application_id: string
          email: string
          tenant_id: string
          used: boolean
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
      booking_status: "gebucht" | "bestätigt" | "abgeschlossen" | "storniert"
      document_category: "identitaet" | "auftrag" | "sonstiges"
      document_status: "hochgeladen" | "geprueft" | "abgelehnt"
      employee_status:
        | "registriert"
        | "angenommen"
        | "abgelehnt"
        | "deaktiviert"
      employment_type: "minijob" | "teilzeit" | "vollzeit"
      kyc_status:
        | "nicht_gestartet"
        | "eingereicht"
        | "in_pruefung"
        | "verifiziert"
        | "abgelehnt"
      onboarding_status: "nicht_gestartet" | "in_bearbeitung" | "abgeschlossen"
      task_assignment_status:
        | "entwurf"
        | "zugewiesen"
        | "geplant"
        | "in_bearbeitung"
        | "eingereicht"
        | "in_pruefung"
        | "genehmigt"
        | "abgelehnt"
        | "nachbesserung"
        | "abgeschlossen"
      transaction_status:
        | "ausstehend"
        | "gutgeschrieben"
        | "genehmigt"
        | "ausgezahlt"
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
      app_role: ["admin", "user"],
      booking_status: ["gebucht", "bestätigt", "abgeschlossen", "storniert"],
      document_category: ["identitaet", "auftrag", "sonstiges"],
      document_status: ["hochgeladen", "geprueft", "abgelehnt"],
      employee_status: [
        "registriert",
        "angenommen",
        "abgelehnt",
        "deaktiviert",
      ],
      employment_type: ["minijob", "teilzeit", "vollzeit"],
      kyc_status: [
        "nicht_gestartet",
        "eingereicht",
        "in_pruefung",
        "verifiziert",
        "abgelehnt",
      ],
      onboarding_status: ["nicht_gestartet", "in_bearbeitung", "abgeschlossen"],
      task_assignment_status: [
        "entwurf",
        "zugewiesen",
        "geplant",
        "in_bearbeitung",
        "eingereicht",
        "in_pruefung",
        "genehmigt",
        "abgelehnt",
        "nachbesserung",
        "abgeschlossen",
      ],
      transaction_status: [
        "ausstehend",
        "gutgeschrieben",
        "genehmigt",
        "ausgezahlt",
      ],
    },
  },
} as const
