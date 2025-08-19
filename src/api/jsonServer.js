import axios from 'axios';
import { getDaysDifference, getNowJalali, smartDateParser } from '../utils/dateUtils';
import { supabase, supabaseAdmin } from '../services/supabaseClient';
import { formatPhoneToE164 } from '../services/phoneFormatter';

const API_URL = '/api';
const apiClient = axios.create({ baseURL: API_URL });


const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const generateUniqueId = (prefix = '') => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `${prefix}${timestamp}_${random}`;
};


export const getUserByEmail = async (email) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    throw new Error('خطا در دریافت اطلاعات کاربر');
  }
};

export const updateUserLogin = async (user_id, loginData) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .update({
        ...loginData,
        updated_at: new Date().toISOString()
      })
      .eq('id', user_id)
      .select();

    if (error) throw error;
    return data;
  } catch (error) {
    throw new Error('خطا در به‌روزرسانی اطلاعات ورود');
  }
};


export const fetchUsers = async () => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*');

    if (error) throw error;
    return data;
  } catch (error) {
    throw new Error('خطا در دریافت لیست کاربران');
  }
};

export const createUser = async (userData) => {
  try {
    
    const { data: existingUser, error: lookupError } = await supabaseAdmin
      .from('users')
      .select('id, phoneNumber')
      .eq('email', userData.email)
      .maybeSingle();

    
    if (existingUser) {
      if (!existingUser.phoneNumber && userData.phoneNumber) {
        const { error: updateError } = await supabaseAdmin
          .from('users')
          .update({ phoneNumber: userData.phoneNumber })
          .eq('id', existingUser.id);
        
        if (!updateError) {
          console.log('Updated phone number for existing user');
          return { ...existingUser, phoneNumber: userData.phoneNumber };
        }
      }
      throw new Error('این ایمیل قبلاً ثبت شده است');
    }

    
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: userData.email,
      password: userData.password,
      options: {
        data: {
          firstName: userData.firstName,
          lastName: userData.lastName,
          phoneNumber: userData.phoneNumber,
          role: userData.role || 'Guest'
        },
        emailRedirectTo: window.location.origin
      }
    });

    if (authError) throw authError;
    if (!authData.user?.id) {
      throw new Error('خطا در ایجاد کاربر');
    }

    
    const { data: publicUserData, error: publicUserError } = await supabaseAdmin
      .from('users')
      .upsert({
        id: authData.user.id,
        firstName: userData.firstName,
        lastName: userData.lastName,
        email: userData.email,
        phoneNumber: userData.phoneNumber,
        role: userData.role || 'Guest',
        status: 'active',
      }, {
        onConflict: 'id', 
        ignoreDuplicates: false 
      })
      .select()
      .single();

    if (publicUserError) throw publicUserError;

    return publicUserData;

  } catch (error) {
    console.error('Error creating user:', error);
    
    
    if (error.code === '23505' || error.code === '409') {
      
      const { data: existingUser } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('email', userData.email)
        .single();
      
      if (existingUser) {
        console.warn('User record already existed, returning existing record');
        return existingUser;
      }
    }
    
    throw error;
  }
};

export const updateUser = async (userId, userData) => {
  try {
    
    const formattedPhone = formatPhoneToE164(userData.phoneNumber);
    
    
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      {
        email: userData.email,
        phone: formattedPhone,  
        user_metadata: {
          name: `${userData.firstName} ${userData.lastName}`,
          firstName: userData.firstName,
          lastName: userData.lastName
        }
      }
    );

    if (authError) throw authError;

    
    const { error: dbError } = await supabaseAdmin
      .from('users')
      .update({
        ...userData,
        phoneNumber: userData.phoneNumber 
      })
      .eq('id', userId);

    if (dbError) throw dbError;

    return {
      ...authUser.user,
      ...userData
    };

  } catch (error) {
    console.error('Update error:', error);
    throw error;
  }
};

