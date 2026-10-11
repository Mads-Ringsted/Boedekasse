
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "anke": {
                  Row: {
                    "aendret": boolean,"afgjort": string | null,"afgjort_af": string | null,"afgoerelse": Database["public"]['Enums']["anke_afgoerelse"] | null,"bode_id": string,"bodekasse_id": string,"id": string,"indgivet": string,"saeson_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "aendret"?: boolean,"afgjort"?: string | null,"afgjort_af"?: string | null,"afgoerelse"?: Database["public"]['Enums']["anke_afgoerelse"] | null,"bode_id": string,"bodekasse_id": string,"id"?: string,"indgivet"?: string,"saeson_id": string
                  }
                  Update: {
                    "aendret"?: boolean,"afgjort"?: string | null,"afgjort_af"?: string | null,"afgoerelse"?: Database["public"]['Enums']["anke_afgoerelse"] | null,"bode_id"?: string,"bodekasse_id"?: string,"id"?: string,"indgivet"?: string,"saeson_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "anke_bodekasse_id_afgjort_af_fkey"
      columns: ["bodekasse_id","afgjort_af"]
isOneToOne: false
      referencedRelation: "medlem"
      referencedColumns: ["bodekasse_id","id"]
    },{
      foreignKeyName: "anke_bodekasse_id_afgjort_af_fkey"
      columns: ["bodekasse_id","afgjort_af"]
isOneToOne: false
      referencedRelation: "medlem_saeson_tal"
      referencedColumns: ["bodekasse_id","medlem_id"]
    },{
      foreignKeyName: "anke_bodekasse_id_afgjort_af_fkey"
      columns: ["bodekasse_id","afgjort_af"]
isOneToOne: false
      referencedRelation: "medlem_saldo"
      referencedColumns: ["bodekasse_id","medlem_id"]
    },{
      foreignKeyName: "anke_bodekasse_id_bode_id_fkey"
      columns: ["bodekasse_id","bode_id"]
isOneToOne: false
      referencedRelation: "bode"
      referencedColumns: ["bodekasse_id","id"]
    },{
      foreignKeyName: "anke_bodekasse_id_bode_id_fkey"
      columns: ["bodekasse_id","bode_id"]
isOneToOne: false
      referencedRelation: "bode_baerer"
      referencedColumns: ["bodekasse_id","id"]
    },{
      foreignKeyName: "anke_bodekasse_id_fkey"
      columns: ["bodekasse_id"]
isOneToOne: false
      referencedRelation: "bodekasse"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "anke_bodekasse_id_fkey"
      columns: ["bodekasse_id"]
isOneToOne: false
      referencedRelation: "bodekasse_saeson"
      referencedColumns: ["bodekasse_id"]
    },{
      foreignKeyName: "anke_bodekasse_id_fkey"
      columns: ["bodekasse_id"]
isOneToOne: false
      referencedRelation: "kassen"
      referencedColumns: ["bodekasse_id"]
    },{
      foreignKeyName: "anke_bodekasse_id_saeson_id_fkey"
      columns: ["bodekasse_id","saeson_id"]
isOneToOne: false
      referencedRelation: "saeson"
      referencedColumns: ["bodekasse_id","id"]
    },{
      foreignKeyName: "anke_bodekasse_id_saeson_id_fkey"
      columns: ["bodekasse_id","saeson_id"]
isOneToOne: false
      referencedRelation: "saeson_status"
      referencedColumns: ["bodekasse_id","id"]
    }
                  ]
                },"betalingsmelding": {
                  Row: {
                    "behandlet": string | null,"behandlet_af": string | null,"beloeb": number,"bodekasse_id": string,"id": string,"medlem_id": string,"meldt": string,"saeson_id": string,"status": Database["public"]['Enums']["melding_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "behandlet"?: string | null,"behandlet_af"?: string | null,"beloeb": number,"bodekasse_id": string,"id"?: string,"medlem_id": string,"meldt"?: string,"saeson_id": string,"status"?: Database["public"]['Enums']["melding_status"]
                  }
                  Update: {
                    "behandlet"?: string | null,"behandlet_af"?: string | null,"beloeb"?: number,"bodekasse_id"?: string,"id"?: string,"medlem_id"?: string,"meldt"?: string,"saeson_id"?: string,"status"?: Database["public"]['Enums']["melding_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "betalingsmelding_bodekasse_id_behandlet_af_fkey"
      columns: ["bodekasse_id","behandlet_af"]
isOneToOne: false
      referencedRelation: "medlem"
      referencedColumns: ["bodekasse_id","id"]
    },{
      foreignKeyName: "betalingsmelding_bodekasse_id_behandlet_af_fkey"
      columns: ["bodekasse_id","behandlet_af"]
isOneToOne: false
      referencedRelation: "medlem_saeson_tal"
      referencedColumns: ["bodekasse_id","medlem_id"]
    },{
      foreignKeyName: "betalingsmelding_bodekasse_id_behandlet_af_fkey"
      columns: ["bodekasse_id","behandlet_af"]
isOneToOne: false
      referencedRelation: "medlem_saldo"
      referencedColumns: ["bodekasse_id","medlem_id"]
    },{
      foreignKeyName: "betalingsmelding_bodekasse_id_fkey"
      columns: ["bodekasse_id"]
isOneToOne: false
      referencedRelation: "bodekasse"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "betalingsmelding_bodekasse_id_fkey"
      columns: ["bodekasse_id"]
isOneToOne: false
      referencedRelation: "bodekasse_saeson"
      referencedColumns: ["bodekasse_id"]
    },{
      foreignKeyName: "betalingsmelding_bodekasse_id_fkey"
      columns: ["bodekasse_id"]
isOneToOne: false
      referencedRelation: "kassen"
      referencedColumns: ["bodekasse_id"]
    },{
      foreignKeyName: "betalingsmelding_bodekasse_id_medlem_id_fkey"
      columns: ["bodekasse_id","medlem_id"]
isOneToOne: false
      referencedRelation: "medlem"
      referencedColumns: ["bodekasse_id","id"]
    },{
      foreignKeyName: "betalingsmelding_bodekasse_id_medlem_id_fkey"
      columns: ["bodekasse_id","medlem_id"]
isOneToOne: false
      referencedRelation: "medlem_saeson_tal"
      referencedColumns: ["bodekasse_id","medlem_id"]
    },{
      foreignKeyName: "betalingsmelding_bodekasse_id_medlem_id_fkey"
      columns: ["bodekasse_id","medlem_id"]
isOneToOne: false
      referencedRelation: "medlem_saldo"
      referencedColumns: ["bodekasse_id","medlem_id"]
    },{
      foreignKeyName: "betalingsmelding_bodekasse_id_saeson_id_fkey"
      columns: ["bodekasse_id","saeson_id"]
isOneToOne: false
      referencedRelation: "saeson"
      referencedColumns: ["bodekasse_id","id"]
    },{
      foreignKeyName: "betalingsmelding_bodekasse_id_saeson_id_fkey"
      columns: ["bodekasse_id","saeson_id"]
isOneToOne: false
      referencedRelation: "saeson_status"
      referencedColumns: ["bodekasse_id","id"]
    }
                  ]
                },"bode": {
                  Row: {
                    "annulleret": string | null,"annulleret_af": string | null,"annulleret_note": string | null,"batch_id": string,"bodekasse_id": string,"bodekategori_id": string | null,"giver_id": string,"givet": string,"grund": string | null,"id": string,"modtager_id": string,"pris": number,"saeson_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "annulleret"?: string | null,"annulleret_af"?: string | null,"annulleret_note"?: string | null,"batch_id": string,"bodekasse_id": string,"bodekategori_id"?: string | null,"giver_id": string,"givet"?: string,"grund"?: string | null,"id"?: string,"modtager_id": string,"pris": number,"saeson_id": string
                  }
                  Update: {
                    "annulleret"?: string | null,"annulleret_af"?: string | null,"annulleret_note"?: string | null,"batch_id"?: string,"bodekasse_id"?: string,"bodekategori_id"?: string | null,"giver_id"?: string,"givet"?: string,"grund"?: string | null,"id"?: string,"modtager_id"?: string,"pris"?: number,"saeson_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "bode_bodekasse_id_annulleret_af_fkey"
      columns: ["bodekasse_id","annulleret_af"]
isOneToOne: false
      referencedRelation: "medlem"
      referencedColumns: ["bodekasse_id","id"]
    },{
      foreignKeyName: "bode_bodekasse_id_annulleret_af_fkey"
      columns: ["bodekasse_id","annulleret_af"]
isOneToOne: false
      referencedRelation: "medlem_saeson_tal"
      referencedColumns: ["bodekasse_id","medlem_id"]
    },{
      foreignKeyName: "bode_bodekasse_id_annulleret_af_fkey"
      columns: ["bodekasse_id","annulleret_af"]
isOneToOne: false
      referencedRelation: "medlem_saldo"
      referencedColumns: ["bodekasse_id","medlem_id"]
    },{
      foreignKeyName: "bode_bodekasse_id_bodekategori_id_fkey"
      columns: ["bodekasse_id","bodekategori_id"]
isOneToOne: false
      referencedRelation: "bodekategori"
      referencedColumns: ["bodekasse_id","id"]
    },{
      foreignKeyName: "bode_bodekasse_id_bodekategori_id_fkey"
      columns: ["bodekasse_id","bodekategori_id"]
isOneToOne: false
      referencedRelation: "bodekategori_brug"
      referencedColumns: ["bodekasse_id","bodekategori_id"]
    },{
      foreignKeyName: "bode_bodekasse_id_fkey"
      columns: ["bodekasse_id"]
isOneToOne: false
      referencedRelation: "bodekasse"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bode_bodekasse_id_fkey"
      columns: ["bodekasse_id"]
isOneToOne: false
      referencedRelation: "bodekasse_saeson"
      referencedColumns: ["bodekasse_id"]
    },{
      foreignKeyName: "bode_bodekasse_id_fkey"
      columns: ["bodekasse_id"]
isOneToOne: false
      referencedRelation: "kassen"
      referencedColumns: ["bodekasse_id"]
    },{
      foreignKeyName: "bode_bodekasse_id_giver_id_fkey"
      columns: ["bodekasse_id","giver_id"]
isOneToOne: false
      referencedRelation: "medlem"
      referencedColumns: ["bodekasse_id","id"]
    },{
      foreignKeyName: "bode_bodekasse_id_giver_id_fkey"
      columns: ["bodekasse_id","giver_id"]
isOneToOne: false
      referencedRelation: "medlem_saeson_tal"
      referencedColumns: ["bodekasse_id","medlem_id"]
    },{
      foreignKeyName: "bode_bodekasse_id_giver_id_fkey"
      columns: ["bodekasse_id","giver_id"]
isOneToOne: false
      referencedRelation: "medlem_saldo"
      referencedColumns: ["bodekasse_id","medlem_id"]
    },{
      foreignKeyName: "bode_bodekasse_id_modtager_id_fkey"
      columns: ["bodekasse_id","modtager_id"]
isOneToOne: false
      referencedRelation: "medlem"
      referencedColumns: ["bodekasse_id","id"]
    },{
      foreignKeyName: "bode_bodekasse_id_modtager_id_fkey"
      columns: ["bodekasse_id","modtager_id"]
isOneToOne: false
      referencedRelation: "medlem_saeson_tal"
      referencedColumns: ["bodekasse_id","medlem_id"]
    },{
      foreignKeyName: "bode_bodekasse_id_modtager_id_fkey"
      columns: ["bodekasse_id","modtager_id"]
isOneToOne: false
      referencedRelation: "medlem_saldo"
      referencedColumns: ["bodekasse_id","medlem_id"]
    },{
      foreignKeyName: "bode_bodekasse_id_saeson_id_fkey"
      columns: ["bodekasse_id","saeson_id"]
isOneToOne: false
      referencedRelation: "saeson"
      referencedColumns: ["bodekasse_id","id"]
    },{
      foreignKeyName: "bode_bodekasse_id_saeson_id_fkey"
      columns: ["bodekasse_id","saeson_id"]
isOneToOne: false
      referencedRelation: "saeson_status"
      referencedColumns: ["bodekasse_id","id"]
    }
                  ]
                },"bodekasse": {
                  Row: {
                    "anke_max_gange": number,"anke_min": number,"anke_til": boolean,"anke_vindue_timer": number,"engangsgebyr": number,"engangsgebyr_til": boolean,"fravaersgebyr": number,"frikob_pris": number,"frikob_til": boolean,"id": string,"konkurrence_til": boolean,"mobilepay_box": string | null,"navn": string,"oprettelsesgebyr": number,"oprettelsesgebyr_til": boolean,"oprettet": string,"placeringer": (number)[]
                  }
                  ComputedFields: never
                  Insert: {
                    "anke_max_gange"?: number,"anke_min"?: number,"anke_til"?: boolean,"anke_vindue_timer"?: number,"engangsgebyr"?: number,"engangsgebyr_til"?: boolean,"fravaersgebyr"?: number,"frikob_pris"?: number,"frikob_til"?: boolean,"id"?: string,"konkurrence_til"?: boolean,"mobilepay_box"?: string | null,"navn": string,"oprettelsesgebyr"?: number,"oprettelsesgebyr_til"?: boolean,"oprettet"?: string,"placeringer"?: (number)[]
                  }
                  Update: {
                    "anke_max_gange"?: number,"anke_min"?: number,"anke_til"?: boolean,"anke_vindue_timer"?: number,"engangsgebyr"?: number,"engangsgebyr_til"?: boolean,"fravaersgebyr"?: number,"frikob_pris"?: number,"frikob_til"?: boolean,"id"?: string,"konkurrence_til"?: boolean,"mobilepay_box"?: string | null,"navn"?: string,"oprettelsesgebyr"?: number,"oprettelsesgebyr_til"?: boolean,"oprettet"?: string,"placeringer"?: (number)[]
                  }
                  Relationships: [
                    
                  ]
                },"bodekasse_kode": {
                  Row: {
                    "bodekasse_id": string,"kode": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bodekasse_id": string,"kode": string
                  }
                  Update: {
                    "bodekasse_id"?: string,"kode"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "bodekasse_kode_bodekasse_id_fkey"
      columns: ["bodekasse_id"]
isOneToOne: true
      referencedRelation: "bodekasse"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bodekasse_kode_bodekasse_id_fkey"
      columns: ["bodekasse_id"]
isOneToOne: true
      referencedRelation: "bodekasse_saeson"
      referencedColumns: ["bodekasse_id"]
    },{
      foreignKeyName: "bodekasse_kode_bodekasse_id_fkey"
      columns: ["bodekasse_id"]
isOneToOne: true
      referencedRelation: "kassen"
      referencedColumns: ["bodekasse_id"]
    }
                  ]
                },"bodekategori": {
                  Row: {
                    "arkiveret": string | null,"beskrivelse": string | null,"bodekasse_id": string,"id": string,"navn": string,"oprettet": string,"oprettet_af": string,"pris": number
                  }
                  ComputedFields: never
                  Insert: {
                    "arkiveret"?: string | null,"beskrivelse"?: string | null,"bodekasse_id": string,"id"?: string,"navn": string,"oprettet"?: string,"oprettet_af": string,"pris": number
                  }
                  Update: {
                    "arkiveret"?: string | null,"beskrivelse"?: string | null,"bodekasse_id"?: string,"id"?: string,"navn"?: string,"oprettet"?: string,"oprettet_af"?: string,"pris"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "bodekategori_bodekasse_id_fkey"
      columns: ["bodekasse_id"]
isOneToOne: false
      referencedRelation: "bodekasse"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bodekategori_bodekasse_id_fkey"
      columns: ["bodekasse_id"]
isOneToOne: false
      referencedRelation: "bodekasse_saeson"
      referencedColumns: ["bodekasse_id"]
    },{
      foreignKeyName: "bodekategori_bodekasse_id_fkey"
      columns: ["bodekasse_id"]
isOneToOne: false
      referencedRelation: "kassen"
      referencedColumns: ["bodekasse_id"]
    },{
      foreignKeyName: "bodekategori_bodekasse_id_oprettet_af_fkey"
      columns: ["bodekasse_id","oprettet_af"]
isOneToOne: false
      referencedRelation: "medlem"
      referencedColumns: ["bodekasse_id","id"]
    },{
      foreignKeyName: "bodekategori_bodekasse_id_oprettet_af_fkey"
      columns: ["bodekasse_id","oprettet_af"]
isOneToOne: false
      referencedRelation: "medlem_saeson_tal"
      referencedColumns: ["bodekasse_id","medlem_id"]
    },{
      foreignKeyName: "bodekategori_bodekasse_id_oprettet_af_fkey"
      columns: ["bodekasse_id","oprettet_af"]
isOneToOne: false
      referencedRelation: "medlem_saldo"
      referencedColumns: ["bodekasse_id","medlem_id"]
    }
                  ]
                },"frikob": {
                  Row: {
                    "annulleret": string | null,"annulleret_af": string | null,"annulleret_note": string | null,"bodekasse_id": string,"bodekategori_id": string,"id": string,"koebt": string,"medlem_id": string,"registreret_af": string,"saeson_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "annulleret"?: string | null,"annulleret_af"?: string | null,"annulleret_note"?: string | null,"bodekasse_id": string,"bodekategori_id": string,"id"?: string,"koebt"?: string,"medlem_id": string,"registreret_af": string,"saeson_id": string
                  }
                  Update: {
                    "annulleret"?: string | null,"annulleret_af"?: string | null,"annulleret_note"?: string | null,"bodekasse_id"?: string,"bodekategori_id"?: string,"id"?: string,"koebt"?: string,"medlem_id"?: string,"registreret_af"?: string,"saeson_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "frikob_bodekasse_id_annulleret_af_fkey"
      columns: ["bodekasse_id","annulleret_af"]
isOneToOne: false
      referencedRelation: "medlem"
      referencedColumns: ["bodekasse_id","id"]
    },{
      foreignKeyName: "frikob_bodekasse_id_annulleret_af_fkey"
      columns: ["bodekasse_id","annulleret_af"]
isOneToOne: false
      referencedRelation: "medlem_saeson_tal"
      referencedColumns: ["bodekasse_id","medlem_id"]
    },{
      foreignKeyName: "frikob_bodekasse_id_annulleret_af_fkey"
      columns: ["bodekasse_id","annulleret_af"]
isOneToOne: false
      referencedRelation: "medlem_saldo"
      referencedColumns: ["bodekasse_id","medlem_id"]
    },{
      foreignKeyName: "frikob_bodekasse_id_bodekategori_id_fkey"
      columns: ["bodekasse_id","bodekategori_id"]
isOneToOne: false
      referencedRelation: "bodekategori"
      referencedColumns: ["bodekasse_id","id"]
    },{
      foreignKeyName: "frikob_bodekasse_id_bodekategori_id_fkey"
      columns: ["bodekasse_id","bodekategori_id"]
isOneToOne: false
      referencedRelation: "bodekategori_brug"
      referencedColumns: ["bodekasse_id","bodekategori_id"]
    },{
      foreignKeyName: "frikob_bodekasse_id_fkey"
      columns: ["bodekasse_id"]
isOneToOne: false
      referencedRelation: "bodekasse"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "frikob_bodekasse_id_fkey"
      columns: ["bodekasse_id"]
isOneToOne: false
      referencedRelation: "bodekasse_saeson"
      referencedColumns: ["bodekasse_id"]
    },{
      foreignKeyName: "frikob_bodekasse_id_fkey"
      columns: ["bodekasse_id"]
isOneToOne: false
      referencedRelation: "kassen"
      referencedColumns: ["bodekasse_id"]
    },{
      foreignKeyName: "frikob_bodekasse_id_medlem_id_fkey"
      columns: ["bodekasse_id","medlem_id"]
isOneToOne: false
      referencedRelation: "medlem"
      referencedColumns: ["bodekasse_id","id"]
    },{
      foreignKeyName: "frikob_bodekasse_id_medlem_id_fkey"
      columns: ["bodekasse_id","medlem_id"]
isOneToOne: false
      referencedRelation: "medlem_saeson_tal"
      referencedColumns: ["bodekasse_id","medlem_id"]
    },{
      foreignKeyName: "frikob_bodekasse_id_medlem_id_fkey"
      columns: ["bodekasse_id","medlem_id"]
isOneToOne: false
      referencedRelation: "medlem_saldo"
      referencedColumns: ["bodekasse_id","medlem_id"]
    },{
      foreignKeyName: "frikob_bodekasse_id_registreret_af_fkey"
      columns: ["bodekasse_id","registreret_af"]
isOneToOne: false
      referencedRelation: "medlem"
      referencedColumns: ["bodekasse_id","id"]
    },{
      foreignKeyName: "frikob_bodekasse_id_registreret_af_fkey"
      columns: ["bodekasse_id","registreret_af"]
isOneToOne: false
      referencedRelation: "medlem_saeson_tal"
      referencedColumns: ["bodekasse_id","medlem_id"]
    },{
      foreignKeyName: "frikob_bodekasse_id_registreret_af_fkey"
      columns: ["bodekasse_id","registreret_af"]
isOneToOne: false
      referencedRelation: "medlem_saldo"
      referencedColumns: ["bodekasse_id","medlem_id"]
    },{
      foreignKeyName: "frikob_bodekasse_id_saeson_id_fkey"
      columns: ["bodekasse_id","saeson_id"]
isOneToOne: false
      referencedRelation: "saeson"
      referencedColumns: ["bodekasse_id","id"]
    },{
      foreignKeyName: "frikob_bodekasse_id_saeson_id_fkey"
      columns: ["bodekasse_id","saeson_id"]
isOneToOne: false
      referencedRelation: "saeson_status"
      referencedColumns: ["bodekasse_id","id"]
    }
                  ]
                },"gebyr": {
                  Row: {
                    "anke_id": string | null,"annulleret": string | null,"annulleret_af": string | null,"annulleret_note": string | null,"art": Database["public"]['Enums']["gebyr_art"],"beloeb": number,"bode_id": string | null,"bodekasse_id": string,"bodekategori_id": string | null,"frikob_id": string | null,"id": string,"konkurrence_id": string | null,"medlem_id": string,"oprettet": string,"saeson_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "anke_id"?: string | null,"annulleret"?: string | null,"annulleret_af"?: string | null,"annulleret_note"?: string | null,"art": Database["public"]['Enums']["gebyr_art"],"beloeb": number,"bode_id"?: string | null,"bodekasse_id": string,"bodekategori_id"?: string | null,"frikob_id"?: string | null,"id"?: string,"konkurrence_id"?: string | null,"medlem_id": string,"oprettet"?: string,"saeson_id": string
                  }
                  Update: {
                    "anke_id"?: string | null,"annulleret"?: string | null,"annulleret_af"?: string | null,"annulleret_note"?: string | null,"art"?: Database["public"]['Enums']["gebyr_art"],"beloeb"?: number,"bode_id"?: string | null,"bodekasse_id"?: string,"bodekategori_id"?: string | null,"frikob_id"?: string | null,"id"?: string,"konkurrence_id"?: string | null,"medlem_id"?: string,"oprettet"?: string,"saeson_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "gebyr_bodekasse_id_anke_id_fkey"
      columns: ["bodekasse_id","anke_id"]
isOneToOne: false
      referencedRelation: "anke"
      referencedColumns: ["bodekasse_id","id"]
    },{
      foreignKeyName: "gebyr_bodekasse_id_annulleret_af_fkey"
      columns: ["bodekasse_id","annulleret_af"]
isOneToOne: false
      referencedRelation: "medlem"
      referencedColumns: ["bodekasse_id","id"]
    },{
      foreignKeyName: "gebyr_bodekasse_id_annulleret_af_fkey"
      columns: ["bodekasse_id","annulleret_af"]
isOneToOne: false
      referencedRelation: "medlem_saeson_tal"
      referencedColumns: ["bodekasse_id","medlem_id"]
    },{
      foreignKeyName: "gebyr_bodekasse_id_annulleret_af_fkey"
      columns: ["bodekasse_id","annulleret_af"]
isOneToOne: false
      referencedRelation: "medlem_saldo"
      referencedColumns: ["bodekasse_id","medlem_id"]
    },{
      foreignKeyName: "gebyr_bodekasse_id_bode_id_fkey"
      columns: ["bodekasse_id","bode_id"]
isOneToOne: false
      referencedRelation: "bode"
      referencedColumns: ["bodekasse_id","id"]
    },{
      foreignKeyName: "gebyr_bodekasse_id_bode_id_fkey"
      columns: ["bodekasse_id","bode_id"]
isOneToOne: false
      referencedRelation: "bode_baerer"
      referencedColumns: ["bodekasse_id","id"]
    },{
      foreignKeyName: "gebyr_bodekasse_id_bodekategori_id_fkey"
      columns: ["bodekasse_id","bodekategori_id"]
isOneToOne: false
      referencedRelation: "bodekategori"
      referencedColumns: ["bodekasse_id","id"]
    },{
      foreignKeyName: "gebyr_bodekasse_id_bodekategori_id_fkey"
      columns: ["bodekasse_id","bodekategori_id"]
isOneToOne: false
      referencedRelation: "bodekategori_brug"
      referencedColumns: ["bodekasse_id","bodekategori_id"]
    },{
      foreignKeyName: "gebyr_bodekasse_id_fkey"
      columns: ["bodekasse_id"]
isOneToOne: false
      referencedRelation: "bodekasse"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "gebyr_bodekasse_id_fkey"
      columns: ["bodekasse_id"]
isOneToOne: false
      referencedRelation: "bodekasse_saeson"
      referencedColumns: ["bodekasse_id"]
    },{
      foreignKeyName: "gebyr_bodekasse_id_fkey"
      columns: ["bodekasse_id"]
isOneToOne: false
      referencedRelation: "kassen"
      referencedColumns: ["bodekasse_id"]
    },{
      foreignKeyName: "gebyr_bodekasse_id_frikob_id_fkey"
      columns: ["bodekasse_id","frikob_id"]
isOneToOne: false
      referencedRelation: "frikob"
      referencedColumns: ["bodekasse_id","id"]
    },{
      foreignKeyName: "gebyr_bodekasse_id_konkurrence_id_fkey"
      columns: ["bodekasse_id","konkurrence_id"]
isOneToOne: false
      referencedRelation: "konkurrence"
      referencedColumns: ["bodekasse_id","id"]
    },{
      foreignKeyName: "gebyr_bodekasse_id_medlem_id_fkey"
      columns: ["bodekasse_id","medlem_id"]
isOneToOne: false
      referencedRelation: "medlem"
      referencedColumns: ["bodekasse_id","id"]
    },{
      foreignKeyName: "gebyr_bodekasse_id_medlem_id_fkey"
      columns: ["bodekasse_id","medlem_id"]
isOneToOne: false
      referencedRelation: "medlem_saeson_tal"
      referencedColumns: ["bodekasse_id","medlem_id"]
    },{
      foreignKeyName: "gebyr_bodekasse_id_medlem_id_fkey"
      columns: ["bodekasse_id","medlem_id"]
isOneToOne: false
      referencedRelation: "medlem_saldo"
      referencedColumns: ["bodekasse_id","medlem_id"]
    },{
      foreignKeyName: "gebyr_bodekasse_id_saeson_id_fkey"
      columns: ["bodekasse_id","saeson_id"]
isOneToOne: false
      referencedRelation: "saeson"
      referencedColumns: ["bodekasse_id","id"]
    },{
      foreignKeyName: "gebyr_bodekasse_id_saeson_id_fkey"
      columns: ["bodekasse_id","saeson_id"]
isOneToOne: false
      referencedRelation: "saeson_status"
      referencedColumns: ["bodekasse_id","id"]
    }
                  ]
                },"haendelse": {
                  Row: {
                    "aktoer_id": string | null,"art": string,"batch_id": string | null,"bodekasse_id": string,"data": NonNullable<Json>,"id": number,"modtager_id": string | null,"ref_id": string | null,"ref_tabel": string | null,"saeson_id": string,"tid": string
                  }
                  ComputedFields: never
                  Insert: {
                    "aktoer_id"?: string | null,"art": string,"batch_id"?: string | null,"bodekasse_id": string,"data"?: NonNullable<Json>,"id"?: never,"modtager_id"?: string | null,"ref_id"?: string | null,"ref_tabel"?: string | null,"saeson_id": string,"tid"?: string
                  }
                  Update: {
                    "aktoer_id"?: string | null,"art"?: string,"batch_id"?: string | null,"bodekasse_id"?: string,"data"?: NonNullable<Json>,"id"?: never,"modtager_id"?: string | null,"ref_id"?: string | null,"ref_tabel"?: string | null,"saeson_id"?: string,"tid"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "haendelse_bodekasse_id_aktoer_id_fkey"
      columns: ["bodekasse_id","aktoer_id"]
isOneToOne: false
      referencedRelation: "medlem"
      referencedColumns: ["bodekasse_id","id"]
    },{
      foreignKeyName: "haendelse_bodekasse_id_aktoer_id_fkey"
      columns: ["bodekasse_id","aktoer_id"]
isOneToOne: false
      referencedRelation: "medlem_saeson_tal"
      referencedColumns: ["bodekasse_id","medlem_id"]
    },{
      foreignKeyName: "haendelse_bodekasse_id_aktoer_id_fkey"
      columns: ["bodekasse_id","aktoer_id"]
isOneToOne: false
      referencedRelation: "medlem_saldo"
      referencedColumns: ["bodekasse_id","medlem_id"]
    },{
      foreignKeyName: "haendelse_bodekasse_id_fkey"
      columns: ["bodekasse_id"]
isOneToOne: false
      referencedRelation: "bodekasse"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "haendelse_bodekasse_id_fkey"
      columns: ["bodekasse_id"]
isOneToOne: false
      referencedRelation: "bodekasse_saeson"
      referencedColumns: ["bodekasse_id"]
    },{
      foreignKeyName: "haendelse_bodekasse_id_fkey"
      columns: ["bodekasse_id"]
isOneToOne: false
      referencedRelation: "kassen"
      referencedColumns: ["bodekasse_id"]
    },{
      foreignKeyName: "haendelse_bodekasse_id_modtager_id_fkey"
      columns: ["bodekasse_id","modtager_id"]
isOneToOne: false
      referencedRelation: "medlem"
      referencedColumns: ["bodekasse_id","id"]
    },{
      foreignKeyName: "haendelse_bodekasse_id_modtager_id_fkey"
      columns: ["bodekasse_id","modtager_id"]
isOneToOne: false
      referencedRelation: "medlem_saeson_tal"
      referencedColumns: ["bodekasse_id","medlem_id"]
    },{
      foreignKeyName: "haendelse_bodekasse_id_modtager_id_fkey"
      columns: ["bodekasse_id","modtager_id"]
isOneToOne: false
      referencedRelation: "medlem_saldo"
      referencedColumns: ["bodekasse_id","medlem_id"]
    },{
      foreignKeyName: "haendelse_bodekasse_id_saeson_id_fkey"
      columns: ["bodekasse_id","saeson_id"]
isOneToOne: false
      referencedRelation: "saeson"
      referencedColumns: ["bodekasse_id","id"]
    },{
      foreignKeyName: "haendelse_bodekasse_id_saeson_id_fkey"
      columns: ["bodekasse_id","saeson_id"]
isOneToOne: false
      referencedRelation: "saeson_status"
      referencedColumns: ["bodekasse_id","id"]
    }
                  ]
                },"haevning": {
                  Row: {
                    "annulleret": string | null,"annulleret_af": string | null,"annulleret_note": string | null,"beloeb": number,"bodekasse_id": string,"formaal": string,"id": string,"registreret": string,"registreret_af": string,"saeson_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "annulleret"?: string | null,"annulleret_af"?: string | null,"annulleret_note"?: string | null,"beloeb": number,"bodekasse_id": string,"formaal": string,"id"?: string,"registreret"?: string,"registreret_af": string,"saeson_id": string
                  }
                  Update: {
                    "annulleret"?: string | null,"annulleret_af"?: string | null,"annulleret_note"?: string | null,"beloeb"?: number,"bodekasse_id"?: string,"formaal"?: string,"id"?: string,"registreret"?: string,"registreret_af"?: string,"saeson_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "haevning_bodekasse_id_annulleret_af_fkey"
      columns: ["bodekasse_id","annulleret_af"]
isOneToOne: false
      referencedRelation: "medlem"
      referencedColumns: ["bodekasse_id","id"]
    },{
      foreignKeyName: "haevning_bodekasse_id_annulleret_af_fkey"
      columns: ["bodekasse_id","annulleret_af"]
isOneToOne: false
      referencedRelation: "medlem_saeson_tal"
      referencedColumns: ["bodekasse_id","medlem_id"]
    },{
      foreignKeyName: "haevning_bodekasse_id_annulleret_af_fkey"
      columns: ["bodekasse_id","annulleret_af"]
isOneToOne: false
      referencedRelation: "medlem_saldo"
      referencedColumns: ["bodekasse_id","medlem_id"]
    },{
      foreignKeyName: "haevning_bodekasse_id_fkey"
      columns: ["bodekasse_id"]
isOneToOne: false
      referencedRelation: "bodekasse"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "haevning_bodekasse_id_fkey"
      columns: ["bodekasse_id"]
isOneToOne: false
      referencedRelation: "bodekasse_saeson"
      referencedColumns: ["bodekasse_id"]
    },{
      foreignKeyName: "haevning_bodekasse_id_fkey"
      columns: ["bodekasse_id"]
isOneToOne: false
      referencedRelation: "kassen"
      referencedColumns: ["bodekasse_id"]
    },{
      foreignKeyName: "haevning_bodekasse_id_registreret_af_fkey"
      columns: ["bodekasse_id","registreret_af"]
isOneToOne: false
      referencedRelation: "medlem"
      referencedColumns: ["bodekasse_id","id"]
    },{
      foreignKeyName: "haevning_bodekasse_id_registreret_af_fkey"
      columns: ["bodekasse_id","registreret_af"]
isOneToOne: false
      referencedRelation: "medlem_saeson_tal"
      referencedColumns: ["bodekasse_id","medlem_id"]
    },{
      foreignKeyName: "haevning_bodekasse_id_registreret_af_fkey"
      columns: ["bodekasse_id","registreret_af"]
isOneToOne: false
      referencedRelation: "medlem_saldo"
      referencedColumns: ["bodekasse_id","medlem_id"]
    },{
      foreignKeyName: "haevning_bodekasse_id_saeson_id_fkey"
      columns: ["bodekasse_id","saeson_id"]
isOneToOne: false
      referencedRelation: "saeson"
      referencedColumns: ["bodekasse_id","id"]
    },{
      foreignKeyName: "haevning_bodekasse_id_saeson_id_fkey"
      columns: ["bodekasse_id","saeson_id"]
isOneToOne: false
      referencedRelation: "saeson_status"
      referencedColumns: ["bodekasse_id","id"]
    }
                  ]
                },"indbetaling": {
                  Row: {
                    "annulleret": string | null,"annulleret_af": string | null,"annulleret_note": string | null,"beloeb": number,"betalingsmelding_id": string | null,"bodekasse_id": string,"id": string,"medlem_id": string,"note": string | null,"registreret": string,"registreret_af": string,"saeson_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "annulleret"?: string | null,"annulleret_af"?: string | null,"annulleret_note"?: string | null,"beloeb": number,"betalingsmelding_id"?: string | null,"bodekasse_id": string,"id"?: string,"medlem_id": string,"note"?: string | null,"registreret"?: string,"registreret_af": string,"saeson_id": string
                  }
                  Update: {
                    "annulleret"?: string | null,"annulleret_af"?: string | null,"annulleret_note"?: string | null,"beloeb"?: number,"betalingsmelding_id"?: string | null,"bodekasse_id"?: string,"id"?: string,"medlem_id"?: string,"note"?: string | null,"registreret"?: string,"registreret_af"?: string,"saeson_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "indbetaling_bodekasse_id_annulleret_af_fkey"
      columns: ["bodekasse_id","annulleret_af"]
isOneToOne: false
      referencedRelation: "medlem"
      referencedColumns: ["bodekasse_id","id"]
    },{
      foreignKeyName: "indbetaling_bodekasse_id_annulleret_af_fkey"
      columns: ["bodekasse_id","annulleret_af"]
isOneToOne: false
      referencedRelation: "medlem_saeson_tal"
      referencedColumns: ["bodekasse_id","medlem_id"]
    },{
      foreignKeyName: "indbetaling_bodekasse_id_annulleret_af_fkey"
      columns: ["bodekasse_id","annulleret_af"]
isOneToOne: false
      referencedRelation: "medlem_saldo"
      referencedColumns: ["bodekasse_id","medlem_id"]
    },{
      foreignKeyName: "indbetaling_bodekasse_id_betalingsmelding_id_fkey"
      columns: ["bodekasse_id","betalingsmelding_id"]
isOneToOne: false
      referencedRelation: "betalingsmelding"
      referencedColumns: ["bodekasse_id","id"]
    },{
      foreignKeyName: "indbetaling_bodekasse_id_fkey"
      columns: ["bodekasse_id"]
isOneToOne: false
      referencedRelation: "bodekasse"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "indbetaling_bodekasse_id_fkey"
      columns: ["bodekasse_id"]
isOneToOne: false
      referencedRelation: "bodekasse_saeson"
      referencedColumns: ["bodekasse_id"]
    },{
      foreignKeyName: "indbetaling_bodekasse_id_fkey"
      columns: ["bodekasse_id"]
isOneToOne: false
      referencedRelation: "kassen"
      referencedColumns: ["bodekasse_id"]
    },{
      foreignKeyName: "indbetaling_bodekasse_id_medlem_id_fkey"
      columns: ["bodekasse_id","medlem_id"]
isOneToOne: false
      referencedRelation: "medlem"
      referencedColumns: ["bodekasse_id","id"]
    },{
      foreignKeyName: "indbetaling_bodekasse_id_medlem_id_fkey"
      columns: ["bodekasse_id","medlem_id"]
isOneToOne: false
      referencedRelation: "medlem_saeson_tal"
      referencedColumns: ["bodekasse_id","medlem_id"]
    },{
      foreignKeyName: "indbetaling_bodekasse_id_medlem_id_fkey"
      columns: ["bodekasse_id","medlem_id"]
isOneToOne: false
      referencedRelation: "medlem_saldo"
      referencedColumns: ["bodekasse_id","medlem_id"]
    },{
      foreignKeyName: "indbetaling_bodekasse_id_registreret_af_fkey"
      columns: ["bodekasse_id","registreret_af"]
isOneToOne: false
      referencedRelation: "medlem"
      referencedColumns: ["bodekasse_id","id"]
    },{
      foreignKeyName: "indbetaling_bodekasse_id_registreret_af_fkey"
      columns: ["bodekasse_id","registreret_af"]
isOneToOne: false
      referencedRelation: "medlem_saeson_tal"
      referencedColumns: ["bodekasse_id","medlem_id"]
    },{
      foreignKeyName: "indbetaling_bodekasse_id_registreret_af_fkey"
      columns: ["bodekasse_id","registreret_af"]
isOneToOne: false
      referencedRelation: "medlem_saldo"
      referencedColumns: ["bodekasse_id","medlem_id"]
    },{
      foreignKeyName: "indbetaling_bodekasse_id_saeson_id_fkey"
      columns: ["bodekasse_id","saeson_id"]
isOneToOne: false
      referencedRelation: "saeson"
      referencedColumns: ["bodekasse_id","id"]
    },{
      foreignKeyName: "indbetaling_bodekasse_id_saeson_id_fkey"
      columns: ["bodekasse_id","saeson_id"]
isOneToOne: false
      referencedRelation: "saeson_status"
      referencedColumns: ["bodekasse_id","id"]
    }
                  ]
                },"konkurrence": {
                  Row: {
                    "annulleret": string | null,"annulleret_af": string | null,"annulleret_note": string | null,"bodekasse_id": string,"dato": string,"id": string,"oprettet": string,"oprettet_af": string,"rettet": string | null,"rettet_af": string | null,"saeson_id": string,"titel": string
                  }
                  ComputedFields: never
                  Insert: {
                    "annulleret"?: string | null,"annulleret_af"?: string | null,"annulleret_note"?: string | null,"bodekasse_id": string,"dato"?: string,"id"?: string,"oprettet"?: string,"oprettet_af": string,"rettet"?: string | null,"rettet_af"?: string | null,"saeson_id": string,"titel": string
                  }
                  Update: {
                    "annulleret"?: string | null,"annulleret_af"?: string | null,"annulleret_note"?: string | null,"bodekasse_id"?: string,"dato"?: string,"id"?: string,"oprettet"?: string,"oprettet_af"?: string,"rettet"?: string | null,"rettet_af"?: string | null,"saeson_id"?: string,"titel"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "konkurrence_bodekasse_id_annulleret_af_fkey"
      columns: ["bodekasse_id","annulleret_af"]
isOneToOne: false
      referencedRelation: "medlem"
      referencedColumns: ["bodekasse_id","id"]
    },{
      foreignKeyName: "konkurrence_bodekasse_id_annulleret_af_fkey"
      columns: ["bodekasse_id","annulleret_af"]
isOneToOne: false
      referencedRelation: "medlem_saeson_tal"
      referencedColumns: ["bodekasse_id","medlem_id"]
    },{
      foreignKeyName: "konkurrence_bodekasse_id_annulleret_af_fkey"
      columns: ["bodekasse_id","annulleret_af"]
isOneToOne: false
      referencedRelation: "medlem_saldo"
      referencedColumns: ["bodekasse_id","medlem_id"]
    },{
      foreignKeyName: "konkurrence_bodekasse_id_fkey"
      columns: ["bodekasse_id"]
isOneToOne: false
      referencedRelation: "bodekasse"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "konkurrence_bodekasse_id_fkey"
      columns: ["bodekasse_id"]
isOneToOne: false
      referencedRelation: "bodekasse_saeson"
      referencedColumns: ["bodekasse_id"]
    },{
      foreignKeyName: "konkurrence_bodekasse_id_fkey"
      columns: ["bodekasse_id"]
isOneToOne: false
      referencedRelation: "kassen"
      referencedColumns: ["bodekasse_id"]
    },{
      foreignKeyName: "konkurrence_bodekasse_id_oprettet_af_fkey"
      columns: ["bodekasse_id","oprettet_af"]
isOneToOne: false
      referencedRelation: "medlem"
      referencedColumns: ["bodekasse_id","id"]
    },{
      foreignKeyName: "konkurrence_bodekasse_id_oprettet_af_fkey"
      columns: ["bodekasse_id","oprettet_af"]
isOneToOne: false
      referencedRelation: "medlem_saeson_tal"
      referencedColumns: ["bodekasse_id","medlem_id"]
    },{
      foreignKeyName: "konkurrence_bodekasse_id_oprettet_af_fkey"
      columns: ["bodekasse_id","oprettet_af"]
isOneToOne: false
      referencedRelation: "medlem_saldo"
      referencedColumns: ["bodekasse_id","medlem_id"]
    },{
      foreignKeyName: "konkurrence_bodekasse_id_rettet_af_fkey"
      columns: ["bodekasse_id","rettet_af"]
isOneToOne: false
      referencedRelation: "medlem"
      referencedColumns: ["bodekasse_id","id"]
    },{
      foreignKeyName: "konkurrence_bodekasse_id_rettet_af_fkey"
      columns: ["bodekasse_id","rettet_af"]
isOneToOne: false
      referencedRelation: "medlem_saeson_tal"
      referencedColumns: ["bodekasse_id","medlem_id"]
    },{
      foreignKeyName: "konkurrence_bodekasse_id_rettet_af_fkey"
      columns: ["bodekasse_id","rettet_af"]
isOneToOne: false
      referencedRelation: "medlem_saldo"
      referencedColumns: ["bodekasse_id","medlem_id"]
    },{
      foreignKeyName: "konkurrence_bodekasse_id_saeson_id_fkey"
      columns: ["bodekasse_id","saeson_id"]
isOneToOne: false
      referencedRelation: "saeson"
      referencedColumns: ["bodekasse_id","id"]
    },{
      foreignKeyName: "konkurrence_bodekasse_id_saeson_id_fkey"
      columns: ["bodekasse_id","saeson_id"]
isOneToOne: false
      referencedRelation: "saeson_status"
      referencedColumns: ["bodekasse_id","id"]
    }
                  ]
                },"konkurrence_resultat": {
                  Row: {
                    "bodekasse_id": string,"konkurrence_id": string,"medlem_id": string,"plads": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "bodekasse_id": string,"konkurrence_id": string,"medlem_id": string,"plads"?: number | null
                  }
                  Update: {
                    "bodekasse_id"?: string,"konkurrence_id"?: string,"medlem_id"?: string,"plads"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "konkurrence_resultat_bodekasse_id_fkey"
      columns: ["bodekasse_id"]
isOneToOne: false
      referencedRelation: "bodekasse"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "konkurrence_resultat_bodekasse_id_fkey"
      columns: ["bodekasse_id"]
isOneToOne: false
      referencedRelation: "bodekasse_saeson"
      referencedColumns: ["bodekasse_id"]
    },{
      foreignKeyName: "konkurrence_resultat_bodekasse_id_fkey"
      columns: ["bodekasse_id"]
isOneToOne: false
      referencedRelation: "kassen"
      referencedColumns: ["bodekasse_id"]
    },{
      foreignKeyName: "konkurrence_resultat_bodekasse_id_konkurrence_id_fkey"
      columns: ["bodekasse_id","konkurrence_id"]
isOneToOne: false
      referencedRelation: "konkurrence"
      referencedColumns: ["bodekasse_id","id"]
    },{
      foreignKeyName: "konkurrence_resultat_bodekasse_id_medlem_id_fkey"
      columns: ["bodekasse_id","medlem_id"]
isOneToOne: false
      referencedRelation: "medlem"
      referencedColumns: ["bodekasse_id","id"]
    },{
      foreignKeyName: "konkurrence_resultat_bodekasse_id_medlem_id_fkey"
      columns: ["bodekasse_id","medlem_id"]
isOneToOne: false
      referencedRelation: "medlem_saeson_tal"
      referencedColumns: ["bodekasse_id","medlem_id"]
    },{
      foreignKeyName: "konkurrence_resultat_bodekasse_id_medlem_id_fkey"
      columns: ["bodekasse_id","medlem_id"]
isOneToOne: false
      referencedRelation: "medlem_saldo"
      referencedColumns: ["bodekasse_id","medlem_id"]
    }
                  ]
                },"medlem": {
                  Row: {
                    "bodekasse_id": string,"email": string | null,"er_admin": boolean,"id": string,"navn": string,"oprettet": string,"udmeldt": string | null,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "bodekasse_id": string,"email"?: string | null,"er_admin"?: boolean,"id"?: string,"navn": string,"oprettet"?: string,"udmeldt"?: string | null,"user_id"?: string | null
                  }
                  Update: {
                    "bodekasse_id"?: string,"email"?: string | null,"er_admin"?: boolean,"id"?: string,"navn"?: string,"oprettet"?: string,"udmeldt"?: string | null,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "medlem_bodekasse_id_fkey"
      columns: ["bodekasse_id"]
isOneToOne: false
      referencedRelation: "bodekasse"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "medlem_bodekasse_id_fkey"
      columns: ["bodekasse_id"]
isOneToOne: false
      referencedRelation: "bodekasse_saeson"
      referencedColumns: ["bodekasse_id"]
    },{
      foreignKeyName: "medlem_bodekasse_id_fkey"
      columns: ["bodekasse_id"]
isOneToOne: false
      referencedRelation: "kassen"
      referencedColumns: ["bodekasse_id"]
    }
                  ]
                },"saeson": {
                  Row: {
                    "afsluttet": string | null,"bodekasse_id": string,"id": string,"loebenr": number,"navn": string,"slutdato": string | null,"startet": string
                  }
                  ComputedFields: never
                  Insert: {
                    "afsluttet"?: string | null,"bodekasse_id": string,"id"?: string,"loebenr"?: never,"navn": string,"slutdato"?: string | null,"startet"?: string
                  }
                  Update: {
                    "afsluttet"?: string | null,"bodekasse_id"?: string,"id"?: string,"loebenr"?: never,"navn"?: string,"slutdato"?: string | null,"startet"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "saeson_bodekasse_id_fkey"
      columns: ["bodekasse_id"]
isOneToOne: false
      referencedRelation: "bodekasse"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "saeson_bodekasse_id_fkey"
      columns: ["bodekasse_id"]
isOneToOne: false
      referencedRelation: "bodekasse_saeson"
      referencedColumns: ["bodekasse_id"]
    },{
      foreignKeyName: "saeson_bodekasse_id_fkey"
      columns: ["bodekasse_id"]
isOneToOne: false
      referencedRelation: "kassen"
      referencedColumns: ["bodekasse_id"]
    }
                  ]
                }
          }
          Views: {
            "bode_baerer": {
                  Row: {
                    "afgoerelse": Database["public"]['Enums']["anke_afgoerelse"] | null,"anke_id": string | null,"anket": boolean | null,"annulleret": string | null,"annulleret_af": string | null,"annulleret_note": string | null,"baerer_id": string | null,"batch_id": string | null,"bodekasse_id": string | null,"bodekategori_id": string | null,"giver_id": string | null,"givet": string | null,"grund": string | null,"id": string | null,"modtager_id": string | null,"pris": number | null,"saeson_id": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "bode_bodekasse_id_annulleret_af_fkey"
      columns: ["bodekasse_id","annulleret_af"]
isOneToOne: false
      referencedRelation: "medlem"
      referencedColumns: ["bodekasse_id","id"]
    },{
      foreignKeyName: "bode_bodekasse_id_annulleret_af_fkey"
      columns: ["bodekasse_id","annulleret_af"]
isOneToOne: false
      referencedRelation: "medlem_saeson_tal"
      referencedColumns: ["bodekasse_id","medlem_id"]
    },{
      foreignKeyName: "bode_bodekasse_id_annulleret_af_fkey"
      columns: ["bodekasse_id","annulleret_af"]
isOneToOne: false
      referencedRelation: "medlem_saldo"
      referencedColumns: ["bodekasse_id","medlem_id"]
    },{
      foreignKeyName: "bode_bodekasse_id_bodekategori_id_fkey"
      columns: ["bodekasse_id","bodekategori_id"]
isOneToOne: false
      referencedRelation: "bodekategori"
      referencedColumns: ["bodekasse_id","id"]
    },{
      foreignKeyName: "bode_bodekasse_id_bodekategori_id_fkey"
      columns: ["bodekasse_id","bodekategori_id"]
isOneToOne: false
      referencedRelation: "bodekategori_brug"
      referencedColumns: ["bodekasse_id","bodekategori_id"]
    },{
      foreignKeyName: "bode_bodekasse_id_fkey"
      columns: ["bodekasse_id"]
isOneToOne: false
      referencedRelation: "bodekasse"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bode_bodekasse_id_fkey"
      columns: ["bodekasse_id"]
isOneToOne: false
      referencedRelation: "bodekasse_saeson"
      referencedColumns: ["bodekasse_id"]
    },{
      foreignKeyName: "bode_bodekasse_id_fkey"
      columns: ["bodekasse_id"]
isOneToOne: false
      referencedRelation: "kassen"
      referencedColumns: ["bodekasse_id"]
    },{
      foreignKeyName: "bode_bodekasse_id_giver_id_fkey"
      columns: ["bodekasse_id","giver_id"]
isOneToOne: false
      referencedRelation: "medlem"
      referencedColumns: ["bodekasse_id","id"]
    },{
      foreignKeyName: "bode_bodekasse_id_giver_id_fkey"
      columns: ["bodekasse_id","giver_id"]
isOneToOne: false
      referencedRelation: "medlem_saeson_tal"
      referencedColumns: ["bodekasse_id","medlem_id"]
    },{
      foreignKeyName: "bode_bodekasse_id_giver_id_fkey"
      columns: ["bodekasse_id","giver_id"]
isOneToOne: false
      referencedRelation: "medlem_saldo"
      referencedColumns: ["bodekasse_id","medlem_id"]
    },{
      foreignKeyName: "bode_bodekasse_id_modtager_id_fkey"
      columns: ["bodekasse_id","modtager_id"]
isOneToOne: false
      referencedRelation: "medlem"
      referencedColumns: ["bodekasse_id","id"]
    },{
      foreignKeyName: "bode_bodekasse_id_modtager_id_fkey"
      columns: ["bodekasse_id","modtager_id"]
isOneToOne: false
      referencedRelation: "medlem_saeson_tal"
      referencedColumns: ["bodekasse_id","medlem_id"]
    },{
      foreignKeyName: "bode_bodekasse_id_modtager_id_fkey"
      columns: ["bodekasse_id","modtager_id"]
isOneToOne: false
      referencedRelation: "medlem_saldo"
      referencedColumns: ["bodekasse_id","medlem_id"]
    },{
      foreignKeyName: "bode_bodekasse_id_saeson_id_fkey"
      columns: ["bodekasse_id","saeson_id"]
isOneToOne: false
      referencedRelation: "saeson"
      referencedColumns: ["bodekasse_id","id"]
    },{
      foreignKeyName: "bode_bodekasse_id_saeson_id_fkey"
      columns: ["bodekasse_id","saeson_id"]
isOneToOne: false
      referencedRelation: "saeson_status"
      referencedColumns: ["bodekasse_id","id"]
    }
                  ]
                },"bodekasse_saeson": {
                  Row: {
                    "aktiv_saeson_id": string | null,"bodekasse_id": string | null,"pause": boolean | null,"seneste_saeson_id": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"bodekategori_brug": {
                  Row: {
                    "antal": number | null,"bodekasse_id": string | null,"bodekategori_id": string | null,"ofte_brugt": boolean | null,"saeson_id": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "bodekategori_bodekasse_id_fkey"
      columns: ["bodekasse_id"]
isOneToOne: false
      referencedRelation: "bodekasse"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bodekategori_bodekasse_id_fkey"
      columns: ["bodekasse_id"]
isOneToOne: false
      referencedRelation: "bodekasse_saeson"
      referencedColumns: ["bodekasse_id"]
    },{
      foreignKeyName: "bodekategori_bodekasse_id_fkey"
      columns: ["bodekasse_id"]
isOneToOne: false
      referencedRelation: "kassen"
      referencedColumns: ["bodekasse_id"]
    }
                  ]
                },"kassen": {
                  Row: {
                    "beloeb": number | null,"bodekasse_id": string | null,"haevet": number | null,"indbetalt": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"medlem_saeson_tal": {
                  Row: {
                    "bodekasse_id": string | null,"boeder_i_alt": number | null,"indbetalt": number | null,"medlem_id": string | null,"overfoert": number | null,"saeson_id": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "medlem_bodekasse_id_fkey"
      columns: ["bodekasse_id"]
isOneToOne: false
      referencedRelation: "bodekasse"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "medlem_bodekasse_id_fkey"
      columns: ["bodekasse_id"]
isOneToOne: false
      referencedRelation: "bodekasse_saeson"
      referencedColumns: ["bodekasse_id"]
    },{
      foreignKeyName: "medlem_bodekasse_id_fkey"
      columns: ["bodekasse_id"]
isOneToOne: false
      referencedRelation: "kassen"
      referencedColumns: ["bodekasse_id"]
    }
                  ]
                },"medlem_saldo": {
                  Row: {
                    "bodekasse_id": string | null,"medlem_id": string | null,"saldo": number | null
                  }
                  ComputedFields: never
                  Insert: {
                           "bodekasse_id"?: string | null,"medlem_id"?: string | null,"saldo"?: never
                         }
                        Update: {
                           "bodekasse_id"?: string | null,"medlem_id"?: string | null,"saldo"?: never
                         }
                        Relationships: [
                    {
      foreignKeyName: "medlem_bodekasse_id_fkey"
      columns: ["bodekasse_id"]
isOneToOne: false
      referencedRelation: "bodekasse"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "medlem_bodekasse_id_fkey"
      columns: ["bodekasse_id"]
isOneToOne: false
      referencedRelation: "bodekasse_saeson"
      referencedColumns: ["bodekasse_id"]
    },{
      foreignKeyName: "medlem_bodekasse_id_fkey"
      columns: ["bodekasse_id"]
isOneToOne: false
      referencedRelation: "kassen"
      referencedColumns: ["bodekasse_id"]
    }
                  ]
                },"saeson_status": {
                  Row: {
                    "afsluttet": string | null,"bodekasse_id": string | null,"er_seneste": boolean | null,"id": string | null,"koerer": boolean | null,"loebenr": number | null,"navn": string | null,"slutdato": string | null,"slutter": string | null,"startet": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "saeson_bodekasse_id_fkey"
      columns: ["bodekasse_id"]
isOneToOne: false
      referencedRelation: "bodekasse"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "saeson_bodekasse_id_fkey"
      columns: ["bodekasse_id"]
isOneToOne: false
      referencedRelation: "bodekasse_saeson"
      referencedColumns: ["bodekasse_id"]
    },{
      foreignKeyName: "saeson_bodekasse_id_fkey"
      columns: ["bodekasse_id"]
isOneToOne: false
      referencedRelation: "kassen"
      referencedColumns: ["bodekasse_id"]
    }
                  ]
                }
          }
          Functions: {
            [_ in never]: never
          }
          Enums: {
            "anke_afgoerelse": "modtager_vandt"|"giver_vandt"|"ikke_afgjort","gebyr_art": "oprettelse"|"engangsbode"|"anke"|"frikob"|"placering"|"fravaer","melding_status": "afventer"|"bekraeftet"|"afvist"|"trukket"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "anke_afgoerelse": ["modtager_vandt", "giver_vandt", "ikke_afgjort"],"gebyr_art": ["oprettelse", "engangsbode", "anke", "frikob", "placering", "fravaer"],"melding_status": ["afventer", "bekraeftet", "afvist", "trukket"]
          }
        }
} as const
