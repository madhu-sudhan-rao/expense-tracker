import {
  siAmericanexpress,
  siAxisbank,
  siDinersclub,
  siHdfcbank,
  siHsbc,
  siIcicibank,
  siMastercard,
  siPaytm,
  siPhonepe,
  siVisa,
  type SimpleIcon,
} from 'simple-icons'

export interface Brand {
  key: string
  name: string
  /** Initials for the badge when no logo exists. */
  short: string
  color: string
  logo?: SimpleIcon
}

// Banks without a logo in Simple Icons get an initials badge in their brand colour.
export const BANKS: Brand[] = [
  { key: 'sbi', name: 'State Bank of India', short: 'SBI', color: '#22409A' },
  { key: 'hdfc', name: 'HDFC Bank', short: 'HDFC', color: '#004B8D', logo: siHdfcbank },
  { key: 'icici', name: 'ICICI Bank', short: 'ICICI', color: '#AE282E', logo: siIcicibank },
  { key: 'axis', name: 'Axis Bank', short: 'AXIS', color: '#971A4D', logo: siAxisbank },
  { key: 'kotak', name: 'Kotak Mahindra Bank', short: 'KMB', color: '#ED1C24' },
  { key: 'yes', name: 'Yes Bank', short: 'YES', color: '#0055A4' },
  { key: 'idfc', name: 'IDFC FIRST Bank', short: 'IDFC', color: '#9C1D26' },
  { key: 'indusind', name: 'IndusInd Bank', short: 'IIB', color: '#8B1D41' },
  { key: 'bob', name: 'Bank of Baroda', short: 'BoB', color: '#F26522' },
  { key: 'pnb', name: 'Punjab National Bank', short: 'PNB', color: '#A20A3A' },
  { key: 'canara', name: 'Canara Bank', short: 'CB', color: '#0091D5' },
  { key: 'union', name: 'Union Bank of India', short: 'UBI', color: '#E31E24' },
  { key: 'boi', name: 'Bank of India', short: 'BOI', color: '#F58220' },
  { key: 'federal', name: 'Federal Bank', short: 'FB', color: '#1E4C9A' },
  { key: 'au', name: 'AU Small Finance Bank', short: 'AU', color: '#6D2077' },
  { key: 'idbi', name: 'IDBI Bank', short: 'IDBI', color: '#00836C' },
  { key: 'rbl', name: 'RBL Bank', short: 'RBL', color: '#21409A' },
  { key: 'hsbc', name: 'HSBC', short: 'HSBC', color: '#DB0011', logo: siHsbc },
  { key: 'sc', name: 'Standard Chartered', short: 'SC', color: '#0072AA' },
]

export const WALLETS: Brand[] = [
  { key: 'paytm', name: 'Paytm', short: 'Paytm', color: '#20336B', logo: siPaytm },
  { key: 'phonepe', name: 'PhonePe', short: 'Pe', color: '#5F259F', logo: siPhonepe },
  { key: 'amazonpay', name: 'Amazon Pay', short: 'aPay', color: '#232F3E' },
  { key: 'mobikwik', name: 'MobiKwik', short: 'MK', color: '#1A73E8' },
]

export const NETWORKS: Brand[] = [
  { key: 'visa', name: 'Visa', short: 'VISA', color: '#1A1F71', logo: siVisa },
  { key: 'mastercard', name: 'Mastercard', short: 'MC', color: '#EB001B', logo: siMastercard },
  { key: 'rupay', name: 'RuPay', short: 'RuPay', color: '#097A44' },
  { key: 'amex', name: 'American Express', short: 'AMEX', color: '#2E77BC', logo: siAmericanexpress },
  { key: 'diners', name: 'Diners Club', short: 'DC', color: '#004C97', logo: siDinersclub },
]

export const OTHER_COLOR = '#475569'

const all = new Map<string, Brand>([...BANKS, ...WALLETS, ...NETWORKS].map((b) => [b.key, b]))
export const brandFor = (key?: string | null) => (key ? all.get(key) : undefined)

export function initialsOf(name: string) {
  const words = name.replace(/bank/gi, '').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return 'B'
  if (words.length === 1) return words[0].slice(0, 4).toUpperCase()
  return words
    .slice(0, 3)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}
