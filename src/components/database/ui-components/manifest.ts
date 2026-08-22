/* AUTO-GENERATED component inventory — regenerated 2026-08-07 by a
   directory-aware crawl over src/components AND src/app. kitFiles =
   how many of the module's files import from the shared kit
   (@/components/kds, /ui or /common) — the convergence signal the
   catalog shows as a percentage. Do not hand-edit; rerun the crawl. */
export interface UiModule { key: string; fileCount: number; kitFiles: number; components: string[] }
export const UI_COMPONENT_TOTALS = { components: 841, files: 1034, modules: 111 };
export const UI_COMPONENT_MODULES: UiModule[] = [
  {
    "key": "activity",
    "fileCount": 1,
    "kitFiles": 0,
    "components": [
      "ActivityTracker"
    ]
  },
  {
    "key": "admin",
    "fileCount": 58,
    "kitFiles": 21,
    "components": [
      "AccessRightsTab",
      "AccessoryOptionsSection",
      "AccountDetail",
      "AccountForm",
      "AccountsList",
      "AdminAuth",
      "ApiKeyRevealModal",
      "AuthGate",
      "BarcodeQRDisplay",
      "BaseFobCard",
      "CalendarApp",
      "CalendarTab",
      "CertificationsSection",
      "ClassificationSection",
      "CompleteSetConfigurator",
      "CreateBrandModal",
      "CreateCategoryModal",
      "CreateDivisionModal",
      "CreateSubcategoryModal",
      "CreateSupplierModal",
      "DayView",
      "DescriptionSection",
      "EventModal",
      "FamilySharedDivider",
      "FamilySpecGrid",
      "FamilyStrip",
      "FieldHelp",
      "KnowledgeSection",
      "MediaSection",
      "MemberIdentityPanel",
      "MemberLogisticsPanel",
      "MemberPricingPanel",
      "MemberSupplierPanel",
      "ModelsSection",
      "MonthView",
      "NotesTab",
      "OverviewTab",
      "PreferencesTab",
      "PricingIntelligenceCard",
      "PrivateTab",
      "ProductDocumentsSection",
      "ProductForm",
      "ProductFormLazy",
      "ProductList",
      "ProductProfile",
      "ProductStockProfile",
      "ProductVisualLibrary",
      "RelatedProductsSection",
      "RichTextEditor",
      "SchemaSpecsSection",
      "SearchSocialSection",
      "SecurityTab",
      "SelectWithCreate",
      "SewingMachineSection",
      "StatButtons",
      "StatusBadge",
      "StatusRibbon",
      "SupplierLinkSection",
      "TabActionBar",
      "TabEmptyState",
      "TaxonomyAdmin",
      "TechnicalSection",
      "Toggle",
      "VisualAssetPicker",
      "WeekView"
    ]
  },
  {
    "key": "ai",
    "fileCount": 11,
    "kitFiles": 1,
    "components": [
      "AutoTranslate",
      "EmojiButton",
      "KoleexAiApp",
      "KoleexGlowOrb",
      "KoleexOrb",
      "KoleexOrbIcon",
      "KoleexRobot",
      "MessageMarkdown",
      "MicButton",
      "ProjectGlyph",
      "TypingIndicator"
    ]
  },
  {
    "key": "ai-orb",
    "fileCount": 1,
    "kitFiles": 0,
    "components": [
      "AIOrb"
    ]
  },
  {
    "key": "approval",
    "fileCount": 2,
    "kitFiles": 1,
    "components": [
      "ApprovalBadge",
      "ApprovalReviewDrawer"
    ]
  },
  {
    "key": "attachments",
    "fileCount": 4,
    "kitFiles": 2,
    "components": [
      "AttachmentDropzone",
      "AttachmentList",
      "AttachmentPreviewDrawer",
      "EvidenceBadge"
    ]
  },
  {
    "key": "behavior",
    "fileCount": 1,
    "kitFiles": 0,
    "components": [
      "BehaviorPicker",
      "BehaviorSlider",
      "BehaviorSliderStyles"
    ]
  },
  {
    "key": "commercial-policy",
    "fileCount": 8,
    "kitFiles": 4,
    "components": [
      "Badge",
      "Callout",
      "CardGrid",
      "CatalogEditorModal",
      "DataTable",
      "IncotermsManager",
      "InfoCard",
      "MarketSegmentation",
      "PaymentTermsManager",
      "PolicyPage",
      "PolicySidebar",
      "RuleList",
      "Section",
      "SectionDesc",
      "ShippingDocumentsManager",
      "ShippingMethodsManager",
      "StepFlow"
    ]
  },
  {
    "key": "common",
    "fileCount": 1,
    "kitFiles": 0,
    "components": [
      "BoundIcon"
    ]
  },
  {
    "key": "contacts",
    "fileCount": 3,
    "kitFiles": 1,
    "components": [
      "Contacts",
      "ImportSupplierFromCatalog",
      "SquareLogoCropper"
    ]
  },
  {
    "key": "create",
    "fileCount": 6,
    "kitFiles": 6,
    "components": [
      "CreateAsset",
      "CreateCustomer",
      "CreateExpense",
      "CreateHub",
      "CreateInventoryItem",
      "CreateSupplier"
    ]
  },
  {
    "key": "customers",
    "fileCount": 1,
    "kitFiles": 0,
    "components": [
      "CustomersServerList"
    ]
  },
  {
    "key": "database",
    "fileCount": 27,
    "kitFiles": 11,
    "components": [
      "AddToCollectionModal",
      "AssetDna",
      "AssetQuality",
      "AssetRegistry",
      "AssetReview",
      "BrandReadThrough",
      "BrandsManager",
      "ClassificationIconHub",
      "ClassificationManager",
      "CollectionDetail",
      "CollectionModal",
      "CollectionsBrowser",
      "DatabaseHeader",
      "DatabaseHome",
      "IconBindingPicker",
      "KdsShowcase",
      "PlatformShowcase",
      "ReviewBoard",
      "SemanticRelationships",
      "SpecIconHub",
      "UiComponentsCatalog",
      "UsageGovernance",
      "VisualAssetCard",
      "VisualAssetDetailDrawer",
      "VisualLibraryBrowser",
      "VisualLibraryUploadModal",
      "VisualRelationshipModal"
    ]
  },
  {
    "key": "discuss",
    "fileCount": 8,
    "kitFiles": 1,
    "components": [
      "CustomerChatModal",
      "CustomerContactCard",
      "DiscussAiChat",
      "DiscussApp",
      "SearchPanel",
      "ThreadPane",
      "TranslatableBody",
      "VoicePlaybackBubble",
      "VoiceRecorder"
    ]
  },
  {
    "key": "documents",
    "fileCount": 4,
    "kitFiles": 2,
    "components": [
      "DocToolbar",
      "DocumentsApp",
      "PackingListDoc",
      "PortCombobox"
    ]
  },
  {
    "key": "employees",
    "fileCount": 3,
    "kitFiles": 1,
    "components": [
      "EmployeeBehaviorSection",
      "EmployeeForm",
      "EmployeeSkillsSection"
    ]
  },
  {
    "key": "executive",
    "fileCount": 1,
    "kitFiles": 1,
    "components": [
      "ExecutiveDashboard"
    ]
  },
  {
    "key": "expenses",
    "fileCount": 3,
    "kitFiles": 3,
    "components": [
      "ExpensesApp",
      "ExpensesHeader",
      "ExpensesTabs"
    ]
  },
  {
    "key": "finance",
    "fileCount": 36,
    "kitFiles": 31,
    "components": [
      "AgingTable",
      "AnomalyChip",
      "AreaChart",
      "AreaChartMini",
      "BarChart",
      "CalmTag",
      "ChartCard",
      "ConcentrationBar",
      "DashboardSection",
      "DataEntryHub",
      "DisplayKpi",
      "DonutChart",
      "EditDrawer",
      "EmptyState",
      "Eyebrow",
      "Field",
      "FinanceAccountingQueue",
      "FinanceApprovals",
      "FinanceBankAccounts",
      "FinanceBankImports",
      "FinanceCashFlow",
      "FinanceCustomers",
      "FinanceDashboard",
      "FinanceEquity",
      "FinanceExpenseAnalytics",
      "FinanceGeneralLedger",
      "FinanceHeader",
      "FinanceHome",
      "FinanceNotifications",
      "FinanceOrders",
      "FinancePayments",
      "FinanceProfitLoss",
      "FinanceReconciliation",
      "FinanceReports",
      "FinanceSetup",
      "FinanceStatements",
      "FinanceSuppliers",
      "FinanceTreasuryForecast",
      "FinanceTreasuryPlans",
      "FinanceTrialBalance",
      "FinanceWorkspace",
      "FxRatesManager",
      "Hairline",
      "HealthBadge",
      "HealthPill",
      "HealthRail",
      "HeroKpiCard",
      "InsightCard",
      "IntelligenceLine",
      "KpiCard",
      "LiquidityMeter",
      "ManualMovementDrawer",
      "MetricCard",
      "ModeToggle",
      "OperationalKpi",
      "OperationsDigest",
      "PageHeader",
      "PartyChip",
      "PartyPickerModal",
      "PeriodTabs",
      "ProfitFlow",
      "ProgressBar",
      "SectionCard",
      "SectionTitle",
      "SegmentedNav",
      "StatRow",
      "StatementsDashboard",
      "StatusBadge",
      "TimelineStrip",
      "TopCategoriesCard",
      "TopOrdersCard",
      "TrendChart",
      "VisualStatements",
      "WorkflowRail"
    ]
  },
  {
    "key": "home",
    "fileCount": 1,
    "kitFiles": 1,
    "components": [
    ]
  },
  {
    "key": "hr",
    "fileCount": 17,
    "kitFiles": 4,
    "components": [
      "AppraisalsModule",
      "Attendance",
      "BehaviorModule",
      "DashboardModule",
      "Documents",
      "EmployeeAvatar",
      "EmployeeLink",
      "EmployeePicker",
      "EmptyState",
      "FieldLabel",
      "HRApp",
      "HrFileField",
      "LeaveManagement",
      "ModalShell",
      "OnboardingModule",
      "PayrollModule",
      "RecruitmentModule",
      "ReportsModule",
      "SkillsModule",
      "StatusBadge",
      "Training",
      "TranslatableText"
    ]
  },
  {
    "key": "icons",
    "fileCount": 315,
    "kitFiles": 14,
    "components": [
      "BrandGlyph",
      "FileCode2Icon",
      "FolderIcon",
      "HighlighterIcon",
      "NotesIcon",
      "StrikethroughIcon",
      "TranslatorIcon"
    ]
  },
  {
    "key": "inventory",
    "fileCount": 19,
    "kitFiles": 18,
    "components": [
      "ActionCard",
      "AlertCard",
      "BatchOption",
      "BulkActionBar",
      "DetailsAccordion",
      "DirectionDelta",
      "EmptyHero",
      "FilterChip",
      "HumanStatusPill",
      "IntelTile",
      "InventoryBalances",
      "InventoryBatches",
      "InventoryDashboard",
      "InventoryEmpty",
      "InventoryHeader",
      "InventoryInternalItemDrawer",
      "InventoryItems",
      "InventoryKpi",
      "InventoryMovementDetail",
      "InventoryMovements",
      "InventoryPageHero",
      "InventoryPageShell",
      "InventoryReturnCreateDrawer",
      "InventoryReturnDetail",
      "InventoryReturns",
      "InventorySearch",
      "InventorySerials",
      "InventoryShortcutsLegend",
      "InventoryTransferCreateDrawer",
      "InventoryTransferDetail",
      "InventoryTransfers",
      "InventoryWarehouses",
      "ListRow",
      "ListSection",
      "LocationTypeChip",
      "LookupInput",
      "MobileBottomBar",
      "MobileFab",
      "OperatorMovementMenu",
      "PageTitleIcon",
      "Panel",
      "PrimaryButton",
      "SecondaryButton",
      "SectionEyebrow",
      "StatusBadge",
      "TodayTile",
      "TraceabilityCard",
      "TypeChip",
      "TypeIcon",
      "ViewModeToggle",
      "WarningChip"
    ]
  },
  {
    "key": "invoices",
    "fileCount": 2,
    "kitFiles": 2,
    "components": [
      "EntityInvoicesStrip",
      "InvoicesApp"
    ]
  },
  {
    "key": "invoices-doc",
    "fileCount": 1,
    "kitFiles": 1,
    "components": [
      "Quotations"
    ]
  },
  {
    "key": "kds",
    "fileCount": 26,
    "kitFiles": 0,
    "components": [
      "Avatar",
      "Button",
      "Checkbox",
      "ChoiceRows",
      "CollapsibleSection",
      "ConfirmDialog",
      "ConfirmWithReason",
      "Drawer",
      "Dropzone",
      "EmptyState",
      "FilterChip",
      "MenuItem",
      "MenuList",
      "Modal",
      "Pagination",
      "ProgressBar",
      "SearchInput",
      "SectionHeader",
      "Spinner",
      "StatusPill",
      "Table",
      "Td",
      "Th",
      "Toast",
      "Toggle"
    ]
  },
  {
    "key": "knowledge",
    "fileCount": 13,
    "kitFiles": 1,
    "components": [
      "AIParseFlow",
      "BreakdownCard",
      "CategoryGrid",
      "CodeBuilder",
      "CompareCodes",
      "DivisionStrip",
      "EcosystemPreview",
      "HeaderShell",
      "HubIcon",
      "KnowledgeDownload",
      "LangProvider",
      "ProductMatches",
      "SearchByCode",
      "SectionHeader",
      "StickyNav"
    ]
  },
  {
    "key": "landed-cost",
    "fileCount": 1,
    "kitFiles": 0,
    "components": [
      "SimulationForm"
    ]
  },
  {
    "key": "layout",
    "fileCount": 15,
    "kitFiles": 3,
    "components": [
      "AppLaunchLink",
      "AppLaunchSplash",
      "FloatingPanel",
      "KoleexLogo",
      "MainHeader",
      "NavigationProgress",
      "NotificationBell",
      "PermissionGate",
      "RootShell",
      "Sidebar",
      "SidebarProvider",
      "TenantPicker",
      "UserMenu",
      "ViewAsBanner",
      "ViewAsPicker"
    ]
  },
  {
    "key": "markets",
    "fileCount": 1,
    "kitFiles": 0,
    "components": [
      "Markets"
    ]
  },
  {
    "key": "notes",
    "fileCount": 6,
    "kitFiles": 2,
    "components": [
      "ConfirmDialog",
      "FoldersSidebar",
      "NoteEditor",
      "NotesApp",
      "NotesList",
      "PromptDialog",
      "ShareDialog"
    ]
  },
  {
    "key": "operations",
    "fileCount": 2,
    "kitFiles": 2,
    "components": [
      "NotificationBell",
      "OperationsDashboard"
    ]
  },
  {
    "key": "payment",
    "fileCount": 2,
    "kitFiles": 2,
    "components": [
      "PaymentReviewDrawer",
      "ReconciliationBadge"
    ]
  },
  {
    "key": "perf",
    "fileCount": 3,
    "kitFiles": 0,
    "components": [
      "PerfPanel",
      "PerfPanelGate",
      "PerfVitals"
    ]
  },
  {
    "key": "planning",
    "fileCount": 3,
    "kitFiles": 1,
    "components": [
      "EntityPicker",
      "EntityPlanningStrip",
      "PlanningApp"
    ]
  },
  {
    "key": "price-calculator",
    "fileCount": 1,
    "kitFiles": 1,
    "components": [
      "PriceCalculator"
    ]
  },
  {
    "key": "product-preview",
    "fileCount": 2,
    "kitFiles": 0,
    "components": [
      "ProductPreview",
      "VisualGlyph"
    ]
  },
  {
    "key": "product-templates",
    "fileCount": 1,
    "kitFiles": 0,
    "components": [
      "FieldRenderer"
    ]
  },
  {
    "key": "projects",
    "fileCount": 3,
    "kitFiles": 2,
    "components": [
      "AttachmentsPanel",
      "ChecklistPanel",
      "CommentsPanel",
      "EntityTasksStrip",
      "MilestoneStrip",
      "ProjectsApp",
      "SubtasksPanel",
      "TimePanel"
    ]
  },
  {
    "key": "purchase",
    "fileCount": 17,
    "kitFiles": 3,
    "components": [
      "ApprovalsModule",
      "BillsModule",
      "CategoriesModule",
      "ContractsModule",
      "NewBillDialog",
      "NewPaymentDialog",
      "NewPurchaseOrderDialog",
      "NewReceiptDialog",
      "NewRequisitionDialog",
      "OrdersModule",
      "PaymentsModule",
      "PriceListsModule",
      "PurchaseHeader",
      "PurchaseHome",
      "RFQsModule",
      "ReceiptsModule",
      "ReceiveDialog",
      "ReportsModule",
      "RequisitionsModule",
      "ReturnsModule",
      "SuppliersModule"
    ]
  },
  {
    "key": "pwa",
    "fileCount": 3,
    "kitFiles": 0,
    "components": [
      "DevReload",
      "ServiceWorkerRegistrar",
      "UpdateWatcher"
    ]
  },
  {
    "key": "qa",
    "fileCount": 12,
    "kitFiles": 6,
    "components": [
      "AnnotationEditor",
      "AttachmentStrip",
      "AttachmentThumbs",
      "CaptureOverlay",
      "ClaudeWorkspaceDrawer",
      "FixEvidenceForm",
      "FixEvidenceSection",
      "MyIssuesView",
      "QaFocusHighlight",
      "QaReportsApp",
      "ReportIssueButton",
      "ReporterIssueView",
      "WatchControl"
    ]
  },
  {
    "key": "quotations",
    "fileCount": 7,
    "kitFiles": 2,
    "components": [
      "CustomerPickerModal",
      "ImageLightbox",
      "ProductPickerModal",
      "QuotationA4Preview",
      "QuotationPreviewSkeleton",
      "Quotations",
      "ScreenshotCaptureModal",
      "StampSignatureActions",
      "StampSignatureBox"
    ]
  },
  {
    "key": "reports",
    "fileCount": 2,
    "kitFiles": 2,
    "components": [
      "OperationalReports",
      "StatementReports"
    ]
  },
  {
    "key": "sales",
    "fileCount": 19,
    "kitFiles": 6,
    "components": [
      "ActivitiesModule",
      "CommissionsModule",
      "ContactsModule",
      "CustomersModule",
      "DashboardModule",
      "DiscountsModule",
      "ForecastModule",
      "InvoicesModule",
      "LeadsModule",
      "OrdersModule",
      "PaymentsModule",
      "PipelineModule",
      "PriceListsModule",
      "QuotationsModule",
      "ReportsModule",
      "SalesApp",
      "SalesOrderDetail",
      "SalesOrders",
      "ShipDialog"
    ]
  },
  {
    "key": "security",
    "fileCount": 17,
    "kitFiles": 2,
    "components": [
      "DataTable",
      "DeepDiveTabs",
      "EmptyState",
      "InvestigationDrawer",
      "KpiStrip",
      "NeedsAttention",
      "ReadinessPanel",
      "RiskBadge",
      "SectionCard",
      "SecurityCenter",
      "SecurityHeader",
      "SeverityChip",
      "Sparkline",
      "StatusHero",
      "ThreatLevelBadge",
      "ThreatList",
      "TrendPanel"
    ]
  },
  {
    "key": "settings",
    "fileCount": 12,
    "kitFiles": 3,
    "components": [
      "AboutTab",
      "AdminTab",
      "ControlRow",
      "DisplayTab",
      "LoginHistoryTab",
      "NotificationsTab",
      "PasswordTab",
      "PrivacyTab",
      "ProfileTab",
      "RegionTab",
      "Segmented",
      "SelectControl",
      "SettingsCard",
      "SoundsTab",
      "StampSignatureTab",
      "SwitchRow"
    ]
  },
  {
    "key": "super-admin",
    "fileCount": 2,
    "kitFiles": 0,
    "components": [
      "AlertPreferencesModal",
      "UserActivityDrawer"
    ]
  },
  {
    "key": "suppliers",
    "fileCount": 14,
    "kitFiles": 9,
    "components": [
      "AddressAutocomplete",
      "CatalogsSection",
      "ContactsSection",
      "FactorySection",
      "KoleexMainSuppliers",
      "MediaSection",
      "NegotiationSection",
      "RiskSection",
      "SourcingCommandCenter",
      "SourcingSection",
      "SupplierDetail",
      "SuppliersHeader",
      "SuppliersServerList",
      "TimelineSection"
    ]
  },
  {
    "key": "todo",
    "fileCount": 3,
    "kitFiles": 1,
    "components": [
      "MyWorkStrip",
      "ProductPicker",
      "TaskExtras"
    ]
  },
  {
    "key": "translator",
    "fileCount": 1,
    "kitFiles": 1,
    "components": [
      "TranslatorApp"
    ]
  },
  {
    "key": "ui",
    "fileCount": 28,
    "kitFiles": 14,
    "components": [
      "AppHomeMenu",
      "AppLoadingSkeleton",
      "AutoTranslatedText",
      "BackToTop",
      "BoardSkeleton",
      "ConfirmDialog",
      "ConversationSkeleton",
      "DatePicker",
      "DirectoryListSkeleton",
      "DocumentWorkflowBanner",
      "EditorSkeleton",
      "ErpEyebrow",
      "ErpHairline",
      "ErpKpi",
      "ErpPage",
      "ErpPanel",
      "ErpQuickAction",
      "ErpStageTimeline",
      "ErpStatusDot",
      "ErpTable",
      "FocusBoundary",
      "FocusToggle",
      "IdentitySourceNote",
      "InlineCreateModal",
      "InlineEntityPicker",
      "KpiCard",
      "MobileActionBar",
      "PageHeader",
      "PageNavPopup",
      "PersonName",
      "ProfileCompletenessBar",
      "ReportFilters",
      "ReportFooter",
      "ReportHeader",
      "ReportRow",
      "ReportSection",
      "ReportShell",
      "ReportSubtotal",
      "ReportTable",
      "ReportToolbar",
      "ReportTotal",
      "SmartCreateDrawer",
      "SmartCreatePage",
      "SmartEmpty",
      "SmartEmptyState",
      "SmartField",
      "SmartHelpCard",
      "SmartImpactBadge",
      "SmartInput",
      "SmartSection",
      "SmartSelect",
      "SmartTextarea",
      "TabStrip",
      "TraceabilityPanel",
      "UndoToast",
      "VlIcon",
      "WorkflowRail",
      "WorkspaceSkeleton"
    ]
  },
  {
    "key": "website",
    "fileCount": 1,
    "kitFiles": 0,
    "components": [
      "WebsiteCMS"
    ]
  },
  {
    "key": "workflows",
    "fileCount": 1,
    "kitFiles": 1,
    "components": [
      "FinanceWorkflow",
      "InventoryWorkflow",
      "ProcurementWorkflow",
      "SalesWorkflow",
      "WorkflowsHub"
    ]
  },
  {
    "key": "routes \u00b7 accounts",
    "fileCount": 6,
    "kitFiles": 1,
    "components": [
      "AccountDetailPage",
      "AccountsPage",
      "EditAccountPage",
      "Loading",
      "LoginSecurityPage",
      "NewAccountPage"
    ]
  },
  {
    "key": "routes \u00b7 ai",
    "fileCount": 4,
    "kitFiles": 2,
    "components": [
      "AiKnowledgePage",
      "AiPage",
      "Loading",
      "OrbDemoPage"
    ]
  },
  {
    "key": "routes \u00b7 ai-face-lab",
    "fileCount": 1,
    "kitFiles": 0,
    "components": [
      "AiFaceLabPage"
    ]
  },
  {
    "key": "routes \u00b7 ai-orb-lab",
    "fileCount": 1,
    "kitFiles": 0,
    "components": [
      "AiOrbLab"
    ]
  },
  {
    "key": "routes \u00b7 brands",
    "fileCount": 1,
    "kitFiles": 0,
    "components": [
      "BrandsRedirect"
    ]
  },
  {
    "key": "routes \u00b7 calendar",
    "fileCount": 1,
    "kitFiles": 0,
    "components": [
      "CalendarPage"
    ]
  },
  {
    "key": "routes \u00b7 catalogs",
    "fileCount": 2,
    "kitFiles": 1,
    "components": [
      "CatalogsPage",
      "Loading"
    ]
  },
  {
    "key": "routes \u00b7 categories",
    "fileCount": 1,
    "kitFiles": 0,
    "components": [
      "CategoriesPage"
    ]
  },
  {
    "key": "routes \u00b7 commercial-policy",
    "fileCount": 2,
    "kitFiles": 0,
    "components": [
      "CommercialPolicyPage",
      "MarketProfilePage"
    ]
  },
  {
    "key": "routes \u00b7 contacts",
    "fileCount": 2,
    "kitFiles": 1,
    "components": [
      "ContactsPage",
      "Loading"
    ]
  },
  {
    "key": "routes \u00b7 create",
    "fileCount": 6,
    "kitFiles": 0,
    "components": [
      "Page"
    ]
  },
  {
    "key": "routes \u00b7 crm",
    "fileCount": 2,
    "kitFiles": 2,
    "components": [
      "CrmPage",
      "Loading"
    ]
  },
  {
    "key": "routes \u00b7 customers",
    "fileCount": 3,
    "kitFiles": 2,
    "components": [
      "CustomerProfilePage",
      "CustomersPage",
      "Loading"
    ]
  },
  {
    "key": "routes \u00b7 database",
    "fileCount": 11,
    "kitFiles": 0,
    "components": [
      "ClassificationPage",
      "CollectionDetailPage",
      "CollectionsPage",
      "DatabaseBrandsPage",
      "DatabaseLayout",
      "DatabasePage",
      "DatabaseSpecsAttributesPage",
      "LegacyIssuesRedirect",
      "ReviewBoardPage",
      "UiComponentsPage",
      "VisualLibraryPage"
    ]
  },
  {
    "key": "routes \u00b7 discuss",
    "fileCount": 2,
    "kitFiles": 2,
    "components": [
      "DiscussPage",
      "Loading"
    ]
  },
  {
    "key": "routes \u00b7 divisions",
    "fileCount": 1,
    "kitFiles": 0,
    "components": [
      "DivisionsPage"
    ]
  },
  {
    "key": "routes \u00b7 documents",
    "fileCount": 1,
    "kitFiles": 0,
    "components": [
      "DocumentsPage"
    ]
  },
  {
    "key": "routes \u00b7 employees",
    "fileCount": 5,
    "kitFiles": 1,
    "components": [
      "AddEmployeePage",
      "EditEmployeePage",
      "EmployeeProfilePage",
      "EmployeesLoading",
      "EmployeesPage"
    ]
  },
  {
    "key": "routes \u00b7 executive",
    "fileCount": 1,
    "kitFiles": 0,
    "components": [
      "Page"
    ]
  },
  {
    "key": "routes \u00b7 expenses",
    "fileCount": 1,
    "kitFiles": 0,
    "components": [
      "ExpensesAppPage"
    ]
  },
  {
    "key": "routes \u00b7 finance",
    "fileCount": 30,
    "kitFiles": 0,
    "components": [
      "FinanceAccountingQueuePage",
      "FinanceBankAccountsPage",
      "FinanceBankImportsPage",
      "FinanceCashFlowPage",
      "FinanceCustomersPage",
      "FinanceEquityPage",
      "FinanceExpensesPage",
      "FinanceGeneralLedgerPage",
      "FinanceIntelligencePage",
      "FinanceLoading",
      "FinanceNotificationsPage",
      "FinanceOrdersPage",
      "FinanceOverviewPage",
      "FinancePage",
      "FinancePaymentsPage",
      "FinanceProfitLossPage",
      "FinanceReconciliationPage",
      "FinanceReportsPage",
      "FinanceSetupPage",
      "FinanceStatementsPage",
      "FinanceSuppliersPage",
      "FinanceTreasuryForecastPage",
      "FinanceTreasuryPlansPage",
      "FinanceTrialBalancePage",
      "Page",
      "ReportPrintPage"
    ]
  },
  {
    "key": "routes \u00b7 home",
    "fileCount": 1,
    "kitFiles": 0,
    "components": [
      "Page"
    ]
  },
  {
    "key": "routes \u00b7 hr",
    "fileCount": 1,
    "kitFiles": 0,
    "components": [
      "HRPage"
    ]
  },
  {
    "key": "routes \u00b7 inbox",
    "fileCount": 2,
    "kitFiles": 2,
    "components": [
      "InboxPage",
      "Loading"
    ]
  },
  {
    "key": "routes \u00b7 inventory",
    "fileCount": 14,
    "kitFiles": 1,
    "components": [
      "InventoryBalancesPage",
      "InventoryItemsPage",
      "InventoryLayout",
      "InventoryMovementsPage",
      "InventoryPage",
      "InventorySearchPage",
      "InventoryWarehousesPage",
      "Loading",
      "Page"
    ]
  },
  {
    "key": "routes \u00b7 invoices",
    "fileCount": 3,
    "kitFiles": 1,
    "components": [
      "InvoicePrintPage",
      "InvoicesPage",
      "Loading"
    ]
  },
  {
    "key": "routes \u00b7 issues",
    "fileCount": 1,
    "kitFiles": 1,
    "components": [
      "IssuesPage"
    ]
  },
  {
    "key": "routes \u00b7 kds-lab",
    "fileCount": 2,
    "kitFiles": 1,
    "components": [
      "ElementElection",
      "KdsLab"
    ]
  },
  {
    "key": "routes \u00b7 knowledge",
    "fileCount": 82,
    "kitFiles": 0,
    "components": [
      "AccessControlPage",
      "AgentCreditPage",
      "AgentOverviewPage",
      "ApprovalCommissionPage",
      "ApprovalCreditPage",
      "ApprovalDiamondPage",
      "ApprovalDiscountPage",
      "ApprovalFlowPage",
      "ApprovalFlowsPage",
      "ApprovalLevelsPage",
      "ApprovalOverviewPage",
      "ApprovalSpecialPricePage",
      "BusinessModelPage",
      "CaseStudiesPage",
      "ChannelStructurePage",
      "CommercialFlowOverviewPage",
      "CommercialPolicyLandingPage",
      "CommercialPolicyLayout",
      "CommercialScenariosPage",
      "CommissionCalculationPage",
      "CommissionCalculatorPage",
      "CommissionExamplesPage",
      "CommissionFaqPage",
      "CommissionFlowPage",
      "CommissionOverviewPage",
      "CommissionPolicyPage",
      "CommissionScenariosPage",
      "CommissionVisualsPage",
      "CompetitorsPage",
      "CreditCalculatorPage",
      "CreditCheckFlowPage",
      "CreditDaysPage",
      "CreditExamplesPage",
      "CreditFaqPage",
      "CreditFlowPage",
      "CreditLimitsPage",
      "CreditMatrixPage",
      "CreditOverviewPage",
      "CreditPolicyPage",
      "CreditProfilesPage",
      "CreditUpgradePage",
      "CustomerLevelsPage",
      "CustomerTypesPage",
      "DecisionTreePage",
      "DiscountApprovalPage",
      "DiscountCalculatorPage",
      "DiscountExamplesPage",
      "DiscountFlowPage",
      "DiscountMarginPage",
      "DiscountOverviewPage",
      "DiscountPage",
      "DiscountTypesPage",
      "FxRiskPage",
      "IntroductionPage",
      "KnowledgeLayout",
      "KnowledgePage",
      "LandedCostPage",
      "MarginFlowPage",
      "MarginStrategyPage",
      "MarketBandsPage",
      "OverduePolicyPage",
      "PartnerSystemPage",
      "PriceCalculatorPage",
      "PriceFlowPage",
      "PricingAlgorithmPage",
      "PricingEngineDashboardPage",
      "PricingFlowPage",
      "PricingFormulaPage",
      "PricingGovernancePage",
      "PricingMathPage",
      "PricingOverviewPage",
      "ProductCodingSystemPage",
      "ProductLevelsPage",
      "ProfitAnalysisPage",
      "QuickReferencePage",
      "ScenarioLibraryPage",
      "SettingsPage",
      "SpecialPricingPage",
      "SupplierDataGuidePage",
      "SupplierOnboardingWorkflowPage"
    ]
  },
  {
    "key": "routes \u00b7 landed-cost",
    "fileCount": 4,
    "kitFiles": 1,
    "components": [
      "EditSimulationPage",
      "LandedCostListPage",
      "NewSimulationPage",
      "PrintReportPage"
    ]
  },
  {
    "key": "routes \u00b7 login",
    "fileCount": 1,
    "kitFiles": 0,
    "components": [
      "LoginPage"
    ]
  },
  {
    "key": "routes \u00b7 management",
    "fileCount": 1,
    "kitFiles": 1,
    "components": [
      "ManagementPage"
    ]
  },
  {
    "key": "routes \u00b7 markets",
    "fileCount": 1,
    "kitFiles": 0,
    "components": [
      "MarketsPage"
    ]
  },
  {
    "key": "routes \u00b7 notes",
    "fileCount": 1,
    "kitFiles": 0,
    "components": [
      "NotesPage"
    ]
  },
  {
    "key": "routes \u00b7 operations",
    "fileCount": 1,
    "kitFiles": 0,
    "components": [
      "Page"
    ]
  },
  {
    "key": "routes \u00b7 orb-lab",
    "fileCount": 1,
    "kitFiles": 0,
    "components": [
      "OrbLab"
    ]
  },
  {
    "key": "routes \u00b7 planning",
    "fileCount": 1,
    "kitFiles": 0,
    "components": [
      "PlanningPage"
    ]
  },
  {
    "key": "routes \u00b7 price-calculator",
    "fileCount": 2,
    "kitFiles": 1,
    "components": [
      "PriceCalculatorPage",
      "PricingSettingsPage"
    ]
  },
  {
    "key": "routes \u00b7 product-data",
    "fileCount": 9,
    "kitFiles": 0,
    "components": [
      "DemoLockstitchPage",
      "EditProductDataPage",
      "NewProductDataPage",
      "ProductDataDetailPage",
      "ProductDataLoading",
      "ProductDataPage",
      "ProductDataSettingsPage",
      "ProductPreviewPage",
      "VisualMappingRedirect"
    ]
  },
  {
    "key": "routes \u00b7 products",
    "fileCount": 10,
    "kitFiles": 1,
    "components": [
      "EditProductPage",
      "LegacyProductView",
      "Loading",
      "NewProductPage",
      "OgImage",
      "ProductDetailPage",
      "ProductSettingsPage",
      "ProductsLoading",
      "ProductsPage",
      "PublicProductPage"
    ]
  },
  {
    "key": "routes \u00b7 projects",
    "fileCount": 1,
    "kitFiles": 0,
    "components": [
      "ProjectsPage"
    ]
  },
  {
    "key": "routes \u00b7 purchase",
    "fileCount": 16,
    "kitFiles": 1,
    "components": [
      "Loading",
      "PurchaseLayout",
      "PurchasePageRoute",
      "PurchaseRoute"
    ]
  },
  {
    "key": "routes \u00b7 qa",
    "fileCount": 3,
    "kitFiles": 0,
    "components": [
      "MyIssuesPage",
      "QaRedirect",
      "ReporterIssuePage"
    ]
  },
  {
    "key": "routes \u00b7 quotations",
    "fileCount": 5,
    "kitFiles": 1,
    "components": [
      "Loading",
      "PreorderPage",
      "QuotationDetailPage",
      "QuotationPrintPage",
      "QuotationsPage"
    ]
  },
  {
    "key": "routes \u00b7 reports",
    "fileCount": 2,
    "kitFiles": 0,
    "components": [
      "Page"
    ]
  },
  {
    "key": "routes \u00b7 roles",
    "fileCount": 1,
    "kitFiles": 1,
    "components": [
      "RolesPage"
    ]
  },
  {
    "key": "routes \u00b7 root",
    "fileCount": 5,
    "kitFiles": 2,
    "components": [
      "HomePage",
      "Loading",
      "NotFound",
      "Providers",
      "RootLayout"
    ]
  },
  {
    "key": "routes \u00b7 sales",
    "fileCount": 4,
    "kitFiles": 1,
    "components": [
      "Loading",
      "SalesOrderDetailPage",
      "SalesOrdersPage",
      "SalesPage"
    ]
  },
  {
    "key": "routes \u00b7 settings",
    "fileCount": 3,
    "kitFiles": 3,
    "components": [
      "Loading",
      "NotificationsSettingsPage",
      "SettingsPage"
    ]
  },
  {
    "key": "routes \u00b7 software-center",
    "fileCount": 1,
    "kitFiles": 1,
    "components": [
      "SoftwareCenterPage"
    ]
  },
  {
    "key": "routes \u00b7 subcategories",
    "fileCount": 1,
    "kitFiles": 0,
    "components": [
      "SubcategoriesPage"
    ]
  },
  {
    "key": "routes \u00b7 super-admin",
    "fileCount": 1,
    "kitFiles": 1,
    "components": [
      "SuperAdminActivityPage"
    ]
  },
  {
    "key": "routes \u00b7 suppliers",
    "fileCount": 5,
    "kitFiles": 2,
    "components": [
      "KoleexMainSuppliersPage",
      "Loading",
      "SourcingCommandCenterPage",
      "SupplierDetailPage",
      "SuppliersPage"
    ]
  },
  {
    "key": "routes \u00b7 todo",
    "fileCount": 2,
    "kitFiles": 2,
    "components": [
      "TodoPage",
      "TodoReportPage"
    ]
  },
  {
    "key": "routes \u00b7 translator",
    "fileCount": 1,
    "kitFiles": 0,
    "components": [
      "TranslatorPage"
    ]
  },
  {
    "key": "routes \u00b7 website",
    "fileCount": 1,
    "kitFiles": 0,
    "components": [
      "WebsitePage"
    ]
  },
  {
    "key": "routes \u00b7 workflows",
    "fileCount": 5,
    "kitFiles": 0,
    "components": [
      "Page",
      "WorkflowsPage"
    ]
  }
];
