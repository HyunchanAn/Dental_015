import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HITL_SCHEMA_VERSION,
  addCariesBoxToReport,
  addToothToReport,
  deleteCariesBoxFromReport,
  deleteToothFromReport,
  hydrateReportFromHiTLGolden,
  serializeReportToHiTLGolden,
  toggleToothRestorationTag,
  updateCariesBoxInReport,
  updateToothGeometryInReport,
} from '../src/utils/hitlLogic.mjs';

function makeSeedJson() {
  return {
    schema_version: HITL_SCHEMA_VERSION,
    document_id: 'HITL-TEST-001',
    created_at: '2026-11-23T12:00:00Z',
    updated_at: '2026-11-23T12:00:00Z',
    hitl_status: 'seed',
    annotator: null,
    source_model: 'Dental_008-YOLOv8m-seg',
    image_meta: {
      filename: 'case_001.png',
      width: 2000,
      height: 1000,
      sha256_hash: 'a'.repeat(64),
      source_format: 'PNG',
      pixel_spacing_mm: [0.1, 0.1],
      is_calibrated: true,
      midline_x: 1000.0,
    },
    teeth: [
      {
        instance_id: 't-1',
        fdi: 36,
        bbox_xyxy: [1200, 500, 1300, 700],
        polygon_px: [
          [1200, 500],
          [1300, 500],
          [1300, 700],
          [1200, 700],
        ],
        confidence: 0.92,
        uncertain: false,
        is_supernumerary: false,
        restoration_tags: [],
        clinician_corrected: false,
        original_fdi: null,
      },
      {
        instance_id: 't-2',
        fdi: 37,
        bbox_xyxy: [1310, 505, 1400, 705],
        polygon_px: [
          [1310, 505],
          [1400, 505],
          [1400, 705],
          [1310, 705],
        ],
        confidence: 0.55,
        uncertain: true,
        is_supernumerary: false,
        restoration_tags: [],
        clinician_corrected: false,
        original_fdi: null,
      },
    ],
    lesions: [],
    bone_loss: [],
    missing_fdi: [46],
  };
}

test('HiTL seed hydration -> tooth box move/add/delete & restoration tag -> Golden JSON roundtrip', () => {
  const seed = makeSeedJson();
  let report = hydrateReportFromHiTLGolden(seed);
  assert.equal(report.findings.teeth.length, 2);
  assert.equal(report.findings.teeth[0].toothNumber, 36);
  assert.equal(report.findings.teeth[0].x, 0.6);

  // Move and resize tooth #36
  report = updateToothGeometryInReport(report, 0, { x: 0.61, y: 0.51, w: 0.05, h: 0.2 });
  assert.equal(report.findings.teeth[0].clinicianCorrected, true);

  // Toggle Dental_013 restoration tags on #36
  report = toggleToothRestorationTag(report, 0, 'Crown/Bridge');
  report = toggleToothRestorationTag(report, 0, 'Endodontic (RCT)');
  assert.deepEqual(report.findings.teeth[0].restorationTags, ['Crown/Bridge', 'Endodontic (RCT)']);

  // Add supernumerary tooth #29 and delete uncertain #37
  report = addToothToReport(report, { x: 0.52, y: 0.15, w: 0.025, h: 0.1 }, 29, []);
  assert.equal(report.findings.teeth.length, 3);
  assert.equal(report.findings.supernumeraryTeeth.length, 1);

  report = deleteToothFromReport(report, 1);
  assert.equal(report.findings.teeth.length, 2);

  // Add and update Dental_002 caries lesion box inside #36
  report = addCariesBoxToReport(report, { x: 0.615, y: 0.53, w: 0.02, h: 0.04 });
  assert.equal(report.findings.caries.length, 1);
  assert.equal(report.findings.caries[0].toothNumber, 36);

  report = updateCariesBoxInReport(report, 0, { x: 0.62, y: 0.54, w: 0.02, h: 0.04 }, 36);
  assert.equal(report.findings.caries[0].clinicianCorrected, true);

  // Export back to Dental_Core Golden JSON
  const golden = serializeReportToHiTLGolden(report, 'dr_an');
  assert.equal(golden.schema_version, HITL_SCHEMA_VERSION);
  assert.equal(golden.hitl_status, 'verified_golden');
  assert.equal(golden.annotator, 'dr_an');
  assert.equal(golden.teeth.length, 2);
  assert.equal(golden.teeth[0].bbox_xyxy[0], 1220);
  assert.deepEqual(golden.teeth[0].restoration_tags, ['Crown/Bridge', 'Endodontic (RCT)']);
  assert.equal(golden.teeth[1].fdi, 29);
  assert.equal(golden.teeth[1].is_supernumerary, true);
  assert.equal(golden.lesions.length, 1);
  assert.equal(golden.lesions[0].category, 'caries');
  assert.equal(golden.lesions[0].fdi, 36);

  // Test deleting caries box
  report = deleteCariesBoxFromReport(report, 0);
  assert.equal(report.findings.caries.length, 0);
});
