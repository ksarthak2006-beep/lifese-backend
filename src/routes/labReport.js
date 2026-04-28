/**
 * Lab Report AI — Route
 * POST /api/ocr/lab-report — Parse lab report text and return plain-English analysis
 * GET  /api/ocr/lab-reports — Get saved lab reports for a patient
 */

import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { parseLabReportText, groupResultsByCategory } from '../services/labReportService.js';
import { getDb } from '../db.js';
import { awardPoints } from '../services/gamificationService.js';

const router = Router();

/**
 * POST /api/ocr/lab-report
 * Body: { reportText, reportName?, labName?, reportDate? }
 */
router.post('/lab-report', authMiddleware, requireRole('citizen', 'doctor'), (req, res) => {
  try {
    const { reportText, reportName, labName, reportDate, patientId } = req.body;

    if (!reportText || reportText.trim().length < 10) {
      return res.status(400).json({ error: 'reportText is required and must contain lab data' });
    }

    const userId = patientId || req.user.id;
    const { results, summary } = parseLabReportText(reportText);
    const groupedResults = groupResultsByCategory(results);

    // Save report to DB
    const db = getDb();
    if (!db.labReports) db.labReports = [];

    const reportRecord = {
      id: `lr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userId,
      reportName: reportName || `Lab Report — ${new Date().toLocaleDateString('en-IN')}`,
      labName: labName || 'Unknown Lab',
      reportDate: reportDate || new Date().toISOString(),
      rawText: reportText,
      results,
      groupedResults,
      summary,
      parsedAt: new Date().toISOString(),
    };

    db.labReports.push(reportRecord);

    // Award health points for uploading lab report
    if (req.user.role === 'citizen') {
      awardPoints(req.user.id, 'upload_lab', { reportId: reportRecord.id });
    }

    res.status(201).json({
      reportId: reportRecord.id,
      summary,
      groupedResults,
      results,
      totalTests: results.length,
      criticalCount: results.filter((r) => r.severity === 'danger').length,
      warningCount: results.filter((r) => r.severity === 'warning').length,
      normalCount: results.filter((r) => r.severity === 'normal').length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/ocr/lab-reports — List saved lab reports for current user
 */
router.get('/lab-reports', authMiddleware, requireRole('citizen', 'doctor'), (req, res) => {
  try {
    const db = getDb();
    const userId = req.query.patientId || req.user.id;
    const reports = (db.labReports || []).filter
      ? db.labReports.filter((r) => r.userId === userId)
      : [];
    res.json(reports.map((r) => ({
      id: r.id,
      reportName: r.reportName,
      labName: r.labName,
      reportDate: r.reportDate,
      totalTests: r.results?.length || 0,
      summary: r.summary,
      parsedAt: r.parsedAt,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/ocr/lab-reports/:id — Get a specific lab report with full results
 */
router.get('/lab-reports/:id', authMiddleware, requireRole('citizen', 'doctor'), (req, res) => {
  try {
    const db = getDb();
    const reports = db.labReports || [];
    const report = reports.find ? reports.find((r) => r.id === req.params.id) : null;
    if (!report) return res.status(404).json({ error: 'Lab report not found' });
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
