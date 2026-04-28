import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import logger from './utils/logger.js';
import { initSentry } from './utils/sentry.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';

import citizenRoutes from './routes/citizen.js';
import doctorRoutes from './routes/doctor.js';
import prescriptionRoutes from './routes/prescriptions.js';
import consentRoutes from './routes/consent.js';
import { router as medicinesRoutes } from './routes/medicines.js';
import fhirRoutes from './routes/fhir.js';
import longitudinalRoutes from './routes/longitudinal.js';
import bookingRoutes from './routes/booking.js';
import triageRoutes from './routes/triage.js';
import clinicalRoutes from './routes/clinical.js';
import ocrRoutes from './routes/ocr.js';
import gamificationRoutes from './routes/gamification.js';
import chronicleRoutes from './routes/chronicle.js';
import availabilityRoutes from './routes/availability.js';
import guardianRoutes from './routes/guardian.js';
import scribeRoutes from './routes/scribe.js';
import flashSummaryRoutes from './routes/flashSummary.js';
import doctorAvailabilityRoutes from './routes/doctorAvailability.js';
import testCentersRoutes from './routes/testCenters.js';
import zkRoutes from './routes/zk.js';
import schnorrRoutes from './routes/schnorr.js';
import snarkVerifyRoutes from './routes/snarkVerify.js';
import secureRecordsRoutes from './routes/secureRecords.js';
import docsRoutes from './routes/docs.js';
import alertsRoutes from './routes/alerts.js';
import rxConfigRoutes from './routes/rxConfig.js';
import pillPhotosRoutes from './routes/pillPhotos.js';
import remindersRoutes from './routes/reminders.js';
import timelineRoutes from './routes/timeline.js';
import mastersRoutes from './routes/masters.js';
import clinicalNotesRoutes from './routes/clinicalNotes.js';
import billingRoutes from './routes/billing.js';
import insuranceRoutes from './routes/insurance.js';
import educationRoutes from './routes/education.js';
import analyticsRoutes from './routes/analytics.js';
import telemedicineRoutes from './routes/telemedicine.js';
import fulfillmentRoutes from './routes/fulfillment.js';
import vaultRoutes from './routes/vault.js';
import webauthnRoutes from './routes/webauthn.js';
import labReportRoutes from './routes/labReport.js';
import healthScoreRoutes from './routes/healthScore.js';
import wearableRoutes from './routes/wearable.js';
import consultRoutes from './routes/consult.js';
import audioBriefRoutes from './routes/audioBrief.js';
import emergencyRoutes from './routes/emergency.js';
import communityRoutes from './routes/community.js';
import { telemetryMiddleware, getMetrics } from './middleware/telemetry.js';
import { securityHeaders, rateLimiter, globalErrorHandler } from './middleware/production.js';

dotenv.config();
initSentry();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const PORT = process.env.PORT || 5001;

// Production Middleware
app.use(securityHeaders);
app.use(rateLimiter);

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'https://lifese-frontend.vercel.app',
    ];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn('CORS blocked origin', { origin });
      callback(new Error('CORS Policy Blocked'));
    }
  },
  credentials: true
}));

app.use(express.json());
app.use(cookieParser()); // Enable cookie parsing for secure token handling

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

app.use('/api/citizen', citizenRoutes);
app.use('/api/doctor', doctorRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/consent', consentRoutes);
app.use('/api/medicines', medicinesRoutes);
app.use('/api/docs', docsRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/rx-config', rxConfigRoutes);
app.use('/api/pill-photos', pillPhotosRoutes);
app.use('/api/reminders', remindersRoutes);
app.use('/api/timeline', timelineRoutes);
app.use('/api/masters', mastersRoutes);
app.use('/api/clinical-notes', clinicalNotesRoutes);
app.use('/api/fhir', fhirRoutes);
app.use('/api/longitudinal', longitudinalRoutes);
app.use('/api/booking', bookingRoutes);
app.use('/api/triage', triageRoutes);
app.use('/api/clinical', clinicalRoutes);
app.use('/api/ocr', ocrRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use('/api/chronicle', chronicleRoutes);
app.use('/api/availability', availabilityRoutes);
app.use('/api/guardian', guardianRoutes);
app.use('/api/scribe', scribeRoutes);
app.use('/api/flash-summary', flashSummaryRoutes);
app.use('/api/doctor-availability', doctorAvailabilityRoutes);
app.use('/api/test-centers', testCentersRoutes);
app.use('/api/zk', zkRoutes);
app.use('/api/zk', schnorrRoutes);
app.use('/api/zk', snarkVerifyRoutes);
app.use('/api/secure-records', secureRecordsRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/insurance', insuranceRoutes);
app.use('/api/education', educationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/telemedicine', telemedicineRoutes);
app.use('/api/fulfillment', fulfillmentRoutes);
app.use('/api/vault', vaultRoutes);
app.use('/api/webauthn', webauthnRoutes);
app.use('/api/ocr', labReportRoutes);
app.use('/api/health-score', healthScoreRoutes);
app.use('/api/wearable', wearableRoutes);
app.use('/api/consult', consultRoutes);
app.use('/api/audio-brief', audioBriefRoutes);
app.use('/api/emergency', emergencyRoutes);
app.use('/api/community', communityRoutes);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../index.html'));
});

app.get('/api/health', (_, res) => res.json({ status: 'ok', service: 'LifeSe Backend' }));
app.get('/api/metrics', (req, res) => {
  if (req.ip === '::1' || req.ip === '127.0.0.1') return getMetrics(req, res);
  res.status(403).json({ error: 'Forbidden' });
});

app.use(telemetryMiddleware);
app.use(globalErrorHandler); // Must be the last middleware

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, async () => {
    logger.info(`🏥 LifeSe Backend initialized on port ${PORT}`);
    
    // 🧬 Seed Demo Data (Admin, Doctor, Citizen) for Presentation Flow
    try {
      const { getDb } = await import('./db.js');
      const db = getDb();
      const demoUsers = [
        { id: 'admin-1', phone: '9876543212', name: 'LifeSe Lead Admin', role: 'admin', healthId: 'LIFE-ADMIN-01' },
        { id: 'doc-1', phone: '9876543210', name: 'Dr. Sarah Smith', role: 'doctor', healthId: 'LIFE-DOC-01', verificationStatus: 'verified' },
        { id: 'cit-1', phone: '7778889990', name: 'Rahul Kumar', role: 'citizen', healthId: 'LIFE-RAHUL-01' },
      ];
      demoUsers.forEach(u => {
          try { db.users.push(u); } catch (err) {} 
      });
      logger.info('🧬 Demo data seeded successfully');
    } catch (e) {
      logger.warn('Seed data skip (already exists or error)', { message: e.message });
    }
  });
}


process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection', { reason });
});

process.on('uncaughtException', (err) => {
  logger.fatal('Uncaught Exception', { message: err.message, stack: err.stack });
  process.exit(1);
});

export { app };


