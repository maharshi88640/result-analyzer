import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export const useSupabase = (table: string) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: fetchedData, error: fetchError } = await supabase
        .from(table)
        .select('*');

      if (fetchError) throw fetchError;
      
      setData(fetchedData || []);
      setError(null);
    } catch (err) {
      console.error(`Error fetching data from ${table}:`, err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [table]);

  const refresh = () => {
    fetchData();
  };

  return { data, loading, error, refresh };
};

export const useGrades = (studentId?: string) => {
  const [grades, setGrades] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGrades = async () => {
    try {
      setLoading(true);
      let query = supabase.from('grades').select('*');
      
      if (studentId) {
        query = query.eq('student_id', studentId);
      }
      
      const { data: fetchedGrades, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      
      setGrades(fetchedGrades || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching grades:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      setGrades([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGrades();
  }, [studentId]);

  const refresh = () => {
    fetchGrades();
  };

  return { grades, loading, error, refresh };
};
