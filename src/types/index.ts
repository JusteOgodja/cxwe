export interface Brand {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logo_url?: string;
  is_active: boolean;
  created_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  slug: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  country?: string;
  description?: string;
  logo_url?: string;
  is_active: boolean;
  created_at: string;
}

export interface Dimensions {
  length: number;
  width: number;
  height: number;
  weight_net?: number;
  weight_brut?: number;
  volume?: number;
}

export interface Palettisation {
  cartons_per_layer: number;
  layers_per_palette: number;
}

export interface PricingTier {
  id?: string;
  product_id?: string;
  min_quantity: number;
  price: number;
  currency: string;
}

export interface ProductLot {
  id: string;
  product_id: string;
  batch_number: string;
  quantity: number;
  expiry_date?: string;
  is_active: boolean;
  created_at: string;
}

// Product — matches actual Supabase DB column names (snake_case)
export interface Product {
  id: string;

  // Basic
  name: string;
  description: string;
  details: string[];
  image_url: string;
  sort_order: number;
  is_active: boolean;

  // Organization
  category_id: string;
  marque_id?: string;
  fournisseur_id?: string;
  sous_categories_ids?: string[];

  // Identification
  ean?: string;
  hs_code?: string;

  // Storage & conservation
  temperature: 'Ambiante' | 'Réfrigéré' | 'Frais' | 'Surgelé';
  duree_conservation: number;

  // Logistics
  commande_min: number;
  colisage: number;
  palettisation?: Palettisation;
  dimensions_unite?: Dimensions;
  dimensions_carton?: Dimensions;
  dimensions_palette?: Dimensions;

  // Pricing
  devise: string;
  pricing_tiers?: PricingTier[];

  // Commerce
  incoterms_dispo?: string[];
  pays_origine: string;
  pays_export_autorises?: string[];

  // Compliance
  certifications?: string[];
  regimes?: string[];

  // Composition
  allergenes?: string[];
  ingredients_texte?: string;
  nutrition_texte?: string;

  // Marketing
  note_moyenne: number;
  nb_avis: number;
  is_new: boolean;
  is_promo: boolean;
  est_sponsored: boolean;

  // Sourcing
  source_platform?: string;
  source_url?: string;
  poids?: number;
  poids_unite?: string;
  prix_ancien?: number;
  remise_pct?: number;

  // Status
  statut: 'actif' | 'inactif' | 'brouillon' | 'archivé';

  // Timestamps
  created_at: string;
  updated_at?: string;

  // Joined via Supabase select
  category?: { name: string; slug: string };
  brand?: { name: string; slug: string };
  supplier?: { name: string; slug: string };
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  image_url: string;
  parentId?: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface QuoteRequest {
  id: string;
  // Buyer identity
  company_name: string;
  buyer_vat_number?: string;
  contact_name: string;
  email: string;
  phone?: string;
  country: string;
  // Billing address
  buyer_address?: string;
  buyer_city?: string;
  buyer_postal_code?: string;
  // Delivery
  delivery_address?: string;
  delivery_country?: string;
  // Products
  products_interested: string;
  quantity_notes?: string;
  // Commercial terms
  incoterm?: string;
  port_loading?: string;
  port_destination?: string;
  currency?: string;
  payment_terms?: string;
  container_type?: string;
  delivery_date?: string;
  order_frequency?: string;
  // Requirements
  required_certifications?: string[];
  labeling_requirements?: string;
  private_label?: boolean;
  sample_request?: boolean;
  // Notes & status
  message?: string;
  status: QuoteStatus;
  created_at: string;
}

export type QuoteStatus = 'new' | 'in_review' | 'responded' | 'closed';