export const deleteUser = async (user_id) => {
  try {
    
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(
      user_id,
      true 
    );

    if (authError) throw authError;

    
    const { error: dbError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', user_id);

    if (dbError) throw dbError;

    return true;
  } catch (error) {
    console.error('Delete User Error:', error);
    throw new Error('خطا در حذف کاربر: ' + error.message);
  }
};


export const fetchHotels = async (filters = {}) => {
  try {
    
    let query = supabase.from('hotels').select('*');

    
    if (filters.city) {
      
      query = query.ilike('city', `%${filters.city}%`);
    }
    if (filters.category) {
      
      query = query.eq('category', filters.category);
    }
    if (filters.minPrice !== undefined) {
      
      query = query.gte('price', filters.minPrice);
    }
    if (filters.maxPrice !== undefined) {
      
      query = query.lte('price', filters.maxPrice);
    }
    if (filters.maxGuests !== undefined) {
      
      query = query.gte('maxGuests', filters.maxGuests);
    }
    if (filters.search) {
      
      query = query.or(`name.ilike.%${filters.search}%,city.ilike.%${filters.search}%`);
    }

    
    query = query.order('createdAt', { ascending: false });

    
    const { data, error } = await query;

    
    if (error) {
      console.error("Supabase error fetching hotels:", error);
      throw new Error('خطا در دریافت لیست هتل‌ها');
    }

    
    return data;

  } catch (error) {
    
    console.error('Generic error in fetchHotels:', error);
    throw error;
  }
};



export const updateHotel = async ({ hotelId, updatedData }) => {
  try {
    if (!hotelId) {
      throw new Error('شناسه هتل نامعتبر است');
    }

    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No active session found');
    }

    
    const dataToUpdate = {
      name: updatedData.name,
      city: updatedData.city,
      maxGuests: updatedData.maxGuests,
      images: updatedData.images,
      image: updatedData.image,
      description: updatedData.description,
      rules: updatedData.rules,
      aboutHotel: updatedData.aboutHotel,
      price: updatedData.price || 0,
      category: updatedData.category,
      rating: updatedData.rating,
      facilities: updatedData.facilities,
      status: updatedData.status || 'active',
      updatedAt: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('hotels')
      .update(dataToUpdate)
      .eq('id', hotelId)
      .select();

    if (error) {
      console.error('Supabase update error:', error);
      throw error;
    }

    return data[0];

  } catch (error) {
    console.error('Update Hotel Error:', error);
    throw error;
  }
};


export const createHotel = async (hotelData) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    console.log("Current session before creating hotel:", session);

    if (!session) {
      console.error("No active session found! The user is not authenticated from Supabase's perspective.");
      throw new Error('شما برای ایجاد هتل باید ابتدا وارد شوید. نشست فعال یافت نشد.');
    }

    const images = hotelData.images || [];
    if (hotelData.image && !images.includes(hotelData.image)) {
      images.unshift(hotelData.image); 
    }

    const dataToInsert = {
      name: hotelData.name,
      city: hotelData.city,
      price: hotelData.price || 0,
      maxGuests: hotelData.maxGuests,
      description: hotelData.description,
      category:hotelData.category,
      images: images,
      image: images[0] || null,
      rating:hotelData.rating,
      status: 'active'
    };

    const { data, error } = await supabase
      .from('hotels')
      .insert([dataToInsert])
      .select();

    if (error) {
      console.error("Supabase error creating hotel:", error);
      throw new Error('خطا در ایجاد هتل');
    }

    return data[0];

  } catch (error) {
    console.error('Generic error in createHotel:', error);
    throw error;
  }
};

export const fetchHotelDetails = async (hotelId) => {
  try {
    const { data, error } = await supabase
      .from('hotels')
      .select('*')
      .eq('id', hotelId)
      .single();

    if (error) throw error;

    return {
      ...data,
      maxGuests: data.maxGuests
    };
  } catch (error) {
    console.error('Error fetching hotel details:', error);
    throw new Error('خطا در دریافت جزئیات هتل');
  }
};



export const deleteHotel = async (hotelId) => {
  try {
    const { error } = await supabase
      .from('hotels')
      .delete()
      .eq('id', hotelId);

    if (error) throw error;

    return { success: true, message: 'Hotel deleted successfully' };
  } catch (error) {
    console.error('Delete Hotel Error:', error);
    throw new Error('خطا در حذف هتل');
  }
};


export const fetchReservations = async () => {
  
  const { data, error } = await supabase
    .from('reservations')
    .select(`
      *,
      users ( firstName, lastName, email, phoneNumber ),
      hotels ( name )
    `)
    .order('createdAt', { ascending: false });

  if (error) {
    console.error("Error fetching reservations:", error);
    throw new Error('خطا در دریافت لیست رزروها');
  }
  return data;
};


