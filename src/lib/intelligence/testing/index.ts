/* ===========================================================================
   Phase 2.0.2  —  Intelligence Testing public surface.

   Dev-only modules. The dashboard never imports from here.
   ========================================================================== */

export {
  ALL_SCENARIOS,
  healthyState,
  moderatePressureState,
  highRiskState,
  falseSignalState,
  recoveryState,
  type Scenario,
  type ScenarioExpectations,
} from "./scenarios";

export {
  assertScenario,
  type ValidationIssue,
  type IssueLevel,
} from "./assertions";

export {
  runIntelligenceValidation,
  runHealthStability,
  formatReport,
  type ScenarioResult,
  type ValidationReport,
  type ValidationSummary,
  type HealthStabilityResult,
} from "./runner";

export {
  explainPriority,
  explainSignal,
  explainCorrelation,
  explainHealthScore,
  type PriorityExplanation,
} from "./inspectors";
