import type { Booking } from '@/types/booking';

export const mockBookings: Booking[] = [
  // ── Active (5) ────────────────────────────────────────────────
  {
    id: 'bk1', vehicleId: 'v2', vehicleName: 'BMW X1', clientId: 'c1', clientName: 'Mehdi Benali',
    startDate: '2026-04-03', endDate: '2026-04-10', status: 'active', dailyRate: 130, totalAmount: 910,
    deposit: 500, pickupLocation: 'Agence Paris Centre', returnLocation: 'Agence Paris Centre',
    pickupTime: '09:00', returnTime: '18:00', options: [
      { id: 'ins', label: 'Insurance Plus', price: 15, enabled: true },
      { id: 'foreign-use', label: 'Foreign Use Pass', price: 25, enabled: false },
    ], notes: 'Client régulier', createdAt: '2026-03-28',
    startMileage: 12500, includedKm: 1400, extraKmRate: 0.3,
  },
  {
    id: 'bk2', vehicleId: 'v7', vehicleName: 'GLC', clientId: 'c5', clientName: 'Karim Haddad',
    startDate: '2026-04-01', endDate: '2026-04-12', status: 'active', dailyRate: 190, totalAmount: 2090,
    deposit: 800, pickupLocation: 'Agence Marseille Gare', returnLocation: 'Agence Marseille Gare',
    pickupTime: '10:00', returnTime: '10:00', options: [
      { id: 'ins', label: 'Insurance Plus', price: 15, enabled: true },
    ], notes: 'Location professionnelle', createdAt: '2026-03-25',
  },
  {
    id: 'bk3', vehicleId: 'v11', vehicleName: 'Kodiaq', clientId: 'c2', clientName: 'Sophie Durand',
    startDate: '2026-04-04', endDate: '2026-04-08', status: 'active', dailyRate: 130, totalAmount: 520,
    deposit: 400, pickupLocation: 'Agence Paris Centre', returnLocation: 'Agence Paris CDG',
    pickupTime: '08:00', returnTime: '14:00', options: [], notes: '', createdAt: '2026-03-29',
  },
  {
    id: 'bk4', vehicleId: 'v14', vehicleName: 'Range Rover', clientId: 'c4', clientName: 'Claire Martin',
    startDate: '2026-04-02', endDate: '2026-04-08', status: 'active', dailyRate: 250, totalAmount: 1500,
    deposit: 1000, pickupLocation: 'Agence Lyon Part-Dieu', returnLocation: 'Agence Lyon Part-Dieu',
    pickupTime: '09:00', returnTime: '16:30', options: [
      { id: 'ins', label: 'Insurance Plus', price: 15, enabled: true },
      { id: 'drv', label: 'Additional Driver', price: 10, enabled: true },
    ], notes: 'Événement spécial', createdAt: '2026-03-27',
  },
  {
    id: 'bk5', vehicleId: 'v15', vehicleName: 'Tayron R', clientId: 'c7', clientName: 'Antoine Moreau',
    startDate: '2026-04-06', endDate: '2026-04-13', status: 'active', dailyRate: 160, totalAmount: 1120,
    deposit: 500, pickupLocation: 'Agence Rennes Gare', returnLocation: 'Agence Rennes Gare',
    pickupTime: '11:00', returnTime: '11:00', options: [], notes: '', createdAt: '2026-04-01',
  },
  // ── Confirmed/Upcoming (5) ────────────────────────────────────
  {
    id: 'bk6', vehicleId: 'v1', vehicleName: 'Audi Q5', clientId: 'c2', clientName: 'Sophie Durand',
    startDate: '2026-04-15', endDate: '2026-04-22', status: 'confirmed', dailyRate: 180, totalAmount: 1260,
    deposit: 600, pickupLocation: 'Agence Paris CDG', returnLocation: 'Agence Paris Centre',
    pickupTime: '10:00', returnTime: '18:00', options: [
      { id: 'foreign-use', label: 'Foreign Use Pass', price: 25, enabled: true },
    ], notes: 'Aller simple', createdAt: '2026-04-05',
  },
  {
    id: 'bk7', vehicleId: 'v5', vehicleName: 'Classe V', clientId: 'c3', clientName: 'Youssef El Amrani',
    startDate: '2026-04-18', endDate: '2026-04-25', status: 'confirmed', dailyRate: 200, totalAmount: 1400,
    deposit: 700, pickupLocation: 'Agence Nice Aéroport', returnLocation: 'Agence Nice Aéroport',
    pickupTime: '09:00', returnTime: '09:00', options: [
      { id: 'ins', label: 'Insurance Plus', price: 15, enabled: true },
      { id: 'seat', label: 'Child Seat', price: 5, enabled: true },
    ], notes: 'Transport de groupe, 7 passagers', createdAt: '2026-04-02',
  },
  {
    id: 'bk8', vehicleId: 'v12', vehicleName: 'Kodiaq 7 Seater', clientId: 'c6', clientName: 'Isabelle Leroy',
    startDate: '2026-04-20', endDate: '2026-04-28', status: 'confirmed', dailyRate: 145, totalAmount: 1160,
    deposit: 500, pickupLocation: 'Agence Lyon Part-Dieu', returnLocation: 'Agence Lyon Part-Dieu',
    pickupTime: '08:00', returnTime: '18:00', options: [], notes: 'Vacances familiales', createdAt: '2026-04-06',
  },
  {
    id: 'bk9', vehicleId: 'v10', vehicleName: 'Karoq', clientId: 'c8', clientName: 'Fatima Zahra',
    startDate: '2026-04-12', endDate: '2026-04-14', status: 'pending', dailyRate: 100, totalAmount: 200,
    deposit: 200, pickupLocation: 'Agence Toulouse Centre', returnLocation: 'Agence Toulouse Centre',
    pickupTime: '14:00', returnTime: '14:00', options: [], notes: 'Weekend', createdAt: '2026-04-07',
  },
  {
    id: 'bk10', vehicleId: 'v3', vehicleName: 'BMW X3', clientId: 'c1', clientName: 'Mehdi Benali',
    startDate: '2026-04-25', endDate: '2026-05-02', status: 'confirmed', dailyRate: 170, totalAmount: 1190,
    deposit: 600, pickupLocation: 'Agence Paris Centre', returnLocation: 'Agence Paris Centre',
    pickupTime: '09:00', returnTime: '18:00', options: [
      { id: 'ins', label: 'Insurance Plus', price: 15, enabled: true },
    ], notes: '', createdAt: '2026-04-08',
  },
  // ── Completed (10) ─────────────────────────────────────────────
  {
    id: 'bk11', vehicleId: 'v2', vehicleName: 'BMW X1', clientId: 'c3', clientName: 'Youssef El Amrani',
    startDate: '2026-03-10', endDate: '2026-03-15', status: 'completed', dailyRate: 130, totalAmount: 650,
    deposit: 500, pickupLocation: 'Agence Nice Aéroport', returnLocation: 'Agence Nice Aéroport',
    pickupTime: '09:00', returnTime: '17:00', options: [], notes: '', createdAt: '2026-03-05',
    startMileage: 45230, returnMileage: 45892, includedKm: 500, extraKmRate: 0.3,
    kmDriven: 662, kmOverage: 162, overageCost: 48.6,
  },
  {
    id: 'bk12', vehicleId: 'v4', vehicleName: 'Classe A', clientId: 'c4', clientName: 'Claire Martin',
    startDate: '2026-03-15', endDate: '2026-03-20', status: 'completed', dailyRate: 110, totalAmount: 550,
    deposit: 300, pickupLocation: 'Agence Lyon Part-Dieu', returnLocation: 'Agence Lyon Part-Dieu',
    pickupTime: '10:00', returnTime: '10:00', options: [], notes: '', createdAt: '2026-03-10',
  },
  {
    id: 'bk13', vehicleId: 'v6', vehicleName: 'Fabia', clientId: 'c8', clientName: 'Fatima Zahra',
    startDate: '2026-03-20', endDate: '2026-03-25', status: 'completed', dailyRate: 55, totalAmount: 275,
    deposit: 150, pickupLocation: 'Agence Toulouse Centre', returnLocation: 'Agence Toulouse Centre',
    pickupTime: '08:00', returnTime: '18:00', options: [], notes: '', createdAt: '2026-03-15',
  },
  {
    id: 'bk14', vehicleId: 'v3', vehicleName: 'BMW X3', clientId: 'c7', clientName: 'Antoine Moreau',
    startDate: '2026-03-28', endDate: '2026-04-03', status: 'completed', dailyRate: 170, totalAmount: 1020,
    deposit: 600, pickupLocation: 'Agence Rennes Gare', returnLocation: 'Agence Rennes Gare',
    pickupTime: '09:00', returnTime: '09:00', options: [], notes: 'Vacances en famille', createdAt: '2026-03-20',
  },
  {
    id: 'bk15', vehicleId: 'v8', vehicleName: 'GLC Coupé', clientId: 'c6', clientName: 'Isabelle Leroy',
    startDate: '2026-03-01', endDate: '2026-03-08', status: 'completed', dailyRate: 210, totalAmount: 1470,
    deposit: 700, pickupLocation: 'Agence Lyon Part-Dieu', returnLocation: 'Agence Lyon Part-Dieu',
    pickupTime: '10:00', returnTime: '18:00', options: [
      { id: 'ins', label: 'Insurance Plus', price: 15, enabled: true },
    ], notes: '', createdAt: '2026-02-24',
  },
  {
    id: 'bk16', vehicleId: 'v13', vehicleName: 'Mini', clientId: 'c2', clientName: 'Sophie Durand',
    startDate: '2026-03-05', endDate: '2026-03-07', status: 'completed', dailyRate: 75, totalAmount: 150,
    deposit: 150, pickupLocation: 'Agence Paris Centre', returnLocation: 'Agence Paris Centre',
    pickupTime: '14:00', returnTime: '14:00', options: [], notes: '', createdAt: '2026-03-01',
  },
  {
    id: 'bk17', vehicleId: 'v10', vehicleName: 'Karoq', clientId: 'c5', clientName: 'Karim Haddad',
    startDate: '2026-02-20', endDate: '2026-03-01', status: 'completed', dailyRate: 100, totalAmount: 900,
    deposit: 400, pickupLocation: 'Agence Marseille Gare', returnLocation: 'Agence Marseille Gare',
    pickupTime: '09:00', returnTime: '17:00', options: [], notes: '', createdAt: '2026-02-15',
  },
  {
    id: 'bk18', vehicleId: 'v1', vehicleName: 'Audi Q5', clientId: 'c1', clientName: 'Mehdi Benali',
    startDate: '2026-02-10', endDate: '2026-02-14', status: 'completed', dailyRate: 180, totalAmount: 720,
    deposit: 500, pickupLocation: 'Agence Paris Centre', returnLocation: 'Agence Paris Centre',
    pickupTime: '09:00', returnTime: '18:00', options: [], notes: '', createdAt: '2026-02-05',
  },
  {
    id: 'bk19', vehicleId: 'v14', vehicleName: 'Range Rover', clientId: 'c3', clientName: 'Youssef El Amrani',
    startDate: '2026-03-18', endDate: '2026-03-25', status: 'completed', dailyRate: 250, totalAmount: 1750,
    deposit: 1000, pickupLocation: 'Agence Nice Aéroport', returnLocation: 'Agence Nice Aéroport',
    pickupTime: '10:00', returnTime: '10:00', options: [
      { id: 'ins', label: 'Insurance Plus', price: 15, enabled: true },
      { id: 'drv', label: 'Additional Driver', price: 10, enabled: true },
    ], notes: 'VIP client', createdAt: '2026-03-12',
  },
  {
    id: 'bk20', vehicleId: 'v9', vehicleName: 'Golf', clientId: 'c4', clientName: 'Claire Martin',
    startDate: '2026-03-10', endDate: '2026-03-12', status: 'completed', dailyRate: 80, totalAmount: 160,
    deposit: 200, pickupLocation: 'Agence Lyon Part-Dieu', returnLocation: 'Agence Lyon Part-Dieu',
    pickupTime: '08:00', returnTime: '18:00', options: [], notes: '', createdAt: '2026-03-05',
  },
  // ── Cancelled (2) ──────────────────────────────────────────────
  {
    id: 'bk21', vehicleId: 'v13', vehicleName: 'Mini', clientId: 'c4', clientName: 'Claire Martin',
    startDate: '2026-03-01', endDate: '2026-03-05', status: 'cancelled', dailyRate: 75, totalAmount: 300,
    deposit: 150, pickupLocation: 'Agence Lyon Part-Dieu', returnLocation: 'Agence Lyon Part-Dieu',
    pickupTime: '10:00', returnTime: '10:00', options: [], notes: 'Annulée — raisons personnelles', createdAt: '2026-02-25',
  },
  {
    id: 'bk22', vehicleId: 'v16', vehicleName: 'Vito', clientId: 'c5', clientName: 'Karim Haddad',
    startDate: '2026-04-10', endDate: '2026-04-15', status: 'cancelled', dailyRate: 120, totalAmount: 600,
    deposit: 400, pickupLocation: 'Agence Marseille Gare', returnLocation: 'Agence Marseille Gare',
    pickupTime: '09:00', returnTime: '09:00', options: [], notes: 'Véhicule en maintenance', createdAt: '2026-04-03',
  },
];
