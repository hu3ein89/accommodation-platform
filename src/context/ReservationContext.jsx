import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../services/supabaseClient';

const ReservationContext = createContext();

export const ReservationProvider = ({ children }) => {
  const [pendingReservations, setPendingReservations] = useState(() => {
    const stored = localStorage.getItem('pendingReservations');
    return stored ? parseInt(stored, 10) : 0;
  });

  // Fetch pending reservations from JSON Server
  const fetchPendingReservations = async () => {
    try {

      const { count, error } = await supabase
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .eq('status_booking', 'pending'); 

      if (error) {
        console.error('Failed to fetch pending reservations:', error);
        return;
      }

      setPendingReservations(count || 0);
      
    } catch (error) {
      console.error('Error in fetchPendingReservations:', error);
    }
  };


  useEffect(() => {

    fetchPendingReservations();

    const channel = supabase
      .channel('public:reservations')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'reservations' 
        },
        
        () => fetchPendingReservations()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);


  const resetReservations = () => {
    setPendingReservations(0);
  };

  return (
    <ReservationContext.Provider 
      value={{ 
        pendingReservations,
        resetReservations
      }}
    >
      {children}
    </ReservationContext.Provider>
  );
};

export const useReservations = () => useContext(ReservationContext);