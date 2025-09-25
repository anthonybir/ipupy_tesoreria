// Church-specific database operations using Supabase with RLS
import { createClient } from '@/lib/supabase/client';

interface ChurchReport {
  id: number;
  church_id: number;
  month: number;
  year: number;
  diezmos: number;
  ofrendas: number;
  status: string;
  created_at: string;
}

interface ChurchTransaction {
  id: number;
  church_id: number;
  fund_id: number;
  concept: string;
  amount_in: number;
  amount_out: number;
  date: string;
}

// Get church's own reports (RLS protected)
export async function getChurchReports(churchId: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .eq('church_id', churchId)
    .order('year', { ascending: false })
    .order('month', { ascending: false });

  if (error) throw error;
  return data as ChurchReport[];
}

// Get church's transactions (RLS protected)
export async function getChurchTransactions(churchId: string, filters?: {
  startDate?: string;
  endDate?: string;
  fundId?: number;
}) {
  const supabase = createClient();

  let query = supabase
    .from('transactions')
    .select(`
      *,
      funds (name, type)
    `)
    .eq('church_id', churchId)
    .order('date', { ascending: false });

  if (filters?.startDate) {
    query = query.gte('date', filters.startDate);
  }

  if (filters?.endDate) {
    query = query.lte('date', filters.endDate);
  }

  if (filters?.fundId) {
    query = query.eq('fund_id', filters.fundId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as ChurchTransaction[];
}

// Submit new church report
export async function submitChurchReport(reportData: Omit<ChurchReport, 'id' | 'created_at'>) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('reports')
    .insert([reportData])
    .select()
    .single();

  if (error) throw error;
  return data as ChurchReport;
}

// Get church profile and statistics
export async function getChurchProfile(churchId: string) {
  const supabase = createClient();

  // Get church details
  const { data: church, error: churchError } = await supabase
    .from('churches')
    .select('*')
    .eq('id', churchId)
    .single();

  if (churchError) throw churchError;

  // Get statistics
  const { data: stats, error: statsError } = await supabase
    .rpc('get_church_statistics', { church_id: churchId });

  if (statsError) throw statsError;

  return {
    church,
    statistics: stats
  };
}

// Get church dashboard data
export async function getChurchDashboard(churchId: string) {
  const supabase = createClient();

  // Get latest reports
  const { data: recentReports, error: reportsError } = await supabase
    .from('reports')
    .select('*')
    .eq('church_id', churchId)
    .order('created_at', { ascending: false })
    .limit(5);

  if (reportsError) throw reportsError;

  // Get recent transactions
  const { data: recentTransactions, error: txnError } = await supabase
    .from('transactions')
    .select(`
      *,
      funds (name)
    `)
    .eq('church_id', churchId)
    .order('date', { ascending: false })
    .limit(10);

  if (txnError) throw txnError;

  // Get current month status
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const { data: currentReport, error: currentError } = await supabase
    .from('reports')
    .select('*')
    .eq('church_id', churchId)
    .eq('month', currentMonth)
    .eq('year', currentYear)
    .maybeSingle();

  if (currentError) throw currentError;

  return {
    recentReports,
    recentTransactions,
    currentMonthReport: currentReport,
    hasSubmittedCurrentMonth: !!currentReport
  };
}

// Update church report (only if pending)
export async function updateChurchReport(
  reportId: number,
  churchId: string,
  updates: Partial<ChurchReport>
) {
  const supabase = createClient();

  // Only allow updates to pending reports
  const { data, error } = await supabase
    .from('reports')
    .update(updates)
    .eq('id', reportId)
    .eq('church_id', churchId)
    .eq('status', 'pending')
    .select()
    .single();

  if (error) throw error;
  return data as ChurchReport;
}