export const createPaymentIntent = async ({ amount }) => {
  try {
    console.log(`Simulating payment intent creation for amount: ${amount}`);
    return {
      clientSecret: generateUniqueId('pi')
    };
  } catch (error) {
    throw new Error('خطا در ایجاد شناسه پرداخت');
  }
};

export const fetchReservationById = async (reservationId) => {
  try {
    const { data: reservation, error: reservationError } = await supabase
      .from('reservations')
      .select('*, hotels(*)')
      .eq('id', reservationId)
      .single();

    if (reservationError) throw reservationError;

    return {
      ...reservation,
      hotel: reservation.hotels || null
    };
  } catch (error) {
    console.error('Error fetching reservation details:', error);
    throw new Error('خطا در دریافت اطلاعات رزرو');
  }
};


export const fetchUserReservations = async (user_id) => {
  try {
    if (!user_id) {
      throw new Error('شناسه کاربر نامعتبر است');
    }

    let retries = 0;
    const maxRetries = 2;
    let lastError = null;

    while (retries <= maxRetries) {
      try {
        const { data: reservations, error } = await supabase
          .from('reservations')
          .select('*')
          .eq('user_id', user_id);

        if (error) throw error;

        return reservations || [];

      } catch (error) {
        lastError = error;
        retries++;

        if (retries <= maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * retries));
          continue;
        }
      }
    }

    console.error('Failed after retries:', {
      user_id,
      error: lastError
    });

    if (lastError?.code === 'PGRST116') { 
      console.warn('Connection error - returning empty reservations');
      return [];
    }

    throw new Error(lastError?.message || 'خطا در دریافت رزروهای کاربر');

  } catch (error) {
    console.error('Critical error fetching reservations:', error);
    throw error;
  }
};

export const createReservation = async (reservationData) => {
  try {
    
    const { data: hotel, error: hotelError } = await supabase
      .from('hotels')
      .select('name, maxGuests') 
      .eq('id', reservationData.hotelId)
      .single();

    if (hotelError) {
      console.error("Error fetching hotel for validation:", hotelError);
      throw new Error("هتل مورد نظر یافت نشد.");
    }

    const totalGuests = reservationData.guests.adults + (reservationData.guests.children || 0);
    if (totalGuests > hotel.maxGuests) {
      throw new Error(`تعداد نفرات (${totalGuests}) بیش از حد مجاز (${hotel.maxGuests}) است!`);
    }

    

    
    const dataToInsert = {
      
      user_id: reservationData.user_id,
      hotelId: reservationData.hotelId,
      hotelName: hotel.name, 
      price: reservationData.price,
      totalPrice: reservationData.totalPrice,
      nights: reservationData.nights,
      checkIn: reservationData.checkIn,
      checkOut: reservationData.checkOut,
      maxGuests: hotel.maxGuests,

      
      guests_adults: reservationData.guests.adults,
      guests_children: reservationData.guests.children || 0,

      
      status_booking: 'pending',
      status_checkin: 'pending',
      status_checkout: 'pending',
    };
    

    console.log('Sending flattened reservation data to Supabase:', dataToInsert);

    const { data: newReservation, error } = await supabase
      .from('reservations')
      .insert(dataToInsert) 
      .select()
      .single();

    if (error) {
      throw error; 
    }

    console.log('Reservation created:', newReservation);
    return newReservation;

  } catch (error) {
    console.error('Error creating reservation:', error);
    throw new Error(error.message || 'خطا در ایجاد رزرو');
  }
};


export const updateReservation = async (updateData) => {
  
  const { id, ...dataToUpdate } = updateData;
  
  const { data, error } = await supabase
    .from('reservations')
    .update(dataToUpdate) 
    .eq('id', id)
    .select()
    .single(); 

  if (error) throw error;
  return data;
};

export const deleteReservation = async (reservationId) => {
  try {
    
    const { data: reservation, error: fetchError } = await supabaseAdmin
      .from('reservations')
      .select('*')
      .eq('id', reservationId)
      .single();

    if (fetchError || !reservation) {
      throw new Error(fetchError?.message || 'Reservation not found');
    }

    
    const { error: txDeleteError } = await supabaseAdmin
      .from('transactions')
      .delete()
      .eq('reservationId', reservationId);

    if (txDeleteError) throw txDeleteError;

    
    const { error: deleteError } = await supabaseAdmin
      .from('reservations')
      .delete()
      .eq('id', reservationId);

    if (deleteError) throw deleteError;

    
    const { data: verifyData } = await supabaseAdmin
      .from('reservations')
      .select('id')
      .eq('id', reservationId)
      .maybeSingle();

    if (verifyData) {
      throw new Error('Deletion verification failed');
    }

    return {
      id: reservationId,
      deleted: true,
      data: reservation
    };

  } catch (error) {
    console.error('Delete reservation error:', error);
    throw new Error(`Failed to delete reservation: ${error.message}`);
  }
};



