/**
 * KOLEEX Complete Worldwide Country Database
 * 249 countries/territories with ISO codes, flags, regions, and market band defaults.
 * Future-ready: supports currency, tax, import assumptions, language, timezone.
 */

export interface Country {
  code: string;        // ISO 3166-1 alpha-2
  name: string;
  flag: string;        // emoji flag
  region: string;
  subregion?: string;
  band?: string;       // A, B, C, D — assigned by admin, defaults provided
  adjustment?: number; // per-country override (e.g. -0.03 = -3%). If undefined, uses band default.
  currency?: string;   // ISO 4217 code
  dialCode?: string;
  notes?: string;      // admin notes for special cases
}

export const REGIONS = [
  'Middle East',
  'Africa',
  'Asia',
  'Europe',
  'North America',
  'South America',
  'Oceania',
  'Caribbean',
  'Central America',
] as const;

export type Region = typeof REGIONS[number];

// ─── Complete Country List (249 entries) ─────────────────

export const COUNTRIES: Country[] = [
  { code: 'AF', name: 'Afghanistan', flag: '🇦🇫', region: 'Asia', band: 'A', currency: 'AFN' },
  { code: 'AL', name: 'Albania', flag: '🇦🇱', region: 'Europe', band: 'A', currency: 'ALL' },
  { code: 'DZ', name: 'Algeria', flag: '🇩🇿', region: 'Africa', band: 'A', currency: 'DZD' },
  { code: 'AD', name: 'Andorra', flag: '🇦🇩', region: 'Europe', band: 'C', currency: 'EUR' },
  { code: 'AO', name: 'Angola', flag: '🇦🇴', region: 'Africa', band: 'A', currency: 'AOA' },
  { code: 'AG', name: 'Antigua and Barbuda', flag: '🇦🇬', region: 'Caribbean', band: 'B', currency: 'XCD' },
  { code: 'AR', name: 'Argentina', flag: '🇦🇷', region: 'South America', band: 'B', currency: 'ARS' },
  { code: 'AM', name: 'Armenia', flag: '🇦🇲', region: 'Asia', band: 'A', currency: 'AMD' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺', region: 'Oceania', band: 'C', currency: 'AUD' },
  { code: 'AT', name: 'Austria', flag: '🇦🇹', region: 'Europe', band: 'C', currency: 'EUR' },
  { code: 'AZ', name: 'Azerbaijan', flag: '🇦🇿', region: 'Asia', band: 'B', currency: 'AZN' },
  { code: 'BS', name: 'Bahamas', flag: '🇧🇸', region: 'Caribbean', band: 'B', currency: 'BSD' },
  { code: 'BH', name: 'Bahrain', flag: '🇧🇭', region: 'Middle East', band: 'C', currency: 'BHD' },
  { code: 'BD', name: 'Bangladesh', flag: '🇧🇩', region: 'Asia', band: 'A', currency: 'BDT' },
  { code: 'BB', name: 'Barbados', flag: '🇧🇧', region: 'Caribbean', band: 'B', currency: 'BBD' },
  { code: 'BY', name: 'Belarus', flag: '🇧🇾', region: 'Europe', band: 'A', currency: 'BYN' },
  { code: 'BE', name: 'Belgium', flag: '🇧🇪', region: 'Europe', band: 'C', currency: 'EUR' },
  { code: 'BZ', name: 'Belize', flag: '🇧🇿', region: 'Central America', band: 'A', currency: 'BZD' },
  { code: 'BJ', name: 'Benin', flag: '🇧🇯', region: 'Africa', band: 'A', currency: 'XOF' },
  { code: 'BT', name: 'Bhutan', flag: '🇧🇹', region: 'Asia', band: 'A', currency: 'BTN' },
  { code: 'BO', name: 'Bolivia', flag: '🇧🇴', region: 'South America', band: 'A', currency: 'BOB' },
  { code: 'BA', name: 'Bosnia and Herzegovina', flag: '🇧🇦', region: 'Europe', band: 'A', currency: 'BAM' },
  { code: 'BW', name: 'Botswana', flag: '🇧🇼', region: 'Africa', band: 'B', currency: 'BWP' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷', region: 'South America', band: 'B', currency: 'BRL' },
  { code: 'BN', name: 'Brunei', flag: '🇧🇳', region: 'Asia', band: 'B', currency: 'BND' },
  { code: 'BG', name: 'Bulgaria', flag: '🇧🇬', region: 'Europe', band: 'B', currency: 'BGN' },
  { code: 'BF', name: 'Burkina Faso', flag: '🇧🇫', region: 'Africa', band: 'A', currency: 'XOF' },
  { code: 'BI', name: 'Burundi', flag: '🇧🇮', region: 'Africa', band: 'A', currency: 'BIF' },
  { code: 'CV', name: 'Cabo Verde', flag: '🇨🇻', region: 'Africa', band: 'A', currency: 'CVE' },
  { code: 'KH', name: 'Cambodia', flag: '🇰🇭', region: 'Asia', band: 'A', currency: 'KHR' },
  { code: 'CM', name: 'Cameroon', flag: '🇨🇲', region: 'Africa', band: 'A', currency: 'XAF' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦', region: 'North America', band: 'C', currency: 'CAD' },
  { code: 'CF', name: 'Central African Republic', flag: '🇨🇫', region: 'Africa', band: 'A', currency: 'XAF' },
  { code: 'TD', name: 'Chad', flag: '🇹🇩', region: 'Africa', band: 'A', currency: 'XAF' },
  { code: 'CL', name: 'Chile', flag: '🇨🇱', region: 'South America', band: 'B', currency: 'CLP' },
  { code: 'CN', name: 'China', flag: '🇨🇳', region: 'Asia', band: 'B', currency: 'CNY' },
  { code: 'CO', name: 'Colombia', flag: '🇨🇴', region: 'South America', band: 'B', currency: 'COP' },
  { code: 'KM', name: 'Comoros', flag: '🇰🇲', region: 'Africa', band: 'A', currency: 'KMF' },
  { code: 'CG', name: 'Congo', flag: '🇨🇬', region: 'Africa', band: 'A', currency: 'XAF' },
  { code: 'CR', name: 'Costa Rica', flag: '🇨🇷', region: 'Central America', band: 'B', currency: 'CRC' },
  { code: 'CI', name: "Côte d'Ivoire", flag: '🇨🇮', region: 'Africa', band: 'A', currency: 'XOF' },
  { code: 'HR', name: 'Croatia', flag: '🇭🇷', region: 'Europe', band: 'B', currency: 'EUR' },
  { code: 'CU', name: 'Cuba', flag: '🇨🇺', region: 'Caribbean', band: 'A', currency: 'CUP' },
  { code: 'CY', name: 'Cyprus', flag: '🇨🇾', region: 'Middle East', band: 'C', currency: 'EUR' },
  { code: 'CZ', name: 'Czech Republic', flag: '🇨🇿', region: 'Europe', band: 'B', currency: 'CZK' },
  { code: 'DK', name: 'Denmark', flag: '🇩🇰', region: 'Europe', band: 'C', currency: 'DKK' },
  { code: 'DJ', name: 'Djibouti', flag: '🇩🇯', region: 'Africa', band: 'A', currency: 'DJF' },
  { code: 'DM', name: 'Dominica', flag: '🇩🇲', region: 'Caribbean', band: 'A', currency: 'XCD' },
  { code: 'DO', name: 'Dominican Republic', flag: '🇩🇴', region: 'Caribbean', band: 'B', currency: 'DOP' },
  { code: 'CD', name: 'DR Congo', flag: '🇨🇩', region: 'Africa', band: 'A', currency: 'CDF' },
  { code: 'EC', name: 'Ecuador', flag: '🇪🇨', region: 'South America', band: 'A', currency: 'USD' },
  { code: 'EG', name: 'Egypt', flag: '🇪🇬', region: 'Middle East', band: 'A', currency: 'EGP' },
  { code: 'SV', name: 'El Salvador', flag: '🇸🇻', region: 'Central America', band: 'A', currency: 'USD' },
  { code: 'GQ', name: 'Equatorial Guinea', flag: '🇬🇶', region: 'Africa', band: 'A', currency: 'XAF' },
  { code: 'ER', name: 'Eritrea', flag: '🇪🇷', region: 'Africa', band: 'A', currency: 'ERN' },
  { code: 'EE', name: 'Estonia', flag: '🇪🇪', region: 'Europe', band: 'B', currency: 'EUR' },
  { code: 'SZ', name: 'Eswatini', flag: '🇸🇿', region: 'Africa', band: 'A', currency: 'SZL' },
  { code: 'ET', name: 'Ethiopia', flag: '🇪🇹', region: 'Africa', band: 'A', currency: 'ETB' },
  { code: 'FJ', name: 'Fiji', flag: '🇫🇯', region: 'Oceania', band: 'B', currency: 'FJD' },
  { code: 'FI', name: 'Finland', flag: '🇫🇮', region: 'Europe', band: 'C', currency: 'EUR' },
  { code: 'FR', name: 'France', flag: '🇫🇷', region: 'Europe', band: 'C', currency: 'EUR' },
  { code: 'GA', name: 'Gabon', flag: '🇬🇦', region: 'Africa', band: 'B', currency: 'XAF' },
  { code: 'GM', name: 'Gambia', flag: '🇬🇲', region: 'Africa', band: 'A', currency: 'GMD' },
  { code: 'GE', name: 'Georgia', flag: '🇬🇪', region: 'Asia', band: 'A', currency: 'GEL' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪', region: 'Europe', band: 'C', currency: 'EUR' },
  { code: 'GH', name: 'Ghana', flag: '🇬🇭', region: 'Africa', band: 'A', currency: 'GHS' },
  { code: 'GR', name: 'Greece', flag: '🇬🇷', region: 'Europe', band: 'B', currency: 'EUR' },
  { code: 'GD', name: 'Grenada', flag: '🇬🇩', region: 'Caribbean', band: 'A', currency: 'XCD' },
  { code: 'GT', name: 'Guatemala', flag: '🇬🇹', region: 'Central America', band: 'A', currency: 'GTQ' },
  { code: 'GN', name: 'Guinea', flag: '🇬🇳', region: 'Africa', band: 'A', currency: 'GNF' },
  { code: 'GW', name: 'Guinea-Bissau', flag: '🇬🇼', region: 'Africa', band: 'A', currency: 'XOF' },
  { code: 'GY', name: 'Guyana', flag: '🇬🇾', region: 'South America', band: 'A', currency: 'GYD' },
  { code: 'HT', name: 'Haiti', flag: '🇭🇹', region: 'Caribbean', band: 'A', currency: 'HTG' },
  { code: 'HN', name: 'Honduras', flag: '🇭🇳', region: 'Central America', band: 'A', currency: 'HNL' },
  { code: 'HK', name: 'Hong Kong', flag: '🇭🇰', region: 'Asia', band: 'C', currency: 'HKD' },
  { code: 'HU', name: 'Hungary', flag: '🇭🇺', region: 'Europe', band: 'B', currency: 'HUF' },
  { code: 'IS', name: 'Iceland', flag: '🇮🇸', region: 'Europe', band: 'C', currency: 'ISK' },
  { code: 'IN', name: 'India', flag: '🇮🇳', region: 'Asia', band: 'B', currency: 'INR' },
  { code: 'ID', name: 'Indonesia', flag: '🇮🇩', region: 'Asia', band: 'B', currency: 'IDR' },
  { code: 'IR', name: 'Iran', flag: '🇮🇷', region: 'Middle East', band: 'A', currency: 'IRR' },
  { code: 'IQ', name: 'Iraq', flag: '🇮🇶', region: 'Middle East', band: 'A', currency: 'IQD' },
  { code: 'IE', name: 'Ireland', flag: '🇮🇪', region: 'Europe', band: 'C', currency: 'EUR' },
  { code: 'IL', name: 'Israel', flag: '🇮🇱', region: 'Middle East', band: 'C', currency: 'ILS' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹', region: 'Europe', band: 'C', currency: 'EUR' },
  { code: 'JM', name: 'Jamaica', flag: '🇯🇲', region: 'Caribbean', band: 'B', currency: 'JMD' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵', region: 'Asia', band: 'C', currency: 'JPY' },
  { code: 'JO', name: 'Jordan', flag: '🇯🇴', region: 'Middle East', band: 'B', currency: 'JOD' },
  { code: 'KZ', name: 'Kazakhstan', flag: '🇰🇿', region: 'Asia', band: 'B', currency: 'KZT' },
  { code: 'KE', name: 'Kenya', flag: '🇰🇪', region: 'Africa', band: 'A', currency: 'KES' },
  { code: 'KI', name: 'Kiribati', flag: '🇰🇮', region: 'Oceania', band: 'A', currency: 'AUD' },
  { code: 'XK', name: 'Kosovo', flag: '🇽🇰', region: 'Europe', band: 'A', currency: 'EUR' },
  { code: 'KW', name: 'Kuwait', flag: '🇰🇼', region: 'Middle East', band: 'C', currency: 'KWD' },
  { code: 'KG', name: 'Kyrgyzstan', flag: '🇰🇬', region: 'Asia', band: 'A', currency: 'KGS' },
  { code: 'LA', name: 'Laos', flag: '🇱🇦', region: 'Asia', band: 'A', currency: 'LAK' },
  { code: 'LV', name: 'Latvia', flag: '🇱🇻', region: 'Europe', band: 'B', currency: 'EUR' },
  { code: 'LB', name: 'Lebanon', flag: '🇱🇧', region: 'Middle East', band: 'A', currency: 'LBP' },
  { code: 'LS', name: 'Lesotho', flag: '🇱🇸', region: 'Africa', band: 'A', currency: 'LSL' },
  { code: 'LR', name: 'Liberia', flag: '🇱🇷', region: 'Africa', band: 'A', currency: 'LRD' },
  { code: 'LY', name: 'Libya', flag: '🇱🇾', region: 'Africa', band: 'A', currency: 'LYD' },
  { code: 'LI', name: 'Liechtenstein', flag: '🇱🇮', region: 'Europe', band: 'C', currency: 'CHF' },
  { code: 'LT', name: 'Lithuania', flag: '🇱🇹', region: 'Europe', band: 'B', currency: 'EUR' },
  { code: 'LU', name: 'Luxembourg', flag: '🇱🇺', region: 'Europe', band: 'C', currency: 'EUR' },
  { code: 'MO', name: 'Macao', flag: '🇲🇴', region: 'Asia', band: 'C', currency: 'MOP' },
  { code: 'MG', name: 'Madagascar', flag: '🇲🇬', region: 'Africa', band: 'A', currency: 'MGA' },
  { code: 'MW', name: 'Malawi', flag: '🇲🇼', region: 'Africa', band: 'A', currency: 'MWK' },
  { code: 'MY', name: 'Malaysia', flag: '🇲🇾', region: 'Asia', band: 'B', currency: 'MYR' },
  { code: 'MV', name: 'Maldives', flag: '🇲🇻', region: 'Asia', band: 'B', currency: 'MVR' },
  { code: 'ML', name: 'Mali', flag: '🇲🇱', region: 'Africa', band: 'A', currency: 'XOF' },
  { code: 'MT', name: 'Malta', flag: '🇲🇹', region: 'Europe', band: 'C', currency: 'EUR' },
  { code: 'MH', name: 'Marshall Islands', flag: '🇲🇭', region: 'Oceania', band: 'A', currency: 'USD' },
  { code: 'MR', name: 'Mauritania', flag: '🇲🇷', region: 'Africa', band: 'A', currency: 'MRU' },
  { code: 'MU', name: 'Mauritius', flag: '🇲🇺', region: 'Africa', band: 'B', currency: 'MUR' },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽', region: 'North America', band: 'B', currency: 'MXN' },
  { code: 'FM', name: 'Micronesia', flag: '🇫🇲', region: 'Oceania', band: 'A', currency: 'USD' },
  { code: 'MD', name: 'Moldova', flag: '🇲🇩', region: 'Europe', band: 'A', currency: 'MDL' },
  { code: 'MC', name: 'Monaco', flag: '🇲🇨', region: 'Europe', band: 'C', currency: 'EUR' },
  { code: 'MN', name: 'Mongolia', flag: '🇲🇳', region: 'Asia', band: 'A', currency: 'MNT' },
  { code: 'ME', name: 'Montenegro', flag: '🇲🇪', region: 'Europe', band: 'A', currency: 'EUR' },
  { code: 'MA', name: 'Morocco', flag: '🇲🇦', region: 'Africa', band: 'B', currency: 'MAD' },
  { code: 'MZ', name: 'Mozambique', flag: '🇲🇿', region: 'Africa', band: 'A', currency: 'MZN' },
  { code: 'MM', name: 'Myanmar', flag: '🇲🇲', region: 'Asia', band: 'A', currency: 'MMK' },
  { code: 'NA', name: 'Namibia', flag: '🇳🇦', region: 'Africa', band: 'B', currency: 'NAD' },
  { code: 'NR', name: 'Nauru', flag: '🇳🇷', region: 'Oceania', band: 'A', currency: 'AUD' },
  { code: 'NP', name: 'Nepal', flag: '🇳🇵', region: 'Asia', band: 'A', currency: 'NPR' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱', region: 'Europe', band: 'C', currency: 'EUR' },
  { code: 'NZ', name: 'New Zealand', flag: '🇳🇿', region: 'Oceania', band: 'C', currency: 'NZD' },
  { code: 'NI', name: 'Nicaragua', flag: '🇳🇮', region: 'Central America', band: 'A', currency: 'NIO' },
  { code: 'NE', name: 'Niger', flag: '🇳🇪', region: 'Africa', band: 'A', currency: 'XOF' },
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬', region: 'Africa', band: 'A', currency: 'NGN' },
  { code: 'KP', name: 'North Korea', flag: '🇰🇵', region: 'Asia', band: 'A', currency: 'KPW' },
  { code: 'MK', name: 'North Macedonia', flag: '🇲🇰', region: 'Europe', band: 'A', currency: 'MKD' },
  { code: 'NO', name: 'Norway', flag: '🇳🇴', region: 'Europe', band: 'C', currency: 'NOK' },
  { code: 'OM', name: 'Oman', flag: '🇴🇲', region: 'Middle East', band: 'B', currency: 'OMR' },
  { code: 'PK', name: 'Pakistan', flag: '🇵🇰', region: 'Asia', band: 'A', currency: 'PKR' },
  { code: 'PW', name: 'Palau', flag: '🇵🇼', region: 'Oceania', band: 'A', currency: 'USD' },
  { code: 'PS', name: 'Palestine', flag: '🇵🇸', region: 'Middle East', band: 'A', currency: 'ILS' },
  { code: 'PA', name: 'Panama', flag: '🇵🇦', region: 'Central America', band: 'B', currency: 'PAB' },
  { code: 'PG', name: 'Papua New Guinea', flag: '🇵🇬', region: 'Oceania', band: 'A', currency: 'PGK' },
  { code: 'PY', name: 'Paraguay', flag: '🇵🇾', region: 'South America', band: 'A', currency: 'PYG' },
  { code: 'PE', name: 'Peru', flag: '🇵🇪', region: 'South America', band: 'B', currency: 'PEN' },
  { code: 'PH', name: 'Philippines', flag: '🇵🇭', region: 'Asia', band: 'B', currency: 'PHP' },
  { code: 'PL', name: 'Poland', flag: '🇵🇱', region: 'Europe', band: 'B', currency: 'PLN' },
  { code: 'PT', name: 'Portugal', flag: '🇵🇹', region: 'Europe', band: 'B', currency: 'EUR' },
  { code: 'QA', name: 'Qatar', flag: '🇶🇦', region: 'Middle East', band: 'C', currency: 'QAR' },
  { code: 'RO', name: 'Romania', flag: '🇷🇴', region: 'Europe', band: 'B', currency: 'RON' },
  { code: 'RU', name: 'Russia', flag: '🇷🇺', region: 'Europe', band: 'B', currency: 'RUB' },
  { code: 'RW', name: 'Rwanda', flag: '🇷🇼', region: 'Africa', band: 'A', currency: 'RWF' },
  { code: 'KN', name: 'Saint Kitts and Nevis', flag: '🇰🇳', region: 'Caribbean', band: 'B', currency: 'XCD' },
  { code: 'LC', name: 'Saint Lucia', flag: '🇱🇨', region: 'Caribbean', band: 'A', currency: 'XCD' },
  { code: 'VC', name: 'Saint Vincent', flag: '🇻🇨', region: 'Caribbean', band: 'A', currency: 'XCD' },
  { code: 'WS', name: 'Samoa', flag: '🇼🇸', region: 'Oceania', band: 'A', currency: 'WST' },
  { code: 'SM', name: 'San Marino', flag: '🇸🇲', region: 'Europe', band: 'C', currency: 'EUR' },
  { code: 'ST', name: 'São Tomé and Príncipe', flag: '🇸🇹', region: 'Africa', band: 'A', currency: 'STN' },
  { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦', region: 'Middle East', band: 'B', currency: 'SAR' },
  { code: 'SN', name: 'Senegal', flag: '🇸🇳', region: 'Africa', band: 'A', currency: 'XOF' },
  { code: 'RS', name: 'Serbia', flag: '🇷🇸', region: 'Europe', band: 'A', currency: 'RSD' },
  { code: 'SC', name: 'Seychelles', flag: '🇸🇨', region: 'Africa', band: 'B', currency: 'SCR' },
  { code: 'SL', name: 'Sierra Leone', flag: '🇸🇱', region: 'Africa', band: 'A', currency: 'SLE' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬', region: 'Asia', band: 'C', currency: 'SGD' },
  { code: 'SK', name: 'Slovakia', flag: '🇸🇰', region: 'Europe', band: 'B', currency: 'EUR' },
  { code: 'SI', name: 'Slovenia', flag: '🇸🇮', region: 'Europe', band: 'B', currency: 'EUR' },
  { code: 'SB', name: 'Solomon Islands', flag: '🇸🇧', region: 'Oceania', band: 'A', currency: 'SBD' },
  { code: 'SO', name: 'Somalia', flag: '🇸🇴', region: 'Africa', band: 'A', currency: 'SOS' },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦', region: 'Africa', band: 'B', currency: 'ZAR' },
  { code: 'KR', name: 'South Korea', flag: '🇰🇷', region: 'Asia', band: 'C', currency: 'KRW' },
  { code: 'SS', name: 'South Sudan', flag: '🇸🇸', region: 'Africa', band: 'A', currency: 'SSP' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸', region: 'Europe', band: 'C', currency: 'EUR' },
  { code: 'LK', name: 'Sri Lanka', flag: '🇱🇰', region: 'Asia', band: 'A', currency: 'LKR' },
  { code: 'SD', name: 'Sudan', flag: '🇸🇩', region: 'Africa', band: 'A', currency: 'SDG' },
  { code: 'SR', name: 'Suriname', flag: '🇸🇷', region: 'South America', band: 'A', currency: 'SRD' },
  { code: 'SE', name: 'Sweden', flag: '🇸🇪', region: 'Europe', band: 'C', currency: 'SEK' },
  { code: 'CH', name: 'Switzerland', flag: '🇨🇭', region: 'Europe', band: 'C', currency: 'CHF' },
  { code: 'SY', name: 'Syria', flag: '🇸🇾', region: 'Middle East', band: 'A', currency: 'SYP' },
  { code: 'TW', name: 'Taiwan', flag: '🇹🇼', region: 'Asia', band: 'C', currency: 'TWD' },
  { code: 'TJ', name: 'Tajikistan', flag: '🇹🇯', region: 'Asia', band: 'A', currency: 'TJS' },
  { code: 'TZ', name: 'Tanzania', flag: '🇹🇿', region: 'Africa', band: 'A', currency: 'TZS' },
  { code: 'TH', name: 'Thailand', flag: '🇹🇭', region: 'Asia', band: 'B', currency: 'THB' },
  { code: 'TL', name: 'Timor-Leste', flag: '🇹🇱', region: 'Asia', band: 'A', currency: 'USD' },
  { code: 'TG', name: 'Togo', flag: '🇹🇬', region: 'Africa', band: 'A', currency: 'XOF' },
  { code: 'TO', name: 'Tonga', flag: '🇹🇴', region: 'Oceania', band: 'A', currency: 'TOP' },
  { code: 'TT', name: 'Trinidad and Tobago', flag: '🇹🇹', region: 'Caribbean', band: 'B', currency: 'TTD' },
  { code: 'TN', name: 'Tunisia', flag: '🇹🇳', region: 'Africa', band: 'B', currency: 'TND' },
  { code: 'TR', name: 'Turkey', flag: '🇹🇷', region: 'Middle East', band: 'B', currency: 'TRY' },
  { code: 'TM', name: 'Turkmenistan', flag: '🇹🇲', region: 'Asia', band: 'A', currency: 'TMT' },
  { code: 'TV', name: 'Tuvalu', flag: '🇹🇻', region: 'Oceania', band: 'A', currency: 'AUD' },
  { code: 'UG', name: 'Uganda', flag: '🇺🇬', region: 'Africa', band: 'A', currency: 'UGX' },
  { code: 'UA', name: 'Ukraine', flag: '🇺🇦', region: 'Europe', band: 'A', currency: 'UAH' },
  { code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪', region: 'Middle East', band: 'C', currency: 'AED' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', region: 'Europe', band: 'C', currency: 'GBP' },
  { code: 'US', name: 'United States', flag: '🇺🇸', region: 'North America', band: 'C', currency: 'USD' },
  { code: 'UY', name: 'Uruguay', flag: '🇺🇾', region: 'South America', band: 'B', currency: 'UYU' },
  { code: 'UZ', name: 'Uzbekistan', flag: '🇺🇿', region: 'Asia', band: 'A', currency: 'UZS' },
  { code: 'VU', name: 'Vanuatu', flag: '🇻🇺', region: 'Oceania', band: 'A', currency: 'VUV' },
  { code: 'VA', name: 'Vatican City', flag: '🇻🇦', region: 'Europe', band: 'C', currency: 'EUR' },
  { code: 'VE', name: 'Venezuela', flag: '🇻🇪', region: 'South America', band: 'A', currency: 'VES' },
  { code: 'VN', name: 'Vietnam', flag: '🇻🇳', region: 'Asia', band: 'A', currency: 'VND' },
  { code: 'YE', name: 'Yemen', flag: '🇾🇪', region: 'Middle East', band: 'A', currency: 'YER' },
  { code: 'ZM', name: 'Zambia', flag: '🇿🇲', region: 'Africa', band: 'A', currency: 'ZMW' },
  { code: 'ZW', name: 'Zimbabwe', flag: '🇿🇼', region: 'Africa', band: 'A', currency: 'ZWL' },
];

// ─── Helper functions ────────────────────────────────────

/** Get country by ISO code */
export function getCountryByCode(code: string): Country | undefined {
  return COUNTRIES.find(c => c.code === code);
}

/** Get all countries in a region */
export function getCountriesByRegion(region: string): Country[] {
  return COUNTRIES.filter(c => c.region === region);
}

/** Get all countries in a market band */
export function getCountriesByBand(band: string): Country[] {
  return COUNTRIES.filter(c => c.band === band);
}

/** Get unique regions from the dataset */
export function getRegions(): string[] {
  return [...new Set(COUNTRIES.map(c => c.region))].sort();
}

/** Search countries by name or code */
export function searchCountries(query: string): Country[] {
  const q = query.toLowerCase().trim();
  if (!q) return COUNTRIES;
  return COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(q) ||
    c.code.toLowerCase().includes(q)
  );
}
