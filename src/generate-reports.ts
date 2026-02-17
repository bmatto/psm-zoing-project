/**
 * Main Report Generation Script
 *
 * Generates zoning analysis reports from enriched parcel data without
 * re-running API enrichment. Reads from output/portsmouth_properties_full.json
 * and generates comprehensive and infrastructure burden reports.
 */

import { readFile, writeFile } from 'fs/promises';
import { EnrichedParcel } from './types/index.js';
import { calculateZoneMetrics } from './analysis/zone-metrics.js';
import { analyzeViolations } from './analysis/violations.js';
import { calculateInfrastructureMetrics } from './analysis/infrastructure-burden.js';
import { ZONING_RULES } from './zoning/rules.js';
import { generateComprehensiveReport } from './reports/comprehensive-report.js';
import { generateInfrastructureReport } from './reports/infrastructure-report.js';

const INPUT_FILE = 'output/portsmouth_properties_full.json';
const OUTPUT_DIR = 'output';

/**
 * Format timestamp for filenames
 */
function getTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

/**
 * Format timestamp for report headers (human readable)
 */
function getReadableTimestamp(): string {
  return new Date().toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

/**
 * Main report generation function
 */
async function generateReports() {
  console.log('Portsmouth Zoning Analysis - Report Generation');
  console.log('='.repeat(60));
  console.log('');

  // Read enriched parcel data
  console.log(`Reading enriched parcel data from ${INPUT_FILE}...`);
  let parcels: EnrichedParcel[];
  try {
    const fileContent = await readFile(INPUT_FILE, 'utf-8');
    const data = JSON.parse(fileContent);

    // Handle both wrapped format (with metadata) and direct array format
    if (Array.isArray(data)) {
      parcels = data;
    } else if (data.parcels && Array.isArray(data.parcels)) {
      parcels = data.parcels;
    } else {
      throw new Error('Invalid file format: expected array or object with "parcels" property');
    }

    console.log(`✓ Loaded ${parcels.length.toLocaleString()} parcels`);
  } catch (error) {
    console.error(`✗ Error reading enriched data file: ${INPUT_FILE}`);
    console.error('  Please run data enrichment first to generate this file.');
    if (error instanceof Error) {
      console.error(`  Error: ${error.message}`);
    }
    process.exit(1);
  }

  // Filter out parcels with missing required fields
  const validParcels = parcels.filter(p => p.zoning && p.parcel_area_sqft > 0);
  const skippedCount = parcels.length - validParcels.length;

  if (skippedCount > 0) {
    console.log(`  Note: Skipped ${skippedCount.toLocaleString()} parcels with missing zoning or area data`);
  }
  console.log('');

  // Generate timestamps
  const timestamp = getTimestamp();
  const readableTimestamp = getReadableTimestamp();

  // Calculate zone metrics
  console.log('Calculating zone metrics...');
  const zoneMetrics = calculateZoneMetrics(validParcels);
  const zoneCount = Object.keys(zoneMetrics.zones).length;
  console.log(`✓ Calculated metrics for ${zoneCount} zones`);
  console.log('');

  // Analyze violations
  console.log('Analyzing zoning violations...');
  const violationsAnalysis = analyzeViolations(validParcels);
  console.log(`✓ Found ${violationsAnalysis.total_violations.toLocaleString()} violations`);
  console.log(`  ${violationsAnalysis.total_parcels_with_violations.toLocaleString()} parcels affected`);
  console.log('');

  // Calculate infrastructure burden
  console.log('Calculating infrastructure burden...');
  const infrastructureMetrics = calculateInfrastructureMetrics(validParcels, ZONING_RULES);
  const infraZoneCount = Object.keys(infrastructureMetrics.zones).length;
  console.log(`✓ Calculated infrastructure metrics for ${infraZoneCount} zones`);
  console.log('');

  // Generate comprehensive report
  console.log('Generating comprehensive report...');
  const comprehensiveReport = generateComprehensiveReport(
    zoneMetrics,
    violationsAnalysis,
    validParcels.length,
    readableTimestamp
  );
  const comprehensiveReportPath = `${OUTPUT_DIR}/Portsmouth_Zoning_Report_${timestamp}.txt`;
  await writeFile(comprehensiveReportPath, comprehensiveReport, 'utf-8');
  console.log(`✓ Written: ${comprehensiveReportPath}`);
  console.log('');

  // Write violations JSON
  const violationsJsonPath = `${OUTPUT_DIR}/violations_analysis.json`;
  await writeFile(violationsJsonPath, JSON.stringify(violationsAnalysis, null, 2), 'utf-8');
  console.log(`✓ Written: ${violationsJsonPath}`);
  console.log('');

  // Generate infrastructure report
  console.log('Generating infrastructure burden report...');
  const infrastructureReport = generateInfrastructureReport(
    infrastructureMetrics,
    readableTimestamp
  );
  const infrastructureReportPath = `${OUTPUT_DIR}/Portsmouth_Infrastructure_Burden_${timestamp}.txt`;
  await writeFile(infrastructureReportPath, infrastructureReport, 'utf-8');
  console.log(`✓ Written: ${infrastructureReportPath}`);
  console.log('');

  // Write infrastructure JSON
  const infrastructureJsonPath = `${OUTPUT_DIR}/infrastructure_metrics.json`;
  await writeFile(infrastructureJsonPath, JSON.stringify(infrastructureMetrics, null, 2), 'utf-8');
  console.log(`✓ Written: ${infrastructureJsonPath}`);
  console.log('');

  // Summary
  console.log('='.repeat(60));
  console.log('Report Generation Complete');
  console.log('='.repeat(60));
  console.log('');
  console.log('Generated Reports:');
  console.log(`  • ${comprehensiveReportPath}`);
  console.log(`  • ${violationsJsonPath}`);
  console.log(`  • ${infrastructureReportPath}`);
  console.log(`  • ${infrastructureJsonPath}`);
  console.log('');
  console.log('Summary Statistics:');
  console.log(`  • Total parcels analyzed: ${validParcels.length.toLocaleString()}`);
  console.log(`  • Parcels skipped: ${skippedCount.toLocaleString()}`);
  console.log(`  • Zones analyzed: ${zoneCount}`);
  console.log(`  • Total violations found: ${violationsAnalysis.total_violations.toLocaleString()}`);
  console.log(`  • Parcels with violations: ${violationsAnalysis.total_parcels_with_violations.toLocaleString()}`);
  console.log('');
}

// Run the report generation
generateReports().catch((error) => {
  console.error('Fatal error during report generation:');
  console.error(error);
  process.exit(1);
});
