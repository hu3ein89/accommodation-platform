
export const formatPhoneToE164 = (phoneNumber) => {
    if (!phoneNumber) return null;
    
    const digits = phoneNumber.replace(/\D/g, '');
    
    if (digits.startsWith('0')) {
      return `+98${digits.substring(1)}`; // For Iran numbers
    }
    
    return `+${digits}`;
  };