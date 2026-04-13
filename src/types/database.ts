export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      operations: {
        Row: {
          adultos: number
          ninos: number
          created_at: string
          driver_id: string
          finished_at: string | null
          id: string
          is_finished: boolean
          observations: string | null
          recaudacion: number
          train_id: string | null
          fecha: string
          groups: number
        }
        Insert: {
          adultos?: number
          ninos?: number
          created_at?: string
          driver_id?: string
          finished_at?: string | null
          id?: string
          is_finished?: boolean
          observations?: string | null
          recaudacion?: number
          train_id?: string | null
          groups?: number
        }
        Update: {
          adultos?: number
          ninos?: number
          created_at?: string
          driver_id?: string
          finished_at?: string | null
          id?: string
          is_finished?: boolean
          observations?: string | null
          recaudacion?: number
          train_id?: string | null
          groups?: number
        }
        Relationships: [
          {
            foreignKeyName: "operations_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operations_train_id_fkey"
            columns: ["train_id"]
            isOneToOne: false
            referencedRelation: "trains"
            referencedColumns: ["id"]
          }
        ]
      }
      profiles: {
        Row: {
          full_name: string
          id: string
          role: "admin" | "driver" | "visualizador"
          train_id: string | null
          updated_at: string
          estado: 'pendiente' | 'aprobado' | 'inactivo'
          ciudad: string | null
          matricula_solicitada: string | null
          email: string
        }
        Insert: {
          full_name: string
          id: string
          role?: "admin" | "driver" | "visualizador"
          train_id?: string | null
          updated_at?: string
          estado?: 'pendiente' | 'aprobado'
          ciudad?: string | null
          matricula_solicitada?: string | null
          email?: string
        }
        Update: {
          full_name?: string
          id?: string
          role?: "admin" | "driver" | "visualizador"
          train_id?: string | null
          updated_at?: string
          estado?: 'pendiente' | 'aprobado'
          ciudad?: string | null
          matricula_solicitada?: string | null
          email?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_train_id_fkey"
            columns: ["train_id"]
            isOneToOne: false
            referencedRelation: "trains"
            referencedColumns: ["id"]
          }
        ]
      }
      trains: {
        Row: {
          ciudad: string
          created_at: string
          id: string
          matricula: string
        }
        Insert: {
          ciudad: string
          created_at?: string
          id?: string
          matricula: string
        }
        Update: {
          ciudad?: string
          created_at?: string
          id?: string
          matricula?: string
        }
        Relationships: []
      }
      daily_closures: {
        Row: {
          id: string
          driver_id: string
          fecha: string
          total_recaudado: number
          total_passengers: number
          total_gastos: number
          adult_start: number | null
          adult_end: number | null
          infant_start: number | null
          infant_end: number | null
          group_start: number | null
          group_end: number | null
          created_at: string
        }
        Insert: {
          id?: string
          driver_id: string
          fecha?: string
          total_recaudado: number
          total_passengers: number
          total_gastos: number
          adult_start?: number | null
          adult_end?: number | null
          infant_start?: number | null
          infant_end?: number | null
          group_start?: number | null
          group_end?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          driver_id?: string
          fecha?: string
          total_recaudado?: number
          total_passengers?: number
          total_gastos?: number
          adult_start?: number | null
          adult_end?: number | null
          infant_start?: number | null
          infant_end?: number | null
          group_start?: number | null
          group_end?: number | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_closures_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      expenses: {
        Row: {
          id: string
          driver_id: string
          amount: number
          category: 'Combustible' | 'Limpieza' | 'Mantenimiento' | 'Peaje' | 'Otros'
          description: string | null
          fecha: string
          ticket_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          driver_id: string
          amount: number
          category: 'Combustible' | 'Limpieza' | 'Mantenimiento' | 'Peaje' | 'Otros'
          description?: string | null
          fecha?: string
          ticket_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          driver_id?: string
          amount?: number
          category?: 'Combustible' | 'Limpieza' | 'Mantenimiento' | 'Peaje' | 'Otros'
          description?: string | null
          fecha?: string
          ticket_url?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Operation = Database['public']['Tables']['operations']['Row'];
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Train = Database['public']['Tables']['trains']['Row'];
export type Closure = Database['public']['Tables']['daily_closures']['Row'];
export type Expense = Database['public']['Tables']['expenses']['Row'];
