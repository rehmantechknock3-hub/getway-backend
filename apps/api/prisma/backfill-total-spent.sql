UPDATE users u
SET "totalSpent" = COALESCE((
  SELECT SUM(b."totalAmount")
  FROM bookings b
  WHERE b."customerId" = u.id
    AND b.status = 'COMPLETED'
), 0);
