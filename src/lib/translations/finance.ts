import type { Translations } from "@/lib/i18n";

/* ===========================================================================
   Finance app translations.

   Covers every operator-visible English string across the Finance app:
   FinanceHome, FinanceHeader, FinanceTabs, FinanceWorkspace,
   DataEntryHub, FinanceSetup, FinanceOrders/Customers/Suppliers/Payments,
   FinanceExpenses (analytics), FinanceBankAccounts (+ dialogs),
   FinanceTreasuryForecast/Plans, FinanceReconciliation, FinanceBankImports,
   accounting queue/trial-balance/general-ledger/profit-loss/cash-flow/equity,
   visual + detailed statements, reports, notifications, FX rates,
   approvals, and the Dashboard cards.

   Keys are namespaced by surface so a quick scan of a Finance component
   reveals which keys to look for. The English entries are the canonical
   source — Chinese and Arabic translations are tuned for an accounting
   / treasury audience (matches the invoices.ts vocabulary).
   ========================================================================== */

import { FIN_ACCOUNTING } from "./finance/accounting";
import { FIN_APP } from "./finance/app";
import { FIN_APPROVALS } from "./finance/approvals";
import { FIN_BANK } from "./finance/bank";
import { FIN_BANKACCOUNTS } from "./finance/bankAccounts";
import { FIN_BANKIMPORTS } from "./finance/bankImports";
import { FIN_CF } from "./finance/cf";
import { FIN_CFG } from "./finance/cfg";
import { FIN_CHART } from "./finance/chart";
import { FIN_COMMON } from "./finance/common";
import { FIN_CUSTOMERS } from "./finance/customers";
import { FIN_DASH } from "./finance/dash";
import { FIN_DASHBOARD } from "./finance/dashboard";
import { FIN_DATAENTRY } from "./finance/dataEntry";
import { FIN_DE } from "./finance/de";
import { FIN_EQUITY } from "./finance/equity";
import { FIN_ERROR } from "./finance/error";
import { FIN_EXPANALYTICS } from "./finance/expAnalytics";
import { FIN_FORECAST } from "./finance/forecast";
import { FIN_FX } from "./finance/fx";
import { FIN_FXRATES } from "./finance/fxRates";
import { FIN_GL } from "./finance/gl";
import { FIN_HEADER } from "./finance/header";
import { FIN_HOME } from "./finance/home";
import { FIN_IMP } from "./finance/imp";
import { FIN_KIND } from "./finance/kind";
import { FIN_MOVEMENT } from "./finance/movement";
import { FIN_NOTIFICATIONS } from "./finance/notifications";
import { FIN_ORDERS } from "./finance/orders";
import { FIN_PARTY } from "./finance/party";
import { FIN_PAYMENTS } from "./finance/payments";
import { FIN_PL } from "./finance/pl";
import { FIN_PROFITFLOW } from "./finance/profitFlow";
import { FIN_RECONCILIATION } from "./finance/reconciliation";
import { FIN_REPORTS } from "./finance/reports";
import { FIN_SETUP } from "./finance/setup";
import { FIN_SEV } from "./finance/sev";
import { FIN_STATEMENTS } from "./finance/statements";
import { FIN_SUBTAB } from "./finance/subtab";
import { FIN_SUPPLIERS } from "./finance/suppliers";
import { FIN_TABS } from "./finance/tabs";
import { FIN_TB } from "./finance/tb";
import { FIN_TOPCATEGORIES } from "./finance/topCategories";
import { FIN_TOPORDERS } from "./finance/topOrders";
import { FIN_TREASURY } from "./finance/treasury";
import { FIN_TREASURYFORECAST } from "./finance/treasuryForecast";
import { FIN_TREASURYPLANS } from "./finance/treasuryPlans";
import { FIN_UIX } from "./finance/uix";
import { FIN_VISUAL } from "./finance/visual";
import { FIN_WORKFLOW } from "./finance/workflow";
import { FIN_WORKSPACE } from "./finance/workspace";
/* ⚠️ THIS UNION EXISTS FOR COMPATIBILITY, NOT FOR SCREENS TO IMPORT.
   The finance dictionary reached 1,637 keys x 3 languages — 287 KB of source,
   200 KB minified — and all 33 finance components imported the whole thing.
   Measured 17/09/2026: that one chunk sat in 28 of the 29 finance routes and
   nowhere else in the Hub, which is why every finance screen weighed
   800-1,010 KB. /finance/orders read 121 of those keys. /finance/cash-flow
   read twelve.

   The strings now live one file per namespace under ./finance/, and each
   screen imports only the namespaces it uses — sixteen of them need exactly
   one. `validate:finance-i18n` fails the build if a finance component imports
   this union again, or calls a key its own imports do not define. */
export const financeT: Translations = {
  ...FIN_ACCOUNTING,
  ...FIN_APP,
  ...FIN_APPROVALS,
  ...FIN_BANK,
  ...FIN_BANKACCOUNTS,
  ...FIN_BANKIMPORTS,
  ...FIN_CF,
  ...FIN_CFG,
  ...FIN_CHART,
  ...FIN_COMMON,
  ...FIN_CUSTOMERS,
  ...FIN_DASH,
  ...FIN_DASHBOARD,
  ...FIN_DATAENTRY,
  ...FIN_DE,
  ...FIN_EQUITY,
  ...FIN_ERROR,
  ...FIN_EXPANALYTICS,
  ...FIN_FORECAST,
  ...FIN_FX,
  ...FIN_FXRATES,
  ...FIN_GL,
  ...FIN_HEADER,
  ...FIN_HOME,
  ...FIN_IMP,
  ...FIN_KIND,
  ...FIN_MOVEMENT,
  ...FIN_NOTIFICATIONS,
  ...FIN_ORDERS,
  ...FIN_PARTY,
  ...FIN_PAYMENTS,
  ...FIN_PL,
  ...FIN_PROFITFLOW,
  ...FIN_RECONCILIATION,
  ...FIN_REPORTS,
  ...FIN_SETUP,
  ...FIN_SEV,
  ...FIN_STATEMENTS,
  ...FIN_SUBTAB,
  ...FIN_SUPPLIERS,
  ...FIN_TABS,
  ...FIN_TB,
  ...FIN_TOPCATEGORIES,
  ...FIN_TOPORDERS,
  ...FIN_TREASURY,
  ...FIN_TREASURYFORECAST,
  ...FIN_TREASURYPLANS,
  ...FIN_UIX,
  ...FIN_VISUAL,
  ...FIN_WORKFLOW,
  ...FIN_WORKSPACE,
};

/* ============================================================================
   Account-name translation helper.

   The chart-of-accounts is stored in the DB with English names. Rather
   than mutate the data layer, we ship a client-side lookup keyed off
   the immutable account CODE and return a localized label. Components
   that render `{account.name}` should use this helper instead.
   ========================================================================== */