export const createTransaction = async (transactionData) => {
  try {
    const requiredFields = ['user_id', 'amount', 'reservationId'];
    for (const field of requiredFields) {
      if (!transactionData[field]) {
        throw new Error(`فیلد ضروری تراکنش مفقود است: ${field}`);
      }
    }

    const dataToInsert = {
      user_id: transactionData.user_id,
      reservationId: transactionData.reservationId,
      amount: Number(transactionData.amount),
      status: transactionData.status || 'pending',
      type: transactionData.type || 'payment',
      description: transactionData.description || null,
      createdAt: new Date().toISOString() 
    };

    const { data, error } = await supabase
      .from('transactions')
      .insert([dataToInsert])
      .select()
      .single();

    if (error) {
      console.error('Supabase error creating transaction:', error);
      throw error;
    }

    console.log('Transaction created successfully:', data);
    return data;

  } catch (error) {
    console.error('Error in createTransaction function:', error);
    throw error;
  }
};


export const fetchTransactions = async (user_id) => {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user_id);

    if (error) throw error;

    console.log(data);
    return data;
  } catch (error) {
    throw new Error('خطا در دریافت تراکنش‌ها');
  }
};

export const fetchTransactionsForReservation = async (reservationId) => {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('reservationId', reservationId);

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Error fetching transactions for reservation:', error);
    throw new Error('خطا در دریافت تراکنش‌های رزرو');
  }
};

export const fetchAllTransactions = async () => {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('createdAt', { ascending: false })
      

    if (error) throw error;

    console.log(data);
    return data;
  } catch (error) {
    throw new Error('خطا در دریافت لیست تراکنش‌ها');
  }
};

