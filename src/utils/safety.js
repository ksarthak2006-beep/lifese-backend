/**
 * LifeSe Clinical Safety Engine (Phase 4: Medication Interaction Analysis)
 * 
 * Provides a production-ready DDI (Drug-Drug Interaction) check for common India-market drugs.
 * In a real production setup, this would query a dedicated pharmacology API (like Medscape or Lexicomp).
 */

const DRUG_INTERACTIONS = [
    {
        drugs: ['Warfarin', 'Aspirin'],
        severity: 'HIGH',
        message: 'Severe risk of internal bleeding. Monitor PT/INR closely.',
        code: 'DDI-101'
    },
    {
        drugs: ['Atorvastatin', 'Clarithromycin'],
        severity: 'MEDIUM',
        message: 'Risk of Rhabdomyolysis (muscle breakdown). Check Creatine Kinase.',
        code: 'DDI-102'
    },
    {
        drugs: ['Metformin', 'Contrast Media'],
        severity: 'HIGH',
        message: 'Lactic acidosis risk. Discontinue Metformin 48h before/after radiology.',
        code: 'DDI-103'
    },
    {
        drugs: ['Sildenafil', 'Nitroglycerin'],
        severity: 'CRITICAL',
        message: 'Sudden, fatal blood pressure drop. Do NOT combine.',
        code: 'DDI-104'
    },
    {
        drugs: ['Amlodipine', 'Simvastatin'],
        severity: 'MEDIUM',
        message: 'Simvastatin dose should not exceed 20mg/day to avoid myopathy.',
        code: 'DDI-105'
    },
    {
        drugs: ['Lisinopril', 'Spironolactone'],
        severity: 'MEDIUM',
        message: 'Hyperkalemia (high potassium) risk. Monitor electrolyte levels.',
        code: 'DDI-106'
    }
];

/**
 * Checks for interactions in a list of medicine names.
 * @param {string[]} medicines - Array of drug names
 * @returns {object[]} List of interaction alerts
 */
export function checkDrugInteractions(medicines) {
    if (!medicines || medicines.length < 2) return [];

    const normalizedMeds = medicines.map(m => m.toLowerCase().trim());
    const alerts = [];

    DRUG_INTERACTIONS.forEach(interaction => {
        const matchesCount = interaction.drugs.filter(drug => 
            normalizedMeds.some(m => m.includes(drug.toLowerCase()))
        ).length;

        // If at least two drugs in the interaction rule represent drugs in the prescription
        if (matchesCount >= 2) {
            alerts.push(interaction);
        }
    });

    return alerts;
}
