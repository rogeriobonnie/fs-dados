import { formatInTimeZone } from 'date-fns-tz';

const TIMEZONE = 'America/Sao_Paulo';

/**
 * Formata uma data usando o fuso horário de São Paulo
 */
export const formatDate = (dateString: string | Date, format: string = 'dd/MM/yyyy'): string => {
  if (!dateString) return '';
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  return formatInTimeZone(date, TIMEZONE, format);
};

/**
 * Formata data no formato DD/MM/YYYY
 */
export const formatDateBR = (dateString: string | Date): string => {
  return formatDate(dateString, 'dd/MM/yyyy');
};

/**
 * Formata data no formato DD/MM
 */
export const formatDateShort = (dateString: string | Date): string => {
  return formatDate(dateString, 'dd/MM');
};

/**
 * Formata a data atual no fuso horário de São Paulo
 */
export const formatCurrentDate = (): string => {
  return formatDate(new Date(), 'dd/MM/yyyy');
};
