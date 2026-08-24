# Amenities Booking

Manages reservations for shared society assets (e.g., Gated Park, Community Hall, Swimming Pool).

## Collision Prevention Logic
- When a resident requests a booking, the system checks for existing overlapping timeslots in `amenity_bookings`.
- Bookings are held in a `pending` state until deposit/payments are cleared, then updated to `approved`.
