import { FinalReportResponse, PanoramaHiTLGoldenJson } from '../types/finalReport';

export const HITL_SCHEMA_VERSION: string;
export const SUPERNUMERARY_FDI_SET: Set<number>;
export const ALL_Selectable_FDI: number[];
export const RESTORATION_TAG_OPTIONS: string[];

export interface SimpleNormBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function normBoxToPxXyxy(
  box: SimpleNormBox,
  width: number,
  height: number
): [number, number, number, number];

export function pxXyxyToNormBox(
  xyxy: [number, number, number, number] | number[],
  width: number,
  height: number
): SimpleNormBox;

export function serializeReportToHiTLGolden(
  report: FinalReportResponse,
  annotator?: string
): PanoramaHiTLGoldenJson;

export function hydrateReportFromHiTLGolden(
  golden: PanoramaHiTLGoldenJson,
  overrideSha256?: string | null
): FinalReportResponse;

export function addToothToReport(
  report: FinalReportResponse,
  normBox: SimpleNormBox,
  fdi?: number,
  restorationTags?: string[]
): FinalReportResponse;

export function updateToothGeometryInReport(
  report: FinalReportResponse,
  index: number,
  normBox: SimpleNormBox
): FinalReportResponse;

export function deleteToothFromReport(
  report: FinalReportResponse,
  index: number
): FinalReportResponse;

export function toggleToothRestorationTag(
  report: FinalReportResponse,
  index: number,
  tag: string
): FinalReportResponse;

export function addCariesBoxToReport(
  report: FinalReportResponse,
  normBox: SimpleNormBox,
  explicitFdi?: number | null
): FinalReportResponse;

export function updateCariesBoxInReport(
  report: FinalReportResponse,
  index: number,
  normBox?: SimpleNormBox | null,
  newFdi?: number | null
): FinalReportResponse;

export function deleteCariesBoxFromReport(
  report: FinalReportResponse,
  index: number
): FinalReportResponse;