export const updateTransaction = async (transactionId, updateData) => {
  try {
    
    const { data: existing, error: fetchError } = await supabase
      .from('transactions')
      .select('id')
      .eq('id', transactionId)
      .single();

    if (fetchError) {
      throw new Error(`تراکنش یافت نشد: ${fetchError.message}`);
    }

    
    const { error: updateError } = await supabase
      .from('transactions')
      .update(updateData)
      .eq('id', transactionId);

    if (updateError) {
      throw new Error(`خطا در به‌روزرسانی: ${updateError.message}`);
    }

    
    const { data: updated, error: readError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .single();

    return updated;

  } catch (error) {
    console.error('Update transaction error:', {
      transactionId,
      updateData,
      error
    });
    throw new Error(`خطا در به‌روزرسانی تراکنش: ${error.message}`);
  }
};




export const createReservationWithTransaction = async ({ reservationData, transactionData }) => {
  let reservationId = null;
  let transactionId = null;

  try {
    
    const reservationResponse = await createReservation(reservationData);
    reservationId = reservationResponse.id;


    const transactionResponse = await createTransaction({
      ...transactionData,
      reservationId,
      status: 'completed'
    });
    transactionId = transactionResponse.id;

    
    await supabase
      .from('reservations')
      .update({ status_booking: 'confirmed' })
      .eq('id', reservationId);

    
    await supabase
      .from('transactions')
      .update({
        status: 'completed',
      })
      .eq('id', transactionId);


    return {
      reservation: reservationResponse,
      transaction: { ...transactionResponse, status: 'completed' }
    };

  } catch (error) {
    console.error('Transaction flow error:', {
      reservationId,
      transactionId,
      error
    });

    
    if (reservationId) {
      try {
        await supabase
          .from('reservations')
          .delete()
          .eq('id', reservationId);
      } catch (deleteError) {
        console.error('Failed to delete reservation during rollback:', deleteError);
      }
    }

    if (transactionId) {
      try {
        await supabase
          .from('transactions')
          .delete()
          .eq('id', transactionId);
      } catch (txDeleteError) {
        console.error('Failed to delete transaction during rollback:', txDeleteError);
      }
    }

    throw new Error('خطا در پردازش تراکنش. لطفاً دوباره تلاش کنید.');
  }
};

export const updateReservationStatus = async ({ id, status }) => {
  console.log('[API] Starting status update for reservation:', id, 'New status:', status);
  try {
    if (!id) {
      throw new Error('شناسه رزرو الزامی است');
    }

    
    console.log('[API] Fetching current reservation for validation...');
    const { data: currentReservation, error: fetchError } = await supabaseAdmin
      .from('reservations')
      .update({ 
        status_booking: status
      })
      .eq('id', id)
      .select('*')
      .single();

    if (fetchError) {
      console.error('[API] Fetch error:', fetchError);
      throw fetchError;
    }
    console.log('[API] Current reservation:', currentReservation);

    
    const now = getNowJalali();
    const checkOutDate = smartDateParser(currentReservation.checkOut);
    console.log('[API] Check-out date analysis:', { checkOutDate, isValid: checkOutDate.isValid() });

    if (checkOutDate.isValid() &&
      getDaysDifference(checkOutDate, now) < 0 &&
      status !== 'completed') {
        const errorMsg = 'رزروهای تکمیل شده قابل تغییر نیستند';
        console.error('[API] Validation failed:', errorMsg);
        throw new Error(errorMsg);  
    }

    
    const updateData = {
      status_booking: status,
      updatedAt: new Date().toISOString()
    };
    console.log('[API] Update payload:', updateData);
    
    console.log('[API] Executing update...');
    const { error: updateError } = await supabaseAdmin
      .from('reservations')
      .update(updateData)
      .eq('id', id);

    if (updateError) {
      console.error('[API] Update error:', updateError);
      throw updateError;
    }

    
    console.log('[API] Fetching updated reservation...');
    const { data: updatedReservation, error: postUpdateError } = await supabaseAdmin
      .from('reservations')
      .update({
        status_booking: status,
        updatedAt: new Date().toISOString()
      })
      .select('*')
      .eq('id', id)
      .single();

    if (postUpdateError) {
      console.error('[API] Post-update fetch error:', postUpdateError);
      throw postUpdateError;
    }

    console.log('[API] Update successful. Updated reservation:', updatedReservation);
    return updatedReservation;
  } catch (error) {
    console.error('Update Reservation Status Error:', error);
    throw new Error(error.message || 'خطا در به‌روزرسانی وضعیت رزرو');
  }
};



export const approveRefund = async (transaction) => {
  try {
    const { id: transactionId, reservationId } = transaction;

    if (!transactionId || !reservationId) {
      throw new Error("اطلاعات تراکنش یا رزرو برای تایید بازپرداخت ناقص است.");
    }

    
    const { error: transactionError } = await supabaseAdmin
      .from('transactions')
      .update({
        status: 'completed',
        type: 'refund_processed',
        processedAt: new Date().toISOString() 
      })
      .eq('id', transactionId);

    if (transactionError) throw transactionError;

    
    const { error: reservationError } = await supabaseAdmin
      .from('reservations')
      .update({
        status_booking: 'refund_processed'
      })
      .eq('id', reservationId);

    if (reservationError) throw reservationError;

    return { success: true };

  } catch (error) {
    console.error('Error approving refund:', error);
    throw error;
  }
};


export const addFavorite = async (user_id, hotelId) => {
  try {
    const { data, error } = await supabase
      .from('favorites')
      .insert({
        user_id,
        hotelId,
      })
      .select();

    if (error) throw error;
    return data[0];
  } catch (error) {
    throw new Error(error.message || 'Error adding to favorites');
  }
};


export const removeFavorite = async (favoriteId) => {
  try {
    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('id', favoriteId);

    if (error) throw error;
  } catch (error) {
    throw new Error(error.message || 'Error removing from favorites');
  }
};


export const getUserFavorites = async (user_id) => {
  try {
    const { data, error } = await supabase
      .from('favorites')
      .select('*')
      .eq('user_id', user_id);

    if (error) throw error;
    return data;
  } catch (error) {
    throw new Error(error.message || 'Error fetching favorites');
  }
};


export const isHotelFavorite = async (user_id, hotelId) => {
  try {
    const { data, error } = await supabase
      .from('favorites')
      .select('*')
      .eq('user_id', user_id)
      .eq('hotelId', hotelId);

    if (error) throw error;
    return data.length > 0 ? data[0] : null;
  } catch (error) {
    throw new Error(error.message || 'Error checking favorites');
  }
};


export const toggleFavorite = async (user_id, hotelId) => {
  try {
    const existingFavorite = await isHotelFavorite(user_id, hotelId);
    if (existingFavorite) {
      await removeFavorite(existingFavorite.id);
      return { action: 'removed', hotelId };
    } else {
      const newFavorite = await addFavorite(user_id, hotelId);
      return { action: 'added', hotelId: newFavorite.hotelId };
    }
  } catch (error) {
    throw new Error(error.message || 'Error toggling favorite');
  }
};



export const fetchNotifications = async (user_id) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user_id)
      .order('createdAt', { ascending: false });

    if (error) throw error;
    return data;
  } catch (error) {
    throw new Error('خطا در دریافت نوتیفیکیشن‌ها');
  }
};


