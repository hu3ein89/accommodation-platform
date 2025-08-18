import { useState, useEffect } from 'react';
import {
  getUserFavorites,
  toggleFavorite as apiToggleFavorite
} from '../api/jsonServer';

export const useFavorites = (user_id) => {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refreshFavorites = async () => {
    if (!user_id) return;
    try {
      setLoading(true);
      const data = await getUserFavorites(user_id);
      setFavorites(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = async (hotelId) => {
    if (!user_id) {
      throw new Error('User  not authenticated');
    }
    try {
      setLoading(true);
      const result = await apiToggleFavorite(user_id, hotelId);
      if (result.action === 'added') {
        setFavorites(prev => [...prev, { hotelId }]);
      } else {
        setFavorites(prev => prev.filter(fav => fav.hotelId !== hotelId));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshFavorites();
  }, [user_id]);

  return { 
    favorites, 
    loading, 
    error, 
    toggleFavorite,
    isFavorite: (hotelId) => favorites.some(fav => fav.hotelId === hotelId)
  };
};
