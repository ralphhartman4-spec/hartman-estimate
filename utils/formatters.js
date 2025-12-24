// utils/formatters.js
export const formatPrice = (amount) => {
  const num = parseFloat(amount || 0);
  if (isNaN(num)) return '$0.00';

  return num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

// Optional: version that hides .00 when it's a whole dollar
export const formatPriceSmart = (amount) => {
  const num = parseFloat(amount || 0);
  if (isNaN(num)) return '$0.00';

  if (Number.isInteger(num)) {
    return num.toLocaleString('en-US'); // $1,234
  }
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }); // $1,234.56
};