export const fetchReservationStats = async (dateRange) => {
  try {
    let query = supabase
      .from('reservations')
      .select('*');

    if (dateRange) {
      query = query
        .gte('checkIn', dateRange[0].format('YYYY-MM-DD'))
        .lte('checkIn', dateRange[1].format('YYYY-MM-DD'));
    }

    const { data, error } = await query;

    if (error) throw error;
    return data;
  } catch (error) {
    throw new Error('خطا در دریافت آمار رزروها');
  }
};


export const fetchFinancialStats = async (dateRange) => {
  try {
    let query = supabase
      .from('transactions')
      .select('*')
      .eq('status', 'completed');

    if (dateRange) {
      query = query
        .gte('createdAt', dateRange[0].format('YYYY-MM-DD'))
        .lte('createdAt', dateRange[1].format('YYYY-MM-DD'));
    }

    const { data, error } = await query;

    if (error) throw error;
    return data;
  } catch (error) {
    throw new Error('خطا در دریافت آمار مالی');
  }
};


export const fetchBookingStats = async () => {
  try {
    const { data: reservations, error } = await supabase
      .from('reservations')
      .select('*');

    if (error) throw error;

    const stats = {
      totalBookings: reservations.length,
      averageSatisfaction: 0,
      totalRevenue: 0,
      pieChart: {
        data: [],
        angleField: 'value',
        colorField: 'type',
        radius: 0.8,
        label: {
          type: 'outer',
          content: '{name} {percentage}'
        }
      }
    };

    
    const totalSatisfaction = reservations.reduce((sum, res) => sum + (res.rating || 0), 0);
    stats.averageSatisfaction = totalSatisfaction / (reservations.length || 1);

    
    stats.totalRevenue = reservations.reduce((sum, res) => sum + (res.amount || 0), 0);

    
    const roomTypes = {};
    reservations.forEach(res => {
      if (res.roomType) {
        roomTypes[res.roomType] = (roomTypes[res.roomType] || 0) + 1;
      }
    });

    stats.pieChart.data = Object.entries(roomTypes).map(([type, count]) => ({
      type,
      value: count
    }));

    return stats;

  } catch (error) {
    throw new Error('خطا در دریافت آمار رزروها');
  }
};


export const fetchRevenue = async (dateRange) => {
  try {
    const [startDate, endDate] = dateRange;

    let query = supabase
      .from('reservations')
      .select('*');

    if (startDate && endDate) {
      query = query
        .gte('checkIn', startDate.format('YYYY-MM-DD'))
        .lte('checkIn', endDate.format('YYYY-MM-DD'));
    }

    const { data: reservations, error } = await query;

    if (error) throw error;

    
    const totalRevenue = reservations.reduce((sum, res) => sum + (res.amount || 0), 0);

    
    const revenueByDate = {};
    reservations.forEach(res => {
      const date = res.checkIn.split('T')[0];
      revenueByDate[date] = (revenueByDate[date] || 0) + (res.amount || 0);
    });

    const chartData = Object.entries(revenueByDate).map(([date, amount]) => ({
      date,
      amount
    }));

    
    const report = Object.entries(revenueByDate).map(([date, revenue]) => ({
      date,
      revenue,
      expenses: Math.round(revenue * 0.3), 
      profit: Math.round(revenue * 0.7) 
    }));

    return {
      totalRevenue,
      chart: {
        data: chartData,
        xField: 'date',
        yField: 'amount',
        xAxis: {
          type: 'time',
          tickCount: 5,
        }
      },
      report
    };

  } catch (error) {
    throw new Error('خطا در دریافت اطلاعات مالی');
  }
};



export const fetchMessages = async (user_id, userRole) => {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(`recipient.eq.${user_id},recipient.eq.all`)
      .order('createdAt', { ascending: false });

    if (error) throw error;
    return data;
  } catch (error) {
    throw new Error('خطا در دریافت پیام‌ها');
  }
};


