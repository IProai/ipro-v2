# STITCH SCREEN INDEX — IProCore UI Source of Truth
Project ID: 8591312144234256806
Total screens: 42 (each has a `.png` screenshot + `.html` code file)

## Usage Rule (SKILL 03)
These files are the source of truth for all UI implementation.
- **PNGs** → visual reference for layout, color, typography
- **HTMLs** → extract design tokens, component structure, CSS variables

---

## Screen Inventory

| # | File Basename | Title | Phase | Route(s) |
|---|--------------|-------|-------|----------|
| 3 | `Premium_Ecosystem_Dashboard_Home_1` | Premium Ecosystem Dashboard Home | P02 | /console/dashboard |
| 4 | `Visual_Playbook_Workflow_Editor_1` | Visual Playbook Workflow Editor | P05 | /console/ai/playbooks |
| 5 | `Ecosystem_Provisioned_Successfully_1` | Ecosystem Provisioned Successfully | P02 | /console/onboarding |
| 6 | `Developer_Console_Overview_1` | Developer Console Overview | P01 | /console/dev/overview |
| 7 | `Permissions_Role_Simulator` | Permissions & Role Simulator | P03 | /console/security/role-simulator |
| 8 | `Arabic_Premium_Ecosystem_Hub_RTL_1` | Arabic Premium Ecosystem Hub (RTL) | P02 | /console/dashboard |
| 9 | `Live_Workflow_Simulation_Debugger` | Live Workflow Simulation & Debugger | P04 | /console/jad/health |
| 10 | `Arabic_Premium_Ecosystem_Hub_RTL_2` | Arabic Premium Ecosystem Hub (RTL) | P02 | /console/dashboard |
| 11 | `Jad_Connector_Marketplace_Hub` | Jad-Connector Marketplace Hub | P04 | /console/jad/marketplace |
| 12 | `Premium_Ecosystem_Dashboard_Home_2` | Premium Ecosystem Dashboard Home | P02 | /console/dashboard |
| 13 | `Ecosystem_Onboarding_Discovery` | Ecosystem Onboarding Discovery | P02 | /console/onboarding |
| 14 | `Owner_Control_Tower_Home_1` | Owner Control Tower Home | P02 | /console/control-tower |
| 15 | `Mobile_Owner_Control_Tower` | Mobile Owner Control Tower | P02 | /console/control-tower (mobile) |
| 16 | `Engine_Settings_Drawer_Dark_Mode` | Engine Settings Drawer (Dark Mode) | P04 | /console/jad/connectors/:id |
| 17 | `Premium_Ecosystem_Dashboard_Home_3` | Premium Ecosystem Dashboard Home | P02 | /console/dashboard |
| 18 | `Engine_Settings_Drawer_Bright_1` | Engine Settings Drawer (Bright) | P04 | /console/jad/connectors/:id |
| 19 | `Mobile_Audit_Compliance_Log` | Mobile Audit & Compliance Log | P01 | /console/security/audit-log |
| 20 | `Visual_Playbook_Workflow_Editor_2` | Visual Playbook Workflow Editor | P05 | /console/ai/playbooks |
| 21 | `End_Client_Dashboard_RTL` | End-Client Dashboard (RTL) | P02 | /console/dashboard |
| 22 | `Brand_Themed_2FA_Verification` | Brand-Themed 2FA Verification | P01 | /2fa |
| 23 | `Mobile_Engine_Registry` | Mobile Engine Registry | P04 | /console/jad/marketplace (mobile) |
| 24 | `Engine_Registry_Marketplace_1` | Engine Registry Marketplace | P04 | /console/jad/marketplace |
| 25 | `Playbook_Blueprint_Registry` | Playbook Blueprint Registry | P05 | /console/ai/playbooks |
| 26 | `Jad_Connector_Integrations_Hub` | Jad-Connector Integrations Hub | P04 | /console/jad/integrations |
| 27 | `Tenant_Provisioning_Wizard_Standardized` | Tenant Provisioning Wizard (Standardized) | P02 | /console/onboarding/setup-wizard |
| 28 | `Ecosystem_Provisioned_Successfully_2` | Ecosystem Provisioned Successfully | P02 | /console/onboarding |
| 29 | `IPRO_Brand_Guidelines_Hub` | IPR-O Brand Guidelines Hub | Design | design/tokens/ |
| 30 | `Standardized_Dark_Control_Hub` | Standardized Dark Control Hub | P02 | /console/control-tower |
| 31 | `Arabic_Premium_Ecosystem_Hub_RTL_3` | Arabic Premium Ecosystem Hub (RTL) | P02 | /console/dashboard |
| 32 | `Luxury_Command_Hub_Variant` | Luxury Command Hub Variant | P02 | /console/dashboard |
| 33 | `Provisioning_Engine_Selection_View` | Provisioning: Engine Selection View | P02 | /console/onboarding/setup-wizard |
| 34 | `Connector_Detail_Activation_View` | Connector Detail & Activation View | P04 | /console/jad/activations/:id |
| 35 | `Developer_Console_Overview_2` | Developer Console Overview | P01 | /console/dev/overview |
| 36 | `IPRO_Unified_UI_Kit_Library` | IPR-O Unified UI Kit Library | Design | packages/design-system/ |
| 37 | `Engine_Registry_Marketplace_2` | Engine Registry Marketplace | P04 | /console/jad/marketplace |
| 38 | `Unified_Design_System_Tokens` | Unified Design System & Tokens | Design | design/tokens/ |
| 39 | `Ecosystem_Provisioned_Successfully_3` | Ecosystem Provisioned Successfully | P02 | /console/onboarding |
| 40 | `Brand_Themed_Secure_Login` | Brand-Themed Secure Login | P01 | /login |
| 41 | `Engine_Settings_Drawer_Bright_2` | Engine Settings Drawer (Bright) | P04 | /console/jad/connectors/:id |
| 42 | `Owner_Control_Tower_Home_2` | Owner Control Tower Home | P02 | /console/control-tower |
| 43 | `Customer_Service_Command_Desk` | Customer Service Command Desk | P02 | /console/help/tickets |
| 44 | `Tenant_Provisioning_Wizard_Pro` | Tenant Provisioning Wizard Pro | P02 | /console/onboarding/setup-wizard |

---

## Key Design Screens (start here)
1. `IPRO_Brand_Guidelines_Hub` — brand colors, typography, spacing scale
2. `Unified_Design_System_Tokens` — full token system
3. `IPRO_Unified_UI_Kit_Library` — all reusable UI components
4. `Brand_Themed_Secure_Login` — login page reference (Phase 01 priority)
5. `Premium_Ecosystem_Dashboard_Home_1` — dashboard reference (Phase 02 priority)
