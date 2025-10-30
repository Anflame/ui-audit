import type { ComponentType } from "react";

declare const REACT_APP_ENV: { [index: string]: string | null | undefined };

const prefix = REACT_APP_ENV.PUBLIC_URL ?? process.env.PUBLIC_URL;
export const prefixRouteUrl = prefix ? `${prefix}/` : "/";

export const RoutePath = {
  CTRL_PROCEDURES: `${prefixRouteUrl}ctrlProcedures`,
  RISKS: `${prefixRouteUrl}risk`,
  RISK_CARD: `${prefixRouteUrl}risk/edit`,
  RISK_TEMPLATES: `${prefixRouteUrl}riskTemplates`,
  RISK_TEMPLATES_CARD: `${prefixRouteUrl}riskTemplates/card`,
  RISK_INDICATORS: `${prefixRouteUrl}riskIndicator`,
  ORGANIZATIONS: `${prefixRouteUrl}organizations`,
  ORGANIZATION_CARD: `${prefixRouteUrl}organizations/card`,
  RISK_TEMPLATE_CARD: `${prefixRouteUrl}riskTemplates/card`,
  DICTIONARY_RISK_SOURCE: `${prefixRouteUrl}riskSource`,
  ERROR_PAGE: `${prefixRouteUrl}error`,
  HOME_PAGE: `${prefixRouteUrl}`,
  DICTIONARY_VIEW: `${prefixRouteUrl}dictionary/:dictionaryName`,
  DICTIONARY_EDITOR: `${prefixRouteUrl}dictionary/:dictionaryName/edit/:id?`,
  DICTIONARY_RISK_PROCESS: `${prefixRouteUrl}localProcess`,
  DICTIONARY_UNITS: `${prefixRouteUrl}unit`,
  DICTIONARY_LOCAL_LSI: `${prefixRouteUrl}localLsi`,
  DICTIONARY_COMPANY_TYPE: `${prefixRouteUrl}companyTypes`,
  DICTIONARY_DOCUMENT_TYPE: `${prefixRouteUrl}typeDocument`,
  DICTIONARY_PERSON: `${prefixRouteUrl}person`,
  DICTIONARY_PERSON_SIGN: `${prefixRouteUrl}personSign`,
  DICTIONARY_OKSM: `${prefixRouteUrl}oksm`,
  DICTIONARY_INCIDENT_RESULT_TYPE: `${prefixRouteUrl}incidentResultType`,
  DICTIONARY_ORGANIZATION_FUNCTION: `${prefixRouteUrl}organizationFunction`,
  DICTIONARY_ORGANIZATION_KIND: `${prefixRouteUrl}organizationKind`,
  DICTIONARY_INCINDENT_STATUS: `${prefixRouteUrl}incidentStatus`,
  DICTIONARY_PERIODICITY: `${prefixRouteUrl}periodicity`,
  DICTIONARY_OBJECTIVE_PRIORITY: `${prefixRouteUrl}objectivePriority`,
  DICTIONARY_OBJECTIVE: `${prefixRouteUrl}objective`,
  DICTIONARY_IMPROVESICS: `${prefixRouteUrl}improvesICS`,
  DICTIONARY_OBJECTIVE_TYPE: `${prefixRouteUrl}objectiveType`,
  DICTIONARY_RISK_INCINDENT_TYPE: `${prefixRouteUrl}dictionary/riskIndicatorType`,
  DICTIONARY_PROCEDURE_TYPE: `${prefixRouteUrl}ctrlProcedureType`,
  DICTIONARY_RISK_INDICATOR_TYPE: `${prefixRouteUrl}riskIndicatorType`,
  DICTIONARY_COMPONENTS_ICS: `${prefixRouteUrl}componentsICS`,
  DICTIONARY_KND_STATUS: `${prefixRouteUrl}kndStatus`,
  DICTIONARY_KND_NAME: `${prefixRouteUrl}kndName`,
  DICTIONARY_KND_PERIOD: `${prefixRouteUrl}kndPeriod`,
  DICTIONARY_RISK_CONSEQUENCE_CATEGORY: `${prefixRouteUrl}riskConsequenceCategory`,
  DICTIONARY_DEAL_TYPES: `${prefixRouteUrl}dealType`,
  DICTIONARY_RISK_CATEGORIES: `${prefixRouteUrl}riskCategory`,
  DICTIONARY_CTRL_PROCEDURE_FREQUENCY: `${prefixRouteUrl}ctrlProcedureFrequency`,
  DICTIONARY_CTRL_PROCEDURE_METHOD: `${prefixRouteUrl}procedureMethod`,
  DICTIONARY_INFO_SYSTEM: `${prefixRouteUrl}infoSystem`,
  INFO_SYSTEM_CARD: `${prefixRouteUrl}infoSystem/card`,
  DICTIONARY_TECHNICAL_PROCESS_TYPES: `${prefixRouteUrl}technicalProcessTypes`,
  DICTIONARY_ASSESSMENT_METHOD: `${prefixRouteUrl}assessmentMethod`,
  DICTIONARY_IDENTIFICATION_AREA: `${prefixRouteUrl}identificationArea`,
  DICTIONARY_RISK_AREA: `${prefixRouteUrl}riskArea`,
  DICTIONARY_COMPANY: `${prefixRouteUrl}company`,
  DICTIONARY_CONTROL_LEVEL: `${prefixRouteUrl}controlLevels`,
  DICTIONARY_ANALYSIS_METHOD: `${prefixRouteUrl}analysisMethod`,
  DICTIONARY_CONSEQUENCE_AGGREGATION_METHOD: `${prefixRouteUrl}consequenceAggregationMethod`,
  DICTIONARY_INFO_SYSTEM_TYPE: `${prefixRouteUrl}infoSystemType`,
  DICTIONARY_REGULATION: `${prefixRouteUrl}regulation`,
  DICTIONARY_POSITION_TYPE: `${prefixRouteUrl}positionType`,
  DICTIONARY_DOCUMENT: `${prefixRouteUrl}documents`,
  DICTIONARY_CHECKLISTS: `${prefixRouteUrl}checklistsIcs`,
  DICTIONARY_LINE_DECLARATION: `${prefixRouteUrl}lineDeclaration`,
  DICTIONARY_TAX_CODES: `${prefixRouteUrl}taxCodes`,
  REPORTS_RISKS_MATRIX: `${prefixRouteUrl}risksMatrix`,
  REPORTS_EXTENDED_MATRIX: `${prefixRouteUrl}extendedMatrix`,
  REPORTS_BOW_TIE: `${prefixRouteUrl}bowTie`,
  REPORTS_KND_REGISTRY: `${prefixRouteUrl}knd`,
  REPORTS_KND_EDITOR: `${prefixRouteUrl}knd/editor`,
  RISK_ANALYSIS_PROFILE: `${prefixRouteUrl}riskAnalysisProfile`,
  RISK_ANALYSIS_PROFILE_CARD: `${prefixRouteUrl}riskAnalysisProfile/card`,
  RISK_CONTRACT: `${prefixRouteUrl}contract`,
  RISK_CONTRACT_CARD: `${prefixRouteUrl}contract/card`,
  RISK_ASSESSMENT_PROFILE: `${prefixRouteUrl}riskAssessmentProfile`,
  OKATO: `${prefixRouteUrl}okato`,
  INCIDENT: `${prefixRouteUrl}incident`,
  FEEDBACK: `${prefixRouteUrl}feedback`,
  FEEDBACK_CARD: `${prefixRouteUrl}feedback/card`,
  REPORTS: `${prefixRouteUrl}reports`,
  DASHBOARDS: `${prefixRouteUrl}dashboards`,
  TAX_AUTHORITY_INTERACTIONS: `${prefixRouteUrl}taxAuthorityInteractions`,
  FAQ: `${prefixRouteUrl}faq`,
  ICONS: `${prefixRouteUrl}iconsShowAll`,
  PREPARATION_CALENDAR_OF_REPORTING_FORM: `${prefixRouteUrl}preparationCalendarOfReportingForm`,
} as const;

type Keys = keyof typeof RoutePath;
type RouteValue = (typeof RoutePath)[Keys];
export interface Route {
  title?: string;
  path?: string;
  hidden?: boolean;
  component?: ComponentType;
  routes?: Route[];
  redirectTo?: RouteValue;
  link?: boolean;
  resourceName?: string;
}

export interface RouteConfig {
  defaultRoute?: RouteValue;
  routes: Route[];
}