export const sendMessage = async (messageData) => {
  try {
    const data = {
      hotelId: messageData.hotelId,
      parentId: messageData.parentId || null,
      content: messageData.content,
      senderId: messageData.senderId, 
      isPublic: true,
      status: 'read',
    };

    const { data: newMessage, error } = await supabase
      .from('messages')
      .insert(data)
      .select()
      .single()

    if (error) throw error;
    return newMessage;
  } catch (error) {
    throw new Error('خطا در ارسال پیام');
  }
};



export const fetchCommentsForHotel = async (hotelId) => {
  try {
    if (!hotelId) return [];

    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        users ( firstName, lastName )
      `) 
      .eq('hotelId', hotelId)
      .eq('isPublic', true)
      .order('createdAt', { ascending: false });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching comments for hotel:', error);
    throw new Error('خطا در دریافت دیدگاه‌ها');
  }
};

export const fetchPublicMessages = async () => {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('isPublic', true)
      .order('createdAt', { ascending: false });

    if (error) throw error;

    const safeMessages = data.map(message => ({
      ...message,
      sender: message.sender || { name: 'کاربر ناشناس', id: null }
    }));

    return safeMessages;
  } catch (error) {
    throw new Error('خطا در دریافت پیام‌های عمومی');
  }
};


export const markMessageAsRead = async (messageId) => {
  try {
    const { data: updatedMessage, error } = await supabase
      .from('messages')
      .update({
        status: 'read',
        readAt: new Date().toISOString()
      })
      .eq('id', messageId)
      .select();

    if (error) throw error;
    return updatedMessage[0];
  } catch (error) {
    throw new Error('خطا در به‌روزرسانی وضعیت پیام');
  }
};


export const deleteMessage = async (messageId) => {
  try {
    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('id', messageId);

    if (error) throw error;
    return true;
  } catch (error) {
    throw new Error('خطا در حذف پیام');
  }
};


export const getUnreadMessagesCount = async (user_id) => {
  try {
    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('recipient', user_id)
      .eq('status', 'unread');

    if (error) throw error;
    return count || 0;
  } catch (error) {
    throw new Error('خطا در دریافت تعداد پیام‌های نخوانده');
  }
};



export const fetchPrivateMessages = async () => {
  try {
    const { data, error } = await supabase
      .from('private_messages')
      .select('*')
      .order('createdAt', { ascending: false });

    if (error) throw error;
    console.log('private messages:', data);
    return data;
  } catch (error) {
    throw new Error('خطا در دریافت پیام‌های خصوصی');
  }
};


export const sendPrivateMessage = async (messageData) => {
  try {
    const dataToSend = {
      subject: messageData.subject,
      content: messageData.message,
      senderId: messageData.senderId,
        sender_name: messageData.name,
        sender_email: messageData.email,
        sender_phone: messageData.phone,
      status: 'unread',
    };

    console.log('final data being sent:', dataToSend);
    const { data, error } = await supabase
      .from('private_messages')
      .insert(dataToSend)
      .select()
      .single();

    if (error) throw error;
    return data[0];
  } catch (error) {
    throw new Error('خطا در ارسال پیام خصوصی');
  }
};


export const updatePrivateMessageStatus = async ({ messageId, status }) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('private_messages')
      .update({ status })
      .eq('id', messageId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    throw new Error('خطا در به‌روزرسانی وضعیت پیام خصوصی');
  }
};


export const deletePrivateMessage = async (messageId) => {
  try {
    const { error } = await supabaseAdmin
      .from('private_messages')
      .delete()
      .eq('id', messageId);

    if (error) throw error;
    return messageId;
  } catch (error) {
    throw new Error('خطا در حذف پیام خصوصی');
  }
};





export const fetchContent = async (hotelId) => {
  if (!hotelId) {
    return { description: '', rules: '', facilities: [], images: [] };
  }

  try {
    const { data, error } = await supabase
      .from('contents')
      .select('*')
      .eq('hotelId', hotelId)
      .single();

    if (error?.code === 'PGRST116') { 
      return { id: hotelId, hotelId, description: '', rules: '', facilities: [], images: [] };
    }

    if (error) throw error;
    return data || { id: hotelId, hotelId, description: '', rules: '', facilities: [], images: [] };
  } catch (error) {
    console.error('Error fetching content:', error);
    throw new Error('خطا در دریافت محتوای هتل');
  }
};

export const updateContent = async (contentData) => {
  if (!contentData || !contentData.id) {
    throw new Error('شناسه هتل برای به‌روزرسانی محتوا الزامی است');
  }

  try {
    const { data, error } = await supabase
      .from('contents')
      .update(contentData)
      .eq('id', contentData.id)
      .select();

    if (error) throw error;
    return data[0];
  } catch (error) {
    console.error('Error updating content:', error);
    throw new Error('خطا در به‌روزرسانی محتوا');
  }
};

export const updateHotelImages = async ({ hotelId, images }) => {
  try {
    const { data, error } = await supabase
      .from('hotels')
      .update({
        images: images,
        image: images[0] || ''
      })
      .eq('id', hotelId)
      .select();

    if (error) throw error;
    return data[0];
  } catch (error) {
    console.error('Error updating hotel images:', error);
    throw new Error('خطا در به‌روزرسانی گالری تصاویر');
  }
};

export const uploadHotelImage = async (hotelId, file) => {
  try {
    const base64 = await convertFileToBase64(file);

    
    const { data: hotel, error: fetchError } = await supabase
      .from('hotels')
      .select('*')
      .eq('id', hotelId)
      .single();

    if (fetchError) throw fetchError;

    const newImage = {
      id: Date.now(),
      data: base64,
      title: file.name,
      createdAt: new Date().toISOString()
    };

    
    const { data: updatedHotel, error: updateError } = await supabase
      .from('hotels')
      .update({
        content: {
          ...hotel.content,
          images: [...(hotel.content?.images || []), newImage]
        }
      })
      .eq('id', hotelId)
      .select();

    if (updateError) throw updateError;
    return newImage;
  } catch (error) {
    console.error('Error uploading image:', error);
    throw new Error('خطا در آپلود تصویر');
  }
};


const convertFileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
};


export const deleteHotelImage = async (hotelId, imageId) => {
  try {
    
    const { data: hotel, error: fetchError } = await supabase
      .from('hotels')
      .select('*')
      .eq('id', hotelId)
      .single();

    if (fetchError) throw fetchError;

    
    const { error: updateError } = await supabase
      .from('hotels')
      .update({
        content: {
          ...hotel.content,
          images: hotel.content?.images?.filter(img => img.id !== imageId) || []
        }
      })
      .eq('id', hotelId);

    if (updateError) throw updateError;
    return true;
  } catch (error) {
    console.error('Error deleting image:', error);
    throw new Error('خطا در حذف تصویر');
  }
};

export const fetchHotelReservations = async (hotelId) => {
  try {
    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .eq('hotelId', hotelId);

    if (error) throw error;
    return data;
  } catch (error) {
    throw new Error('خطا در دریافت اطلاعات رزروها');
  }
};

export const getContent = async () => {
  try {
    const { data, error } = await supabase
      .from('content')
      .select('*')
      .limit(1);

    if (error) throw error;
    return data[0] || {};
  } catch (error) {
    throw new Error('خطا در دریافت محتوا');
  }
};

const handleEditUser = (user) => {
  setEditingUser(user);
  userForm.setFieldsValue({
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role
  });
  setEditUserModal(true);
};

const handleUpdateUser = async (values) => {
  try {
    await updateUserMutation.mutateAsync({
      id: editingUser.id,
      ...values
    });

    notification.success({
      message: "کاربر با موفقیت بروزرسانی شد",
      description: "اطلاعات کاربر با موفقیت بروزرسانی گردید"
    });
  } catch (error) {
    console.error('Error updating user:', error);
    notification.error({
      message: "خطا",
      description: error.message || "خطا در به‌روزرسانی کاربر"
    });
  }
};


export default {
  
  getUserByEmail,
  updateUserLogin,

  
  fetchUsers,
  createUser,
  updateUser,
  deleteUser,
  handleUpdateUser,
  handleEditUser,

  
  fetchHotels,
  fetchHotelDetails,
  createHotel,
  updateHotel,
  deleteHotel,

  
  fetchReservations,
  fetchUserReservations,
  createReservation,
  updateReservation,
  deleteReservation,



  
  toggleFavorite,
  getUserFavorites,

  
  fetchTransactions,

  
  fetchNotifications,

  
  fetchReservationStats,


  
  fetchMessages,
  sendMessage,
  fetchPublicMessages,

  
  fetchBookingStats,
  fetchRevenue,

  
  fetchContent,
  updateContent,
  getContent
}

